# RAKSHA Backend

**Responsive AI-enabled Knowledge & Smart Healthcare Assistance**
*Connecting Rural Healthcare. Closing the Referral Loop.*

FastAPI + PostgreSQL + SQLAlchemy 2 + Alembic. JWT authentication, server-side
RBAC, closed-loop referral lifecycle, transparent rule-based triage,
offline-sync ledger, audit trail, notification outbox.

---

## Quickstart

```bash
# From the repo root — database + backend + migrations + seed, one command:
docker compose up backend

# Or run everything (db + backend + frontend on :5173):
docker compose up --build

# Backend only, locally (Postgres already running):
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # adjust DATABASE_URL / JWT_SECRET
alembic upgrade head            # run migrations
python seed.py                  # deterministic demo data
uvicorn app.main:app --reload   # http://localhost:8000
```

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health: `GET /health`
- Tests: `cd backend && pytest -q` (in-memory SQLite — no Docker needed)

## Demo accounts (password: `raksha123` for all)

| Email | Role |
|---|---|
| `patient@raksha.demo` | PATIENT (Sita Devi, RAK-PAT-2026-00124) |
| `asha@raksha.demo` | ASHA |
| `anm@raksha.demo` | ANM |
| `phc.staff@raksha.demo` | PHC_STAFF |
| `phc.doctor@raksha.demo` | PHC_DOCTOR |
| `chc.doctor@raksha.demo` | CHC_DOCTOR |
| `specialist@raksha.demo` | SPECIALIST (Cardiology) |
| `admin@raksha.demo` | DISTRICT_ADMIN |

---

## API contract (frontend ↔ backend)

All endpoints except `/auth/login` and `/health` require
`Authorization: Bearer <jwt>`. Error shape: `{"detail": "..."}` with proper
4xx/5xx codes (401 unauthenticated, 403 role/consent denied, 404 not found,
409 invalid transition / version conflict, 422 validation).

### Auth
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{"email","password"}` → `{"access_token","token_type","user"}` |
| GET | `/auth/me` | any | current user |

### Patients
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/patients?q=&limit=&offset=` | all | PATIENT role sees only own record; others search by RAKSHA ID / name / phone |
| POST | `/patients` | ASHA, ANM, PHC_STAFF, DISTRICT_ADMIN | issues `RAK-PAT-2026-XXXXX` |
| GET | `/patients/{id}` | consented staff / own patient | audited as `RECORD_VIEW` |
| PATCH | `/patients/{id}` | staff | optimistic `version` → 409 on conflict |
| GET | `/patients/{id}/timeline` | consented staff / own | longitudinal event timeline |

### Records (append-only observations)
| Method | Path | Roles |
|---|---|---|
| GET | `/patients/{id}/records` | consented staff / own |
| POST | `/patients/{id}/visits` | field workers + clinicians |
| POST | `/patients/{id}/vitals` | field workers + clinicians |
| POST | `/patients/{id}/consultations` | clinicians only (creates prescriptions + optional follow-up) |
| POST | `/patients/{id}/diagnostics` | clinicians + PHC_STAFF |
| GET/POST | `/patients/{id}/followups` | field workers + clinicians |
| PATCH | `/followups/{id}/complete` | field workers + clinicians |
| GET | `/followups/all?overdue_only=` | field workers + clinicians + admin |

### Referrals — the closed loop
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/referrals` | field workers + clinicians | starts as `SENT` with 2 history events; destination users notified |
| GET | `/referrals?status=&direction=` | all | scoped by role/facility |
| GET | `/referrals/{id}` | participants + admin | detail incl. event history |
| GET | `/referrals/{id}/history` | participants + admin | immutable transition log |
| POST | `/referrals/{id}/transition` | see matrix | `{"target","notes","outcome"}` |
| POST | `/referrals/{id}/followup` | staff | schedules follow-up, sets `follow_up_date` |
| GET | `/referrals/meta/flow` | any | state machine for UI rendering |

**State machine** — enforcement order is deliberate:
role capability → **403** · invalid transition for an authorized role → **409** ·
right role but wrong facility/referral → **403** · completion without outcome → **422**:

```
CREATED → SENT → ACKNOWLEDGED → ACCEPTED → ARRIVED → IN_CONSULTATION → TREATMENT → COMPLETED
                 (receiving facility only)   (receiving staff            (clinicians of the
                                              or referring ASHA)          destination facility)
CANCELLED reachable from CREATED/SENT/ACKNOWLEDGED/ACCEPTED by creator, source facility or admin.
COMPLETED requires an `outcome` (loop is not closed without a recorded outcome).
```

### Triage (decision support — not diagnosis)
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/triage/assess` | field workers + clinicians | ML model when a trained artifact exists (`mode=ML_MODEL` + `confidence`), transparent rule engine otherwise (`mode=RULE_BASED_FALLBACK`). Returns `risk_level`, `recommended_action`, `red_flags`, `contributing_factors`, disclaimer. With `patient_id`, result is persisted in the record. |
| POST | `/triage/respiratory-risk` | same | compatibility alias |
| GET | `/triage/config` | any | current thresholds (env-configurable) |
| GET | `/triage/model` | any authenticated | active engine status (ML vs rule fallback, model name/version) |

### ML pipeline (prototype decision support)
```bash
cd backend
python -m ml.data.generate --rows 4000 --seed 42   # SYNTHETIC dev dataset (labelled)
python -m ml.training.train --synthetic            # 5-fold stratified CV → joblib artifact
python -m ml.evaluation.evaluate                   # held-out test metrics
```
Artifact: `ml/models/triage_model.joblib` (gitignored). Docker's first boot
trains automatically if absent; any failure transparently falls back to the
rule engine. See `docs/ML_TRIAGE.md` and `docs/ML_VIVA.md`.

