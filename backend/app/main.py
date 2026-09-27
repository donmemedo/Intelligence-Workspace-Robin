"""Robin Iran API: rooms, bookings, presence check-in, analytics. Single file on stdlib sqlite3."""
import os
import sqlite3
import threading
from collections import defaultdict
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, time, timedelta
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

from . import seed
from .seed import TZ, iran_weekday, iso

EQUIPMENT = {"video", "tv", "whiteboard", "phone", "projector"}
HOURS = range(8, 20)  # analytics window 08:00–20:00 (heatmap hours 8..19)
NO_SHOW_AFTER = timedelta(minutes=10)
LIVE = ("upcoming", "active")
SCHEMA = """
CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name_fa TEXT, name_en TEXT, floor INT, capacity INT,
  kind TEXT, equipment TEXT, x REAL, y REAL, w REAL, h REAL);
CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id),
  title TEXT, organizer TEXT, start TEXT, end TEXT, source TEXT, checked_in INT DEFAULT 0,
  status TEXT DEFAULT 'upcoming', sim_show INT);
CREATE INDEX IF NOT EXISTS ix_bookings_room_start ON bookings(room_id, start);
"""
INSERT = ("INSERT INTO bookings (room_id, title, organizer, start, end, source, checked_in, sim_show) "
          "VALUES (?,?,?,?,?,?,?,?)")

# ponytail: one connection behind a global lock; fine for a demo/pilot, use a pool/Postgres at real scale.
LOCK = threading.Lock()
conn: sqlite3.Connection | None = None


def now():
    return datetime.now(TZ).replace(microsecond=0)


def midnight(d):
    return datetime.combine(d, time(0), TZ)


