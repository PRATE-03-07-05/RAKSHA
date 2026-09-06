"""Append-only audit logging service.

Every security- or care-relevant action is recorded with actor, role,
action, resource and (where applicable) patient context. Audit rows are
never updated or deleted by application code.
"""
from typing import Any

from sqlalchemy.orm import Session

from .models import AuditLog, User


class AuditAction:
    LOGIN = "LOGIN"
    LOGIN_FAILED = "LOGIN_FAILED"
    PATIENT_CREATE = "PATIENT_CREATE"
    PATIENT_UPDATE = "PATIENT_UPDATE"
    RECORD_VIEW = "RECORD_VIEW"
    VISIT_CREATE = "VISIT_CREATE"
    VITALS_CREATE = "VITALS_CREATE"
    TRIAGE_ASSESS = "TRIAGE_ASSESS"
    ASSESSMENT_CONFIRM = "ASSESSMENT_CONFIRM"
    CONSULTATION_CREATE = "CONSULTATION_CREATE"
    PRESCRIPTION_CREATE = "PRESCRIPTION_CREATE"
    DIAGNOSTIC_CREATE = "DIAGNOSTIC_CREATE"
    REFERRAL_CREATE = "REFERRAL_CREATE"
    REFERRAL_TRANSITION = "REFERRAL_TRANSITION"
    FOLLOWUP_CREATE = "FOLLOWUP_CREATE"
    FOLLOWUP_COMPLETE = "FOLLOWUP_COMPLETE"
    EMERGENCY_CREATE = "EMERGENCY_CREATE"
    EMERGENCY_UPDATE = "EMERGENCY_UPDATE"
    RESOURCE_UPDATE = "RESOURCE_UPDATE"
    APPOINTMENT_CREATE = "APPOINTMENT_CREATE"
    TELECONSULT_COMPLETE = "TELECONSULT_COMPLETE"
    SYNC_BATCH = "SYNC_BATCH"
    NOTIFICATION_SEND = "NOTIFICATION_SEND"


def log_action(
    db: Session,
    actor: User | None,
    action: str,
    resource_kind: str,
    resource_id: str | None = None,
    patient_id: str | None = None,
    detail: dict[str, Any] | None = None,
    ip: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_id=actor.id if actor else None,
        actor_name=actor.name if actor else "system",
        actor_role=actor.role.value if actor else "SYSTEM",
        action=action,
        resource_kind=resource_kind,
        resource_id=resource_id,
        patient_id=patient_id,
        detail=detail or {},
        ip=ip,
    )
    db.add(entry)
    db.flush()
    return entry
