"""RAKSHA relational data model (SQLAlchemy 2.0).

Design rules:
- Medical observations (visits, vitals, assessments, consultations) are
  APPEND-ONLY time-based events. History is never overwritten — this is
  what makes offline sync non-destructive.
- Every mutable aggregate carries a `version` column for optimistic,
  conflict-aware synchronization with the offline-first frontend.
- Referral status changes are recorded in `referral_events` (immutable).
"""
import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------- enums

class Role(str, enum.Enum):
    PATIENT = "PATIENT"
    ASHA = "ASHA"
    ANM = "ANM"
    PHC_STAFF = "PHC_STAFF"
    PHC_DOCTOR = "PHC_DOCTOR"
    CHC_DOCTOR = "CHC_DOCTOR"
    SPECIALIST = "SPECIALIST"
    DISTRICT_ADMIN = "DISTRICT_ADMIN"


class FacilityType(str, enum.Enum):
    SUB_CENTER = "SUB_CENTER"
    PHC = "PHC"
    CHC = "CHC"
    RURAL_HOSPITAL = "RURAL_HOSPITAL"
    DISTRICT_HOSPITAL = "DISTRICT_HOSPITAL"
    SPECIALIST_CENTER = "SPECIALIST_CENTER"


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class ReferralStatus(str, enum.Enum):
    CREATED = "CREATED"
    SENT = "SENT"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    ACCEPTED = "ACCEPTED"
    ARRIVED = "ARRIVED"
    IN_CONSULTATION = "IN_CONSULTATION"
    TREATMENT = "TREATMENT"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Priority(str, enum.Enum):
    ROUTINE = "ROUTINE"
    PRIORITY = "PRIORITY"
    URGENT = "URGENT"
    EMERGENCY = "EMERGENCY"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FollowUpStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    MISSED = "MISSED"


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_QUEUE = "IN_QUEUE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class AppointmentType(str, enum.Enum):
    OPD = "OPD"
    TELE = "TELE"
    FOLLOWUP = "FOLLOWUP"


class TeleStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class EmergencyStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class NotificationKind(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"
    success = "success"


class NotificationChannel(str, enum.Enum):
    IN_APP = "IN_APP"
    SMS = "SMS"
    EMAIL = "EMAIL"


class SyncStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPLIED = "APPLIED"
    CONFLICT = "CONFLICT"
    SUPERSEDED = "SUPERSEDED"


class ResourceAvailability(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    LIMITED = "LIMITED"
    UNAVAILABLE = "UNAVAILABLE"


# --------------------------------------------------------------------- users

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False, length=24), index=True)
    specialty: Mapped[str | None] = mapped_column(String(80))
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"), index=True)
    district: Mapped[str | None] = mapped_column(String(80))
    village: Mapped[str | None] = mapped_column(String(80))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    facility: Mapped["Facility | None"] = relationship()


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    rak_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)  # RAK-PAT-2026-XXXXX
    name: Mapped[str] = mapped_column(String(120), index=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    age: Mapped[int] = mapped_column(Integer, default=0)
    gender: Mapped[Gender] = mapped_column(Enum(Gender, native_enum=False, length=12))
    phone: Mapped[str | None] = mapped_column(String(20), index=True)
    village: Mapped[str | None] = mapped_column(String(80))
    address: Mapped[str | None] = mapped_column(String(255))
    district: Mapped[str | None] = mapped_column(String(80))
    emergency_contact: Mapped[str | None] = mapped_column(String(120))
    emergency_phone: Mapped[str | None] = mapped_column(String(20))
    blood_group: Mapped[str | None] = mapped_column(String(8))
    conditions: Mapped[list] = mapped_column(JSON, default=list)      # known medical conditions
    allergies: Mapped[list] = mapped_column(JSON, default=list)
    pregnant: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)  # linked PATIENT login
    asha_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    phc_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"))
    consent_granted: Mapped[bool] = mapped_column(Boolean, default=True)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)          # optimistic sync
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    asha: Mapped["User | None"] = relationship(foreign_keys=[asha_id])


# ------------------------------------------------------------------ facility

