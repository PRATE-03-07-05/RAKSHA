# Architecture

## System Architecture

Current implementation is a new monorepo foundation. It contains documentation control files, a FastAPI backend package, authentication and RBAC primitives, workflow transition services, respiratory risk triage decision-support scaffolding, a Flutter patient/frontline app, a React doctor/facility/admin dashboard, a local PostgreSQL Docker Compose service definition, SQLAlchemy database metadata, an Alembic migration environment, one initial database migration, clearly labeled synthetic seed data, and backend/database/auth/workflow/AI/mobile/web contract tests. Clinical workflow APIs beyond triage, durable synchronization behavior, notifications, and interoperability mappings are planned but not yet implemented.

## Frontend Architecture

The React and TypeScript dashboard is implemented under `web/` with Vite.

Current web modules:

- `web/src/App.tsx`: role-aware operational dashboard for doctor, facility coordinator, and administrator users using synthetic local state.
- `web/src/App.css`: responsive dashboard layout, worklist, workflow panels, status pills, and admin KPI styling.
- `web/src/App.test.tsx`: Vitest and Testing Library coverage for role views, accessible dashboard controls, case selection, human review, consultation preparation, facility status advancement, and admin sync exception review.

Current web behavior:

- Doctor mode shows a synthetic triage-review worklist, patient context, vitals, appointment/referral/follow-up status, safety-labeled respiratory risk decision support, and actions to record human review or prepare consultation.
- Facility mode shows synthetic referral and appointment panels with canonical status advancement controls.
- Admin mode shows synthetic operational KPIs, an audit hook note, and sync exception review actions for failed or conflicting records.

Current web limitations:

- Web dashboard state is local and synthetic.
- No web authentication flow is wired to the backend yet.
- No live backend patient, triage, referral, appointment, audit, or sync APIs are consumed yet.
- No production clinical validation, production analytics, or production administrative controls exist yet.

## Mobile Architecture

The Flutter patient/frontline app is implemented under `mobile/`.

Current mobile modules:

- `mobile/lib/main.dart`: Material 3 app with patient/frontline role switching, translation-key-backed English and Hindi text, synthetic patient status, frontline registration/consent capture, symptoms/vitals capture, respiratory risk preview, and local sync queue UI.
- `mobile/test/widget_test.dart`: widget and contract tests for role switching, Hindi localization, validation, local draft saves, respiratory risk flags, and exact sync state values.

Current mobile behavior:

- Patient mode shows synthetic patient status, consent state, triage human-review state, appointment status, and follow-up support.
- Frontline mode captures registration, consent, symptoms, and vitals in local UI state.
- Offline queue records local drafts with sync metadata values `PENDING`, `SYNCING`, `SYNCED`, `FAILED`, and `CONFLICT`.
- Offline and online states are visible and affect sync behavior.
- Respiratory risk UI is labeled as decision support only and human-review required.

Current mobile limitations:

- Local drafts are in-memory only.
- No mobile authentication flow is wired to the backend yet.
- No real backend API synchronization is implemented yet.
- No push or SMS notification integration exists yet.

## Backend Architecture

The backend is a FastAPI application in `backend/app`. Implemented endpoints are `GET /health`, `POST /auth/login`, `GET /auth/me`, `GET /users`, and `POST /triage/respiratory-risk`.

Current backend modules:

- `backend/app/main.py`: FastAPI app creation and health endpoint.
- `backend/app/api/errors.py`: consistent API error envelope and exception handlers.
- `backend/app/api/routes/auth.py`: login and current-user routes.
- `backend/app/api/routes/triage.py`: protected respiratory risk decision-support endpoint.
- `backend/app/api/routes/users.py`: admin-only user listing route.
- `backend/app/ai/schemas.py`: typed respiratory triage request and response schemas.
- `backend/app/ai/respiratory_triage.py`: transparent respiratory risk baseline and manual-review fallback.
- `backend/app/ai/repository.py`: triage-assessment persistence abstraction.
- `backend/app/ai/dependencies.py`: AI service and repository dependency factories.
- `backend/app/auth/passwords.py`: PBKDF2-SHA256 password hashing and verification.
- `backend/app/auth/tokens.py`: signed expiring bearer token issuance and validation.
- `backend/app/auth/dependencies.py`: current-user dependency and server-side role guard.
- `backend/app/auth/repository.py`: user repository protocol and SQLAlchemy implementation.
- `backend/app/auth/schemas.py`: typed auth/user request and response schemas.
- `backend/app/audit/service.py`: audit event abstraction, SQLAlchemy sink, and in-memory test sink.
- `backend/app/core/config.py`: environment-backed authentication settings.
- `backend/app/workflows/rules.py`: explicit transition graph for referrals, appointments, follow-ups, and care plans.
- `backend/app/workflows/service.py`: transition validation, lifecycle timestamp handling, and audit event recording.
- `backend/app/db/base.py`: SQLAlchemy declarative base and constraint naming convention.
- `backend/app/db/enums.py`: canonical roles, lifecycle, and status enums.
- `backend/app/db/models.py`: normalized database metadata.
- `backend/app/db/session.py`: database URL and session factory helpers.

Planned backend modules include trained AI service clients, notification services, interoperability mapping, workflow API route adapters, and broader audit-log integration.

## Database Architecture

PostgreSQL is the intended authoritative transactional database. `docker-compose.yml` defines a local PostgreSQL 16 service for development. SQLAlchemy models and Alembic migration `20260904_0001_initial_database_foundation` define the current application schema.

