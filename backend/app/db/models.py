from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base
from backend.app.db.enums import (
    AppointmentStatus,
    CarePlanStatus,
    ConsentStatus,
    ConsentType,
    DiagnosticRequestStatus,
    EncounterStatus,
    EncounterType,
    FollowUpStatus,
    MedicationRequestStatus,
    ObservationType,
    OrganizationType,
    ReferralStatus,
    SyncStatus,
    TriageRiskLevel,
    UserRole,
    enum_values,
)


def constrained_enum(enum_cls: type[Enum], name: str) -> SQLAlchemyEnum:
    return SQLAlchemyEnum(
        enum_cls,
        values_callable=enum_values,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
    )


class UuidPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class User(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        constrained_enum(UserRole, "user_role"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_users_role", "role"),
        Index("ix_users_is_active", "is_active"),
    )


class Organization(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    organization_type: Mapped[OrganizationType] = mapped_column(
        constrained_enum(OrganizationType, "organization_type"),
        nullable=False,
    )
    district: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    phone_number: Mapped[str | None] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (Index("ix_organizations_type", "organization_type"),)


class Patient(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "patients"

    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    sex: Mapped[str | None] = mapped_column(String(32))
    phone_number: Mapped[str | None] = mapped_column(String(32))
    village: Mapped[str | None] = mapped_column(String(120))
    district: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    preferred_language: Mapped[str] = mapped_column(String(16), nullable=False, default="hi")
    synthetic_label: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
    )

    __table_args__ = (
        Index("ix_patients_external_id", "external_id"),
        Index("ix_patients_name", "full_name"),
        CheckConstraint(
            "preferred_language <> ''",
            name="preferred_language_not_empty",
        ),
    )


class PractitionerProfile(TimestampMixin, Base):
    __tablename__ = "practitioner_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    registration_number: Mapped[str | None] = mapped_column(String(80))
    specialty: Mapped[str | None] = mapped_column(String(120))


class Consent(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "consents"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    consent_type: Mapped[ConsentType] = mapped_column(
        constrained_enum(ConsentType, "consent_type"),
        nullable=False,
    )
    status: Mapped[ConsentStatus] = mapped_column(
        constrained_enum(ConsentStatus, "consent_status"),
        nullable=False,
    )
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
    )
    granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source: Mapped[str | None] = mapped_column(String(80))

    __table_args__ = (
        Index("ix_consents_patient_type_status", "patient_id", "consent_type", "status"),
        CheckConstraint(
            "(status <> 'GRANTED') OR (granted_at IS NOT NULL)",
            name="granted_consent_has_granted_at",
        ),
    )


class Encounter(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "encounters"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        index=True,
    )
    practitioner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
    )
    encounter_type: Mapped[EncounterType] = mapped_column(
        constrained_enum(EncounterType, "encounter_type"),
        nullable=False,
    )
    status: Mapped[EncounterStatus] = mapped_column(
        constrained_enum(EncounterStatus, "encounter_status"),
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (Index("ix_encounters_patient_type", "patient_id", "encounter_type"),)


class SymptomReport(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "symptom_reports"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("encounters.id"),
        index=True,
    )
    cough: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    breathlessness: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fever: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    chest_pain: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    symptom_onset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    captured_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
    )

    __table_args__ = (Index("ix_symptom_reports_patient_created", "patient_id", "created_at"),)


class Observation(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "observations"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("encounters.id"),
        index=True,
    )
    observation_type: Mapped[ObservationType] = mapped_column(
        constrained_enum(ObservationType, "observation_type"),
        nullable=False,
    )
    value: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
    )

    __table_args__ = (
        Index("ix_observations_patient_type_observed", "patient_id", "observation_type", "observed_at"),
        CheckConstraint("value >= 0", name="observation_value_non_negative"),
    )


class TriageAssessment(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "triage_assessments"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("encounters.id"),
        index=True,
    )
    symptom_report_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("symptom_reports.id"),
        index=True,
    )
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    risk_level: Mapped[TriageRiskLevel] = mapped_column(
        constrained_enum(TriageRiskLevel, "triage_risk_level"),
        nullable=False,
    )
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    structured_output: Mapped[dict] = mapped_column(postgresql.JSONB, nullable=False)
    human_review_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_triage_assessments_patient_created", "patient_id", "created_at"),
        CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="triage_confidence_range",
        ),
        CheckConstraint(
            "human_review_required = true",
            name="triage_human_review_required",
        ),
    )


