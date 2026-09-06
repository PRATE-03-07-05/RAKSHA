# RAKSHA

**Responsive AI-enabled Knowledge & Smart Healthcare Assistance**

> *Connecting Rural Healthcare. Closing the Referral Loop.*

An integrated digital healthcare platform connecting patients, ASHA/ANM
frontline workers, PHCs, CHCs, specialists and district administrators
through one continuous, longitudinal health record.

```
Patient → ASHA / ANM → PHC → CHC → Specialist → District Hospital
   ↑                                                      │
   └──────────── outcome & follow-up flow back ───────────┘
```

## Core differentiators

1. **Offline-first healthcare** — field workflows continue without
   connectivity; an idempotent sync ledger (IndexedDB ↔ `POST /sync/batch`)
   merges append-only observations without data loss.
2. **Closed-loop referrals** — a referral is not done when created; it is
   done when the patient arrives, is treated, and the outcome reaches the
   originator. Every transition is authorized, validated and audited.
3. **AI as decision support** — a transparent, rule-based preliminary risk
   assessment explains every flag. Clinicians decide; the system assists.

## Repository layout

```
├── src/                  # React + TypeScript + Tailwind frontend (demo-store driven)
├── backend/              # FastAPI + SQLAlchemy + Alembic (see backend/README.md)
│   ├── app/              # config, models, schemas, security, services, routers
│   ├── migrations/       # Alembic revisions (0001 = initial schema)
│   ├── tests/            # pytest suite (auth, RBAC, patients, referrals, triage)
│   └── seed.py           # deterministic demo data
├── docker-compose.yml    # PostgreSQL 16 + backend + frontend
├── requirements.txt      # Python dependencies
└── .env.example          # frontend env (VITE_API_BASE_URL)
```

## Run it

```bash
docker compose up --build
# frontend   http://localhost:5173
# backend    http://localhost:8000   (Swagger: /docs)
```

Backend-only development, migrations, seeding and tests are documented in
[`backend/README.md`](backend/README.md).

## SIH demo walkthrough (end-to-end)

1. **ASHA** (`asha@raksha.demo`, password `raksha123`) searches Sita Devi,
   records symptoms + vitals (SpO₂ 91%, temp 38.9°C).
2. RAKSHA produces a **HIGH** risk assessment *with reasons*.
3. ASHA creates a **PHC → CHC referral**; the CHC doctor is notified.
4. **CHC doctor** (`chc.doctor@raksha.demo`) acknowledges → accepts → marks
   arrival → consults. The longitudinal record (previous visits, vitals,
   prescriptions) is visible throughout.
5. Doctor raises an **emergency event** (`EMG-RAK-2026-XXXXX`) — in-app alert
   + one-time SMS command token.
6. Referral completes **with a recorded outcome**, follow-up is scheduled and
   assigned back to the ASHA — the loop closes.
7. **District admin** (`admin@raksha.demo`) sees updated KPIs, referral
   bottlenecks and the full audit trail.

Toggle the offline switch in the top bar to demonstrate offline entry and
Sync Center recovery — the same flows queue and replay through
`POST /sync/batch`.

## Status: implemented vs mocked vs integration-ready

| | |
|---|---|
| **Implemented & tested** | auth/JWT, RBAC, patients, longitudinal records, referral lifecycle + history, triage decision support, appointments, facility resources, analytics, bottlenecks, audit logs, sync ledger, notifications (in-app) |
| **Demo data** | facility availability, workloads, map coordinates, seeded patients/referrals |
| **Integration-ready** | ABDM/ABHA, FHIR R4 mapping, eSanjeevani, HMIS, real SMS/EMAIL/FCM providers, WebRTC signaling — isolated adapters, no fake claims |
| **Prototype** | emergency SMS command with one-time token + replay protection |

The shipped frontend runs on an embedded demo store mirroring this exact API
contract (see *Frontend integration* in `backend/README.md`), so it can be
pointed at the live API with a thin client layer.
