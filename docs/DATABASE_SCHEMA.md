# Database Schema

## Current State

The Session 02 database foundation is implemented with SQLAlchemy metadata and an Alembic migration targeting PostgreSQL.

Current files:

- `backend/app/db/base.py`: shared SQLAlchemy declarative base and naming convention.
- `backend/app/db/enums.py`: canonical status and lifecycle enums.
- `backend/app/db/models.py`: current ORM metadata.
- `backend/app/db/session.py`: database URL and session factory helpers.
- `backend/migrations/versions/20260904_0001_initial_database_foundation.py`: initial migration.
- `backend/seeds/synthetic_demo.json`: clearly labeled synthetic demo seed data.

`docker-compose.yml` defines a local PostgreSQL 16 service. Live migration execution was not run in this environment because Docker is unavailable and the PostgreSQL driver is not installed globally. Offline Alembic SQL rendering passes.

## Entity Summary

### users

Purpose: Stores application identities for patients, frontline workers, doctors, facility coordinators, and administrators.

Columns: `id`, `email`, `password_hash`, `full_name`, `role`, `is_active`, `created_at`, `updated_at`.

Primary Key: `id`.

Indexes and Constraints: unique `email`; indexes on `role` and `is_active`; constrained `user_role`.

Lifecycle: Authentication and RBAC behavior will be implemented in Session 03.

### organizations

Purpose: Stores care delivery and administrative organizations.

Columns: `id`, `name`, `organization_type`, `district`, `state`, `phone_number`, `is_active`, `created_at`, `updated_at`.

Primary Key: `id`.

Indexes and Constraints: index on `organization_type`; constrained organization type.

Relationships: Referenced by practitioner profiles, encounters, appointments, referrals, and diagnostic requests.

### patients

Purpose: Stores minimal patient identity and demographic data.

Columns: `id`, `external_id`, `full_name`, `date_of_birth`, `sex`, `phone_number`, `village`, `district`, `state`, `preferred_language`, `synthetic_label`, `created_by_user_id`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `created_by_user_id -> users.id`.

Indexes and Constraints: unique `external_id`; indexes on `external_id`, `full_name`, and `created_by_user_id`; non-empty `preferred_language`.

Lifecycle: Clinical history is kept in related normalized tables, not overwritten on the patient row.

### practitioner_profiles

Purpose: Stores clinician/facility profile data for user accounts.

Columns: `user_id`, `organization_id`, `registration_number`, `specialty`, `created_at`, `updated_at`.

Primary Key: `user_id`.

Foreign Keys: `user_id -> users.id`; `organization_id -> organizations.id`.

Indexes: `organization_id`.

### consents

Purpose: Preserves consent history for registration, care coordination, and data sharing.

Columns: `id`, `patient_id`, `consent_type`, `status`, `recorded_by_user_id`, `granted_at`, `revoked_at`, `source`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `recorded_by_user_id -> users.id`.

Indexes and Constraints: patient/type/status index; granted consent requires `granted_at`; constrained consent type and status.

Lifecycle: Consent changes create historical rows rather than silently overwriting prior consent records.

### encounters

Purpose: Represents registration, triage, consultation, diagnostic, and follow-up encounters.

Columns: `id`, `patient_id`, `organization_id`, `practitioner_user_id`, `encounter_type`, `status`, `started_at`, `ended_at`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `organization_id -> organizations.id`; `practitioner_user_id -> users.id`.

Indexes and Constraints: indexes on patient, organization, practitioner, and patient/type; constrained encounter type and status.

### symptom_reports

Purpose: Stores reported symptoms as historical records.

Columns: `id`, `patient_id`, `encounter_id`, `cough`, `breathlessness`, `fever`, `chest_pain`, `symptom_onset_at`, `notes`, `captured_by_user_id`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `encounter_id -> encounters.id`; `captured_by_user_id -> users.id`.

Indexes: patient, encounter, captured-by user, and patient/created timestamp.

### observations

Purpose: Stores vitals and clinical observations as historical measurements.

Columns: `id`, `patient_id`, `encounter_id`, `observation_type`, `value`, `unit`, `observed_at`, `recorded_by_user_id`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `encounter_id -> encounters.id`; `recorded_by_user_id -> users.id`.

Indexes and Constraints: patient/type/observed timestamp index; non-negative numeric value; constrained observation type.

### triage_assessments

Purpose: Stores AI or decision-support triage outputs that require human review.

Columns: `id`, `patient_id`, `encounter_id`, `symptom_report_id`, `model_name`, `model_version`, `risk_level`, `confidence`, `explanation`, `structured_output`, `human_review_required`, `reviewed_by_user_id`, `reviewed_at`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `encounter_id -> encounters.id`; `symptom_report_id -> symptom_reports.id`; `reviewed_by_user_id -> users.id`.

Indexes and Constraints: patient/created timestamp index; constrained risk level; confidence must be null or between 0 and 1; `human_review_required` must be true.

Lifecycle: AI output is persisted as support material and cannot become an official clinical decision without human review.

### appointments

Purpose: Stores appointment and queue lifecycle data.

Columns: `id`, `patient_id`, `organization_id`, `practitioner_user_id`, `status`, `scheduled_start`, `checked_in_at`, `queue_position`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `organization_id -> organizations.id`; `practitioner_user_id -> users.id`.

