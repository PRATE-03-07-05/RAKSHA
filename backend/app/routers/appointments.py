"""Appointments + teleconsultation session metadata.

Teleconsultations manage scheduling and outcomes only — no real video
provider is integrated; the signaling layer is an isolated extension point.
"""
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..database import get_db
from ..models import (Appointment, AppointmentStatus, AppointmentType,
                      Consultation, Patient, Role, Teleconsultation,
                      TeleStatus, User)
from ..schemas import (AppointmentCreate, AppointmentOut, AppointmentUpdate,
                       TeleComplete, TeleCreate, TeleOut)
from ..security import CLINICAL, CurrentUser, require_roles

router = APIRouter(tags=["appointments"])
DB = Annotated[Session, Depends(get_db)]

_APPT_TRANSITIONS = {
    AppointmentStatus.SCHEDULED: {AppointmentStatus.IN_QUEUE, AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED},
    AppointmentStatus.IN_QUEUE: {AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED},
    AppointmentStatus.COMPLETED: set(),
    AppointmentStatus.CANCELLED: set(),
}


def _tout(db: Session, t: Teleconsultation) -> TeleOut:
    """TeleOut with the consulting clinician's name + specialty resolved."""
    out = TeleOut.model_validate(t)
    doctor = db.get(User, t.doctor_id) if t.doctor_id else None
    out.doctor_name = doctor.name if doctor else None
    out.specialty = doctor.specialty if doctor else None
    return out


def _own_patient(user: User, db: Session, patient_id: str) -> Patient:
    p = db.get(Patient, patient_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    if user.role == Role.PATIENT and p.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only book for your own record")
    return p


@router.post("/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED,
             summary="Book an appointment (patients book for themselves)")
def create_appointment(body: AppointmentCreate, user: CurrentUser, db: DB):
    p = _own_patient(user, db, body.patient_id)
    count = db.execute(select(Appointment).where(Appointment.facility_id == body.facility_id,
                                                 Appointment.date == body.date,
                                                 Appointment.status != AppointmentStatus.CANCELLED)).scalars().all()
    a = Appointment(patient_id=p.id, facility_id=body.facility_id, doctor_id=body.doctor_id,
                    date=body.date, time=body.time, purpose=body.purpose,
                    appointment_type=AppointmentType(body.appointment_type),
                    queue_pos=len(count) + 1)
    db.add(a)
    db.flush()
    log_action(db, user, AuditAction.APPOINTMENT_CREATE, "appointment", a.id, patient_id=p.id,
               detail={"date": body.date.isoformat(), "facility": body.facility_id})
    db.commit()
    db.refresh(a)
    return a


@router.get("/appointments", response_model=list[AppointmentOut], summary="List appointments (role scoped)")
def list_appointments(user: CurrentUser, db: DB, date: str | None = Query(None)):
    q = select(Appointment).order_by(Appointment.date.desc(), Appointment.time.asc())
    if user.role == Role.PATIENT:
        own = select(Patient.id).where(Patient.user_id == user.id)
        q = q.where(Appointment.patient_id.in_(own))
    elif user.role != Role.DISTRICT_ADMIN and user.facility_id:
        q = q.where(Appointment.facility_id == user.facility_id)
    rows = list(db.execute(q).scalars().all())
    if date:
        rows = [a for a in rows if a.date.isoformat() == date]
    return [AppointmentOut.model_validate(a) for a in rows]


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
def get_appointment(appointment_id: str, user: CurrentUser, db: DB):
    a = db.get(Appointment, appointment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    if user.role == Role.PATIENT:
        p = db.get(Patient, a.patient_id)
        if not p or p.user_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your appointment")
    return a


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut,
              summary="Update appointment status (validated transitions)")
def update_appointment(appointment_id: str, body: AppointmentUpdate, user: CurrentUser, db: DB):
    a = db.get(Appointment, appointment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")

    if body.status:
        target = AppointmentStatus(body.status)
        if user.role == Role.PATIENT:
            p = db.get(Patient, a.patient_id)
            if not p or p.user_id != user.id or target != AppointmentStatus.CANCELLED:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Patients can only cancel their own appointments")
        elif user.role != Role.DISTRICT_ADMIN and user.facility_id != a.facility_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the hosting facility can change status")
        if target not in _APPT_TRANSITIONS[a.status]:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"Invalid transition {a.status.value} → {target.value}")
        a.status = target
    if body.queue_pos is not None:
        a.queue_pos = body.queue_pos
    if body.notes is not None:
        a.notes = body.notes
    db.commit()
    db.refresh(a)
    return a


# ------------------------------------------------------------- teleconsults

@router.post("/teleconsultations", response_model=TeleOut, status_code=status.HTTP_201_CREATED,
             summary="Schedule a teleconsultation session (metadata only)")
def create_tele(body: TeleCreate, user: CurrentUser, db: DB):
    p = _own_patient(user, db, body.patient_id)
    t = Teleconsultation(patient_id=p.id, doctor_id=body.doctor_id, facility_id=body.facility_id,
                         scheduled_at=body.scheduled_at, room_code=f"RAK-{secrets.token_hex(4).upper()}")
    db.add(t)
    db.commit()
    db.refresh(t)
    return _tout(db, t)


@router.get("/teleconsultations", response_model=list[TeleOut], summary="List teleconsultations (role scoped)")
def list_teles(user: CurrentUser, db: DB):
    q = select(Teleconsultation).order_by(Teleconsultation.scheduled_at.desc())
    if user.role == Role.PATIENT:
        own = select(Patient.id).where(Patient.user_id == user.id)
        q = q.where(Teleconsultation.patient_id.in_(own))
    elif user.role in CLINICAL:
        q = q.where(Teleconsultation.doctor_id == user.id)
    return [_tout(db, t) for t in db.execute(q).scalars()]


@router.patch("/teleconsultations/{tele_id}/complete", response_model=TeleOut,
              summary="Record teleconsult outcome — written to the longitudinal record",
              dependencies=[Depends(require_roles(*CLINICAL))])
def complete_tele(tele_id: str, body: TeleComplete, user: CurrentUser, db: DB):
    t = db.get(Teleconsultation, tele_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teleconsultation not found")
    if t.doctor_id != user.id and user.role != Role.SPECIALIST:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the consulting clinician can record the outcome")
    if t.status == TeleStatus.COMPLETED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already completed")
    t.status = TeleStatus.COMPLETED
    t.assessment = body.assessment
    t.recommendation = body.recommendation
    t.follow_up_date = body.follow_up_date
    # The outcome becomes a normal consultation event in the patient record.
    db.add(Consultation(patient_id=t.patient_id, doctor_id=user.id, facility_id=t.facility_id,
                        complaint="Teleconsultation", assessment=body.assessment,
                        plan=body.recommendation, follow_up_date=body.follow_up_date))
    log_action(db, user, AuditAction.TELECONSULT_COMPLETE, "teleconsultation", t.id, patient_id=t.patient_id)
    db.commit()
    db.refresh(t)
    return _tout(db, t)
