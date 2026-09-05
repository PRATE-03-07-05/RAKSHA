# RAKSHA

RAKSHA is an AI-enabled integrated healthcare access and care-coordination platform for rural and underserved communities.

The repository is governed by the Codex control documents in [docs](docs). Those documents describe the intended product, the current implementation state, test status, decisions, known issues, and the next implementation session.

## Current State

Sessions 01 through 07 initialize the repository, database, backend security, workflow, AI decision-support, Flutter mobile foundation, and React web dashboard foundation:

- Project documentation control files under `docs/`
- Minimal FastAPI backend package
- `/health` endpoint
- Docker Compose definition for a local PostgreSQL service
- SQLAlchemy database metadata and Alembic migration environment
- Initial normalized PostgreSQL migration
- Clearly labeled synthetic demo seed data
- Password hashing, signed bearer tokens, and server-side RBAC dependencies
- Auth endpoints: `POST /auth/login`, `GET /auth/me`, and admin-only `GET /users`
- Workflow transition service for referrals, appointments, follow-ups, and care plans
- Respiratory risk triage endpoint: `POST /triage/respiratory-risk`
- Flutter patient/frontline app under `mobile/`
- React doctor/facility/admin dashboard under `web/`
- Unit tests covering health, database metadata, migration contents, seed data, auth, RBAC, API errors, workflow transitions, AI triage safety contracts, mobile workflow states, and web dashboard workflows

Clinical workflow APIs beyond respiratory triage, durable offline sync behavior, notifications, and interoperability mappings are planned but not implemented yet.

The respiratory triage baseline is clinical decision support only. It is not clinically validated and always requires human review.

## Local Verification

```powershell
python -m unittest discover backend/tests
```

Offline Alembic SQL rendering:

```powershell
python -m alembic -c backend\alembic.ini upgrade head --sql
```

Flutter mobile verification:

```powershell
cd mobile
flutter test
flutter analyze
```

React web dashboard verification:

```powershell
cd web
npm test
npm run lint
npm run build
```

## Run Backend

```powershell
python -m uvicorn backend.app.main:app --reload
```

The API health check is available at `http://127.0.0.1:8000/health`.

Authenticated routes require `RAKSHA_TOKEN_SECRET` to be set in the environment before issuing or validating bearer tokens.

## Run Web Dashboard

```powershell
cd web
npm run dev -- --host 127.0.0.1 --port 5173
```

The web dashboard is available at `http://127.0.0.1:5173/` when the Vite development server is running.
# RAKSHA