Indexes and Constraints: patient/status index; organization/status/scheduled index; positive queue position when present; exact appointment status constraint.

### consultations

Purpose: Stores clinician-authored consultation records.

Columns: `id`, `encounter_id`, `patient_id`, `practitioner_user_id`, `clinician_notes`, `assessment_text`, `diagnosis_text`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `encounter_id -> encounters.id`; `patient_id -> patients.id`; `practitioner_user_id -> users.id`.

Indexes: encounter, patient, and practitioner.

Lifecycle: Consultation and diagnosis text are clinician-authored fields.

### diagnostic_requests

Purpose: Stores diagnostic orders and availability workflow state.

Columns: `id`, `patient_id`, `encounter_id`, `requested_by_user_id`, `organization_id`, `test_name`, `status`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `encounter_id -> encounters.id`; `requested_by_user_id -> users.id`; `organization_id -> organizations.id`.

Indexes and Constraints: patient/status index; constrained diagnostic request status.

### diagnostic_reports

Purpose: Stores diagnostic result availability and report summaries.

Columns: `id`, `diagnostic_request_id`, `patient_id`, `result_available`, `report_summary`, `report_file_uri`, `reported_at`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `diagnostic_request_id -> diagnostic_requests.id`; `patient_id -> patients.id`.

Indexes: diagnostic request and patient.

### medication_requests

Purpose: Stores clinician-prescribed medication requests.

Columns: `id`, `patient_id`, `encounter_id`, `prescribed_by_user_id`, `medication_name`, `dosage_text`, `status`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `encounter_id -> encounters.id`; `prescribed_by_user_id -> users.id`.

Indexes and Constraints: patient, encounter, prescribed-by user; constrained medication request status.

Lifecycle: Medication requests must be clinician-authored and must not be created autonomously by AI.

### referrals

Purpose: Stores referral lifecycle and coordination state.

Columns: `id`, `patient_id`, `source_organization_id`, `destination_organization_id`, `requested_by_user_id`, `appointment_id`, `status`, `reason`, `clinical_summary`, `clinical_summary_generated_by_ai`, `expires_at`, `completed_at`, `cancelled_at`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `source_organization_id -> organizations.id`; `destination_organization_id -> organizations.id`; `requested_by_user_id -> users.id`; `appointment_id -> appointments.id`.

Indexes and Constraints: patient/status index; destination/status index; exact referral status constraint.

Lifecycle: Referral state changes must be performed by the future workflow engine, not by ad hoc updates.

### care_plans

Purpose: Stores clinician-authored care plans.

Columns: `id`, `patient_id`, `encounter_id`, `authored_by_user_id`, `title`, `plan_text`, `status`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `encounter_id -> encounters.id`; `authored_by_user_id -> users.id`.

Indexes and Constraints: patient/status index; constrained care plan status.

### follow_ups

Purpose: Stores follow-up lifecycle state.

Columns: `id`, `patient_id`, `care_plan_id`, `assigned_to_user_id`, `status`, `due_at`, `completed_at`, `notes`, `created_at`, `updated_at`.

Primary Key: `id`.

Foreign Keys: `patient_id -> patients.id`; `care_plan_id -> care_plans.id`; `assigned_to_user_id -> users.id`.

Indexes and Constraints: patient/status/due index; exact follow-up status constraint.

### audit_logs

Purpose: Records sensitive access and important system actions.

Columns: `id`, `actor_user_id`, `patient_id`, `action`, `entity_type`, `entity_id`, `access_reason`, `ip_address`, `metadata`, `occurred_at`.

Primary Key: `id`.

Foreign Keys: `actor_user_id -> users.id`; `patient_id -> patients.id`.

Indexes: entity, patient/occurred timestamp, actor/occurred timestamp.

Lifecycle: Future APIs must write audit records for sensitive authorization and patient-data access.

### sync_records

Purpose: Stores synchronization state for offline-first workflows.

Columns: `id`, `device_id`, `entity_type`, `entity_id`, `status`, `local_version`, `server_version`, `conflict_payload`, `last_attempt_at`, `created_at`, `updated_at`.

Primary Key: `id`.

Indexes and Constraints: unique device/entity tuple; index on status; non-negative local and server versions; exact sync status constraint.

Lifecycle: Future mobile sync logic must use this table to represent pending, syncing, synced, failed, and conflict states without silent overwrites.

## Canonical Lifecycle Values

Referral statuses:

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

Appointment statuses:

- `REQUESTED`
- `CONFIRMED`
- `CHECKED_IN`
- `IN_QUEUE`
- `IN_CONSULTATION`
- `COMPLETED`
- `CANCELLED`
- `NO_SHOW`

Follow-up statuses:

- `PENDING`
- `CONTACT_ATTEMPTED`
- `COMPLETED`
- `MISSED`
- `ESCALATED`
- `CANCELLED`

Sync statuses:

- `PENDING`
- `SYNCING`
- `SYNCED`
- `FAILED`
- `CONFLICT`

## Migration History

### 20260904_0001_initial_database_foundation

Status: Implemented and rendered successfully with Alembic offline SQL.

Creates:

- pgcrypto extension for UUID generation.
- 19 normalized application tables.
- canonical status constraints.
- foreign keys and indexes.
- audit log and sync metadata structures.

Live execution against PostgreSQL remains pending because Docker is unavailable in the current environment.
