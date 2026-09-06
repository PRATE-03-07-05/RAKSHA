"""Patient management: registration, search, update, longitudinal timeline.

Access is enforced server-side per role and consent; every record view is
written to the audit log with actor + purpose.
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..database import get_db
from ..models import (Assessment, Consultation, DiagnosticRecord,
                      EmergencyEvent, FollowUp, Patient, Referral, Role,
                      Teleconsultation, User, Visit, VitalObservation)
from ..schemas import (Page, PatientCreate, PatientOut, PatientUpdate,
                       TimelineEvent)
from ..security import FIELD_WORKERS, CurrentUser, require_roles
from ..services.patients import generate_rak_id, search as patient_search

router = APIRouter(prefix="/patients", tags=["patients"])

DB = Annotated[Session, Depends(get_db)]


def get_patient_or_404(db: Session, patient_id: str) -> Patient:
    p = db.get(Patient, patient_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    return p


def assert_can_view(user: User, patient: Patient) -> None:
    if user.role == Role.PATIENT:
        if patient.user_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Patients can only access their own record")
        return
    if user.role == Role.DISTRICT_ADMIN:
        return
    if not patient.consent_granted:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Patient consent is not active — access denied and logged")


@router.get("", response_model=Page[PatientOut], summary="Search patients (role-scoped)")
def list_patients(
    user: CurrentUser, db: DB,
    q: str = Query("", description="RAKSHA ID, name or phone"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    if user.role == Role.PATIENT:
        rows = db.execute(select(Patient).where(Patient.user_id == user.id)).scalars().all()
        return Page(items=[PatientOut.model_validate(r) for r in rows], total=len(rows), limit=limit, offset=0)
    rows, total = patient_search(db, user, q, limit, offset)
    return Page(items=[PatientOut.model_validate(r) for r in rows], total=total, limit=limit, offset=offset)


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED,
             summary="Register a patient — issues a RAKSHA Patient ID",
             dependencies=[Depends(require_roles(*FIELD_WORKERS, Role.DISTRICT_ADMIN))])
def create_patient(body: PatientCreate, user: CurrentUser, db: DB):
    p = Patient(
        rak_id=generate_rak_id(db),
        name=body.name, date_of_birth=body.date_of_birth, age=body.age,
        gender=body.gender, phone=body.phone, village=body.village,
        address=body.address, district=body.district or user.district,
        emergency_contact=body.emergency_contact, emergency_phone=body.emergency_phone,
        blood_group=body.blood_group, conditions=body.conditions, allergies=body.allergies,
        pregnant=body.pregnant,
        asha_id=body.asha_id or (user.id if user.role in (Role.ASHA, Role.ANM) else None),
        phc_id=body.phc_id or user.facility_id,
        consent_granted=body.consent_granted,
        consent_at=datetime.now(timezone.utc) if body.consent_granted else None,
    )
    db.add(p)
    db.flush()
    log_action(db, user, AuditAction.PATIENT_CREATE, "patient", p.id, patient_id=p.id,
               detail={"rak_id": p.rak_id, "village": p.village})
    db.commit()
    db.refresh(p)
    return PatientOut.model_validate(p)


@router.get("/{patient_id}", response_model=PatientOut, summary="Patient profile (consent + RBAC enforced)")
def get_patient(patient_id: str, request: Request, user: CurrentUser, db: DB):
    p = get_patient_or_404(db, patient_id)
    assert_can_view(user, p)
    log_action(db, user, AuditAction.RECORD_VIEW, "patient", p.id, patient_id=p.id,
               detail={"purpose": request.headers.get("X-Access-Purpose", "care delivery")},
               ip=request.client.host if request.client else None)
    db.commit()
    db.refresh(p)
    return PatientOut.model_validate(p)


@router.patch("/{patient_id}", response_model=PatientOut, summary="Update patient (optimistic versioning)")
def update_patient(patient_id: str, body: PatientUpdate, user: CurrentUser, db: DB,
                   _: User = Depends(require_roles(*FIELD_WORKERS, *
                                                   [Role.PHC_DOCTOR, Role.CHC_DOCTOR, Role.SPECIALIST,
                                                    Role.DISTRICT_ADMIN]))):
    p = get_patient_or_404(db, patient_id)
    if user.role == Role.PATIENT or (user.role not in (Role.DISTRICT_ADMIN,) and not p.consent_granted):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted")
    if body.version is not None and body.version != p.version:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            {"error": "Version conflict", "server_version": p.version})

    changes = {}
    for field in ("name", "phone", "village", "address", "emergency_contact",
                  "emergency_phone", "conditions", "allergies", "pregnant"):
        value = getattr(body, field)
        if value is not None:
            changes[field] = value
            setattr(p, field, value)
    if body.consent_granted is not None:
        p.consent_granted = body.consent_granted
        p.consent_at = datetime.now(timezone.utc) if body.consent_granted else None
        changes["consent_granted"] = body.consent_granted
    p.version += 1  # exactly one increment per accepted update
    log_action(db, user, AuditAction.PATIENT_UPDATE, "patient", p.id, patient_id=p.id,
               detail={"fields": sorted(changes.keys()), "version": p.version})
    db.commit()
    db.refresh(p)
    return PatientOut.model_validate(p)


@router.get("/{patient_id}/timeline", response_model=list[TimelineEvent],
            summary="Longitudinal health timeline (all time-based events)")
def timeline(patient_id: str, user: CurrentUser, db: DB):
    p = get_patient_or_404(db, patient_id)
    assert_can_view(user, p)
    log_action(db, user, AuditAction.RECORD_VIEW, "timeline", p.id, patient_id=p.id,
               detail={"purpose": "longitudinal record"})
    events: list[TimelineEvent] = [
        TimelineEvent(kind="registered", id=p.id, ts=p.created_at,
                      title="Patient registered", subtitle=f"{p.rak_id} · {p.village or p.district or ''}"),
    ]
    for v in db.execute(select(Visit).where(Visit.patient_id == p.id)).scalars():
        events.append(TimelineEvent(kind="visit", id=v.id, ts=v.created_at, title="Field visit",
                                    subtitle=", ".join(v.symptoms[:4]) or v.complaint or v.location or ""))
    for v in db.execute(select(VitalObservation).where(VitalObservation.patient_id == p.id)).scalars():
        bits = [f"BP {v.systolic}/{v.diastolic}" if v.systolic else None,
                f"SpO₂ {v.spo2}%" if v.spo2 else None,
                f"Temp {v.temperature}°C" if v.temperature else None,
                f"HR {v.heart_rate}" if v.heart_rate else None]
        events.append(TimelineEvent(kind="vitals", id=v.id, ts=v.recorded_at,
                                    title="Vitals recorded", subtitle=" · ".join(b for b in bits if b)))
    for a in db.execute(select(Assessment).where(Assessment.patient_id == p.id)).scalars():
        events.append(TimelineEvent(kind="assessment", id=a.id, ts=a.created_at,
                                    title=f"AI-assisted assessment — {a.level.value}",
                                    subtitle=f"{a.recommendation} · rule {a.rule_version}"
                                             + (" · confirmed" if a.confirmed else " · awaiting confirmation")))
    for c in db.execute(select(Consultation).where(Consultation.patient_id == p.id)).scalars():
        events.append(TimelineEvent(kind="consultation", id=c.id, ts=c.created_at,
                                    title="Clinical consultation", subtitle=c.assessment[:90]))
    for d in db.execute(select(DiagnosticRecord).where(DiagnosticRecord.patient_id == p.id)).scalars():
        events.append(TimelineEvent(kind="diagnostic", id=d.id, ts=d.created_at,
                                    title=f"Diagnostic — {d.test}", subtitle=d.status))
    for r in db.execute(select(Referral).where(Referral.patient_id == p.id)).scalars():
        events.append(TimelineEvent(kind="referral", id=r.id, ts=r.created_at,
                                    title=f"Referral {r.code} — {r.status.value}",
                                    subtitle=f"{r.reason} · priority {r.priority.value}"))
    for f in db.execute(select(FollowUp).where(FollowUp.patient_id == p.id)).scalars():
        events.append(TimelineEvent(kind="followup", id=f.id, ts=f.created_at,
                                    title=f"Follow-up — {f.status.value}",
                                    subtitle=f"scheduled {f.scheduled_date.isoformat()}"))
    for e in db.execute(select(EmergencyEvent).where(EmergencyEvent.patient_id == p.id)).scalars():
        events.append(TimelineEvent(kind="emergency", id=e.id, ts=e.created_at,
                                    title=f"Emergency {e.code}", subtitle=e.clinical_note[:90]))
    for t in db.execute(select(Teleconsultation).where(Teleconsultation.patient_id == p.id)).scalars():
        events.append(TimelineEvent(kind="teleconsultation", id=t.id, ts=t.scheduled_at,
                                    title=f"Teleconsultation — {t.status.value}",
                                    subtitle=(t.assessment or "scheduled")[:90]))

    db.commit()
    events.sort(key=lambda e: e.ts, reverse=True)
    return events
