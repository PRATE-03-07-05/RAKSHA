"""Emergency events — CRITICAL case escalation.

Creates EMG-RAK-2026-XXXXX events with a one-time SMS command token
(EMERGENCY|EVENT_ID|TOKEN). Tokens expire after 10 minutes and replay is
rejected. Push/SMS delivery itself is an isolated adapter (see
services/notifications.py) — only the in-app channel is live in the
prototype.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..database import get_db
from ..models import (EmergencyEvent, EmergencyStatus, Patient, Role, User)
from ..schemas import EmergencyCreate, EmergencyOut, EmergencyUpdate, SmsRedeem
from ..security import CLINICAL, CurrentUser, require_roles
from ..services.notifications import notify

router = APIRouter(prefix="/emergency-events", tags=["emergency"])
DB = Annotated[Session, Depends(get_db)]

_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
VIEWERS = (*CLINICAL, Role.DISTRICT_ADMIN, Role.PATIENT)


def _out(db: Session, e: EmergencyEvent) -> EmergencyOut:
    out = EmergencyOut.model_validate(e)
    doctor = db.get(User, e.doctor_id)
    out.doctor_name = doctor.name if doctor else None
    out.sms_token = e.sms_token
    return out


def _visible(db: Session, user: User, e: EmergencyEvent) -> bool:
    if user.role in (*CLINICAL, Role.DISTRICT_ADMIN):
        return True
    if user.role == Role.PATIENT:
        p = db.get(Patient, e.patient_id)
        return bool(p and p.user_id == user.id)
    return False


@router.post("", response_model=EmergencyOut, status_code=status.HTTP_201_CREATED,
             summary="Raise an emergency event (clinical roles only)",
             dependencies=[Depends(require_roles(*CLINICAL))])
def create_emergency(body: EmergencyCreate, user: CurrentUser, db: DB):
    patient = db.get(Patient, body.patient_id)
    if patient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    n = db.execute(select(EmergencyEvent)).scalars().all()
    code = f"EMG-RAK-{datetime.now(timezone.utc).year}-{len(n) + 1:05d}"
    token = "".join(secrets.choice(_TOKEN_ALPHABET) for _ in range(6))
    e = EmergencyEvent(
        code=code, patient_id=patient.id, doctor_id=user.id,
        facility_id=user.facility_id, severity="CRITICAL",
        clinical_note=body.clinical_note, status=EmergencyStatus.ACTIVE,
        sms_token=token, sms_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(e)
    db.flush()
    log_action(db, user, AuditAction.EMERGENCY_CREATE, "emergency", e.id,
               patient_id=patient.id, detail={"code": code})
    admins = db.execute(select(User).where(User.role == Role.DISTRICT_ADMIN,
                                           User.is_active.is_(True))).scalars().all()
    for a in admins[:5]:
        notify(db, a.id, "critical", f"CRITICAL case flagged — {code}",
               f"{patient.name} at {user.facility_id or 'facility'}: {body.clinical_note[:120]}",
               patient_id=patient.id, ref_kind="emergency", ref_id=e.id,
               link="/app/emergency", sms=True, actor=user)
    if patient.asha_id:
        notify(db, patient.asha_id, "critical", f"Emergency — {patient.name}",
               f"{code} raised by {user.name}. Please be available for follow-up.",
               patient_id=patient.id, ref_kind="emergency", ref_id=e.id,
               link="/app/emergency", actor=user)
    db.commit()
    db.refresh(e)
    return _out(db, e)


@router.get("", response_model=list[EmergencyOut], summary="List emergency events (role scoped)")
def list_emergencies(user: CurrentUser, db: DB):
    rows = db.execute(select(EmergencyEvent).order_by(EmergencyEvent.created_at.desc())).scalars().all()
    return [_out(db, e) for e in rows if _visible(db, user, e)]


@router.patch("/{event_id}/status", response_model=EmergencyOut,
              summary="Acknowledge or resolve an emergency event",
              dependencies=[Depends(require_roles(*CLINICAL, Role.DISTRICT_ADMIN))])
def update_status(event_id: str, body: EmergencyUpdate, user: CurrentUser, db: DB):
    e = db.get(EmergencyEvent, event_id)
    if e is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Emergency event not found")
    e.status = EmergencyStatus(body.status)
    if e.status == EmergencyStatus.ACKNOWLEDGED:
        e.ack_by = body.ack_by or user.name
        e.ack_at = datetime.now(timezone.utc)
    if e.status == EmergencyStatus.RESOLVED:
        e.resolved_at = datetime.now(timezone.utc)
    log_action(db, user, AuditAction.EMERGENCY_UPDATE, "emergency", e.id,
               patient_id=e.patient_id, detail={"status": body.status})
    db.commit()
    db.refresh(e)
    return _out(db, e)


@router.post("/{event_id}/redeem", response_model=EmergencyOut,
             summary="Verify a one-time SMS command token (replay-safe)",
             dependencies=[Depends(require_roles(*CLINICAL, Role.DISTRICT_ADMIN))])
def redeem(event_id: str, body: SmsRedeem, user: CurrentUser, db: DB):
    e = db.get(EmergencyEvent, event_id)
    if e is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Emergency event not found")
    if e.sms_redeemed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Token already redeemed — replay blocked")
    expires = e.sms_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status.HTTP_410_GONE, "One-time token expired")
    if body.token.strip().upper() != e.sms_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid one-time token")
    e.sms_redeemed = True
    e.status = EmergencyStatus.ACKNOWLEDGED
    e.ack_by = user.name
    e.ack_at = datetime.now(timezone.utc)
    log_action(db, user, AuditAction.EMERGENCY_UPDATE, "emergency", e.id,
               patient_id=e.patient_id, detail={"code": e.code, "sms": "token redeemed — alarm triggered"})
    db.commit()
    db.refresh(e)
    return _out(db, e)