Current database foundation:

- users and role storage
- organizations and practitioner profiles
- patients and consent history
- encounters
- symptom reports
- observations
- triage assessments with mandatory human-review constraint
- appointments
- consultations
- diagnostic requests and reports
- medication requests
- referrals
- care plans
- follow-ups
- audit logs
- sync records

Live migration execution remains pending because Docker is unavailable in the current environment.

## AI Architecture

Session 05 implements the first AI-adjacent clinical decision-support service. It is deterministic scaffolding, not a trained or clinically validated model.

Implemented AI modules:

- `RespiratoryRiskTriageService` computes acute respiratory risk using transparent logistic-style scoring plus hard safety overrides for entered emergency warning signs.
- `manual_review_fallback` returns a structured fallback response with no automated confidence or risk score when the service is unavailable.
- `TriageAssessmentRepository` persists model name, model version, risk level, confidence when present, explanation, structured output, and mandatory human-review requirement.

All respiratory triage responses include `human_review_required: true`, `clinical_decision_support_only: true`, `diagnosis: null`, and `treatment_recommendation: null`.

The baseline uses guideline-informed safety signals from CDC and WHO respiratory emergency, oxygen saturation, and child pneumonia/IMCI materials. `docs/AI_EVALUATION.md` records current safety-contract coverage and future evaluation requirements.

## Authentication Architecture

Authentication is implemented for the initial backend API slice.

Current behavior:

- Password hashes use PBKDF2-SHA256 with per-hash salt.
- Access tokens use an internal HMAC-SHA256 signed bearer format with issuer, issued-at, expiration, subject, role, and token ID claims.
- `RAKSHA_TOKEN_SECRET` is required before issuing or validating tokens.
- `GET /auth/me` requires any active authenticated user.
- `GET /users` requires the `ADMIN` role through server-side RBAC.
- Failed logins, successful logins, inactive-user login attempts, and admin user-list access are audit events.

Current limitations:

- No refresh tokens yet.
- No password reset flow yet.
- No account creation endpoint yet.
- No patient-data APIs are exposed yet.

## Workflow Architecture

The backend includes a pure transition engine for canonical state changes. The current workflow service is not exposed through clinical API routes yet.

Implemented transition families:

- referrals: `CREATED` through acceptance, appointment coordination, patient notification, arrival, consultation completion, referred-back, completion, cancellation, and expiry.
- appointments: `REQUESTED` through confirmation, check-in, queue, consultation, completion, cancellation, and no-show.
- follow-ups: `PENDING`, contact attempts, completion, missed, escalation, and cancellation.
- care plans: active, completed, and cancelled.

Invalid jumps are rejected, terminal states do not allow further transitions, and successful transitions emit `WORKFLOW_TRANSITION` audit events.

## Offline Architecture

Flutter currently represents offline-first behavior with an in-memory local draft queue and visible offline, retry, failed, synced, and conflict states. Durable local persistence and backend synchronization are planned for Session 08.

## Synchronization Architecture

No durable synchronization engine is implemented yet. The database now includes `sync_records` with the planned sync metadata states: `PENDING`, `SYNCING`, `SYNCED`, `FAILED`, and `CONFLICT`. Flutter and React UI slices display or manipulate those status values in synthetic local state only.

## Notification Architecture

No notification provider is implemented yet. Future providers must be abstracted and clearly labeled as mock, sandbox, or production.

## Interoperability Architecture

No interoperability layer is implemented yet. Future mapping will align internal resources to FHIR-compatible concepts. ABDM must remain mock or sandbox unless production credentials, specifications, approvals, and deployment conditions are available.

## Infrastructure

Current infrastructure:

- Local PostgreSQL 16 service through Docker Compose.
- FastAPI application runnable through Uvicorn.
- SQLAlchemy metadata and Alembic migration environment.
- Python unittest-based backend, database, migration, and seed-data tests.
- Flutter mobile app with widget tests and analyzer checks.
- Vite React TypeScript web app with Vitest, Testing Library, oxlint, and production build checks.

## Deployment Architecture

No production deployment configuration exists yet.

## Data Flow

Current runtime API data flow includes unauthenticated system health checks, authenticated user APIs, and protected respiratory triage decision support:

Client -> FastAPI `/health` -> static typed health response.

Client -> `POST /auth/login` -> user repository -> password verification -> signed bearer token -> audit event.

Client -> protected route -> bearer token validation -> user repository -> server-side RBAC -> response or error envelope.

Client -> `POST /triage/respiratory-risk` -> bearer token validation -> server-side RBAC -> respiratory risk service or manual fallback -> triage assessment persistence -> audit event -> structured clinical decision-support response.

React dashboard -> synthetic local case state -> role-specific doctor, facility, and admin workflow previews. No live backend data flow exists for the web dashboard yet.

Workflow transition APIs remain planned.

## Security Boundaries

The respiratory triage endpoint accepts patient context and is protected by server-side RBAC for frontline workers, doctors, facility coordinators, and administrators. Patient role access is intentionally denied until patient-scoped ownership authorization exists. `.env` files are ignored, and `.env.example` contains development-only placeholders. Authentication settings require `RAKSHA_TOKEN_SECRET`; production must supply a strong external secret. Server-side RBAC protects the user-list endpoint and the triage endpoint and will be reused for future clinical APIs.
