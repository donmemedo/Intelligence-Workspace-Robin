# Robin Iran · رابین ایران

Workspace intelligence for Iranian offices: rooms book themselves when people walk in (BLE beacon / QR / NFC check-in), unattended bookings release after 10 minutes, a live floor map shows free rooms, and analytics report real utilization. Presence is detected, never identity. Bilingual (fa/en, RTL/LTR), light/dark, responsive.

- `backend/`: FastAPI + SQLite, seeded demo data (Asia/Tehran, Saturday–Wednesday week)
- `frontend/`: Next.js, proxies `/api/*` to the backend

## Run with Docker

```sh
docker compose up --build -d
```

- App: http://localhost:3210
- API: http://localhost:8200/api/health (docs at `/docs`)

Data lives in the `robin-data` volume. `docker compose down -v` resets it.

## Local development

```sh
# backend (http://localhost:8200)
cd backend && python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8200
pytest

# frontend (http://localhost:3201), proxies /api to localhost:8200
cd frontend && npm install && npm run dev -- -p 3201
```

Set `BACKEND_URL` before `npm run build` / `npm run dev` to point the proxy elsewhere; Next bakes rewrites in at build time.
