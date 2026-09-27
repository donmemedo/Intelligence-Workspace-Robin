import os
import tempfile
from datetime import datetime, timedelta

os.environ["DATA_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from app.main import TZ, app  # noqa: E402


def test_flow():
    with TestClient(app) as c:
        assert c.get("/api/health").json() == {"ok": True}
        rooms = c.get("/api/rooms").json()
        assert len(rooms) >= 12 and {r["status"] for r in rooms} <= {"free", "busy", "soon"}
        assert all(r["capacity"] >= 6 for r in c.get("/api/rooms?min_capacity=6").json())
        assert c.get("/api/rooms?equipment=laser").status_code == 422
        assert c.get("/api/rooms/nope").status_code == 404

        # book a slot far enough ahead that it is free: after the room's last booking today
        room = rooms[0]["id"]
        last = max((b["end"] for b in c.get(f"/api/rooms/{room}").json()["today"]), default=None)
        start = max(datetime.now(TZ), datetime.fromisoformat(last) if last else datetime.now(TZ)) + timedelta(hours=1)
        body = {"room_id": room, "title": "Demo", "organizer": "Test",
                "start": start.isoformat(), "end": (start + timedelta(minutes=30)).isoformat()}
        r = c.post("/api/bookings", json=body)
        assert r.status_code == 201 and r.json()["status"] == "upcoming", r.text
        assert c.post("/api/bookings", json=body).status_code == 409
        assert c.post("/api/bookings", json=body | {"title": "  "}).status_code == 422
        assert c.post("/api/bookings", json=body | {"end": body["start"]}).status_code == 422
        assert c.post("/api/bookings", json=body | {"room_id": "nope"}).status_code == 404
        assert c.delete(f"/api/bookings/{r.json()['id']}").status_code == 204
        assert c.delete(f"/api/bookings/{r.json()['id']}").status_code == 404

        # free room with no booking in the next 10 min -> auto_booked, then release
        free = next(x for x in c.get("/api/rooms?status=free").json()
                    if not x["free_until"] or datetime.fromisoformat(x["free_until"]) - datetime.now(TZ) > timedelta(minutes=11))
        r = c.post(f"/api/rooms/{free['id']}/checkin", json={"method": "beacon"})
        assert r.status_code == 200 and r.json()["action"] == "auto_booked", r.text
        assert r.json()["booking"]["source"] == "beacon" and r.json()["booking"]["checked_in"]
        assert c.get(f"/api/rooms/{free['id']}").json()["status"] == "busy"
        assert c.post(f"/api/rooms/{free['id']}/checkin", json={"method": "qr"}).status_code == 409
        assert c.post(f"/api/rooms/{free['id']}/release").json()["status"] == "released"
        assert c.post(f"/api/rooms/{free['id']}/release").status_code == 404
        assert c.post(f"/api/rooms/{free['id']}/checkin", json={"method": "wifi"}).status_code == 422

        s = c.get("/api/summary").json()
        assert s["rooms_total"] == len(rooms) and s["auto_booked_today"] >= 1

        a = c.get("/api/analytics?days=7").json()
        assert a["range_days"] == 7 and len(a["daily"]) == 7 and len(a["heatmap"]) == 7 * 12
        assert a["rooms"] == sorted(a["rooms"], key=lambda x: -x["utilization_pct"])
        assert 0 < a["utilization_pct"] <= 100 and a["underused"]
        assert c.get("/api/analytics?days=5").status_code == 422