class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    code: Mapped[str] = mapped_column(String(24), unique=True)
    name: Mapped[str] = mapped_column(String(140))
    facility_type: Mapped[FacilityType] = mapped_column(Enum(FacilityType, native_enum=False, length=24))
    village: Mapped[str | None] = mapped_column(String(80))
    district: Mapped[str | None] = mapped_column(String(80), index=True)
    phone: Mapped[str | None] = mapped_column(String(20))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class FacilityResource(Base):
    """Current capacity snapshot. Seeded with synthetic demo data —
    never presented as live hospital availability."""
    __tablename__ = "facility_resources"

    facility_id: Mapped[str] = mapped_column(ForeignKey("facilities.id"), primary_key=True)
    total_beds: Mapped[int] = mapped_column(Integer, default=0)
    available_beds: Mapped[int] = mapped_column(Integer, default=0)
    icu_beds: Mapped[int] = mapped_column(Integer, default=0)
    oxygen_available: Mapped[bool] = mapped_column(Boolean, default=False)
    ambulance_available: Mapped[bool] = mapped_column(Boolean, default=False)
    emergency_available: Mapped[bool] = mapped_column(Boolean, default=False)
    cbc: Mapped[ResourceAvailability] = mapped_column(Enum(ResourceAvailability, native_enum=False, length=16), default=ResourceAvailability.AVAILABLE)
    xray: Mapped[ResourceAvailability] = mapped_column(Enum(ResourceAvailability, native_enum=False, length=16), default=ResourceAvailability.AVAILABLE)
    ultrasound: Mapped[ResourceAvailability] = mapped_column(Enum(ResourceAvailability, native_enum=False, length=16), default=ResourceAvailability.LIMITED)
    medicines: Mapped[list] = mapped_column(JSON, default=list)        # [{name, status, qty}]
    specialists: Mapped[list] = mapped_column(JSON, default=list)      # [{specialty, available, days}]
    workload_level: Mapped[str] = mapped_column(String(16), default="MODERATE")  # LOW|MODERATE|HIGH
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    updated_by: Mapped[str | None] = mapped_column(String(120))


# ------------------------------------------------- longitudinal record events

class Visit(Base):
    """A field/home/facility visit — append-only event."""
    __tablename__ = "visits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    worker_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"))
    location: Mapped[str | None] = mapped_column(String(120))
    symptoms: Mapped[list] = mapped_column(JSON, default=list)
    complaint: Mapped[str | None] = mapped_column(Text)
    observations: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(24), default="FIELD")   # FIELD | FACILITY | SYNCED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class VitalObservation(Base):
    """A single vitals measurement — append-only, never overwritten."""
    __tablename__ = "vital_observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    recorded_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"))
    systolic: Mapped[int | None] = mapped_column(Integer)
    diastolic: Mapped[int | None] = mapped_column(Integer)
    temperature: Mapped[float | None] = mapped_column(Float)
    spo2: Mapped[int | None] = mapped_column(Integer)
    heart_rate: Mapped[int | None] = mapped_column(Integer)
    respiratory_rate: Mapped[int | None] = mapped_column(Integer)
    weight_kg: Mapped[float | None] = mapped_column(Float)
    device: Mapped[str | None] = mapped_column(String(60))
    source: Mapped[str] = mapped_column(String(24), default="MANUAL")
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Assessment(Base):
    """Stored AI-assisted (rule-based) triage result with clinician confirmation."""
    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    visit_id: Mapped[str | None] = mapped_column(ForeignKey("visits.id"))
    level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel, native_enum=False, length=12), index=True)
    score: Mapped[int] = mapped_column(Integer, default=0)
    factors: Mapped[list] = mapped_column(JSON, default=list)          # [{code,label,weight}]
    red_flags: Mapped[list] = mapped_column(JSON, default=list)
    recommendation: Mapped[str] = mapped_column(String(60))
    rule_version: Mapped[str] = mapped_column(String(32))
    input_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmed_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"))
    complaint: Mapped[str] = mapped_column(Text)
    findings: Mapped[str | None] = mapped_column(Text)
    assessment: Mapped[str] = mapped_column(Text)
    plan: Mapped[str | None] = mapped_column(Text)
    investigation: Mapped[str | None] = mapped_column(String(160))
    follow_up_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    consultation_id: Mapped[str] = mapped_column(ForeignKey("consultations.id"), index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    medicine: Mapped[str] = mapped_column(String(140))
    dose: Mapped[str | None] = mapped_column(String(80))
    duration: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class DiagnosticRecord(Base):
    __tablename__ = "diagnostic_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    ordered_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"))
    test: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(16), default="ORDERED")  # ORDERED | COMPLETED
    result_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ------------------------------------------------------------------ referral

class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)  # REF-2026-XXXXX
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    from_facility_id: Mapped[str] = mapped_column(ForeignKey("facilities.id"))
    to_facility_id: Mapped[str] = mapped_column(ForeignKey("facilities.id"))
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    reason: Mapped[str] = mapped_column(String(255))
    priority: Mapped[Priority] = mapped_column(Enum(Priority, native_enum=False, length=12))
    status: Mapped[ReferralStatus] = mapped_column(Enum(ReferralStatus, native_enum=False, length=20), index=True, default=ReferralStatus.CREATED)
    clinical_summary: Mapped[str | None] = mapped_column(Text)
    vitals_snapshot: Mapped[str | None] = mapped_column(String(255))
    expected_date: Mapped[date | None] = mapped_column(Date)
    follow_up_date: Mapped[date | None] = mapped_column(Date)
    outcome: Mapped[str | None] = mapped_column(String(60))            # e.g. TREATED_AND_DISCHARGED
    outcome_notes: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    events: Mapped[list["ReferralEvent"]] = relationship(back_populates="referral", order_by="ReferralEvent.created_at")


