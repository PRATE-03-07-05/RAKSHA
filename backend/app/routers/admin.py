"""District administration: analytics, bottleneck visibility, audit logs and
real, database-driven user management."""
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..database import get_db
from ..models import (Assessment, AuditLog, EmergencyEvent, EmergencyStatus,
                      Facility, FacilityResource, FollowUp, FollowUpStatus,
                      Patient, Referral, ReferralStatus, Role, User)
from ..schemas import (AnalyticsOut, AuditOut, PasswordReset, UserCreate,
                       UserOut, UserUpdate)
from ..security import CurrentUser, hash_password, require_roles
from ..services.referrals import is_overdue

router = APIRouter(prefix="/admin", tags=["admin"],
                   dependencies=[Depends(require_roles(Role.DISTRICT_ADMIN))])
DB = Annotated[Session, Depends(get_db)]

ACTIVE_STATES = {ReferralStatus.SENT, ReferralStatus.ACKNOWLEDGED, ReferralStatus.ACCEPTED,
                 ReferralStatus.ARRIVED, ReferralStatus.IN_CONSULTATION, ReferralStatus.TREATMENT}


@router.get("/analytics", response_model=AnalyticsOut, summary="District-level operational analytics")
def analytics(_: CurrentUser, db: DB):
    patients = db.execute(select(Patient)).scalars().all()
    referrals = db.execute(select(Referral)).scalars().all()
    facilities = db.execute(select(Facility).where(Facility.is_active.is_(True))).scalars().all()
    total_users = len(db.execute(select(User)).scalars().all())
    active_emergencies = len(db.execute(select(EmergencyEvent)
                                        .where(EmergencyEvent.status == EmergencyStatus.ACTIVE)).scalars().all())

    completed = [r for r in referrals if r.status == ReferralStatus.COMPLETED]
    active = [r for r in referrals if r.status in ACTIVE_STATES]
    overdue = [r for r in active if is_overdue(r)]
    pending = [r for r in referrals if r.status in (ReferralStatus.CREATED, ReferralStatus.SENT)]

    completion_rate = round(len(completed) / len(referrals), 3) if referrals else 0.0
    durations = [((r.completed_at - r.created_at).total_seconds() / 3600)
                 for r in completed if r.completed_at]
    avg_hours = round(sum(durations) / len(durations), 1) if durations else None

    # latest assessment per patient
    latest: dict[str, Assessment] = {}
    for a in db.execute(select(Assessment).order_by(Assessment.created_at.asc())).scalars():
        latest[a.patient_id] = a
    high = [a for a in latest.values() if a.level.value in ("HIGH", "CRITICAL")]
    critical = [a for a in latest.values() if a.level.value == "CRITICAL"]

    today = date.today()
    missed = db.execute(select(FollowUp).where(FollowUp.status == FollowUpStatus.SCHEDULED,
                                               FollowUp.scheduled_date < today)).scalars().all()

    distribution: dict[str, int] = {}
    for r in referrals:
        distribution[r.status.value] = distribution.get(r.status.value, 0) + 1

    workload = []
    for f in facilities:
        res = db.get(FacilityResource, f.id)
        incoming = sum(1 for r in active if r.to_facility_id == f.id)
        workload.append({"facility_id": f.id, "name": f.name, "type": f.facility_type.value,
                         "active_referrals": incoming,
                         "workload_level": res.workload_level if res else "UNKNOWN",
                         "available_beds": res.available_beds if res else None})

    by_month: dict[str, int] = {}
    for p in patients:
        key = p.created_at.strftime("%Y-%m")
        by_month[key] = by_month.get(key, 0) + 1
    patients_by_month = [{"month": k, "patients": v} for k, v in sorted(by_month.items())][-6:]

    pmap = {p.id: p for p in patients}
    hr_by_fac: dict[str, dict[str, int]] = {}
    for a in high:
        fac = (pmap.get(a.patient_id).phc_id if pmap.get(a.patient_id) else None) or "UNASSIGNED"
        bucket = hr_by_fac.setdefault(fac, {"high": 0, "critical": 0})
        bucket["critical" if a.level.value == "CRITICAL" else "high"] += 1
    high_risk_by_facility = [{"facility_id": k, "high_risk_cases": v["high"] + v["critical"],
                              "high": v["high"], "critical": v["critical"]}
                             for k, v in hr_by_fac.items()]

    shortages = 0
    for f in facilities:
        res = db.get(FacilityResource, f.id)
        if not res:
            continue
        shortages += sum(1 for m in res.medicines if m.get("status") == "UNAVAILABLE")
        shortages += sum(1 for d in (res.cbc.value, res.xray.value, res.ultrasound.value) if d == "UNAVAILABLE")

    return AnalyticsOut(
        total_patients=len(patients),
        total_users=total_users,
        active_emergencies=active_emergencies,
        total_referrals=len(referrals),
        active_referrals=len(active),
        pending_referrals=len(pending),
        completed_referrals=len(completed),
        overdue_referrals=len(overdue),
        completion_rate=completion_rate,
        avg_completion_hours=avg_hours,
        high_risk_cases=len(high),
        critical_cases=len(critical),
        missed_followups=len(missed),
        facilities=len(facilities),
        resource_shortages=shortages,
        referral_status_distribution=distribution,
        facility_workload=workload,
        patients_by_month=patients_by_month,
        high_risk_by_facility=high_risk_by_facility,
    )


