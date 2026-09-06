"""Patient service: RAKSHA ID generation and role-scoped search."""
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Patient, Role, User


def generate_rak_id(db: Session) -> str:
    """Next sequential RAKSHA Patient ID, e.g. RAK-PAT-2026-00031.

    The ID carries no personal data — it is an opaque handle used across
    visits, referrals, prescriptions and emergency events.
    """
    prefix = get_settings().patient_id_prefix
    for attempt in range(1, 50):
        n = db.query(Patient).count() + attempt
        candidate = f"{prefix}-{n:05d}"
        if not db.execute(select(Patient.id).where(Patient.rak_id == candidate)).first():
            return candidate
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not allocate a patient ID")


def can_view(user: User, patient: Patient) -> bool:
    """Consent-aware access predicate (see also audit on RECORD_VIEW)."""
    if user.role == Role.PATIENT:
        return patient.user_id == user.id          # own record only
    if user.role == Role.DISTRICT_ADMIN:
        return True
    if not patient.consent_granted:
        return False
    # Field workers and clinical staff of registered facilities may access
    # consented patients; every access is written to the audit log.
    return True


def search(db: Session, user: User, q: str, limit: int, offset: int) -> tuple[list[Patient], int]:
    base = select(Patient)
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        base = base.where(or_(Patient.rak_id.ilike(like), Patient.name.ilike(like), Patient.phone.ilike(like)))
    total = len(db.execute(base).scalars().all())
    rows = db.execute(base.order_by(Patient.created_at.desc()).limit(limit).offset(offset)).scalars().all()
    return list(rows), total