### Facilities
| Method | Path | Roles |
|---|---|---|
| GET | `/facilities?district=&type=` | any authenticated |
| GET | `/facilities/{id}` / `/facilities/{id}/resources` | any authenticated |
| PATCH | `/facilities/{id}/resources` | DISTRICT_ADMIN or own-facility staff |
| POST | `/facilities/recommend` | any authenticated — rule-scored destination suggestions with transparent reasons (demo data) |

### Appointments & teleconsultation (metadata only)
`POST/GET /appointments`, `GET/PATCH /appointments/{id}` — patients book/cancel their own; facilities manage status (`SCHEDULED→IN_QUEUE→COMPLETED`, validated).
`POST/GET /teleconsultations`, `PATCH /teleconsultations/{id}/complete` — outcome is written into the longitudinal record as a consultation.

### Clinical queue (canonical — PHC/CHC/Specialist dashboards)
| Method | Path | Roles |
|---|---|---|
| GET | `/clinical/queue?status=&priority=&limit=&offset=&include_completed=` | PHC_DOCTOR, CHC_DOCTOR, SPECIALIST |
Auth: JWT; scope derived from `user.role/facility_id/specialty` (frontend filters never widen scope). Response: stable `QueueResponse{items[], total, limit, offset, generated_at, facility_id, role}` with per-item `id, patient_id/name, age, sex, phone, village, queue_status(WAITING/IN_PROGRESS/COMPLETED/CANCELLED), priority(CRITICAL/HIGH/MEDIUM/LOW), priority_score, triage_level, arrival/scheduled_time, waiting_minutes, assigned_facility/clinician, referral_id, reason, source`. Ordering: clinical priority → waiting/arrival time → id; bounded aging (60min→+1 class, max 1, CRITICAL never overtaken). Empty → `200 {items: [], total: 0}`. Queue-management ordering only — triage disclaimers apply.

### Emergency, notifications, sync, admin
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/notifications`, `PATCH /notifications/{id}/read`, `POST /notifications/read-all` | any | in-app; SMS/EMAIL rows are outbox entries |
| POST | `/sync/batch` | field workers + admin | idempotent by client op id; version conflicts reported, never overwritten |
| GET | `/sync/status` | field workers + admin | pending / applied / conflicts / last sync |
| GET | `/admin/analytics` | DISTRICT_ADMIN | KPIs, status distribution, workload, completion rate, avg time |
| GET | `/admin/bottlenecks` | DISTRICT_ADMIN | per-facility completed / pending / overdue |
| GET | `/admin/audit-logs?action=` | DISTRICT_ADMIN | full audit trail |

---

## RBAC matrix (enforced server-side, never by UI hiding)

| Capability | PATIENT | ASHA/ANM | PHC_STAFF | Clinicians* | DISTRICT_ADMIN |
|---|---|---|---|---|---|
| Own profile / record | ✅ | — | — | — | — |
| Register patient | ❌ | ✅ | ✅ | ❌ | ✅ |
| Record visit / vitals | ❌ | ✅ | ✅ | ✅ | ❌ |
| Triage assess (ML model, rule fallback if unavailable) | ❌ | ✅ | ✅ | ✅ | ❌ |
| Consultation / prescription | ❌ | ❌ | ❌ | ✅ | ❌ |
| Create referral | ❌ | ✅ | ✅ | ✅ | ❌ |
| Acknowledge / accept (destination) | ❌ | ❌ | ack only | ✅ | ❌ |
| Clinical steps (consult→treatment→complete) | ❌ | ❌ | ❌ | ✅ (own facility) | ❌ |
| Confirm arrival | ❌ | ✅ (referring) | ✅ (destination) | ✅ | ❌ |
| Facility resources update | ❌ | ❌ | ✅ (own) | ✅ (own) | ✅ |
| Analytics / audit / bottlenecks | ❌ | ❌ | ❌ | ❌ | ✅ |

\* PHC_DOCTOR, CHC_DOCTOR, SPECIALIST — destination-facility scoped for transitions.

## Environment variables
See `backend/.env.example`: `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`,
`ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`, `PATIENT_ID_PREFIX`,
`TRIAGE_*` thresholds, `SMS_PROVIDER` / `SMS_API_KEY` / `EMAIL_PROVIDER` /
`FCM_CREDENTIALS`, ABDM/FHIR placeholders. Nothing sensitive is committed.

## Prototype honesty

| Area | Status |
|---|---|
| Auth / RBAC / patients / records / referral lifecycle / triage / appointments / facilities / admin analytics / audit / sync ledger | **Implemented** (tested) |
| Facility resources, workload, map coordinates | **Demo data** (seeded) |
| AI triage | **Prototype decision support**: trained ML model (synthetic, labelled dataset) with a transparent rule-based fallback — not a medical device, no diagnosis claims |
| SMS / EMAIL / FCM notifications | **Integration-ready** — dev-null providers write to the outbox; swap in real credentials at one point |
| Teleconsultation | **Metadata only** — signaling is an isolated extension point, no fake video |
| ABDM / FHIR / eSanjeevani / HMIS | **Integration-ready** — env placeholders; no live claims |
| Emergency SMS command (`EMERGENCY\|EVENT_ID\|TOKEN`) | **Prototype** — one-time token with expiry, stored per event |
