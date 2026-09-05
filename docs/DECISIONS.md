# Decisions

## DECISION-001

Date: 2026-09-04
Title: Establish repository documentation control files
Problem: The project needs durable memory for specifications, implementation state, decisions, tests, known issues, and handoffs.
Options Considered:
- Rely on conversation history.
- Store project control documentation in the repository.
Decision: Store project control documentation under `docs/` and keep it synchronized with implementation.
Reason: The repository must remain self-describing across future sessions and context resets.
Impact: Adds mandatory documentation maintenance to every meaningful implementation change.
Affected Files: `docs/`
Status: Accepted

## DECISION-002

Date: 2026-09-04
Title: Use FastAPI as the backend foundation
Problem: The specification requires a typed backend API layer with server-side validation and future RBAC.
Options Considered:
- Delay backend initialization until database work.
- Initialize a minimal FastAPI app now.
Decision: Initialize a minimal FastAPI application with a typed health endpoint during Session 01.
Reason: This creates a testable backend foundation while avoiding premature clinical workflow implementation.
Impact: Adds `backend/app/main.py` and a backend health endpoint test.
Affected Files: `backend/`
Status: Accepted

## DECISION-003

Date: 2026-09-04
Title: Treat PostgreSQL Docker Compose as development infrastructure only
Problem: A database service is needed for upcoming migration work, but no application schema has been designed yet.
Options Considered:
- Create database tables immediately.
- Add only local PostgreSQL infrastructure in Session 01 and defer schema to Session 02.
Decision: Add PostgreSQL Docker Compose now and defer application migrations to Session 02.
Reason: This follows the staged plan and prevents undocumented schema design before the database session.
Impact: `DATABASE_SCHEMA.md` currently records no application tables.
Affected Files: `docker-compose.yml`, `docs/DATABASE_SCHEMA.md`
Status: Accepted

## DECISION-004

Date: 2026-09-04
Title: Use SQLAlchemy metadata with Alembic migrations for the database layer
Problem: RAKSHA needs normalized PostgreSQL tables, constraints, indexes, and migration history before backend clinical APIs are implemented.
Options Considered:
- Handwrite SQL only.
- Use SQLAlchemy models with Alembic migrations.
Decision: Use SQLAlchemy ORM metadata as the application schema model and Alembic as the migration system.
Reason: This keeps Python backend types, migrations, and tests aligned while still producing explicit PostgreSQL DDL.
Impact: Adds database model modules, Alembic configuration, an initial migration, and contract tests.
Affected Files: `backend/app/db/`, `backend/alembic.ini`, `backend/migrations/`, `backend/tests/`
Status: Accepted

## DECISION-005

Date: 2026-09-04
Title: Represent canonical statuses as constrained string enums
Problem: Referral, appointment, follow-up, and sync statuses must remain exactly consistent across application layers.
Options Considered:
- PostgreSQL native enums.
- Application-only constants.
- Constrained string columns generated from shared backend enums.
Decision: Use shared Python enums with SQLAlchemy non-native constrained enum columns.
Reason: Check constraints keep the database restrictive while string values remain portable, explicit, and easy to compare with frontend/mobile constants in future sessions.
Impact: Migration SQL includes exact status check constraints; tests assert values match the specification.
Affected Files: `backend/app/db/enums.py`, `backend/app/db/models.py`, `backend/migrations/versions/20260904_0001_initial_database_foundation.py`, `backend/tests/test_database_models.py`
Status: Accepted

## DECISION-006

Date: 2026-09-04
Title: Use offline migration rendering when live PostgreSQL is unavailable
Problem: Session 02 needs migration verification, but Docker and the PostgreSQL Python driver are unavailable in the current environment.
Options Considered:
- Skip migration verification.
- Install or assume external services.
- Run metadata tests and Alembic offline SQL rendering, then document the live-run gap.
Decision: Run metadata and migration contract tests plus Alembic offline SQL rendering, and record live PostgreSQL execution as a known issue.
Reason: This verifies schema shape and generated PostgreSQL SQL without hiding an environment limitation.
Impact: Session 02 is verifiable, but live database execution remains a next-step item when the environment supports it.
Affected Files: `docs/TEST_STATUS.md`, `docs/KNOWN_ISSUES.md`, `docs/SESSION_HANDOFF.md`
Status: Accepted

## DECISION-007

Date: 2026-09-04
Title: Implement authentication without external auth dependencies in the initial backend slice
Problem: Session 03 requires secure authentication primitives, but the current environment has only core Python and existing backend libraries available.
Options Considered:
- Add a framework-specific external authentication package immediately.
- Use Python standard-library password hashing and signed bearer tokens for the first server-side boundary.
Decision: Use PBKDF2-SHA256 password hashes and HMAC-SHA256 signed expiring bearer tokens implemented in local backend modules.
Reason: This avoids dependency drift while providing testable password verification, token expiry, tamper detection, and role claims. Production hardening can add refresh tokens and external identity integration later without changing protected route semantics.
Impact: Adds `backend/app/auth/passwords.py`, `backend/app/auth/tokens.py`, auth API routes, and tests.
Affected Files: `backend/app/auth/`, `backend/app/api/routes/auth.py`, `backend/tests/test_auth_security.py`, `backend/tests/test_auth_api.py`
Status: Accepted

## DECISION-008

