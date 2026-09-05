# Changelog

## [2026-09-04]

### Added

- Initial documentation control system under `docs/`.
- Minimal FastAPI backend package.
- `GET /health` endpoint.
- Local PostgreSQL Docker Compose service definition.
- Backend health endpoint unit test.
- Repository README, `.gitignore`, and `.env.example`.
- Git repository initialization for project history.
- SQLAlchemy database metadata foundation.
- Alembic migration environment.
- Initial migration `20260904_0001_initial_database_foundation`.
- Normalized healthcare tables for users, organizations, patients, consent, encounters, symptoms, observations, triage, appointments, consultations, diagnostics, medication requests, referrals, care plans, follow-ups, audit logs, and sync records.
- Clearly labeled synthetic demo seed data.
- Database model, migration, and seed-data contract tests.
- PBKDF2-SHA256 password hashing service.
- HMAC-SHA256 signed expiring bearer token service.
- Authentication routes for login and current-user profile.
- Admin-only user listing route with server-side RBAC.
- Dependency-injected SQLAlchemy user repository and audit sink.
- Consistent API error envelope and validation error handler.
- Authentication, RBAC, API validation, and permission-boundary tests.
- Explicit workflow transition graph for referrals, appointments, follow-ups, and care plans.
- Workflow transition service with audit events and lifecycle timestamp handling.
- Workflow tests for valid paths, invalid jumps, terminal states, referral completion, queue movement, and audit context.
- Respiratory risk triage decision-support baseline `raksha-respiratory-risk-logistic-baseline`.
- Protected `POST /triage/respiratory-risk` endpoint.
- Structured respiratory triage output with model version, timestamp, confidence, explanation, safety flags, missing inputs, feature contributions, and mandatory human-review requirement.
- Manual-review fallback for respiratory triage service unavailability.
- Triage assessment persistence and `AI_RESPIRATORY_TRIAGE_ASSESSED` audit event.
- AI evaluation status documentation in `docs/AI_EVALUATION.md`.
- AI service, endpoint, fallback, and permission-boundary tests.
- Flutter patient/frontline app scaffold under `mobile/`.
- Android and web Flutter targets for local development.
- Patient mobile status and follow-up support view.
- Frontline registration, consent, symptoms, vitals, respiratory risk preview, and triage-review queue UI.
- Translation-key-backed English and Hindi mobile strings.
- In-memory offline draft queue with `PENDING`, `SYNCING`, `SYNCED`, `FAILED`, and `CONFLICT` sync states.
- Mobile widget tests and sync metadata contract test.
- Vite React TypeScript dashboard scaffold under `web/`.
- Doctor triage-review dashboard with decision-support-only and human-review-required labels.
- Facility coordination dashboard with referral and appointment status controls.
- Administrator oversight dashboard with synthetic KPIs, audit hook note, and sync exception review actions.
- Web dashboard tests with Vitest and Testing Library.
- Web lint and production build configuration.

### Changed

- `backend/requirements.txt` now includes SQLAlchemy, Alembic, and the PostgreSQL driver dependency.
- FastAPI app now includes the protected triage route.
- README now includes Flutter mobile and React web verification commands.

### Fixed

- None.

### Removed

- None.

### Security

- Added `.gitignore` rules to keep `.env` files out of source control.
- Added required `RAKSHA_TOKEN_SECRET` setting for token issuance and validation.
- Added login success/failure and admin user-list access audit events.
- Added server-side RBAC enforcement for `GET /users`.
- Added server-side RBAC enforcement and audit logging for respiratory triage assessment creation.

### Database

- Added initial PostgreSQL migration with UUID primary keys, foreign keys, indexes, audit logging, sync metadata, and exact canonical status constraints.
- Live migration execution remains pending because Docker is unavailable in the current environment.

### API

- Added unauthenticated system health endpoint.
- Added `POST /auth/login`.
- Added `GET /auth/me`.
- Added admin-only `GET /users`.
- Added protected `POST /triage/respiratory-risk`.
- No public workflow transition endpoints are exposed yet.

### AI

- Added respiratory risk triage decision-support scaffolding.
- Added manual-review fallback behavior.
- Documented that the baseline is not clinically validated and must not be used autonomously.

### UI

- Added initial Flutter patient/frontline workflow UI.
- Added mobile states for offline, online, empty, success, validation-error, server-error, failed, retry, synced, and conflict conditions.
- Added React doctor/facility/admin dashboard UI using synthetic local state.