@router.get("/bottlenecks", summary="Where referrals get stuck (per source facility)")
def bottlenecks(_: CurrentUser, db: DB):
    referrals = db.execute(select(Referral)).scalars().all()
    facilities = db.execute(select(Facility)).scalars().all()
    out = []
    for f in facilities:
        mine = [r for r in referrals if r.from_facility_id == f.id]
        if not mine:
            continue
        completed = sum(1 for r in mine if r.status == ReferralStatus.COMPLETED)
        active = [r for r in mine if r.status in ACTIVE_STATES]
        out.append({
            "facility_id": f.id, "name": f.name, "type": f.facility_type.value,
            "total": len(mine), "completed": completed,
            "pending": len(active), "overdue": sum(1 for r in active if is_overdue(r)),
            "completion_rate": round(completed / len(mine), 3),
        })
    return sorted(out, key=lambda x: x["overdue"], reverse=True)


@router.get("/audit-logs", response_model=list[AuditOut], summary="Audit trail (admin only)")
def audit_logs(_: CurrentUser, db: DB,
               action: str | None = Query(None),
               limit: int = Query(100, ge=1, le=500)):
    q = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        q = q.where(AuditLog.action == action.upper())
    return [AuditOut.model_validate(a) for a in db.execute(q.limit(limit)).scalars()]


# ------------------------------------------------------------- user management
# Real, database-driven user administration. Passwords are always stored as
# bcrypt hashes — plaintext never leaves the request boundary.

@router.get("/users", response_model=list[UserOut], summary="List users (admin only)")
def list_users(_: CurrentUser, db: DB,
               role: str | None = Query(None),
               limit: int = Query(200, ge=1, le=500),
               offset: int = Query(0, ge=0)):
    q = select(User).order_by(User.created_at.desc())
    if role:
        q = q.where(User.role == Role(role.upper()))
    rows = db.execute(q.limit(limit).offset(offset)).scalars().all()
    return [UserOut.model_validate(u) for u in rows]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED,
             summary="Create a user (admin only)")
def create_user(body: UserCreate, admin: CurrentUser, db: DB):
    existing = db.execute(select(User).where(User.email == body.email.lower())).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")
    if body.facility_id and db.get(Facility, body.facility_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Facility not found")

    u = User(
        email=body.email.lower(),
        name=body.name,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=body.role,
        specialty=body.specialty,
        facility_id=body.facility_id,
        district=body.district,
        village=body.village,
        is_active=True,
    )
    db.add(u)
    db.flush()
    log_action(db, admin, AuditAction.USER_CREATE, "user", u.id,
               detail={"email": u.email, "role": u.role.value})
    db.commit()
    db.refresh(u)
    return u


@router.patch("/users/{user_id}", response_model=UserOut,
              summary="Update user role / facility / activation (admin only)")
def update_user(user_id: str, body: UserUpdate, admin: CurrentUser, db: DB):
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if u.id == admin.id and body.is_active is False:
        raise HTTPException(status.HTTP_409_CONFLICT, "You cannot deactivate your own account")
    if body.facility_id and db.get(Facility, body.facility_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Facility not found")

    changes: dict[str, object] = {}
    for field in ("name", "role", "facility_id", "district", "phone", "specialty", "village", "is_active"):
        value = getattr(body, field)
        if value is not None:
            changes[field] = value
            setattr(u, field, value)
    if changes:
        log_action(db, admin, AuditAction.USER_UPDATE, "user", u.id,
                   detail={"fields": sorted(str(k) for k in changes)})
    db.commit()
    db.refresh(u)
    return u


@router.post("/users/{user_id}/reset-password", response_model=UserOut,
             summary="Reset a user's password (admin only)")
def reset_user_password(user_id: str, body: PasswordReset, admin: CurrentUser, db: DB):
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    u.password_hash = hash_password(body.new_password)
    log_action(db, admin, AuditAction.USER_RESET_PASSWORD, "user", u.id)
    db.commit()
    db.refresh(u)
    return u
