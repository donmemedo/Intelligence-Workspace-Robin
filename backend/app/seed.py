"""Demo data: rooms, 30 days of history, and a live schedule around the current clock."""
import random
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Tehran")

# id, fa, en, floor, capacity, kind, equipment, x, y, w, h, popularity (0..1.2; low = underused)
ROOMS = [
    ("sepidar", "سپیدار", "Sepidar", 1, 8, "meeting", "video,tv,whiteboard", 2, 2, 30, 18, 1.1),
    ("alborz", "البرز", "Alborz", 1, 20, "board", "video,tv,projector,whiteboard", 36, 2, 38, 20, 0.5),
    ("kaj", "کاج", "Kaj", 1, 2, "phone", "phone", 78, 2, 10, 10, 1.0),
    ("narvan", "نارون", "Narvan", 1, 2, "phone", "phone", 78, 14, 10, 10, 0.8),
    ("khazar", "خزر", "Khazar", 1, 4, "focus", "tv,whiteboard", 2, 38, 24, 20, 0.9),
    ("pars", "پارس", "Pars", 1, 10, "meeting", "video,tv", 60, 38, 36, 20, 1.0),
    ("damavand", "دماوند", "Damavand", 2, 12, "meeting", "video,tv,whiteboard", 2, 2, 34, 20, 1.2),
    ("zagros", "زاگرس", "Zagros", 2, 6, "meeting", "tv,whiteboard", 40, 2, 24, 18, 0.9),
    ("anahita", "آناهیتا", "Anahita", 2, 3, "focus", "whiteboard", 68, 2, 14, 14, 0.7),
    ("tisfun", "تیسفون", "Tisfun", 2, 16, "board", "video,projector,whiteboard", 2, 38, 44, 20, 0.12),
    ("sahand", "سهند", "Sahand", 2, 4, "focus", "tv", 52, 40, 20, 18, 0.8),
    ("hirmand", "هیرمند", "Hirmand", 3, 8, "meeting", "video,tv", 2, 2, 28, 18, 1.0),
    ("arvand", "اروند", "Arvand", 3, 2, "phone", "phone", 34, 2, 10, 10, 0.15),
    ("bisotun", "بیستون", "Bisotun", 3, 6, "meeting", "tv,whiteboard", 60, 2, 26, 18, 0.9),
    ("karun", "کارون", "Karun", 3, 10, "meeting", "video,projector", 2, 40, 36, 18, 0.7),
]

TITLES = ["جلسه هفتگی تیم محصول", "بررسی اسپرینت", "مصاحبه استخدامی", "جلسه با مشتری", "برنامه‌ریزی فصلی",
          "هم‌اندیشی طراحی", "گزارش مالی", "تماس با تأمین‌کننده", "آموزش داخلی", "جلسه دونفره", "بازبینی کد"]
PEOPLE = ["سارا احمدی", "علی رضایی", "مریم حسینی", "رضا کریمی", "نگار موسوی", "امیر محمدی", "لیلا جعفری", "حمید صادقی"]
WEEKDAY_LOAD = (1, 1, 1, 1, 1, 0.35, 0)  # Sat..Fri


def iso(dt):
    return dt.astimezone(TZ).isoformat(timespec="seconds")


def iran_weekday(d):  # 0 = Saturday … 6 = Friday
    return (d.weekday() + 2) % 7


def _slots(rng, kind, t, stop, prob):
    step = timedelta(minutes=15 if kind == "phone" else 30)
    while t < stop:
        if rng.random() < prob(t):
            end = t + timedelta(minutes=rng.choice((15, 30) if kind == "phone" else (30, 45, 60, 60, 90)))
            if end > stop:
                return
            yield t, end
            t = end + timedelta(minutes=rng.choice((0, 15, 30, 45)))
        else:
            t += step


def _row(rng, room_id, s, e, now):
    """(room_id, title, organizer, start, end, source, checked_in, sim_show). Auto-booking only happens in the past."""
    if s <= now and rng.random() < 0.3:
        return (room_id, "Spontaneous meeting", "", iso(s), iso(e), rng.choice(("beacon", "qr", "nfc")), 1, 1)
    show = int(rng.random() >= 0.15)
    return (room_id, rng.choice(TITLES), rng.choice(PEOPLE), iso(s), iso(e), "manual", 0, show)


def history(now, days=30):
    for back in range(1, days + 1):
        d = now.date() - timedelta(days=back)
        load = WEEKDAY_LOAD[iran_weekday(d)]
        if not load:
            continue
        for r in ROOMS:
            rng = random.Random(f"{d}{r[0]}")
            prob = lambda t, f=r[11]: (0.75 if t.hour in (10, 11, 14, 15) else 0.3) * load * f
            start, stop = datetime.combine(d, time(8), TZ), datetime.combine(d, time(19), TZ)
            for s, e in _slots(rng, r[5], start, stop, prob):
                yield _row(rng, r[0], s, e, now)


def live(now, last_end):
    """Schedule from ~3h before to 8h after now, whatever the hour, so the live view always has free/busy/soon rooms."""
    t0 = (now - timedelta(hours=3)).replace(minute=(now.minute // 15) * 15, second=0, microsecond=0)
    for r in ROOMS:
        rng = random.Random(f"live{now.date()}{r[0]}")
        t = max(t0, datetime.fromisoformat(last_end[r[0]])) if r[0] in last_end else t0
        for s, e in _slots(rng, r[5], t, now + timedelta(hours=8), lambda _, f=r[11]: 0.45 * max(f, 0.5)):
            yield _row(rng, r[0], s, e, now)