def init_db():
    global conn
    data_dir = os.environ.get("DATA_DIR", "./data")
    os.makedirs(data_dir, exist_ok=True)
    conn = sqlite3.connect(os.path.join(data_dir, "robin.db"), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    if not conn.execute("SELECT 1 FROM rooms LIMIT 1").fetchone():
        conn.executemany("INSERT INTO rooms VALUES (?,?,?,?,?,?,?,?,?,?,?)", [r[:11] for r in seed.ROOMS])
        conn.executemany(INSERT, seed.history(now()))
    conn.commit()


def refresh(c, t):
    """Lazy maintenance: top up the live demo schedule, simulate arrivals, then no_show / ended / active."""
    n = iso(t)
    if not c.execute("SELECT 1 FROM bookings WHERE sim_show IS NOT NULL AND end > ? LIMIT 1", (n,)).fetchone():
        last = {r[0]: r[1] for r in c.execute("SELECT room_id, MAX(end) FROM bookings WHERE end > ? GROUP BY room_id",
                                               (iso(t - timedelta(hours=3)),))}
        c.executemany(INSERT, seed.live(t, last))
    # ponytail: simulated occupancy sensor — seeded attendees "arrive" at start; real beacons replace this.
    c.execute("UPDATE bookings SET checked_in=1 WHERE sim_show=1 AND checked_in=0 AND start<=? AND status IN (?,?)",
              (n, *LIVE))
    c.execute("UPDATE bookings SET status='no_show' WHERE status IN (?,?) AND checked_in=0 AND source='manual' "
              "AND start<=?", (*LIVE, iso(t - NO_SHOW_AFTER)))
    c.execute("UPDATE bookings SET status='ended' WHERE status IN (?,?) AND end<=?", (*LIVE, n))
    c.execute("UPDATE bookings SET status='active' WHERE status='upcoming' AND start<=?", (n,))


@contextmanager
def tx():
    with LOCK:
        t = now()
        try:
            refresh(conn, t)
            yield conn, t
            conn.commit()
        except BaseException:
            conn.rollback()
            raise


def booking(r):
    return {k: r[k] for k in ("id", "room_id", "title", "organizer", "start", "end", "source", "status")} | {
        "checked_in": bool(r["checked_in"])}


def get_booking(c, bid):
    return booking(c.execute("SELECT * FROM bookings WHERE id=?", (bid,)).fetchone())


def rooms_view(c, t, room_id=None):
    tomorrow = iso(midnight(t.date() + timedelta(days=1)))
    by_room = defaultdict(list)
    for b in c.execute("SELECT * FROM bookings WHERE status IN (?,?) AND start < ? ORDER BY start", (*LIVE, tomorrow)):
        by_room[b["room_id"]].append(b)
    q, args = ("SELECT * FROM rooms WHERE id=?", (room_id,)) if room_id else ("SELECT * FROM rooms ORDER BY floor, id", ())
    out, soon = [], iso(t + timedelta(minutes=15))
    for r in c.execute(q, args):
        bs = by_room[r["id"]]
        cur = next((b for b in bs if b["status"] == "active"), None)
        nxt = next((b for b in bs if b["status"] == "upcoming"), None)
        status = "busy" if cur else "soon" if nxt and nxt["start"] <= soon else "free"
        people = min(r["capacity"], 1 + (cur["id"] * 7) % r["capacity"]) if cur and cur["checked_in"] else 0
        out.append({
            "id": r["id"], "name": {"fa": r["name_fa"], "en": r["name_en"]}, "floor": r["floor"],
            "capacity": r["capacity"], "kind": r["kind"], "equipment": r["equipment"].split(","),
            "x": r["x"], "y": r["y"], "w": r["w"], "h": r["h"], "status": status, "people": people,
            "current": booking(cur) if cur else None, "next": booking(nxt) if nxt else None,
            "free_until": nxt["start"] if nxt and not cur else None,
        })
    return out


def overlaps(c, room_id, start, end):
    return c.execute("SELECT 1 FROM bookings WHERE room_id=? AND status NOT IN ('released','no_show') "
                     "AND start < ? AND end > ? LIMIT 1", (room_id, end, start)).fetchone() is not None


def require_room(c, room_id):
    if not c.execute("SELECT 1 FROM rooms WHERE id=?", (room_id,)).fetchone():
        raise HTTPException(404, "Room not found")


@asynccontextmanager
async def lifespan(_):
    init_db()
    yield
    conn.close()


app = FastAPI(title="Robin Iran API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/rooms")
def list_rooms(floor: int | None = Query(None, ge=1, le=3), min_capacity: int | None = Query(None, ge=1),
               equipment: str | None = None, status: Literal["free", "busy", "soon"] | None = None):
    need = {e.strip() for e in equipment.split(",") if e.strip()} if equipment else set()
    if need - EQUIPMENT:
        raise HTTPException(422, f"Unknown equipment: {', '.join(sorted(need - EQUIPMENT))}")
    with tx() as (c, t):
        rooms = rooms_view(c, t)
    return [r for r in rooms if (floor is None or r["floor"] == floor)
            and (min_capacity is None or r["capacity"] >= min_capacity)
            and need <= set(r["equipment"]) and (status is None or r["status"] == status)]


@app.get("/api/rooms/{room_id}")
def get_room(room_id: str):
    with tx() as (c, t):
        rooms = rooms_view(c, t, room_id)
        if not rooms:
            raise HTTPException(404, "Room not found")
        today = c.execute("SELECT * FROM bookings WHERE room_id=? AND start >= ? AND start < ? ORDER BY start",
                          (room_id, iso(midnight(t.date())), iso(midnight(t.date() + timedelta(days=1))))).fetchall()
    return rooms[0] | {"today": [booking(b) for b in today]}


@app.get("/api/summary")
def summary():
    with tx() as (c, t):
        rooms = rooms_view(c, t)
        day = (iso(midnight(t.date())), iso(midnight(t.date() + timedelta(days=1))))
        rows = c.execute("SELECT source, status FROM bookings WHERE start >= ? AND start < ?", day).fetchall()
    free = [r for r in rooms if r["status"] != "busy"]
    auto = sum(r["source"] != "manual" for r in rows)
    no_shows = sum(r["status"] == "no_show" for r in rows)
    return {
        "rooms_total": len(rooms), "rooms_free": len(free),
        "occupancy_pct": round(100 * (len(rooms) - len(free)) / len(rooms), 1) if rooms else 0,
        "meetings_today": sum(r["status"] != "no_show" for r in rows), "auto_booked_today": auto,
        "no_shows_today": no_shows, "minutes_saved_today": minutes_saved(auto, no_shows),
        "floors": [{"floor": f, "total": sum(r["floor"] == f for r in rooms),
                    "free": sum(r["floor"] == f for r in free)} for f in sorted({r["floor"] for r in rooms})],
    }


def minutes_saved(auto, no_shows):
    # ponytail: heuristic — a walk-in auto-booking saves ~10 min of room hunting, a released no-show ~15 min for
    # the next team (research: ~30 min/day lost finding rooms). Replace with measured search time when available.
    return auto * 10 + no_shows * 15


class BookingIn(BaseModel):
    room_id: str = Field(min_length=1, max_length=64)
    title: str = Field(max_length=120)
    organizer: str = Field("", max_length=80)
    start: datetime
    end: datetime

    @field_validator("title", "organizer")
    @classmethod
    def strip(cls, v):
        return v.strip()

    @field_validator("start", "end")
    @classmethod
    def tehran(cls, v):
        return (v.replace(tzinfo=TZ) if v.tzinfo is None else v.astimezone(TZ)).replace(microsecond=0)

    @model_validator(mode="after")
    def check(self):
        if not self.title:
            raise ValueError("title must not be empty")
        if self.end <= self.start:
            raise ValueError("end must be after start")
        if self.end - self.start > timedelta(hours=8):
            raise ValueError("booking cannot exceed 8 hours")
        return self


class CheckinIn(BaseModel):
    method: Literal["beacon", "qr", "nfc"]


@app.post("/api/bookings", status_code=201)
def create_booking(b: BookingIn):
    with tx() as (c, t):
        require_room(c, b.room_id)
        if b.end <= t:
            raise HTTPException(422, "Booking must end in the future")
        s, e = iso(b.start), iso(b.end)
        if overlaps(c, b.room_id, s, e):
            raise HTTPException(409, "Room is already booked for that time")
        bid = c.execute("INSERT INTO bookings (room_id, title, organizer, start, end, source) VALUES (?,?,?,?,?,?)",
                        (b.room_id, b.title, b.organizer, s, e, "manual")).lastrowid
        refresh(c, t)  # sets active if it already started
        return get_booking(c, bid)


@app.delete("/api/bookings/{bid}", status_code=204)
def delete_booking(bid: int):
    with tx() as (c, _):
        if not c.execute("DELETE FROM bookings WHERE id=?", (bid,)).rowcount:
            raise HTTPException(404, "Booking not found")
    return Response(status_code=204)


@app.post("/api/rooms/{room_id}/checkin")
def checkin(room_id: str, body: CheckinIn):
    with tx() as (c, t):
        require_room(c, room_id)
        room = rooms_view(c, t, room_id)[0]
        cur = room["current"]
        if cur:
            if cur["checked_in"]:
                raise HTTPException(409, "Room is in use and already checked in")
            c.execute("UPDATE bookings SET checked_in=1 WHERE id=?", (cur["id"],))
            return {"action": "checked_in", "booking": get_booking(c, cur["id"])}
        end = t + timedelta(minutes=30)
        if room["next"]:
            nxt = datetime.fromisoformat(room["next"]["start"])
            if nxt - t < timedelta(minutes=10):
                raise HTTPException(409, "Next booking starts in less than 10 minutes")
            end = min(end, nxt)
        bid = c.execute("INSERT INTO bookings (room_id, title, organizer, start, end, source, checked_in, status) "
                        "VALUES (?,?,?,?,?,?,1,'active')",
                        (room_id, "Spontaneous meeting", "", iso(t), iso(end), body.method)).lastrowid
        return {"action": "auto_booked", "booking": get_booking(c, bid)}


@app.post("/api/rooms/{room_id}/release")
def release(room_id: str):
    with tx() as (c, t):
        require_room(c, room_id)
        cur = c.execute("SELECT id FROM bookings WHERE room_id=? AND status='active' ORDER BY start LIMIT 1",
                        (room_id,)).fetchone()
        if not cur:
            raise HTTPException(404, "No active booking in this room")
        c.execute("UPDATE bookings SET status='released', end=? WHERE id=?", (iso(t), cur["id"]))
        return get_booking(c, cur["id"])


@app.get("/api/analytics")
def analytics(days: int = 7):
    if days not in (7, 14, 30):
        raise HTTPException(422, "days must be 7, 14 or 30")
    with tx() as (c, t):
        first = t.date() - timedelta(days=days - 1)
        rooms = c.execute("SELECT id, name_fa, name_en, floor, capacity FROM rooms ORDER BY id").fetchall()
        rows = c.execute("SELECT room_id, start, end, source, status FROM bookings WHERE start >= ? AND start <= ? "
                         "AND status IN ('ended','active','released','no_show')", (iso(midnight(first)), iso(t))).fetchall()
    dates = [first + timedelta(days=i) for i in range(days)]
    workdays = sum(iran_weekday(d) != 6 for d in dates) or 1
    slot = len(HOURS) * 60  # room-minutes available per day
    by_hour, by_day, by_room = defaultdict(float), defaultdict(float), defaultdict(float)
    count_day, room_n, room_ns = defaultdict(int), defaultdict(int), defaultdict(int)
    held_minutes, auto, no_shows = [], 0, 0
    for r in rows:
        s, e = datetime.fromisoformat(r["start"]), min(datetime.fromisoformat(r["end"]), t)
        count_day[s.date()] += 1
        room_n[r["room_id"]] += 1
        auto += r["source"] != "manual"
        if r["status"] == "no_show":
            no_shows += 1
            room_ns[r["room_id"]] += 1
            continue
        held_minutes.append((e - s).total_seconds() / 60)
        h = s.replace(minute=0, second=0)
        while h < e:  # split into hour buckets inside the analytics window
            m = (min(e, h + timedelta(hours=1)) - max(s, h)).total_seconds() / 60
            if h.hour in HOURS:
                by_hour[iran_weekday(h.date()), h.hour] += m
                by_day[h.date()] += m
                by_room[r["room_id"]] += m
            h += timedelta(hours=1)
    n_rooms, total = len(rooms) or 1, len(rows) or 1
    pct = lambda a, b: round(min(100.0, 100 * a / b), 1) if b else 0.0
    per_room = sorted(({"id": r["id"], "name": {"fa": r["name_fa"], "en": r["name_en"]}, "floor": r["floor"],
                        "capacity": r["capacity"], "utilization_pct": pct(by_room[r["id"]], workdays * slot),
                        "bookings": room_n[r["id"]], "no_shows": room_ns[r["id"]]} for r in rooms),
                      key=lambda x: -x["utilization_pct"])
    wd_count = defaultdict(int)
    for d in dates:
        wd_count[iran_weekday(d)] += 1
    return {
        "range_days": days,
        "utilization_pct": pct(sum(by_day.values()), n_rooms * workdays * slot),
        "no_show_rate_pct": pct(no_shows, total), "auto_booked_pct": pct(auto, total),
        "avg_meeting_minutes": round(sum(held_minutes) / len(held_minutes), 1) if held_minutes else 0,
        "hours_saved": round(minutes_saved(auto, no_shows) / 60, 1),
        "rooms": per_room,
        "heatmap": [{"weekday": w, "hour": hr, "pct": pct(by_hour[w, hr], n_rooms * 60 * wd_count[w])}
                    for w in range(7) for hr in HOURS],
        "daily": [{"date": d.isoformat(), "bookings": count_day[d], "utilization_pct": pct(by_day[d], n_rooms * slot)}
                  for d in dates],
        "underused": [r["id"] for r in per_room if r["utilization_pct"] < 20],
    }
