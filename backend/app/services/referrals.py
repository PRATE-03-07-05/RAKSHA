"""Closed-loop referral lifecycle.

State machine:
    CREATED → SENT → ACKNOWLEDGED → ACCEPTED → ARRIVED →
    IN_CONSULTATION → TREATMENT → COMPLETED  (+ scheduled FOLLOW-UP)
    CANCELLED is reachable from pre-arrival states.

Every transition appends an immutable ReferralEvent and is audited.
Invalid transitions → 409. Unauthorized actors → 403.
"""
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..models import (Priority, Referral, ReferralEvent, ReferralStatus,
                      Role, User)
from .notifications import notify

FIELD = {Role.ASHA, Role.ANM, Role.PHC_STAFF}
CLINICAL = {Role.PHC_DOCTOR, Role.CHC_DOCTOR, Role.SPECIALIST}

ALLOWED_TRANSITIONS: dict[ReferralStatus, list[ReferralStatus]] = {
    ReferralStatus.CREATED: [ReferralStatus.SENT, ReferralStatus.CANCELLED],
    ReferralStatus.SENT: [ReferralStatus.ACKNOWLEDGED, ReferralStatus.CANCELLED],
    ReferralStatus.ACKNOWLEDGED: [ReferralStatus.ACCEPTED, ReferralStatus.CANCELLED],
    ReferralStatus.ACCEPTED: [ReferralStatus.ARRIVED, ReferralStatus.CANCELLED],
    ReferralStatus.ARRIVED: [ReferralStatus.IN_CONSULTATION],
    ReferralStatus.IN_CONSULTATION: [ReferralStatus.TREATMENT],
    ReferralStatus.TREATMENT: [ReferralStatus.COMPLETED],
    ReferralStatus.COMPLETED: [],
    ReferralStatus.CANCELLED: [],
}

# Which roles may perform each incoming transition
_TRANSITION_ROLES: dict[ReferralStatus, set[Role]] = {
    ReferralStatus.SENT: FIELD | CLINICAL,
    ReferralStatus.ACKNOWLEDGED: {Role.PHC_STAFF} | CLINICAL,
    ReferralStatus.ACCEPTED: CLINICAL,
    ReferralStatus.ARRIVED: FIELD | CLINICAL,
    ReferralStatus.IN_CONSULTATION: CLINICAL,
    ReferralStatus.TREATMENT: CLINICAL,
    ReferralStatus.COMPLETED: CLINICAL,
    ReferralStatus.CANCELLED: FIELD | CLINICAL | {Role.DISTRICT_ADMIN},
}


def next_statuses(current: ReferralStatus) -> list[ReferralStatus]:
    return ALLOWED_TRANSITIONS.get(current, [])


def is_overdue(referral: Referral, today: date | None = None) -> bool:
    if referral.status in (ReferralStatus.COMPLETED, ReferralStatus.CANCELLED):
        return False
    exp = referral.expected_date or (today or date.today())
    return exp < (today or date.today())


def _authorize(user: User, referral: Referral, target: ReferralStatus) -> None:
    if user.role not in _TRANSITION_ROLES.get(target, set()):
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            f"Role {user.role.value} cannot move a referral to {target.value}")
    at_destination = user.facility_id and user.facility_id == referral.to_facility_id
    at_source = user.facility_id and user.facility_id == referral.from_facility_id
    is_creator = user.id == referral.created_by_id

    if target == ReferralStatus.CANCELLED:
        if not (is_creator or at_source or user.role == Role.DISTRICT_ADMIN):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the creator, source facility or admin can cancel")
        return
    if target == ReferralStatus.ACKNOWLEDGED:
        # Acknowledgement is a coordination step: referral-desk staff
        # (PHC_STAFF) may confirm receipt on behalf of the network, while
        # clinical roles must belong to the receiving facility.
        if user.role != Role.PHC_STAFF and not at_destination:
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                "Acknowledgement requires the receiving facility or referral-desk staff")
    elif target in (ReferralStatus.ACCEPTED, ReferralStatus.IN_CONSULTATION,
                    ReferralStatus.TREATMENT, ReferralStatus.COMPLETED):
        if not at_destination:
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                "Only staff of the receiving facility can perform this step")
    if target == ReferralStatus.ARRIVED:
        # Destination staff confirm — or the patient's ASHA/ANM confirms from the field.
        field_confirm = user.role in (Role.ASHA, Role.ANM) and (is_creator or at_source)
        if not (at_destination or field_confirm):
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                "Arrival must be confirmed by the destination facility or the referring field worker")
    if target == ReferralStatus.SENT and not (is_creator or at_source):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the referring side can dispatch")


def apply_transition(
    db: Session,
    user: User,
    referral: Referral,
    target: ReferralStatus,
    notes: str | None = None,
    outcome: str | None = None,
    outcome_notes: str | None = None,
) -> Referral:
    """Validate + apply one transition, append event, audit, notify."""
    if target not in ALLOWED_TRANSITIONS.get(referral.status, []):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Invalid transition {referral.status.value} → {target.value}. "
            f"Allowed: {[s.value for s in next_statuses(referral.status)]}",
        )
    _authorize(user, referral, target)

    if target == ReferralStatus.COMPLETED and not outcome:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "An outcome (e.g. TREATED_AND_DISCHARGED) is required to complete a referral")

    previous = referral.status
    referral.status = target
    referral.version += 1
    if target == ReferralStatus.COMPLETED:
        referral.completed_at = datetime.now(timezone.utc)
        referral.outcome = outcome
        referral.outcome_notes = outcome_notes

    event = ReferralEvent(
        referral_id=referral.id,
        from_status=previous.value,
        to_status=target.value,
        actor_id=user.id,
        actor_role=user.role.value,
        facility_id=user.facility_id,
        notes=notes,
    )
    db.add(event)
    log_action(db, user, AuditAction.REFERRAL_TRANSITION, "referral", referral.id,
               patient_id=referral.patient_id,
               detail={"from": previous.value, "to": target.value, "notes": notes})

    _notify_transition(db, user, referral, previous, target)
    db.flush()
    return referral


def _notify_transition(db: Session, actor: User, referral: Referral,
                       previous: ReferralStatus, target: ReferralStatus) -> None:
    """Closed-loop messaging: both ends of the referral always hear the outcome."""
    if target == ReferralStatus.ACKNOWLEDGED:
        notify(db, referral.created_by_id, "info",
               f"Referral {referral.code} acknowledged",
               "The receiving facility has acknowledged the referral.",
               ref_kind="referral", ref_id=referral.id, link=f"/app/referrals/{referral.id}")
    elif target == ReferralStatus.ARRIVED:
        notify(db, referral.created_by_id, "success",
               f"Patient arrived — {referral.code}",
               "The referred patient has reached the destination facility.",
               ref_kind="referral", ref_id=referral.id, link=f"/app/referrals/{referral.id}")
    elif target == ReferralStatus.COMPLETED:
        notify(db, referral.created_by_id, "success",
               f"Referral loop closed — {referral.code}",
               f"Outcome recorded: {(referral.outcome or 'completed').replace('_', ' ').lower()}.",
               ref_kind="referral", ref_id=referral.id, link=f"/app/referrals/{referral.id}")
    elif target == ReferralStatus.CANCELLED:
        notify(db, referral.created_by_id, "warning",
               f"Referral {referral.code} cancelled",
               f"Cancelled by {actor.name}.",
               ref_kind="referral", ref_id=referral.id, link=f"/app/referrals/{referral.id}")


def generate_code(db: Session) -> str:
    n = db.query(Referral).count() + 1
    return f"REF-{date.today().year}-{n:05d}"
