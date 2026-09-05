"""initial database foundation

Revision ID: 20260904_0001
Revises:
Create Date: 2026-09-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260904_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


REFERRAL_STATUSES = [
    "CREATED",
    "ACCEPTED",
    "APPOINTMENT_PENDING",
    "APPOINTMENT_BOOKED",
    "PATIENT_NOTIFIED",
    "PATIENT_ARRIVED",
    "CONSULTATION_COMPLETED",
    "REFERRED_BACK",
    "COMPLETED",
    "CANCELLED",
    "EXPIRED",
]

APPOINTMENT_STATUSES = [
    "REQUESTED",
    "CONFIRMED",
    "CHECKED_IN",
    "IN_QUEUE",
    "IN_CONSULTATION",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
]

FOLLOW_UP_STATUSES = [
    "PENDING",
    "CONTACT_ATTEMPTED",
    "COMPLETED",
    "MISSED",
    "ESCALATED",
    "CANCELLED",
]

SYNC_STATUSES = [
    "PENDING",
    "SYNCING",
    "SYNCED",
    "FAILED",
    "CONFLICT",
]


def enum_type(name: str, values: list[str]) -> sa.Enum:
    return sa.Enum(
        *values,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
    )


def uuid_pk() -> sa.Column:
    return sa.Column(
        "id",
        postgresql.UUID(as_uuid=True),
        server_default=sa.text("gen_random_uuid()"),
        nullable=False,
    )


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "users",
        uuid_pk(),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column(
            "role",
            enum_type(
                "user_role",
                ["PATIENT", "FRONTLINE_WORKER", "DOCTOR", "FACILITY_COORDINATOR", "ADMIN"],
            ),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_is_active", "users", ["is_active"])

    op.create_table(
        "organizations",
        uuid_pk(),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "organization_type",
            enum_type(
                "organization_type",
                [
                    "CLINIC",
                    "PRIMARY_HEALTH_CENTER",
                    "DISTRICT_HOSPITAL",
                    "DIAGNOSTIC_CENTER",
                    "ADMINISTRATIVE",
                ],
            ),
            nullable=False,
        ),
        sa.Column("district", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=120), nullable=True),
        sa.Column("phone_number", sa.String(length=32), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organizations")),
    )
    op.create_index("ix_organizations_type", "organizations", ["organization_type"])

    op.create_table(
        "patients",
        uuid_pk(),
        sa.Column("external_id", sa.String(length=64), nullable=True),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("sex", sa.String(length=32), nullable=True),
        sa.Column("phone_number", sa.String(length=32), nullable=True),
        sa.Column("village", sa.String(length=120), nullable=True),
        sa.Column("district", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=120), nullable=True),
        sa.Column("preferred_language", sa.String(length=16), nullable=False),
        sa.Column("synthetic_label", sa.Boolean(), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        *timestamps(),
        sa.CheckConstraint("preferred_language <> ''", name=op.f("ck_patients_preferred_language_not_empty")),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], name=op.f("fk_patients_created_by_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_patients")),
        sa.UniqueConstraint("external_id", name=op.f("uq_patients_external_id")),
    )
    op.create_index("ix_patients_external_id", "patients", ["external_id"])
    op.create_index("ix_patients_name", "patients", ["full_name"])
    op.create_index("ix_patients_created_by_user_id", "patients", ["created_by_user_id"])

    op.create_table(
        "practitioner_profiles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("registration_number", sa.String(length=80), nullable=True),
        sa.Column("specialty", sa.String(length=120), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_practitioner_profiles_organization_id_organizations")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_practitioner_profiles_user_id_users")),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_practitioner_profiles")),
    )
    op.create_index("ix_practitioner_profiles_organization_id", "practitioner_profiles", ["organization_id"])

    op.create_table(
        "consents",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("consent_type", enum_type("consent_type", ["REGISTRATION", "CARE_COORDINATION", "DATA_SHARING"]), nullable=False),
        sa.Column("status", enum_type("consent_status", ["GRANTED", "REVOKED"]), nullable=False),
        sa.Column("recorded_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=80), nullable=True),
        *timestamps(),
        sa.CheckConstraint("(status <> 'GRANTED') OR (granted_at IS NOT NULL)", name=op.f("ck_consents_granted_consent_has_granted_at")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_consents_patient_id_patients")),
        sa.ForeignKeyConstraint(["recorded_by_user_id"], ["users.id"], name=op.f("fk_consents_recorded_by_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_consents")),
    )
    op.create_index("ix_consents_patient_id", "consents", ["patient_id"])
    op.create_index("ix_consents_recorded_by_user_id", "consents", ["recorded_by_user_id"])
    op.create_index("ix_consents_patient_type_status", "consents", ["patient_id", "consent_type", "status"])

    op.create_table(
        "encounters",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("practitioner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("encounter_type", enum_type("encounter_type", ["REGISTRATION", "TRIAGE", "CONSULTATION", "DIAGNOSTIC", "FOLLOW_UP"]), nullable=False),
        sa.Column("status", enum_type("encounter_status", ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_encounters_organization_id_organizations")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_encounters_patient_id_patients")),
        sa.ForeignKeyConstraint(["practitioner_user_id"], ["users.id"], name=op.f("fk_encounters_practitioner_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_encounters")),
    )
    op.create_index("ix_encounters_patient_id", "encounters", ["patient_id"])
    op.create_index("ix_encounters_organization_id", "encounters", ["organization_id"])
    op.create_index("ix_encounters_practitioner_user_id", "encounters", ["practitioner_user_id"])
    op.create_index("ix_encounters_patient_type", "encounters", ["patient_id", "encounter_type"])

    op.create_table(
        "symptom_reports",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("cough", sa.Boolean(), nullable=False),
        sa.Column("breathlessness", sa.Boolean(), nullable=False),
        sa.Column("fever", sa.Boolean(), nullable=False),
        sa.Column("chest_pain", sa.Boolean(), nullable=False),
        sa.Column("symptom_onset_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("captured_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["captured_by_user_id"], ["users.id"], name=op.f("fk_symptom_reports_captured_by_user_id_users")),
        sa.ForeignKeyConstraint(["encounter_id"], ["encounters.id"], name=op.f("fk_symptom_reports_encounter_id_encounters")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_symptom_reports_patient_id_patients")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_symptom_reports")),
    )
    op.create_index("ix_symptom_reports_patient_id", "symptom_reports", ["patient_id"])
    op.create_index("ix_symptom_reports_encounter_id", "symptom_reports", ["encounter_id"])
    op.create_index("ix_symptom_reports_captured_by_user_id", "symptom_reports", ["captured_by_user_id"])
    op.create_index("ix_symptom_reports_patient_created", "symptom_reports", ["patient_id", "created_at"])

    op.create_table(
        "observations",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("observation_type", enum_type("observation_type", ["RESPIRATORY_RATE", "SPO2", "TEMPERATURE_C", "PULSE", "BLOOD_PRESSURE_SYSTOLIC", "BLOOD_PRESSURE_DIASTOLIC"]), nullable=False),
        sa.Column("value", sa.Numeric(8, 2), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        *timestamps(),
        sa.CheckConstraint("value >= 0", name=op.f("ck_observations_observation_value_non_negative")),
        sa.ForeignKeyConstraint(["encounter_id"], ["encounters.id"], name=op.f("fk_observations_encounter_id_encounters")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_observations_patient_id_patients")),
        sa.ForeignKeyConstraint(["recorded_by_user_id"], ["users.id"], name=op.f("fk_observations_recorded_by_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_observations")),
    )
    op.create_index("ix_observations_patient_id", "observations", ["patient_id"])
    op.create_index("ix_observations_encounter_id", "observations", ["encounter_id"])
    op.create_index("ix_observations_recorded_by_user_id", "observations", ["recorded_by_user_id"])
    op.create_index("ix_observations_patient_type_observed", "observations", ["patient_id", "observation_type", "observed_at"])

    op.create_table(
        "triage_assessments",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("symptom_report_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("model_name", sa.String(length=120), nullable=False),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("risk_level", enum_type("triage_risk_level", ["LOW", "MODERATE", "HIGH", "URGENT"]), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("structured_output", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("human_review_required", sa.Boolean(), nullable=False),
        sa.Column("reviewed_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.CheckConstraint("confidence IS NULL OR (confidence >= 0 AND confidence <= 1)", name=op.f("ck_triage_assessments_triage_confidence_range")),
        sa.CheckConstraint("human_review_required = true", name=op.f("ck_triage_assessments_triage_human_review_required")),
        sa.ForeignKeyConstraint(["encounter_id"], ["encounters.id"], name=op.f("fk_triage_assessments_encounter_id_encounters")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_triage_assessments_patient_id_patients")),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], name=op.f("fk_triage_assessments_reviewed_by_user_id_users")),
        sa.ForeignKeyConstraint(["symptom_report_id"], ["symptom_reports.id"], name=op.f("fk_triage_assessments_symptom_report_id_symptom_reports")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_triage_assessments")),
    )
    op.create_index("ix_triage_assessments_patient_id", "triage_assessments", ["patient_id"])
    op.create_index("ix_triage_assessments_encounter_id", "triage_assessments", ["encounter_id"])
    op.create_index("ix_triage_assessments_symptom_report_id", "triage_assessments", ["symptom_report_id"])
    op.create_index("ix_triage_assessments_reviewed_by_user_id", "triage_assessments", ["reviewed_by_user_id"])
    op.create_index("ix_triage_assessments_patient_created", "triage_assessments", ["patient_id", "created_at"])

    op.create_table(
        "appointments",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("practitioner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", enum_type("appointment_status", APPOINTMENT_STATUSES), nullable=False),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("queue_position", sa.Integer(), nullable=True),
        *timestamps(),
        sa.CheckConstraint("queue_position IS NULL OR queue_position > 0", name=op.f("ck_appointments_appointment_queue_position_positive")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_appointments_organization_id_organizations")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_appointments_patient_id_patients")),
        sa.ForeignKeyConstraint(["practitioner_user_id"], ["users.id"], name=op.f("fk_appointments_practitioner_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointments")),
    )
    op.create_index("ix_appointments_patient_id", "appointments", ["patient_id"])
    op.create_index("ix_appointments_organization_id", "appointments", ["organization_id"])
    op.create_index("ix_appointments_practitioner_user_id", "appointments", ["practitioner_user_id"])
    op.create_index("ix_appointments_patient_status", "appointments", ["patient_id", "status"])
    op.create_index("ix_appointments_org_status_scheduled", "appointments", ["organization_id", "status", "scheduled_start"])

    op.create_table(
        "consultations",
        uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("practitioner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinician_notes", sa.Text(), nullable=False),
        sa.Column("assessment_text", sa.Text(), nullable=True),
        sa.Column("diagnosis_text", sa.Text(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["encounter_id"], ["encounters.id"], name=op.f("fk_consultations_encounter_id_encounters")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_consultations_patient_id_patients")),
        sa.ForeignKeyConstraint(["practitioner_user_id"], ["users.id"], name=op.f("fk_consultations_practitioner_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_consultations")),
    )
    op.create_index("ix_consultations_encounter_id", "consultations", ["encounter_id"])
    op.create_index("ix_consultations_patient_id", "consultations", ["patient_id"])
    op.create_index("ix_consultations_practitioner_user_id", "consultations", ["practitioner_user_id"])

    op.create_table(
        "diagnostic_requests",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("requested_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("test_name", sa.String(length=160), nullable=False),
        sa.Column("status", enum_type("diagnostic_request_status", ["REQUESTED", "SCHEDULED", "COMPLETED", "CANCELLED"]), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["encounter_id"], ["encounters.id"], name=op.f("fk_diagnostic_requests_encounter_id_encounters")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_diagnostic_requests_organization_id_organizations")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_diagnostic_requests_patient_id_patients")),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"], name=op.f("fk_diagnostic_requests_requested_by_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_diagnostic_requests")),
    )
    op.create_index("ix_diagnostic_requests_patient_id", "diagnostic_requests", ["patient_id"])
    op.create_index("ix_diagnostic_requests_encounter_id", "diagnostic_requests", ["encounter_id"])
    op.create_index("ix_diagnostic_requests_requested_by_user_id", "diagnostic_requests", ["requested_by_user_id"])
    op.create_index("ix_diagnostic_requests_organization_id", "diagnostic_requests", ["organization_id"])
    op.create_index("ix_diagnostic_requests_patient_status", "diagnostic_requests", ["patient_id", "status"])

    op.create_table(
        "diagnostic_reports",
        uuid_pk(),
        sa.Column("diagnostic_request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("result_available", sa.Boolean(), nullable=False),
        sa.Column("report_summary", sa.Text(), nullable=True),
        sa.Column("report_file_uri", sa.String(length=500), nullable=True),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["diagnostic_request_id"], ["diagnostic_requests.id"], name=op.f("fk_diagnostic_reports_diagnostic_request_id_diagnostic_requests")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_diagnostic_reports_patient_id_patients")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_diagnostic_reports")),
    )
    op.create_index("ix_diagnostic_reports_diagnostic_request_id", "diagnostic_reports", ["diagnostic_request_id"])
    op.create_index("ix_diagnostic_reports_patient_id", "diagnostic_reports", ["patient_id"])

    op.create_table(
        "medication_requests",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("prescribed_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("medication_name", sa.String(length=180), nullable=False),
        sa.Column("dosage_text", sa.Text(), nullable=False),
        sa.Column("status", enum_type("medication_request_status", ["ACTIVE", "COMPLETED", "CANCELLED"]), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["encounter_id"], ["encounters.id"], name=op.f("fk_medication_requests_encounter_id_encounters")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_medication_requests_patient_id_patients")),
        sa.ForeignKeyConstraint(["prescribed_by_user_id"], ["users.id"], name=op.f("fk_medication_requests_prescribed_by_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_medication_requests")),
    )
    op.create_index("ix_medication_requests_patient_id", "medication_requests", ["patient_id"])
    op.create_index("ix_medication_requests_encounter_id", "medication_requests", ["encounter_id"])
    op.create_index("ix_medication_requests_prescribed_by_user_id", "medication_requests", ["prescribed_by_user_id"])

    op.create_table(
        "referrals",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("destination_organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", enum_type("referral_status", REFERRAL_STATUSES), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("clinical_summary", sa.Text(), nullable=True),
        sa.Column("clinical_summary_generated_by_ai", sa.Boolean(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], name=op.f("fk_referrals_appointment_id_appointments")),
        sa.ForeignKeyConstraint(["destination_organization_id"], ["organizations.id"], name=op.f("fk_referrals_destination_organization_id_organizations")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_referrals_patient_id_patients")),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"], name=op.f("fk_referrals_requested_by_user_id_users")),
        sa.ForeignKeyConstraint(["source_organization_id"], ["organizations.id"], name=op.f("fk_referrals_source_organization_id_organizations")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_referrals")),
    )
    op.create_index("ix_referrals_patient_id", "referrals", ["patient_id"])
    op.create_index("ix_referrals_source_organization_id", "referrals", ["source_organization_id"])
    op.create_index("ix_referrals_destination_organization_id", "referrals", ["destination_organization_id"])
    op.create_index("ix_referrals_requested_by_user_id", "referrals", ["requested_by_user_id"])
    op.create_index("ix_referrals_appointment_id", "referrals", ["appointment_id"])
    op.create_index("ix_referrals_patient_status", "referrals", ["patient_id", "status"])
    op.create_index("ix_referrals_destination_status", "referrals", ["destination_organization_id", "status"])

    op.create_table(
        "care_plans",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("authored_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("plan_text", sa.Text(), nullable=False),
        sa.Column("status", enum_type("care_plan_status", ["ACTIVE", "COMPLETED", "CANCELLED"]), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["authored_by_user_id"], ["users.id"], name=op.f("fk_care_plans_authored_by_user_id_users")),
        sa.ForeignKeyConstraint(["encounter_id"], ["encounters.id"], name=op.f("fk_care_plans_encounter_id_encounters")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_care_plans_patient_id_patients")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_care_plans")),
    )
    op.create_index("ix_care_plans_patient_id", "care_plans", ["patient_id"])
    op.create_index("ix_care_plans_encounter_id", "care_plans", ["encounter_id"])
    op.create_index("ix_care_plans_authored_by_user_id", "care_plans", ["authored_by_user_id"])
    op.create_index("ix_care_plans_patient_status", "care_plans", ["patient_id", "status"])

    op.create_table(
        "follow_ups",
        uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("care_plan_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_to_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", enum_type("follow_up_status", FOLLOW_UP_STATUSES), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["assigned_to_user_id"], ["users.id"], name=op.f("fk_follow_ups_assigned_to_user_id_users")),
        sa.ForeignKeyConstraint(["care_plan_id"], ["care_plans.id"], name=op.f("fk_follow_ups_care_plan_id_care_plans")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_follow_ups_patient_id_patients")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_follow_ups")),
    )
    op.create_index("ix_follow_ups_patient_id", "follow_ups", ["patient_id"])
    op.create_index("ix_follow_ups_care_plan_id", "follow_ups", ["care_plan_id"])
    op.create_index("ix_follow_ups_assigned_to_user_id", "follow_ups", ["assigned_to_user_id"])
    op.create_index("ix_follow_ups_patient_status_due", "follow_ups", ["patient_id", "status", "due_at"])

    op.create_table(
        "audit_logs",
        uuid_pk(),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("entity_type", sa.String(length=120), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("access_reason", sa.String(length=240), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], name=op.f("fk_audit_logs_actor_user_id_users")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_audit_logs_patient_id_patients")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
    )
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])
    op.create_index("ix_audit_logs_patient_id", "audit_logs", ["patient_id"])
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("ix_audit_logs_patient_occurred", "audit_logs", ["patient_id", "occurred_at"])
    op.create_index("ix_audit_logs_actor_occurred", "audit_logs", ["actor_user_id", "occurred_at"])

    op.create_table(
        "sync_records",
        uuid_pk(),
        sa.Column("device_id", sa.String(length=120), nullable=False),
        sa.Column("entity_type", sa.String(length=120), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", enum_type("sync_status", SYNC_STATUSES), nullable=False),
        sa.Column("local_version", sa.Integer(), nullable=False),
        sa.Column("server_version", sa.Integer(), nullable=True),
        sa.Column("conflict_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        *timestamps(),
        sa.CheckConstraint("local_version >= 0", name=op.f("ck_sync_records_sync_local_version_non_negative")),
        sa.CheckConstraint("server_version IS NULL OR server_version >= 0", name=op.f("ck_sync_records_sync_server_version_non_negative")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sync_records")),
        sa.UniqueConstraint("device_id", "entity_type", "entity_id", name="uq_sync_records_device_entity"),
    )
    op.create_index("ix_sync_records_status", "sync_records", ["status"])


def downgrade() -> None:
    op.drop_index("ix_sync_records_status", table_name="sync_records")
    op.drop_table("sync_records")
    op.drop_index("ix_audit_logs_actor_occurred", table_name="audit_logs")
    op.drop_index("ix_audit_logs_patient_occurred", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity", table_name="audit_logs")
    op.drop_index("ix_audit_logs_patient_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_follow_ups_patient_status_due", table_name="follow_ups")
    op.drop_index("ix_follow_ups_assigned_to_user_id", table_name="follow_ups")
    op.drop_index("ix_follow_ups_care_plan_id", table_name="follow_ups")
    op.drop_index("ix_follow_ups_patient_id", table_name="follow_ups")
    op.drop_table("follow_ups")
    op.drop_index("ix_care_plans_patient_status", table_name="care_plans")
    op.drop_index("ix_care_plans_authored_by_user_id", table_name="care_plans")
    op.drop_index("ix_care_plans_encounter_id", table_name="care_plans")
    op.drop_index("ix_care_plans_patient_id", table_name="care_plans")
    op.drop_table("care_plans")
    op.drop_index("ix_referrals_destination_status", table_name="referrals")
    op.drop_index("ix_referrals_patient_status", table_name="referrals")
    op.drop_index("ix_referrals_appointment_id", table_name="referrals")
    op.drop_index("ix_referrals_requested_by_user_id", table_name="referrals")
    op.drop_index("ix_referrals_destination_organization_id", table_name="referrals")
    op.drop_index("ix_referrals_source_organization_id", table_name="referrals")
    op.drop_index("ix_referrals_patient_id", table_name="referrals")
    op.drop_table("referrals")
    op.drop_index("ix_medication_requests_prescribed_by_user_id", table_name="medication_requests")
    op.drop_index("ix_medication_requests_encounter_id", table_name="medication_requests")
    op.drop_index("ix_medication_requests_patient_id", table_name="medication_requests")
    op.drop_table("medication_requests")
    op.drop_index("ix_diagnostic_reports_patient_id", table_name="diagnostic_reports")
    op.drop_index("ix_diagnostic_reports_diagnostic_request_id", table_name="diagnostic_reports")
    op.drop_table("diagnostic_reports")
    op.drop_index("ix_diagnostic_requests_patient_status", table_name="diagnostic_requests")
    op.drop_index("ix_diagnostic_requests_organization_id", table_name="diagnostic_requests")
    op.drop_index("ix_diagnostic_requests_requested_by_user_id", table_name="diagnostic_requests")
    op.drop_index("ix_diagnostic_requests_encounter_id", table_name="diagnostic_requests")
    op.drop_index("ix_diagnostic_requests_patient_id", table_name="diagnostic_requests")
    op.drop_table("diagnostic_requests")
    op.drop_index("ix_consultations_practitioner_user_id", table_name="consultations")
    op.drop_index("ix_consultations_patient_id", table_name="consultations")
    op.drop_index("ix_consultations_encounter_id", table_name="consultations")
    op.drop_table("consultations")
    op.drop_index("ix_appointments_org_status_scheduled", table_name="appointments")
    op.drop_index("ix_appointments_patient_status", table_name="appointments")
    op.drop_index("ix_appointments_practitioner_user_id", table_name="appointments")
    op.drop_index("ix_appointments_organization_id", table_name="appointments")
    op.drop_index("ix_appointments_patient_id", table_name="appointments")
    op.drop_table("appointments")
    op.drop_index("ix_triage_assessments_patient_created", table_name="triage_assessments")
    op.drop_index("ix_triage_assessments_reviewed_by_user_id", table_name="triage_assessments")
    op.drop_index("ix_triage_assessments_symptom_report_id", table_name="triage_assessments")
    op.drop_index("ix_triage_assessments_encounter_id", table_name="triage_assessments")
    op.drop_index("ix_triage_assessments_patient_id", table_name="triage_assessments")
    op.drop_table("triage_assessments")
    op.drop_index("ix_observations_patient_type_observed", table_name="observations")
    op.drop_index("ix_observations_recorded_by_user_id", table_name="observations")
    op.drop_index("ix_observations_encounter_id", table_name="observations")
    op.drop_index("ix_observations_patient_id", table_name="observations")
    op.drop_table("observations")
    op.drop_index("ix_symptom_reports_patient_created", table_name="symptom_reports")
    op.drop_index("ix_symptom_reports_captured_by_user_id", table_name="symptom_reports")
    op.drop_index("ix_symptom_reports_encounter_id", table_name="symptom_reports")
    op.drop_index("ix_symptom_reports_patient_id", table_name="symptom_reports")
    op.drop_table("symptom_reports")
    op.drop_index("ix_encounters_patient_type", table_name="encounters")
    op.drop_index("ix_encounters_practitioner_user_id", table_name="encounters")
    op.drop_index("ix_encounters_organization_id", table_name="encounters")
    op.drop_index("ix_encounters_patient_id", table_name="encounters")
    op.drop_table("encounters")
    op.drop_index("ix_consents_patient_type_status", table_name="consents")
    op.drop_index("ix_consents_recorded_by_user_id", table_name="consents")
    op.drop_index("ix_consents_patient_id", table_name="consents")
    op.drop_table("consents")
    op.drop_index("ix_practitioner_profiles_organization_id", table_name="practitioner_profiles")
    op.drop_table("practitioner_profiles")
    op.drop_index("ix_patients_created_by_user_id", table_name="patients")
    op.drop_index("ix_patients_name", table_name="patients")
    op.drop_index("ix_patients_external_id", table_name="patients")
    op.drop_table("patients")
    op.drop_index("ix_organizations_type", table_name="organizations")
    op.drop_table("organizations")
    op.drop_index("ix_users_is_active", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_table("users")

