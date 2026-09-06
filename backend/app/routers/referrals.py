"""Closed-loop referral APIs — the heart of RAKSHA.

Lifecycle: CREATED → SENT → ACKNOWLEDGED → ACCEPTED → ARRIVED →
IN_CONSULTATION → TREATMENT → COMPLETED (+ follow-up), CANCELLED early.

Who created it, why, where to, current status, acknowledgements, arrival,
treatment and outcome are all answerable from this resource + its history.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..database import get_db
from ..models import (Facility, FollowUp, Patient, Priority, Referral,
                      ReferralEvent, ReferralStatus, Role, User)
from ..schemas import (FollowUpCreate, FollowUpOut, Page, ReferralCreate,
                       ReferralDetail, ReferralEventOut, ReferralOut,
                       ReferralTransition)
from ..security import CLINICAL, FIELD_WORKERS, CurrentUser, require_roles
from ..services import referrals as svc
from ..services.notifications import notify

router = APIRouter(prefix="/referrals", tags=["referrals"])
DB = Annotated[Session, Depends(get_db)]
CREATORS = (*FIELD_WORKERS, *CLINICAL)


def _out(r: Referral) -> ReferralOut:
    out = ReferralOut.model_validate(r)
    out.overdue = svc.is_overdue(r)
    return out


def _detail(r: Referral) -> ReferralDetail:
    d = ReferralDetail.model_validate(r)
    d.overdue = svc.is_overdue(r)
    d.events = [ReferralEventOut.model_validate(e) for e in r.events]
    return d


def _assert_visible(user: User, r: Referral, db: Session) -> None:
    if user.role == Role.DISTRICT_ADMIN:
        return
    if r.created_by_id == user.id or user.facility_id in (r.from_facility_id, r.to_facility_id):
        return
    if user.role == Role.PATIENT:
        p = db.get(Patient, r.patient_id)
        if p and p.user_id == user.id:
            return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a participant of this referral")


@router.post("", response_model=ReferralOut, status_code=status.HTTP_201_CREATED,
             summary="Create a referral (starts as SENT with full audit trail)",
             dependencies=[Depends(require_roles(*CREATORS))])
def create_referral(body: ReferralCreate, user: CurrentUser, db: DB):
    patient = db.get(Patient, body.patient_id)
    if patient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    for fid, label in ((body.from_facility_id, "Source"), (body.to_facility_id, "Destination")):
        if db.get(Facility, fid) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} facility not found")
    if body.from_facility_id == body.to_facility_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Source and destination must differ")

    r = Referral(
        code=svc.generate_code(db),
        patient_id=patient.id,
        from_facility_id=body.from_facility_id,
        to_facility_id=body.to_facility_id,
        created_by_id=user.id,
        reason=body.reason,
        priority=Priority(body.priority),
        status=ReferralStatus.SENT,
        clinical_summary=body.clinical_summary,
        vitals_snapshot=body.vitals_snapshot,
        expected_date=body.expected_date,
    )
    db.add(r)
    db.flush()
    for frm, to, note in ((None, ReferralStatus.CREATED, "Referral created"),
                          (ReferralStatus.CREATED, ReferralStatus.SENT, "Referral dispatched to destination")):
        db.add(ReferralEvent(referral_id=r.id, from_status=frm.value if frm else None, to_status=to.value,
                             actor_id=user.id, actor_role=user.role.value,
                             facility_id=user.facility_id or body.from_facility_id, notes=note))
    log_action(db, user, AuditAction.REFERRAL_CREATE, "referral", r.id, patient_id=patient.id,
               detail={"code": r.code, "to": body.to_facility_id, "priority": body.priority})

    # Notify every user at the receiving facility — the loop starts here.
    dest_users = db.execute(select(User).where(User.facility_id == body.to_facility_id,
                                               User.is_active.is_(True))).scalars().all()
    for u in dest_users[:10]:
        notify(db, u.id, "warning" if body.priority in ("URGENT", "EMERGENCY") else "info",
               f"Incoming referral {r.code} — {body.priority}",
               f"{patient.name} referred from {body.from_facility_id}. Reason: {body.reason}",
               patient_id=patient.id, ref_kind="referral", ref_id=r.id,
               link=f"/app/referrals/{r.id}", sms=body.priority == "EMERGENCY", actor=user)
    if patient.asha_id and patient.asha_id != user.id:
        notify(db, patient.asha_id, "info", f"Referral {r.code} created",
               f"{patient.name} referred — you will be updated at every step.",
               patient_id=patient.id, ref_kind="referral", ref_id=r.id,
               link=f"/app/referrals/{r.id}", actor=user)
    db.commit()
    db.refresh(r)
    return _out(r)


@router.get("", response_model=Page[ReferralOut], summary="List referrals (role/facility scoped)")
def list_referrals(
    user: CurrentUser, db: DB,
    status_filter: str | None = Query(None, alias="status"),
    direction: str = Query("all", pattern="^(incoming|outgoing|all)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    q = select(Referral)
    if user.role == Role.DISTRICT_ADMIN:
        pass
    elif user.role == Role.PATIENT:
        own = select(Patient.id).where(Patient.user_id == user.id)
        q = q.where(Referral.patient_id.in_(own))
    elif user.role in (Role.ASHA, Role.ANM):
        q = q.where((Referral.created_by_id == user.id) | (Referral.from_facility_id == user.facility_id)
                    | (Referral.to_facility_id == user.facility_id))
    else:
        conds = []
        if direction in ("incoming", "all") and user.facility_id:
            conds.append(Referral.to_facility_id == user.facility_id)
        if direction in ("outgoing", "all") and user.facility_id:
            conds.append(Referral.from_facility_id == user.facility_id)
        conds.append(Referral.created_by_id == user.id)
        from sqlalchemy import or_
        q = q.where(or_(*conds))

    if status_filter:
        q = q.where(Referral.status == ReferralStatus(status_filter.upper()))

    rows = list(db.execute(q.order_by(Referral.created_at.desc())).scalars().all())
    total = len(rows)
    page = rows[offset: offset + limit]
    return Page(items=[_out(r) for r in page], total=total, limit=limit, offset=offset)


@router.get("/meta/flow", summary="Referral state machine (for UI rendering)")
def flow(_: CurrentUser):
    return {
        "flow": [s.value for s in (ReferralStatus.CREATED, ReferralStatus.SENT, ReferralStatus.ACKNOWLEDGED,
                                   ReferralStatus.ACCEPTED, ReferralStatus.ARRIVED,
                                   ReferralStatus.IN_CONSULTATION, ReferralStatus.TREATMENT,
                                   ReferralStatus.COMPLETED)],
        "terminal": [ReferralStatus.CANCELLED.value],
        "today": date.today().isoformat(),
    }


@router.get("/{referral_id}", response_model=ReferralDetail, summary="Referral with full event history")
def get_referral(referral_id: str, user: CurrentUser, db: DB):
    r = db.get(Referral, referral_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Referral not found")
    _assert_visible(user, r, db)
    return _detail(r)


@router.get("/{referral_id}/history", response_model=list[ReferralEventOut],
            summary="Immutable status-transition history")
def referral_history(referral_id: str, user: CurrentUser, db: DB):
    r = db.get(Referral, referral_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Referral not found")
    _assert_visible(user, r, db)
    return [ReferralEventOut.model_validate(e) for e in r.events]


@router.post("/{referral_id}/transition", response_model=ReferralDetail,
             summary="Advance the referral lifecycle (validated + authorized)")
def transition(referral_id: str, body: ReferralTransition, user: CurrentUser, db: DB):
    r = db.get(Referral, referral_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Referral not found")
    try:
        target = ReferralStatus(body.target.upper())
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown status '{body.target}'")
    svc.apply_transition(db, user, r, target, notes=body.notes,
                         outcome=body.outcome, outcome_notes=body.outcome_notes)
    db.commit()
    db.refresh(r)
    return _detail(r)


@router.post("/{referral_id}/followup", response_model=FollowUpOut,
             status_code=status.HTTP_201_CREATED, summary="Schedule follow-up against a referral",
             dependencies=[Depends(require_roles(*CREATORS, Role.DISTRICT_ADMIN))])
def schedule_followup(referral_id: str, body: FollowUpCreate, user: CurrentUser, db: DB):
    r = db.get(Referral, referral_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Referral not found")
    f = FollowUp(patient_id=r.patient_id, referral_id=r.id, scheduled_date=body.scheduled_date,
                 notes=body.notes or "Post-referral review", assignee_role=body.assignee_role)
    db.add(f)
    r.follow_up_date = body.scheduled_date
    log_action(db, user, AuditAction.FOLLOWUP_CREATE, "followup", None, patient_id=r.patient_id,
               detail={"referral": r.code, "date": body.scheduled_date.isoformat()})
    patient = db.get(Patient, r.patient_id)
    if patient and patient.asha_id:
        notify(db, patient.asha_id, "info", f"Follow-up scheduled — {patient.name}",
               f"Due {body.scheduled_date.isoformat()}. Please visit and record observations.",
               patient_id=patient.id, ref_kind="followup", ref_id=r.id,
               link="/app/followups", actor=user)
    db.commit()
    db.refresh(f)
    return f