class ReferralEvent(Base):
    """Immutable status-transition log — the closed-loop audit trail."""
    __tablename__ = "referral_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    referral_id: Mapped[str] = mapped_column(ForeignKey("referrals.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    actor_role: Mapped[str] = mapped_column(String(24))
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)

    referral: Mapped[Referral] = relationship(back_populates="events")


class FollowUp(Base):
    __tablename__ = "followups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    referral_id: Mapped[str | None] = mapped_column(ForeignKey("referrals.id"))
    scheduled_date: Mapped[date] = mapped_column(Date, index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    assignee_role: Mapped[str] = mapped_column(String(24), default="ASHA")
    status: Mapped[FollowUpStatus] = mapped_column(Enum(FollowUpStatus, native_enum=False, length=16), default=FollowUpStatus.SCHEDULED)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


# -------------------------------------------------------- appointments/tele

class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    facility_id: Mapped[str] = mapped_column(ForeignKey("facilities.id"))
    doctor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    date: Mapped[date] = mapped_column(Date, index=True)
    time: Mapped[str] = mapped_column(String(8), default="09:00")
    purpose: Mapped[str] = mapped_column(String(140), default="General OPD")
    appointment_type: Mapped[AppointmentType] = mapped_column(Enum(AppointmentType, native_enum=False, length=12), default=AppointmentType.OPD)
    status: Mapped[AppointmentStatus] = mapped_column(Enum(AppointmentStatus, native_enum=False, length=16), default=AppointmentStatus.SCHEDULED)
    queue_pos: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Teleconsultation(Base):
    """Teleconsult session metadata only — no real video provider is
    integrated; signaling is an isolated extension point."""
    __tablename__ = "teleconsultations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[TeleStatus] = mapped_column(Enum(TeleStatus, native_enum=False, length=16), default=TeleStatus.SCHEDULED)
    room_code: Mapped[str] = mapped_column(String(24), unique=True)
    assessment: Mapped[str | None] = mapped_column(Text)
    recommendation: Mapped[str | None] = mapped_column(Text)
    follow_up_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


# --------------------------------------------------------- emergency/events

class EmergencyEvent(Base):
    __tablename__ = "emergency_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)  # EMG-RAK-2026-XXXXX
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"))
    severity: Mapped[str] = mapped_column(String(12), default="CRITICAL")
    clinical_note: Mapped[str] = mapped_column(Text)
    status: Mapped[EmergencyStatus] = mapped_column(Enum(EmergencyStatus, native_enum=False, length=16), default=EmergencyStatus.ACTIVE)
    sms_token: Mapped[str] = mapped_column(String(12))                     # one-time command token
    sms_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sms_redeemed: Mapped[bool] = mapped_column(Boolean, default=False)
    ack_by: Mapped[str | None] = mapped_column(String(120))
    ack_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    patient_id: Mapped[str | None] = mapped_column(ForeignKey("patients.id"))
    kind: Mapped[NotificationKind] = mapped_column(Enum(NotificationKind, native_enum=False, length=12), default=NotificationKind.info)
    channel: Mapped[NotificationChannel] = mapped_column(Enum(NotificationChannel, native_enum=False, length=12), default=NotificationChannel.IN_APP)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(String(400))
    ref_kind: Mapped[str | None] = mapped_column(String(24))
    ref_id: Mapped[str | None] = mapped_column(String(36))
    link: Mapped[str | None] = mapped_column(String(120))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    delivered: Mapped[bool] = mapped_column(Boolean, default=False)    # provider confirmed delivery
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


# ------------------------------------------------------------------- audit

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uid)
    actor_id: Mapped[str | None] = mapped_column(String(36), index=True)
    actor_name: Mapped[str] = mapped_column(String(120), default="system")
    actor_role: Mapped[str] = mapped_column(String(24), default="SYSTEM")
    action: Mapped[str] = mapped_column(String(40), index=True)
    resource_kind: Mapped[str] = mapped_column(String(30))
    resource_id: Mapped[str | None] = mapped_column(String(36))
    patient_id: Mapped[str | None] = mapped_column(String(36), index=True)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    ip: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


# -------------------------------------------------------------------- sync

class SyncOperation(Base):
    """Server-side ledger of client sync operations.

    The primary key IS the client operation id, which makes re-sending the
    same batch idempotent. Append-only creates apply cleanly; entity updates
    use optimistic `version` checks and are recorded as CONFLICT instead of
    being silently overwritten.
    """
    __tablename__ = "sync_operations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)      # client operation id
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    entity: Mapped[str] = mapped_column(String(30))                    # patient|visit|vital|referral|followup|assessment
    operation: Mapped[str] = mapped_column(String(10))                 # create|update
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    client_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[SyncStatus] = mapped_column(Enum(SyncStatus, native_enum=False, length=16), default=SyncStatus.PENDING)
    result: Mapped[dict] = mapped_column(JSON, default=dict)           # server outcome / conflict info
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