Date: 2026-09-04
Title: Enforce RBAC through FastAPI dependencies
Problem: Sensitive authorization decisions must occur on the server and be reusable across future clinical APIs.
Options Considered:
- Inline role checks in each endpoint.
- Use a shared dependency that validates the authenticated user and allowed roles.
Decision: Implement `get_current_user` and `require_roles(...)` dependencies and use them on protected routes.
Reason: Dependency-based enforcement is explicit in route definitions, testable, and reusable across future workflow APIs.
Impact: Admin-only `GET /users` is protected by server-side role enforcement, with allow and deny tests.
Affected Files: `backend/app/auth/dependencies.py`, `backend/app/api/routes/users.py`, `backend/tests/test_auth_api.py`
Status: Accepted

## DECISION-009

Date: 2026-09-04
Title: Standardize API errors with an envelope before clinical APIs are exposed
Problem: The backend needs predictable validation, authentication, and authorization errors for future mobile and web clients.
Options Considered:
- Use FastAPI default error shapes.
- Add a shared error envelope now.
Decision: Add `{ "error": { "code", "message", "details" } }` responses for handled API errors and validation failures.
Reason: A stable error contract lets frontend clients build consistent loading and error states later.
Impact: Adds API error handlers and tests for validation/auth failures.
Affected Files: `backend/app/api/errors.py`, `backend/app/main.py`, `backend/tests/test_auth_api.py`
Status: Accepted

## DECISION-010

Date: 2026-09-04
Title: Implement workflow transitions as an explicit backend service before exposing clinical route handlers
Problem: RAKSHA needs consistent state changes for referrals, appointments, follow-ups, and care coordination without ad hoc status updates.
Options Considered:
- Let endpoints update status fields directly when routes are added.
- Create a reusable transition service with a canonical transition graph first.
Decision: Implement a pure backend workflow transition service and transition graph before clinical workflow APIs are exposed.
Reason: This centralizes allowed transitions, terminal-state handling, lifecycle timestamp behavior, and audit event recording so future APIs cannot drift from the documented workflow.
Impact: Adds `backend/app/workflows/` and workflow transition tests; no new public workflow endpoints are exposed yet.
Affected Files: `backend/app/workflows/rules.py`, `backend/app/workflows/service.py`, `backend/tests/test_workflow_transitions.py`
Status: Accepted

## DECISION-011

Date: 2026-09-04
Title: Implement respiratory triage as transparent decision-support scaffolding
Problem: Session 05 requires AI services for acute respiratory risk triage, but there is no approved clinical training dataset or validation process in the repository yet.
Options Considered:
- Integrate an external LLM or opaque model immediately.
- Delay all AI work until clinical data governance exists.
- Add a deterministic, transparent baseline with strict safety language, hard emergency-warning overrides, persistence, audit logging, and tests.
Decision: Add `raksha-respiratory-risk-logistic-baseline` version `2026-09-04.v0` as clinical decision-support scaffolding only.
Reason: This creates the API, schema, persistence, audit, fallback, and safety contract needed by later clients while avoiding unsupported diagnosis, prescribing, or clinical validation claims.
Impact: The endpoint can route entered acute respiratory presentations for prompt human review, but it must not be used autonomously and must be replaced or validated through an approved evaluation pipeline before clinical deployment.
Affected Files: `backend/app/ai/`, `backend/app/api/routes/triage.py`, `backend/app/main.py`, `backend/tests/test_ai_respiratory_triage.py`, `docs/AI_SPECIFICATION.md`, `docs/AI_EVALUATION.md`, `docs/API_CONTRACT.md`
Status: Accepted

## DECISION-012

Date: 2026-09-04
Title: Scaffold Flutter patient and frontline app before durable synchronization
Problem: Session 06 requires patient/frontline mobile workflows, translation keys, offline state representation, and tests, while durable offline persistence and backend sync are scheduled for Session 08.
Options Considered:
- Wait for the backend sync engine before building mobile UI.
- Build a static visual mockup with no state changes.
- Build a functional Flutter UI with local in-memory draft state, exact sync status labels, and tests.
Decision: Create `mobile/` as a Flutter app with Android and web targets, role-aware patient/frontline workflows, translation-key-backed English/Hindi text, and in-memory offline queue behavior.
Reason: This gives later sessions a testable mobile surface and validates role, localization, triage-labeling, and sync-state UX without pretending that durable synchronization already exists.
Impact: The mobile app can demonstrate local draft capture and sync states, but it does not yet authenticate against the backend, persist drafts across app restarts, or perform real server synchronization.
Affected Files: `mobile/`, `README.md`, `docs/UI_SPECIFICATION.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`, `docs/TEST_STATUS.md`, `docs/CHANGELOG.md`
Status: Accepted

## DECISION-013

Date: 2026-09-04
Title: Scaffold React dashboards with synthetic local state before backend workflow APIs
Problem: Session 07 requires role-appropriate doctor, facility, and administrator dashboards, but live patient, referral, appointment, audit, and sync APIs are not exposed yet.
Options Considered:
- Wait for all backend workflow APIs before building the web dashboard.
- Build a static dashboard mockup with inactive controls.
- Build a functional React dashboard using clearly labeled synthetic local state, accessible controls, and tests.
Decision: Create `web/` as a Vite React TypeScript app with role-aware dashboards backed by synthetic local state until API adapters exist.
Reason: This gives later sessions a tested web surface for clinical review, facility coordination, and administrative oversight without pretending that live backend data, production analytics, or autonomous clinical decision-making exist.
Impact: The dashboard can demonstrate role workflows and status changes locally, but it does not authenticate against the backend or persist changes to server APIs yet.
Affected Files: `web/`, `README.md`, `docs/UI_SPECIFICATION.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`, `docs/TEST_STATUS.md`, `docs/CHANGELOG.md`
Status: Accepted
