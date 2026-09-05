# Test Status

Last Updated: 2026-09-04

## Backend Tests

Status: PASS
Command: `python -m unittest discover backend/tests`
Passed: 45
Failed: 0
Skipped: 0
Known Failures: None
Last Run: 2026-09-04

## Database Tests

Status: PASS_WITH_ENVIRONMENT_LIMITATION
Command: `python -m unittest discover backend/tests`; `python -m alembic -c backend\alembic.ini upgrade head --sql`
Passed: 12 database, migration, and seed-data contract checks plus offline Alembic SQL render
Failed: 0
Skipped: Live PostgreSQL migration execution
Known Failures: Docker is not installed in this environment; `psycopg` is listed in requirements but not installed globally
Last Run: 2026-09-04

## Authentication Tests

Status: PASS
Command: `python -m unittest discover backend/tests`
Passed: 14 authentication/security/API tests
Failed: 0
Skipped: 0
Known Failures: None
Last Run: 2026-09-04

## RBAC Tests

Status: PASS
Command: `python -m unittest discover backend/tests`
Passed: Admin allow and non-admin deny checks
Failed: 0
Skipped: 0
Known Failures: None
Last Run: 2026-09-04

## API Tests

Status: PASS
Command: `python -m unittest discover backend/tests`
Passed: 14 API route and validation checks
Failed: 0
Skipped: 0
Known Failures: None
Last Run: 2026-09-04

## Workflow Tests

Status: PASS
Command: `python -m unittest discover backend/tests`
Passed: 10 workflow transition tests
Failed: 0
Skipped: 0
Known Failures: None
Last Run: 2026-09-04

## AI Tests

Status: PASS
Command: `python -m unittest discover backend/tests`
Passed: 7 AI service, fallback, endpoint, and permission-boundary tests
Failed: 0
Skipped: 0
Known Failures: No clinical validation metrics exist yet; current tests are synthetic safety-contract checks
Last Run: 2026-09-04

## Mobile Tests

Status: PASS
Command: `flutter test`
Passed: 6 mobile widget and sync-state contract tests
Failed: 0
Skipped: 0
Known Failures: Current offline queue is in-memory only; durable persistence and backend sync are planned for Session 08
Last Run: 2026-09-04

## Mobile Static Analysis

Status: PASS
Command: `flutter analyze`
Passed: No issues found
Failed: 0
Skipped: 0
Known Failures: None
Last Run: 2026-09-04

## Web Tests

Status: PASS
Command: `npm test` from `web/`
Passed: 5 web dashboard tests
Failed: 0
Skipped: 0
Known Failures: Current dashboard uses synthetic local state and is not wired to backend APIs yet
Last Run: 2026-09-04

## Web Static Analysis

Status: PASS
Command: `npm run lint` from `web/`
Passed: Web lint completed successfully
Failed: 0
Skipped: 0
Known Failures: None
Last Run: 2026-09-04

## Web Build

Status: PASS
Command: `npm run build` from `web/`
Passed: TypeScript project build and Vite production build completed successfully
Failed: 0
Skipped: 0
Known Failures: None
Last Run: 2026-09-04

## Offline/Sync Tests

Status: PASS_FOR_MOBILE_UI_SLICE
Command: `flutter test`
Passed: Sync metadata values and offline queue UI states are covered by mobile tests
Failed: 0
Skipped: Durable offline persistence, backend sync, and conflict-resolution engine tests
Known Failures: Offline synchronization engine is planned for Session 08
Last Run: 2026-09-04

## Integration Tests

Status: NOT IMPLEMENTED
Command: Not available
Passed: 0
Failed: 0
Skipped: 0
Known Failures: Integration is planned for Session 11
Last Run: Not run yet

## End-to-End Tests

Status: NOT IMPLEMENTED
Command: Not available
Passed: 0
Failed: 0
Skipped: 0
Known Failures: End-to-end journey testing is planned after core modules exist
Last Run: Not run yet

## Security Tests

Status: PASS_FOR_AUTH_AND_TRIAGE_SLICE
Command: `python -m unittest discover backend/tests`
Passed: Password hashing, token tampering, token expiry, invalid credential, inactive user, missing token, invalid token, user-list role denial, and triage patient-role denial checks
Failed: 0
Skipped: Broader clinical permission-boundary tests pending future APIs
Known Failures: None
Last Run: 2026-09-04

## Compile Checks

Status: PASS
Command: `python -m compileall backend`
Passed: Backend package and tests compiled successfully
Failed: 0
Skipped: 0
Known Failures: None
Last Run: 2026-09-04

## Accessibility Tests

Status: PASS_FOR_WEB_UI_SLICE
Command: `npm test` from `web/`
Passed: React tests use accessible role/name queries for primary dashboard controls and validate no unsupported clinical claims in the triage review view
Failed: 0
Skipped: Formal WCAG audit, browser assistive-technology pass, and automated axe scan
Known Failures: None in current synthetic dashboard test slice
Last Run: 2026-09-04

## Performance Tests

Status: NOT IMPLEMENTED
Command: Not available
Passed: 0
Failed: 0
Skipped: 0
Known Failures: Performance targets are not defined yet
Last Run: Not run yet
