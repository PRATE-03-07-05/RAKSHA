"""Longitudinal record APIs: visits, vitals, consultations, prescriptions,
diagnostics and follow-ups. Observations are append-only events."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..database import get_db
from ..models import (Consultation, DiagnosticRecord, FollowUp,
                      FollowUpStatus, Patient, Prescription, Role, User, Visit,
                      VitalObservation)
from ..schemas import (ConsultationCreate, ConsultationOut, DiagnosticCreate,
                       DiagnosticOut, FollowUpCreate, FollowUpOut, MedItem,
                       VisitCreate, VisitOut, VitalCreate, VitalOut)
from ..security import CLINICAL, FIELD_WORKERS, CurrentUser, require_roles
from .patients import assert_can_view, get_patient_or_404

router = APIRouter(tags=["records"])
DB = Annotated[Session, Depends(get_db)]

RECORDERS = (*FIELD_WORKERS, *CLINICAL)


def _consultation_out(c: Consultation, db: Session) -> ConsultationOut:
    meds = db.execute(select(Prescription).where(Prescription.consultation_id == c.id)).scalars().all()
    out = ConsultationOut.model_validate(c)
    out.meds = [MedItem(medicine=m.medicine, dose=m.dose, duration=m.duration) for m in meds]
    doctor = db.get(User, c.doctor_id) if c.doctor_id else None
    out.doctor_name = doctor.name if doctor else None
    out.specialty = doctor.specialty if doctor else None
    return out


@router.get("/patients/{patient_id}/records",
            summary="Full longitudinal record (visits, vitals, consultations, diagnostics)")
def get_records(patient_id: str, user: CurrentUser, db: DB):
    p = get_patient_or_404(db, patient_id)
    assert_can_view(user, p)
    log_action(db, user, AuditAction.RECORD_VIEW, "records", p.id, patient_id=p.id)
    db.commit()

    ucache: dict[str, User | None] = {}

    def uget(uid_: str | None) -> User | None:
        if uid_ and uid_ not in ucache:
            ucache[uid_] = db.get(User, uid_)
        return ucache[uid_] if uid_ else None

    visits = []
    for v in db.execute(select(Visit).where(Visit.patient_id == p.id)
                        .order_by(Visit.created_at.desc())).scalars():
        vo = VisitOut.model_validate(v)
        w = uget(v.worker_id)
        vo.worker_name = w.name if w else None
        vo.worker_role = w.role.value if w else None
        visits.append(vo)
    vitals = []
    for v in db.execute(select(VitalObservation).where(VitalObservation.patient_id == p.id)
                        .order_by(VitalObservation.recorded_at.desc())).scalars():
        vo2 = VitalOut.model_validate(v)
        w2 = uget(v.recorded_by_id)
        vo2.recorded_by_name = w2.name if w2 else None
        vitals.append(vo2)
    consults = [_consultation_out(c, db) for c in
                db.execute(select(Consultation).where(Consultation.patient_id == p.id)
                           .order_by(Consultation.created_at.desc())).scalars()]
    diagnostics = []
    for d in db.execute(select(DiagnosticRecord).where(DiagnosticRecord.patient_id == p.id)
                        .order_by(DiagnosticRecord.created_at.desc())).scalars():
        do = DiagnosticOut.model_validate(d)
        w3 = uget(d.ordered_by_id)
        do.ordered_by_name = w3.name if w3 else None
        diagnostics.append(do)
    followups = [FollowUpOut.model_validate(f) for f in
                 db.execute(select(FollowUp).where(FollowUp.patient_id == p.id)
                            .order_by(FollowUp.scheduled_date.desc())).scalars()]
    return {"visits": visits, "vitals": vitals, "consultations": consults,
            "diagnostics": diagnostics, "followups": followups}


@router.post("/patients/{patient_id}/visits", response_model=VisitOut,
             status_code=status.HTTP_201_CREATED, summary="Record a field/facility visit",
             dependencies=[Depends(require_roles(*RECORDERS))])
def create_visit(patient_id: str, body: VisitCreate, user: CurrentUser, db: DB):
    p = get_patient_or_404(db, patient_id)
    assert_can_view(user, p)
    v = Visit(patient_id=p.id, worker_id=user.id, facility_id=body.facility_id or user.facility_id,
              location=body.location, symptoms=body.symptoms, complaint=body.complaint,
              observations=body.observations, notes=body.notes, source="FIELD")
    db.add(v)
    db.flush()
    log_action(db, user, AuditAction.VISIT_CREATE, "visit", v.id, patient_id=p.id)
    db.commit()
    db.refresh(v)
    out = VisitOut.model_validate(v)
    out.worker_name = user.name
    out.worker_role = user.role.value
    return out


@router.post("/patients/{patient_id}/vitals", response_model=VitalOut,
             status_code=status.HTTP_201_CREATED, summary="Record vitals (append-only observation)",
             dependencies=[Depends(require_roles(*RECORDERS))])
def create_vitals(patient_id: str, body: VitalCreate, user: CurrentUser, db: DB):
    p = get_patient_or_404(db, patient_id)
    assert_can_view(user, p)
    if all(v is None for v in (body.systolic, body.diastolic, body.temperature, body.spo2, body.heart_rate,
                               body.respiratory_rate, body.weight_kg)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "At least one vital measurement is required")
    o = VitalObservation(
        patient_id=p.id, recorded_by_id=user.id, facility_id=body.facility_id or user.facility_id,
        systolic=body.systolic, diastolic=body.diastolic, temperature=body.temperature,
        spo2=body.spo2, heart_rate=body.heart_rate, respiratory_rate=body.respiratory_rate,
        weight_kg=body.weight_kg, device=body.device,
        recorded_at=body.recorded_at or datetime.now(timezone.utc), source="MANUAL",
    )
    db.add(o)
    db.flush()
    log_action(db, user, AuditAction.VITALS_CREATE, "vital", o.id, patient_id=p.id,
               detail={"spo2": o.spo2, "temp": o.temperature})
    db.commit()
    db.refresh(o)
    vout = VitalOut.model_validate(o)
    vout.recorded_by_name = user.name
    return vout


@router.post("/patients/{patient_id}/consultations", response_model=ConsultationOut,
             status_code=status.HTTP_201_CREATED, summary="Record clinical consultation + prescription",
             dependencies=[Depends(require_roles(*CLINICAL))])
def create_consultation(patient_id: str, body: ConsultationCreate, user: CurrentUser, db: DB):
    p = get_patient_or_404(db, patient_id)
    assert_can_view(user, p)
    c = Consultation(patient_id=p.id, doctor_id=user.id, facility_id=user.facility_id,
                     complaint=body.complaint, findings=body.findings, assessment=body.assessment,
                     plan=body.plan, investigation=body.investigation, follow_up_date=body.follow_up_date)
    db.add(c)
    db.flush()
    log_action(db, user, AuditAction.CONSULTATION_CREATE, "consultation", c.id, patient_id=p.id)

    for med in body.meds:
        rx = Prescription(consultation_id=c.id, patient_id=p.id,
                          medicine=med.medicine, dose=med.dose, duration=med.duration)
        db.add(rx)
    if body.meds:
        log_action(db, user, AuditAction.PRESCRIPTION_CREATE, "prescription", c.id,
                   patient_id=p.id, detail={"meds": [m.medicine for m in body.meds]})
    if body.follow_up_date:
        db.add(FollowUp(patient_id=p.id, scheduled_date=body.follow_up_date,
                        notes="Post-consultation review", assignee_role="ASHA"))
    if body.investigation:
        db.add(DiagnosticRecord(patient_id=p.id, ordered_by_id=user.id,
                                facility_id=user.facility_id, test=body.investigation))
    db.commit()
    db.refresh(c)
    return _consultation_out(c, db)


@router.post("/patients/{patient_id}/diagnostics", response_model=DiagnosticOut,
             status_code=status.HTTP_201_CREATED, summary="Order/record a diagnostic",
             dependencies=[Depends(require_roles(*CLINICAL, Role.PHC_STAFF))])
def create_diagnostic(patient_id: str, body: DiagnosticCreate, user: CurrentUser, db: DB):
    p = get_patient_or_404(db, patient_id)
    assert_can_view(user, p)
    d = DiagnosticRecord(patient_id=p.id, ordered_by_id=user.id,
                         facility_id=body.facility_id or user.facility_id,
                         test=body.test, status=body.status, result_text=body.result_text,
                         completed_at=datetime.now(timezone.utc) if body.status == "COMPLETED" else None)
    db.add(d)
    db.flush()
    log_action(db, user, AuditAction.DIAGNOSTIC_CREATE, "diagnostic", d.id, patient_id=p.id,
               detail={"test": body.test})
    db.commit()
    db.refresh(d)
    dout = DiagnosticOut.model_validate(d)
    dout.ordered_by_name = user.name
    return dout


# ------------------------------------------------------------------ follow-ups

@router.get("/patients/{patient_id}/followups", response_model=list[FollowUpOut],
            summary="Follow-ups for a patient")
def list_patient_followups(patient_id: str, user: CurrentUser, db: DB):
    p = get_patient_or_404(db, patient_id)
    assert_can_view(user, p)
    rows = db.execute(select(FollowUp).where(FollowUp.patient_id == p.id)
                      .order_by(FollowUp.scheduled_date.desc())).scalars().all()
    return [FollowUpOut.model_validate(f) for f in rows]


@router.post("/patients/{patient_id}/followups", response_model=FollowUpOut,
             status_code=status.HTTP_201_CREATED, summary="Schedule a follow-up",
             dependencies=[Depends(require_roles(*RECORDERS))])
def create_followup(patient_id: str, body: FollowUpCreate, user: CurrentUser, db: DB):
    p = get_patient_or_404(db, patient_id)
    assert_can_view(user, p)
    f = FollowUp(patient_id=p.id, referral_id=body.referral_id, scheduled_date=body.scheduled_date,
                 notes=body.notes, assignee_role=body.assignee_role)
    db.add(f)
    db.flush()
    log_action(db, user, AuditAction.FOLLOWUP_CREATE, "followup", f.id, patient_id=p.id,
               detail={"date": body.scheduled_date.isoformat()})
    db.commit()
    db.refresh(f)
    return f


@router.patch("/followups/{followup_id}/complete", response_model=FollowUpOut,
              summary="Mark follow-up completed (closes the loop)",
              dependencies=[Depends(require_roles(*RECORDERS))])
def complete_followup(followup_id: str, user: CurrentUser, db: DB):
    f = db.get(FollowUp, followup_id)
    if f is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Follow-up not found")
    if f.status == FollowUpStatus.COMPLETED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Follow-up already completed")
    f.status = FollowUpStatus.COMPLETED
    f.completed_at = datetime.now(timezone.utc)
    f.completed_by_id = user.id
    log_action(db, user, AuditAction.FOLLOWUP_COMPLETE, "followup", f.id, patient_id=f.patient_id)
    db.commit()
    db.refresh(f)
    return f


@router.get("/followups/all", response_model=list[FollowUpOut],
            summary="Follow-ups visible to the caller (workers: own village; clinical/admin: all)",
            dependencies=[Depends(require_roles(*RECORDERS, Role.DISTRICT_ADMIN))])
def all_followups(user: CurrentUser, db: DB, overdue_only: bool = False):
    from datetime import date as _date
    q = select(FollowUp).order_by(FollowUp.scheduled_date.asc())
    rows = list(db.execute(q).scalars().all())
    if user.role in (Role.ASHA, Role.ANM):
        mine = {p.id for p in db.execute(select(Patient).where(Patient.asha_id == user.id)).scalars()}
        rows = [f for f in rows if f.patient_id in mine]
    if overdue_only:
        today = _date.today()
        rows = [f for f in rows if f.status == FollowUpStatus.SCHEDULED and f.scheduled_date < today]
    return [FollowUpOut.model_validate(f) for f in rows]
