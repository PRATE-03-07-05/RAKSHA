# RAKSHA Execution Plan

## SESSION 01

Status: COMPLETED
Started: 2026-09-04
Completed: 2026-09-04

Objective:
Repository and documentation foundation.

Prerequisites:
- Empty or newly initialized workspace.
- Master product and workflow-control specifications supplied by the user.

Tasks:
- Inspect repository baseline.
- Create required documentation control files.
- Initialize minimal repository metadata.
- Create minimal FastAPI backend package.
- Add `/health` endpoint.
- Add local PostgreSQL Docker Compose service.
- Add initial backend health endpoint test.
- Run relevant verification.
- Update progress, test status, changelog, and session handoff.

Files Expected To Change:
- `README.md`
- `.gitignore`
- `.env.example`
- `docker-compose.yml`
- `backend/`
- `docs/`

Dependencies:
- Python 3
- FastAPI
- Pydantic
- Uvicorn
- Docker for local PostgreSQL when database work begins

Acceptance Criteria:
- [x] Repository structure created
- [x] Backend initialized
- [x] Docker environment initialized
- [x] Documentation system initialized
- [x] Health endpoint implemented
- [x] Health endpoint test passes
- [x] Session handoff updated

Tests Required:
- `python -m unittest discover backend/tests`

Test Result:
- PASS, 2 tests passed on 2026-09-04

Expected Handoff:
- Continue to Session 02 for PostgreSQL schema design, migrations, constraints, indexes, audit tables, seed data, and database tests.

## SESSION 02

Status: COMPLETED
Started: 2026-09-04
Completed: 2026-09-04

Objective:
Database and migrations foundation.

Prerequisites:
- Session 01 complete.
- PostgreSQL local service available.

Tasks:
- Add database configuration.
- Add SQLAlchemy or equivalent ORM/data access layer.
- Add migration tooling.
- Model core normalized healthcare entities.
- Implement canonical status constraints.
- Add audit log structure.
- Add synthetic seed data plan.
- Add database tests.
- Update `DATABASE_SCHEMA.md`, `ARCHITECTURE.md`, `PROGRESS.md`, `TEST_STATUS.md`, `DECISIONS.md`, `CHANGELOG.md`, and `SESSION_HANDOFF.md`.

Files Expected To Change:
- backend database modules
- migration files
- seed data files
- database tests
- docs

Dependencies:
- PostgreSQL
- migration tool
- database driver

Acceptance Criteria:
- [x] Normalized core tables exist in migrations
- [x] Canonical statuses are constrained
- [x] Foreign keys and indexes are present
- [x] Audit logging structure exists
- [x] Synthetic seed data is clearly labeled
- [x] Database tests pass
- [x] Offline Alembic SQL render succeeds

Environment Limitation:
- Live PostgreSQL migration execution was not run because Docker is not installed on this machine and the PostgreSQL Python driver is not installed in the current global environment. The driver is listed in `backend/requirements.txt`.

Tests Required:
- Database migration tests
- Constraint tests
- Seed data consistency tests

Test Result:
- PASS, 14 backend/database tests passed on 2026-09-04.
- PASS, Alembic offline upgrade SQL rendered on 2026-09-04.

Expected Handoff:
- Continue to Session 03 for backend core APIs and authentication.

## SESSION 03

Status: COMPLETED
Started: 2026-09-04
Completed: 2026-09-04

Objective:
Backend core APIs and authentication.

Acceptance Criteria:
- [x] Authentication implemented
- [x] RBAC implemented server-side
- [x] Core typed API schemas implemented
- [x] Consistent API errors implemented
- [x] Audit logging integrated for sensitive access
- [x] Relevant tests pass

Implemented Scope:
- PBKDF2-SHA256 password hashing.
- HMAC-SHA256 signed expiring bearer tokens.
- `POST /auth/login`.
- `GET /auth/me`.
- Admin-only `GET /users`.
- Dependency-injected SQLAlchemy user repository and audit sink.
- Consistent API error envelope and validation error handler.

Tests Required:
- Authentication tests.
- RBAC tests.
- API validation tests.
- Permission-boundary tests.

Test Result:
- PASS, 28 backend tests passed on 2026-09-04.

Expected Handoff:
- Continue to Session 04 for explicit workflow and state-transition engine.

## SESSION 04

Status: COMPLETED
Started: 2026-09-04
Completed: 2026-09-04

Objective:
Workflow and state-transition engine.

Acceptance Criteria:
- [x] Referral, appointment, follow-up, and care-coordination transitions are explicit
- [x] Invalid transitions are rejected
- [x] Audit trail records workflow changes
- [x] Workflow tests pass

Implemented Scope:
- Pure backend transition graph for referrals, appointments, follow-ups, and care plans.
- Shared service that validates transitions, rejects invalid jumps, blocks terminal states, applies lifecycle timestamps where fields exist, and records audit events.
- Workflow tests for happy paths, invalid transitions, terminal states, string status coercion, and audit context.

Tests Required:
- Workflow transition tests.
- Referral completion tests.
- Appointment and queue management transition tests.
- Follow-up transition tests.

Test Result:
- PASS, 38 backend tests passed on 2026-09-04.

Expected Handoff:
- Continue to Session 05 for AI services.

## SESSION 05

Status: COMPLETED
Started: 2026-09-04
Completed: 2026-09-04

Objective:
AI services.

