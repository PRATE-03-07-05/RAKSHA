# Demo Scenario

## Current State

The canonical demo journey is planned but not implemented end to end yet.

Session 02 adds `backend/seeds/synthetic_demo.json`, which reserves a clearly labeled synthetic patient and consistent journey IDs for future implementation. These seed records are not loaded into a database yet because live PostgreSQL migration execution is pending in the current environment.

Session 05 adds protected respiratory risk triage decision support for the synthetic triage step. This implementation can create a structured triage assessment for the reserved synthetic patient ID when the database contains the patient record. It remains decision support only and requires human review.

Session 06 adds a Flutter patient/frontline app that can demonstrate the synthetic patient journey through role switching, consent capture, symptom/vitals capture, respiratory risk preview, local triage-review queueing, and visible sync states. The current local queue is in-memory only and does not yet synchronize with the backend.

Session 07 adds a React doctor/facility/admin dashboard that can demonstrate the synthetic patient journey through triage human review, consultation preparation, referral and appointment status movement, operational KPI display, and sync exception review. The current dashboard uses local synthetic state and does not yet synchronize with the backend.

All demo data must remain synthetic and clearly labeled as synthetic.

## Planned Primary Synthetic Patient Journey

1. Patient Registration - implemented mobile UI scaffold
2. Consent - implemented mobile UI scaffold
3. Symptoms/Vitals - implemented mobile UI scaffold
4. AI-Assisted Triage - implemented backend scaffold and mobile decision-support preview
5. Human Review - implemented web UI scaffold
6. Appointment/Queue - implemented web UI scaffold
7. Doctor Consultation - consultation preparation implemented as web UI scaffold
8. Diagnostic Request
9. Diagnostic Availability Check
10. Referral
11. Destination Hospital
12. Consultation
13. Care Plan
14. Follow-Up
15. Admin Dashboard - implemented web UI scaffold

## Consistency Requirement

The final demo must use one consistent synthetic patient across modules so that the same patient ID, referral, appointment, diagnostic result, and follow-up appear consistently across mobile, doctor dashboard, facility workflow, and administrator dashboard.

Current reserved synthetic patient:

- Patient: `SYNTH-RAKSHA-001`
- Name: `Asha Devi`
- Patient UUID: `00000000-0000-4000-8000-000000000001`
- Initial referral status: `CREATED`
- Initial appointment status: `REQUESTED`
- Initial follow-up status: `PENDING`

## Safety Label

Demo records must be labeled synthetic and must not imply real clinical validation, real patient care, or production ABDM connectivity.
