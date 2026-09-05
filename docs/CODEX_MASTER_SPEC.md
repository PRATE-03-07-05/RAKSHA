# RAKSHA Master Specification

## Objective

RAKSHA is an AI-enabled integrated healthcare access and care-coordination platform for rural and underserved communities. It must support a complete synthetic demonstration journey from patient registration through triage, human review, appointment or queue management, consultation, diagnostics or treatment, referral when necessary, referral completion, care plan, follow-up, and administrative visibility.

This file is the permanent product-level source of truth. It must not claim that planned functionality exists until implementation, tests, and supporting documentation confirm it.

## Source Of Truth Rules

1. The current repository implementation is the highest-authority description of what exists.
2. This master specification describes intended behavior.
3. `CODEX_EXECUTION_PLAN.md` defines the staged implementation sequence.
4. Supporting documents describe current architecture, schema, APIs, AI, UI, tests, decisions, issues, progress, and handoff state.
5. Contradictions must be recorded in `DECISIONS.md` and repaired before building new dependent features.

## Product Layers

### Data Layer

PostgreSQL is the authoritative transactional database. The system must use normalized entities, foreign keys, indexes, constraints, migrations, audit logs, and lifecycle or status fields. Clinical history must be preserved rather than silently overwritten. Patient information must not be stored as one unstructured table.

### Backend Layer

The backend must use FastAPI with typed request and response schemas, server-side validation, authentication, RBAC, explicit workflow transitions, consistent error responses, audit logging, background jobs, and service modules. Sensitive authorization decisions must occur on the server.

### Frontend Layer

The patient and frontline workflow must use Flutter. Doctor, facility, and administrator workflows must use React and TypeScript. Frontend role capabilities must match the backend RBAC model. Important screens must include loading, empty, success, validation-error, server-error, and offline states where relevant.

## Canonical Workflow

Registration -> Consent -> Symptoms/Vitals -> AI-assisted triage -> Human review -> Appointment/Queue -> Consultation -> Diagnostics/Treatment -> Referral when necessary -> Referral completion -> Care plan -> Follow-up.

## Status Taxonomy

Referral statuses must remain exactly:

- `CREATED`
- `ACCEPTED`
- `APPOINTMENT_PENDING`
- `APPOINTMENT_BOOKED`
- `PATIENT_NOTIFIED`
- `PATIENT_ARRIVED`
- `CONSULTATION_COMPLETED`
- `REFERRED_BACK`
- `COMPLETED`
- `CANCELLED`
- `EXPIRED`

Appointment statuses must remain exactly:

- `REQUESTED`
- `CONFIRMED`
- `CHECKED_IN`
- `IN_QUEUE`
- `IN_CONSULTATION`
- `COMPLETED`
- `CANCELLED`
- `NO_SHOW`

Follow-up statuses must remain exactly:

- `PENDING`
- `CONTACT_ATTEMPTED`
- `COMPLETED`
- `MISSED`
- `ESCALATED`
- `CANCELLED`

These values must remain consistent across database enums or constraints, backend schemas, mobile types, web types, tests, seed data, and documentation.

## Users And Roles

Required role families:

- Patient: registers, gives consent, reports symptoms, views status, receives reminders and care instructions.
- Frontline worker: assists registration, captures vitals, supports offline workflows, synchronizes field data, guides patient actions.
- Doctor or clinician: reviews AI-assisted triage, conducts consultation, enters diagnosis or assessment, orders diagnostics, creates treatment plans, initiates referrals.
- Facility coordinator: manages appointments, queues, diagnostic availability, referral acceptance, arrival, and completion coordination.
- Administrator: monitors synthetic demo operations, audits access, manages users and facilities, views operational KPIs.

Exact permissions must be encoded server-side before sensitive functionality is exposed.

## Functional Requirements