Acceptance Criteria:
- [x] Respiratory risk triage baseline implemented as clinical decision support only
- [x] Structured AI output includes model version, confidence, explanation, timestamp, and human-review requirement
- [x] Manual-review fallback exists
- [x] Evaluation artifacts are documented
- [x] AI endpoint tests pass

Implemented Scope:
- Protected `POST /triage/respiratory-risk` endpoint.
- Transparent respiratory risk baseline `raksha-respiratory-risk-logistic-baseline`, version `2026-09-04.v0`.
- Structured output with risk score, safety flags, missing inputs, feature contributions, limitations, and recommended review routing.
- Mandatory `human_review_required: true`, `clinical_decision_support_only: true`, `diagnosis: null`, and `treatment_recommendation: null`.
- Manual-review fallback with no automated confidence or risk score.
- Triage assessment persistence and audit event recording.
- Safety-contract and endpoint tests.
- Evaluation documentation in `docs/AI_EVALUATION.md`.

Tests Required:
- AI service tests.
- AI endpoint structure tests.
- Permission-boundary tests.
- Manual fallback tests.

Test Result:
- PASS, 45 backend tests passed on 2026-09-04.

Expected Handoff:
- Continue to Session 06 for Flutter patient and frontline application.

## SESSION 06

Status: COMPLETED
Started: 2026-09-04
Completed: 2026-09-04

Objective:
Flutter patient and frontline application.

Acceptance Criteria:
- [x] Role-appropriate patient/frontline workflows exist
- [x] Translation keys are used
- [x] Offline states are represented
- [x] Important UI states are implemented
- [x] Mobile tests pass

Implemented Scope:
- Flutter app scaffolded under `mobile/` with Android and web targets.
- Role selector for patient and frontline worker workflows.
- Translation-key-backed English and Hindi UI strings.
- Frontline registration, consent, symptom, vital, respiratory risk preview, and triage-review queue flows.
- Patient status and follow-up support view.
- In-memory local draft queue with exact sync metadata values: `PENDING`, `SYNCING`, `SYNCED`, `FAILED`, and `CONFLICT`.
- Offline, online, empty, success, validation-error, server-error, failed, retry, synced, and conflict UI states.
- Mobile widget and contract tests.

Tests Required:
- Flutter widget tests.
- Translation/role switching tests.
- Offline state tests.
- Sync metadata contract tests.

Test Result:
- PASS, `flutter test` ran 6 tests on 2026-09-04.
- PASS, `flutter analyze` found no issues on 2026-09-04.

Expected Handoff:
- Continue to Session 07 for React doctor, facility, and administrator dashboards.

## SESSION 07

Status: COMPLETED
Started: 2026-09-04
Completed: 2026-09-04

Objective:
React doctor, facility, and administrator dashboards.

Acceptance Criteria:
- [x] Role-appropriate dashboards exist
- [x] No unsupported clinical claims or fake controls appear
- [x] Accessibility-oriented checks are integrated in React tests
- [x] Web tests pass

Implemented Scope:
- Vite React TypeScript app scaffolded under `web/`.
- Doctor dashboard with triage-review worklist, decision-support-only safety language, patient vitals, human-review recording, and consultation preparation actions.
- Facility dashboard with referral and appointment workflow state controls using canonical status labels.
- Administrator dashboard with synthetic operational KPIs, audit hook note, and sync exception review actions.
- Synthetic local state only; no live backend patient data or production clinical claims.
- Vitest and Testing Library coverage for dashboard role views, triage human review, consultation preparation, facility status advancement, admin sync exceptions, and case selection.

Tests Required:
- React dashboard tests.
- Accessibility-oriented role/name tests.
- Static lint check.
- Production build.

Test Result:
- PASS, `npm test` ran 5 web dashboard tests on 2026-09-04.
- PASS, `npm run lint` completed on 2026-09-04.
- PASS, `npm run build` completed on 2026-09-04.

Expected Handoff:
- Continue to Session 08 for durable offline synchronization.

## SESSION 08

Status: PENDING

Objective:
Offline synchronization.

Acceptance Criteria:
- [ ] Local mobile persistence exists
- [ ] Sync metadata states are enforced
- [ ] Conflict handling avoids silent overwrites
- [ ] Sync tests pass

## SESSION 09

Status: PENDING

Objective:
Notifications.

Acceptance Criteria:
- [ ] Notification abstractions exist
- [ ] Mock or sandbox providers are clearly labeled
- [ ] Meaningful workflow notifications are implemented
- [ ] Notification tests pass

## SESSION 10

Status: PENDING

Objective:
Interoperability-ready layer.

Acceptance Criteria:
- [ ] Internal resources map to FHIR-compatible concepts
- [ ] ABDM remains mock/sandbox unless valid production conditions are available
- [ ] Mapping tests pass

## SESSION 11

Status: PENDING

Objective:
Full integration.

Acceptance Criteria:
- [ ] One synthetic patient journey works across implemented modules
- [ ] Consistent IDs and statuses appear across backend, mobile, web, and docs
- [ ] Integration tests pass

## SESSION 12

Status: PENDING

Objective:
Automated testing expansion.

Acceptance Criteria:
- [ ] Required test families are implemented
- [ ] Critical permission and workflow boundaries are covered
- [ ] End-to-end journey tests pass

## SESSION 13

Status: PENDING

Objective:
Deployment configuration and documentation.

Acceptance Criteria:
- [ ] Deployment configuration exists
- [ ] Secrets remain outside source control
- [ ] Privacy and compliance constraints are documented
- [ ] Final demo instructions are complete
