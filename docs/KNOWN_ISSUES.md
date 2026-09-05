# Known Issues

## ISSUE-001

Issue ID: ISSUE-001
Description: Application database schema has not been implemented.
Severity: Medium
Affected Component: Database
Reproduction: Inspect migrations; no migration directory or schema exists.
Current Workaround: None required for Session 01 because no patient data workflows exist.
Root Cause: Database implementation is planned for Session 02.
Status: Resolved on 2026-09-04
Next Action: None for this issue; see ISSUE-003 for live migration execution follow-up.

## ISSUE-002

Issue ID: ISSUE-002
Description: Authentication and RBAC have not been implemented.
Severity: High
Affected Component: Backend security
Reproduction: Inspect API; only unauthenticated `/health` endpoint exists.
Current Workaround: Do not expose clinical APIs until authentication and RBAC are implemented.
Root Cause: Security implementation is planned for Session 03.
Status: Resolved on 2026-09-04
Next Action: None for this issue; broader clinical permission-boundary tests will be added as clinical APIs are implemented.

## ISSUE-003

Issue ID: ISSUE-003
Description: Initial Alembic migration has not been executed against a live PostgreSQL database in this environment.
Severity: Medium
Affected Component: Database verification
Reproduction: Run `docker --version`; Docker is not available. Run `python -c "import psycopg"`; the global environment does not include the PostgreSQL driver.
Current Workaround: Metadata contract tests pass, and `python -m alembic -c backend\alembic.ini upgrade head --sql` renders PostgreSQL SQL successfully.
Root Cause: Local environment does not currently provide Docker or a globally installed PostgreSQL Python driver.
Status: Open
Next Action: Install project requirements and run the migration against a PostgreSQL instance when Docker or another local PostgreSQL service is available.

## ISSUE-004

Issue ID: ISSUE-004
Description: Python linting and static type checking are not available in the current global environment.
Severity: Low
Affected Component: Developer tooling
Reproduction: Run `python -m ruff --version` or `python -m mypy --version`; both modules are unavailable.
Current Workaround: Python compilation and unittest verification pass.
Root Cause: `ruff` and `mypy` have not been installed for this workspace.
Status: Open
Next Action: Add and install development requirements, then run linting and type checks.

## ISSUE-005

Issue ID: ISSUE-005
Description: Respiratory risk triage baseline is not clinically validated and has no sensitivity, specificity, precision, recall, F1, PR-AUC, ROC-AUC, or calibration metrics.
Severity: High
Affected Component: AI decision support
Reproduction: Inspect `docs/AI_EVALUATION.md`; current evidence is limited to synthetic safety-contract tests.
Current Workaround: Treat all output as clinical decision support only, require human review for every result, and avoid production clinical use.
Root Cause: No approved training or validation dataset and no clinical review process have been introduced yet.
Status: Open
Next Action: Add approved data governance, training/evaluation artifacts, calibration analysis, and clinician review before any clinical validation claim.

## ISSUE-006

Issue ID: ISSUE-006
Description: Flutter offline queue is in-memory only and does not persist drafts across app restarts or synchronize with the backend.
Severity: Medium
Affected Component: Mobile offline synchronization
Reproduction: Inspect `mobile/lib/main.dart`; local drafts are stored in widget state rather than durable storage.
Current Workaround: Use the current mobile app for synthetic UI workflow demonstration only.
Root Cause: Durable offline persistence, conflict handling, and backend synchronization are planned for Session 08.
Status: Open
Next Action: Add local persistence, sync transport, conflict records, and backend synchronization tests in Session 08.

## ISSUE-007

Issue ID: ISSUE-007
Description: React dashboard uses synthetic local state and is not wired to backend authentication or workflow APIs.
Severity: Medium
Affected Component: Web dashboard
Reproduction: Inspect `web/src/App.tsx`; dashboard case, referral, appointment, audit, and sync exception state is held in React component state rather than loaded from FastAPI.
Current Workaround: Use the current dashboard for synthetic workflow demonstration and accessibility-oriented UI testing only.
Root Cause: Backend workflow, administration, audit browsing, and synchronization APIs are planned for later sessions.
Status: Open
Next Action: Add authenticated API adapters and server-backed workflow route integration after the required backend endpoints exist.