- Patient registration and consent capture.
- Symptoms and vitals capture.
- AI-assisted acute respiratory risk triage for prompt professional review.
- Human review before clinical decisions.
- Appointment and queue workflow.
- Consultation records.
- Diagnostics and treatment support.
- Referral creation, acceptance, appointment booking, patient notification, arrival, consultation completion, referred-back state, completion, cancellation, and expiry.
- Care plans and follow-up tracking.
- Offline-first field workflows on mobile.
- Synchronization conflict detection.
- Notifications for meaningful patient and workflow events.
- Interoperability-ready mappings to FHIR-compatible concepts.
- Synthetic demo data clearly labeled as synthetic.

## AI Requirements

The AI system is clinical decision support only. It must never autonomously diagnose, prescribe, modify official diagnoses, cancel referrals, override a healthcare professional, or present output as clinically validated unless that validation exists.

Every clinical AI result must include:

- structured output
- model name and version
- timestamp
- confidence where appropriate
- explanation
- human-review requirement

The initial severe-illness use case must identify high-risk acute respiratory presentations requiring prompt professional review, not make a disease diagnosis. Start with a transparent baseline such as logistic regression and compare suitable tree-based models. Evaluate sensitivity, specificity, precision, recall, F1, PR-AUC, ROC-AUC, and calibration. Store model version with every prediction. Provide clinician-suitable explainability. If the AI service is unavailable, the workflow must continue through manual review.

LLM features may be implemented only for safe assistance such as multilingual translation, record summarization, symptom extraction, missing-information detection, and referral-summary drafting. LLMs must not invent clinical facts. AI-generated summaries must be clearly distinguished from clinician-authored records.

## Offline Requirements

The Flutter application must support offline-first field workflows for approved core actions. Local records must carry synchronization metadata and explicitly represent:

- `PENDING`
- `SYNCING`
- `SYNCED`
- `FAILED`
- `CONFLICT`

Conflicting clinical information must never be silently overwritten. UI must clearly show whether information is current, waiting for synchronization, failed, or conflicted.

## Interoperability Requirements

Internal resources must be mapped to FHIR-compatible concepts, including:

- Patient
- Encounter
- Observation
- Condition
- MedicationRequest
- DiagnosticReport
- ServiceRequest
- Practitioner
- Organization
- Appointment
- CarePlan

Official ABDM integration must not be faked. Sandbox or mock integrations must be clearly labeled. Production ABDM connectivity requires valid API specifications, credentials, approvals, and deployment conditions.

## Privacy, Security, And Compliance

RAKSHA must follow privacy-by-design principles:

- minimize data collection
- enforce least privilege
- use secure authentication
- protect private files
- log sensitive access
- encrypt data in transit
- use appropriate encryption at rest
- keep secrets out of source code

DPDP and applicable health-data or telemedicine requirements are deployment constraints that must be reviewed for the final jurisdiction and operational context.

## UI Requirements

The UI must be simple, trustworthy, readable, accessible, and suitable for rural or low-literacy contexts. It must prioritize clear status, next actions, and safe workflows over decorative dashboards. It must support multilingual UI through translation keys rather than hardcoded strings. It must not rely on color alone to communicate risk. The web interface must follow WCAG 2.2 accessibility practices.

## Testing Requirements

Automated tests are required for:

- authentication
- RBAC
- database constraints
- API validation
- workflow transitions
- referral completion
- appointment and queue management
- offline synchronization
- AI endpoint structure
- permission boundaries
- important frontend workflows
- complete end-to-end patient journey

A feature is not complete until its database model, backend API, frontend UI, tests, and documentation agree.

## Prohibited Functionality

- No autonomous AI diagnosis or prescribing.
- No AI override of healthcare professionals.
- No fake production ABDM integration.
- No hardcoded patient data in production code.
- No placeholder healthcare claims.
- No dead navigation or fake buttons.
- No silent overwrite of clinical conflicts.
- No undocumented significant implementation changes.

