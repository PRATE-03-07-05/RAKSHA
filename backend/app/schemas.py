"""Pydantic request/response contracts.

These schemas ARE the frontend ↔ backend contract — they mirror the demo
store shapes used by the React app so it can be pointed at this API with
minimal adaptation (see README "Frontend integration").
"""
from datetime import date, datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import Gender, Role

T = TypeVar("T")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------- auth

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserOut(ORM):
    id: str
    email: str
    name: str
    phone: str | None = None
    role: str
    specialty: str | None = None
    facility_id: str | None = None
    district: str | None = None
    village: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    """Admin-driven user provisioning. Passwords are hashed server-side."""
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: Role
    facility_id: str | None = None
    district: str | None = None
    phone: str | None = Field(default=None, max_length=20)
    specialty: str | None = None
    village: str | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    role: Role | None = None
    facility_id: str | None = None
    district: str | None = None
    phone: str | None = None
    specialty: str | None = None
    village: str | None = None
    is_active: bool | None = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


# ------------------------------------------------------------------- patients

class PatientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    date_of_birth: date | None = None
    age: int = Field(ge=0, le=120)
    # Enum-typed: only MALE/FEMALE/OTHER are accepted (422 otherwise) and the
    # OpenAPI contract matches the database column exactly.
    gender: Gender
    # Explicit default=None (mirrors VitalCreate) — a constrained Optional
    # must never rely on implicit default resolution.
    phone: str | None = Field(default=None, max_length=20)
    village: str | None = None
    address: str | None = None
    district: str | None = None
    emergency_contact: str | None = None
    emergency_phone: str | None = None
    blood_group: str | None = None
    conditions: list[str] = []
    allergies: list[str] = []
    pregnant: bool = False
    asha_id: str | None = None
    phc_id: str | None = None
    consent_granted: bool = True


class PatientUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    village: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    emergency_phone: str | None = None
    conditions: list[str] | None = None
    allergies: list[str] | None = None
    pregnant: bool | None = None
    consent_granted: bool | None = None
    version: int | None = None  # optimistic concurrency for sync


class PatientOut(ORM):
    id: str
    rak_id: str
    name: str
    date_of_birth: date | None = None
    age: int
    gender: str
    phone: str | None = None
    village: str | None = None
    address: str | None = None
    district: str | None = None
    emergency_contact: str | None = None
    emergency_phone: str | None = None
    blood_group: str | None = None
    conditions: list = []
    allergies: list = []
    pregnant: bool = False
    asha_id: str | None = None
    phc_id: str | None = None
    consent_granted: bool = True
    version: int = 1
    created_at: datetime
    updated_at: datetime
    asha_name: str | None = None


# -------------------------------------------------------------------- records

class VisitCreate(BaseModel):
    symptoms: list[str] = []
    complaint: str | None = None
    observations: str | None = None
    notes: str | None = None
    location: str | None = None
    facility_id: str | None = None


class VisitOut(ORM):
    id: str
    patient_id: str
    worker_id: str
    facility_id: str | None = None
    location: str | None = None
    symptoms: list = []
    complaint: str | None = None
    observations: str | None = None
    notes: str | None = None
    source: str
    created_at: datetime
    worker_name: str | None = None
    worker_role: str | None = None


class VitalCreate(BaseModel):
    systolic: int | None = Field(default=None, ge=40, le=260)
    diastolic: int | None = Field(default=None, ge=20, le=200)
    temperature: float | None = Field(default=None, ge=30, le=45)
    spo2: int | None = Field(default=None, ge=50, le=100)
    heart_rate: int | None = Field(default=None, ge=20, le=250)
    respiratory_rate: int | None = Field(default=None, ge=4, le=80)
    weight_kg: float | None = Field(default=None, ge=1, le=300)
    device: str | None = None
    recorded_at: datetime | None = None
    facility_id: str | None = None


class VitalOut(ORM):
    id: str
    patient_id: str
    recorded_by_id: str
    facility_id: str | None = None
    systolic: int | None = None
    diastolic: int | None = None
    temperature: float | None = None
    spo2: int | None = None
    heart_rate: int | None = None
    respiratory_rate: int | None = None
    weight_kg: float | None = None
    device: str | None = None
    source: str
    recorded_at: datetime
    created_at: datetime
    recorded_by_name: str | None = None


class AssessmentOut(ORM):
    id: str
    patient_id: str
    visit_id: str | None = None
    level: str
    score: int
    factors: list = []
    red_flags: list = []
    recommendation: str
    rule_version: str
    input_snapshot: dict = {}
    confirmed: bool
    confirmed_by_id: str | None = None
    confirmed_at: datetime | None = None
    created_at: datetime
    confirmed_by_name: str | None = None


class MedItem(BaseModel):
    medicine: str = Field(min_length=1, max_length=140)
    dose: str | None = None
    duration: str | None = None


class ConsultationCreate(BaseModel):
    complaint: str = Field(min_length=2)
    findings: str | None = None
    assessment: str = Field(min_length=2)
    plan: str | None = None
    investigation: str | None = None
    follow_up_date: date | None = None
    meds: list[MedItem] = []