class Appointment(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "appointments"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    practitioner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        constrained_enum(AppointmentStatus, "appointment_status"),
        nullable=False,
    )
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    queue_position: Mapped[int | None] = mapped_column(Integer)

    __table_args__ = (
        Index("ix_appointments_patient_status", "patient_id", "status"),
        Index("ix_appointments_org_status_scheduled", "organization_id", "status", "scheduled_start"),
        CheckConstraint(
            "queue_position IS NULL OR queue_position > 0",
            name="appointment_queue_position_positive",
        ),
    )


class Consultation(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "consultations"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("encounters.id"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    practitioner_user_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    clinician_notes: Mapped[str] = mapped_column(Text, nullable=False)
    assessment_text: Mapped[str | None] = mapped_column(Text)
    diagnosis_text: Mapped[str | None] = mapped_column(Text)


class DiagnosticRequest(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "diagnostic_requests"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("encounters.id"),
        index=True,
    )
    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        index=True,
    )
    test_name: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[DiagnosticRequestStatus] = mapped_column(
        constrained_enum(DiagnosticRequestStatus, "diagnostic_request_status"),
        nullable=False,
    )

    __table_args__ = (Index("ix_diagnostic_requests_patient_status", "patient_id", "status"),)


class DiagnosticReport(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "diagnostic_reports"

    diagnostic_request_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("diagnostic_requests.id"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    result_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    report_summary: Mapped[str | None] = mapped_column(Text)
    report_file_uri: Mapped[str | None] = mapped_column(String(500))
    reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MedicationRequest(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "medication_requests"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("encounters.id"),
        index=True,
    )
    prescribed_by_user_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    medication_name: Mapped[str] = mapped_column(String(180), nullable=False)
    dosage_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[MedicationRequestStatus] = mapped_column(
        constrained_enum(MedicationRequestStatus, "medication_request_status"),
        nullable=False,
    )


class Referral(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "referrals"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    source_organization_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    destination_organization_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("appointments.id"),
        index=True,
    )
    status: Mapped[ReferralStatus] = mapped_column(
        constrained_enum(ReferralStatus, "referral_status"),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    clinical_summary: Mapped[str | None] = mapped_column(Text)
    clinical_summary_generated_by_ai: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_referrals_patient_status", "patient_id", "status"),
        Index("ix_referrals_destination_status", "destination_organization_id", "status"),
    )


class CarePlan(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "care_plans"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    encounter_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("encounters.id"),
        index=True,
    )
    authored_by_user_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    plan_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[CarePlanStatus] = mapped_column(
        constrained_enum(CarePlanStatus, "care_plan_status"),
        nullable=False,
    )

    __table_args__ = (Index("ix_care_plans_patient_status", "patient_id", "status"),)


class FollowUp(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "follow_ups"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )
    care_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("care_plans.id"),
        index=True,
    )
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
    )
    status: Mapped[FollowUpStatus] = mapped_column(
        constrained_enum(FollowUpStatus, "follow_up_status"),
        nullable=False,
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (Index("ix_follow_ups_patient_status_due", "patient_id", "status", "due_at"),)


class AuditLog(UuidPrimaryKeyMixin, Base):
    __tablename__ = "audit_logs"

    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
    )
    patient_id: Mapped[uuid.UUID | None] = mapped_column(
        postgresql.UUID(as_uuid=True),
        ForeignKey("patients.id"),
        index=True,
    )
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(postgresql.UUID(as_uuid=True))
    access_reason: Mapped[str | None] = mapped_column(String(240))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    event_metadata: Mapped[dict] = mapped_column(
        "metadata",
        postgresql.JSONB,
        nullable=False,
        default=dict,
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_patient_occurred", "patient_id", "occurred_at"),
        Index("ix_audit_logs_actor_occurred", "actor_user_id", "occurred_at"),
    )


class SyncRecord(UuidPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "sync_records"

    device_id: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(postgresql.UUID(as_uuid=True), nullable=False)
    status: Mapped[SyncStatus] = mapped_column(
        constrained_enum(SyncStatus, "sync_status"),
        nullable=False,
    )
    local_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    server_version: Mapped[int | None] = mapped_column(Integer)
    conflict_payload: Mapped[dict | None] = mapped_column(postgresql.JSONB)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("device_id", "entity_type", "entity_id", name="uq_sync_records_device_entity"),
        Index("ix_sync_records_status", "status"),
        CheckConstraint("local_version >= 0", name="sync_local_version_non_negative"),
        CheckConstraint(
            "server_version IS NULL OR server_version >= 0",
            name="sync_server_version_non_negative",
        ),
    )

