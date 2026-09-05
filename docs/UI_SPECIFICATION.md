# UI Specification

## Current State

The Flutter patient/frontline application is implemented under `mobile/` for the initial synthetic demo workflow. The React doctor/facility/admin dashboard is implemented under `web/` with synthetic local state.

## Patient Mobile

Implemented patient workflows:

- role switch into patient mode
- synthetic patient status review
- consent status display
- triage human-review status display
- appointment-request status display
- follow-up support action that queues a local triage-help request

Planned patient workflows still pending:

- authenticated backend patient session
- durable registration and symptom submission
- notifications
- care-plan detail viewing
- production patient-specific authorization

## Frontline Worker Mobile

Implemented frontline workflows:

- assisted registration fields for patient name, village, and age
- consent capture toggle
- symptoms and vitals capture for cough, breathlessness, fever, chest pain, severe weakness, cyanosis, respiratory rate, SpO2, and temperature
- respiratory risk preview with decision-support-only and human-review-required labels
- local offline draft queue for registration, symptoms/vitals, and respiratory triage review
- synchronization status display for `PENDING`, `SYNCING`, `SYNCED`, `FAILED`, and `CONFLICT`
- retry and conflict-marking actions

The current offline queue is in-memory UI state only. Durable offline persistence and backend synchronization are planned for Session 08.

## Doctor Dashboard

Implemented doctor workflows:

- role switch into doctor mode
- synthetic triage-review worklist
- patient context, vitals, appointment, referral, and follow-up status display
- respiratory risk summary labeled as clinical decision support only
- mandatory human-review-required label
- record human-review action
- prepare consultation action

Planned doctor workflows still pending:

- authenticated backend doctor session
- live triage assessment retrieval
- consultation documentation APIs
- diagnostic orders
- clinician-authored treatment plans
- referrals, care plans, and follow-up updates through backend workflow APIs

## Facility Dashboard

Implemented facility workflows:

- role switch into facility mode
- synthetic referral status display
- referral advancement controls
- synthetic appointment status display
- appointment advancement controls
- clear current/next state labels

Planned facility workflows still pending:

- authenticated backend facility session
- live referral and appointment APIs
- patient notification integration
- diagnostic availability integration
- destination-hospital coordination

## Admin Dashboard

Implemented admin workflows:

- role switch into admin mode
- synthetic operational KPI display
- audit hook note
- workflow and sync exception review actions
- local flagging of failed or conflicting sync items

Planned admin workflows still pending:

- authenticated backend admin session
- live user and facility administration
- audit log API browsing
- production analytics and reporting

## Design Requirements

- Simple, trustworthy, rural-friendly interface.
- Translation-key based multilingual UI.
- Clear next actions and status.
- Loading, empty, success, validation-error, server-error, and offline states where relevant.
- No reliance on color alone for risk communication.
- WCAG 2.2-oriented web accessibility.
- No fake buttons, dead navigation, unsupported clinical claims, or hardcoded production patient data.

## Current Implemented UI

Implemented:

- Flutter app in `mobile/lib/main.dart`.
- Widget and contract tests in `mobile/test/widget_test.dart`.
- Android and web Flutter targets generated for local development and testability.
- React app in `web/src/App.tsx`.
- Web dashboard styles in `web/src/App.css`.
- Web dashboard tests in `web/src/App.test.tsx`.

Not implemented:

- Durable offline storage.
- Real backend API synchronization from the mobile app.
- Real backend API synchronization from the React dashboard.
- Push or SMS notifications.