class ConsultationOut(ORM):
    id: str
    patient_id: str
    doctor_id: str
    facility_id: str | None = None
    complaint: str
    findings: str | None = None
    assessment: str
    plan: str | None = None
    investigation: str | None = None
    follow_up_date: date | None = None
    created_at: datetime
    meds: list[MedItem] = []
    doctor_name: str | None = None
    specialty: str | None = None


class DiagnosticCreate(BaseModel):
    test: str = Field(min_length=2, max_length=120)
    result_text: str | None = None
    status: str = "ORDERED"
    facility_id: str | None = None


class DiagnosticOut(ORM):
    id: str
    patient_id: str
    ordered_by_id: str
    facility_id: str | None = None
    test: str
    status: str
    result_text: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    ordered_by_name: str | None = None


class FollowUpCreate(BaseModel):
    referral_id: str | None = None
    scheduled_date: date
    notes: str | None = None
    assignee_role: str = "ASHA"


class FollowUpOut(ORM):
    id: str
    patient_id: str
    referral_id: str | None = None
    scheduled_date: date
    notes: str | None = None
    assignee_role: str
    status: str
    completed_at: datetime | None = None
    completed_by_id: str | None = None
    created_at: datetime


class TimelineEvent(BaseModel):
    kind: str
    id: str
    ts: datetime
    title: str
    subtitle: str = ""


# ------------------------------------------------------------------- referral

class ReferralCreate(BaseModel):
    patient_id: str
    from_facility_id: str
    to_facility_id: str
    reason: str = Field(min_length=4, max_length=255)
    priority: str = Field(pattern="^(ROUTINE|PRIORITY|URGENT|EMERGENCY)$")
    clinical_summary: str | None = None
    vitals_snapshot: str | None = None
    expected_date: date | None = None


class ReferralTransition(BaseModel):
    target: str = Field(min_length=2)
    notes: str | None = None
    outcome: str | None = None        # required when target == COMPLETED
    outcome_notes: str | None = None


class ReferralEventOut(ORM):
    id: str
    referral_id: str
    from_status: str | None = None
    to_status: str
    actor_id: str
    actor_role: str
    facility_id: str | None = None
    notes: str | None = None
    created_at: datetime
    actor_name: str | None = None


class ReferralOut(ORM):
    id: str
    code: str
    patient_id: str
    from_facility_id: str
    to_facility_id: str
    created_by_id: str
    reason: str
    priority: str
    status: str
    clinical_summary: str | None = None
    vitals_snapshot: str | None = None
    expected_date: date | None = None
    follow_up_date: date | None = None
    outcome: str | None = None
    outcome_notes: str | None = None
    version: int
    overdue: bool = False
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    created_by_name: str | None = None
    created_by_role: str | None = None


class ReferralDetail(ReferralOut):
    events: list[ReferralEventOut] = []


# ------------------------------------------------------------------ facility

class FacilityOut(ORM):
    id: str
    code: str
    name: str
    facility_type: str
    village: str | None = None
    district: str | None = None
    phone: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_active: bool


class FacilityResourceOut(ORM):
    facility_id: str
    total_beds: int
    available_beds: int
    icu_beds: int
    oxygen_available: bool
    ambulance_available: bool
    emergency_available: bool
    cbc: str
    xray: str
    ultrasound: str
    medicines: list = []
    specialists: list = []
    workload_level: str
    version: int
    updated_at: datetime
    updated_by: str | None = None


class FacilityResourceUpdate(BaseModel):
    total_beds: int | None = None
    available_beds: int | None = None
    icu_beds: int | None = None
    oxygen_available: bool | None = None
    ambulance_available: bool | None = None
    emergency_available: bool | None = None
    cbc: str | None = None
    xray: str | None = None
    ultrasound: str | None = None
    medicines: list | None = None
    specialists: list | None = None
    workload_level: str | None = None


class RecommendRequest(BaseModel):
    from_facility_id: str
    priority: str = "PRIORITY"
    needs: list[str] = []              # oxygen | icu | emergency | cbc | xray | ultrasound | specialty:X
    destination_types: list[str] = []  # optional filter


class RecommendationOut(BaseModel):
    facility: FacilityOut
    distance_km: float
    score: int
    reasons: list[str]
    load: str


# --------------------------------------------------------------- appointments

class AppointmentCreate(BaseModel):
    patient_id: str
    facility_id: str
    doctor_id: str | None = None
    date: date
    time: str = "09:00"
    purpose: str = "General OPD"
    appointment_type: str = "OPD"


class AppointmentUpdate(BaseModel):
    status: str | None = None
    queue_pos: int | None = None
    notes: str | None = None


class AppointmentOut(ORM):
    id: str
    patient_id: str
    facility_id: str
    doctor_id: str | None = None
    date: date
    time: str
    purpose: str
    appointment_type: str
    status: str
    queue_pos: int | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class TeleCreate(BaseModel):
    patient_id: str
    doctor_id: str
    facility_id: str | None = None
    scheduled_at: datetime


class TeleComplete(BaseModel):
    assessment: str = Field(min_length=4)
    recommendation: str | None = None
    follow_up_date: date | None = None


class TeleOut(ORM):
    id: str
    patient_id: str
    doctor_id: str
    facility_id: str | None = None
    scheduled_at: datetime
    status: str
    room_code: str
    assessment: str | None = None
    recommendation: str | None = None
    follow_up_date: date | None = None
    created_at: datetime
    doctor_name: str | None = None
    specialty: str | None = None


# ------------------------------------------------------------------ emergency

class EmergencyCreate(BaseModel):
    patient_id: str
    clinical_note: str = Field(min_length=6)


class EmergencyUpdate(BaseModel):
    status: str = Field(pattern="^(ACTIVE|ACKNOWLEDGED|RESOLVED)$")
    ack_by: str | None = None


class EmergencyOut(ORM):
    id: str
    code: str
    patient_id: str
    doctor_id: str
    facility_id: str | None = None
    severity: str
    clinical_note: str
    status: str
    sms_redeemed: bool
    sms_expires_at: datetime
    ack_by: str | None = None
    ack_at: datetime | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    doctor_name: str | None = None
    sms_token: str | None = None


class SmsRedeem(BaseModel):
    token: str = Field(min_length=4, max_length=12)


# -------------------------------------------------------------- notifications

class NotificationOut(ORM):
    id: str
    user_id: str
    patient_id: str | None = None
    kind: str
    channel: str
    title: str
    body: str
    ref_kind: str | None = None
    ref_id: str | None = None
    link: str | None = None
    read: bool
    delivered: bool
    created_at: datetime


# ----------------------------------------------------------------------- sync

class SyncOpIn(BaseModel):
    id: str = Field(min_length=6, max_length=64)   # client operation id (idempotency key)
    entity: str = Field(pattern="^(patient|visit|vital|referral|followup|assessment)$")
    operation: str = Field(pattern="^(create|update)$")
    payload: dict
    client_ts: datetime


class SyncOpOut(ORM):
    id: str
    entity: str
    operation: str
    status: str
    result: dict = {}
    created_at: datetime


class SyncBatchIn(BaseModel):
    ops: list[SyncOpIn] = Field(max_length=200)


class SyncBatchOut(BaseModel):
    applied: int
    conflicts: int
    duplicates: int
    results: list[SyncOpOut]


class SyncStatusOut(BaseModel):
    pending: int
    applied: int
    conflicts: int
    last_sync_at: datetime | None = None


# ----------------------------------------------------------------------- admin

class AnalyticsOut(BaseModel):
    total_patients: int
    total_users: int
    active_emergencies: int
    total_referrals: int
    active_referrals: int
    pending_referrals: int
    completed_referrals: int
    overdue_referrals: int
    completion_rate: float
    avg_completion_hours: float | None = None
    high_risk_cases: int
    critical_cases: int
    missed_followups: int
    facilities: int
    resource_shortages: int
    referral_status_distribution: dict
    facility_workload: list
    patients_by_month: list
    high_risk_by_facility: list


class AuditOut(ORM):
    id: str
    actor_id: str | None = None
    actor_name: str
    actor_role: str
    action: str
    resource_kind: str
    resource_id: str | None = None
    patient_id: str | None = None
    detail: dict = {}
    ip: str | None = None
    created_at: datetime


# --------------------------------------------------------------------- triage

class TriageRequest(BaseModel):
    """Structured inputs for rule-based respiratory risk decision support."""
    patient_id: str | None = None
    age: int = Field(ge=0, le=120)
    spo2: int | None = Field(default=None, ge=50, le=100)
    respiratory_rate: int | None = Field(default=None, ge=4, le=80)
    temperature: float | None = Field(default=None, ge=30, le=45)
    heart_rate: int | None = Field(default=None, ge=20, le=250)
    cough: bool = False
    breathing_difficulty: bool = False
    chest_pain: bool = False
    duration_days: int | None = Field(default=None, ge=0, le=60)
    pregnant: bool = False
    conditions: list[str] = []
    severity_reported: str | None = None       # patient-reported severity
    symptoms: list[str] = []


class TriageFactor(BaseModel):
    code: str
    label: str
    weight: int


class TriageResponse(BaseModel):
    risk_level: str
    score: int
    recommended_action: str
    red_flags: list[str]
    contributing_factors: list[TriageFactor]
    rule_version: str
    # ML pipeline metadata — null fields indicate the rule-based fallback mode.
    mode: str | None = None                    # "ML_MODEL" | "RULE_BASED_FALLBACK"
    confidence: float | None = None            # P(predicted class), when a model ran
    model_version: str | None = None
    disclaimer: str = ("AI-assisted preliminary assessment — not a medical diagnosis. "
                       "A qualified clinician makes the final decision.")
    assessment_id: str | None = None           # set when persisted for a patient
