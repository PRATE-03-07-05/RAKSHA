"""Canonical clinical queue — database-backed priority queue for clinicians.

Operational scheduling/prioritization ONLY — not a clinically validated
triage device. Clinical urgency comes from existing RAKSHA data (latest
Assessment level, falling back to referral priority). Existing triage
disclaimer language remains authoritative.

Algorithm (documented constants):
  BASE_RANK: CRITICAL=0, HIGH=1, MEDIUM=2, LOW=3 (lower = earlier).
  AGING_INTERVAL_MIN = 60 — every full hour waited earns +1 boost.
  MAX_AGE_BOOST = 1 — bounded so waiting time can lift a case at most
    one priority class (MEDIUM→HIGH-equivalent, LOW→MEDIUM-equivalent).
  CRITICAL (rank 0) never receives a boost and boosted non-critical ranks
    floor at 1, so CRITICAL can never be overtaken by aging.
  Sort key (deterministic): (effective_rank, entry_time, id).

Sources (existing schema, no new tables):
  - appointments with status SCHEDULED (WAITING) / IN_QUEUE (IN_PROGRESS)
  - referrals with status SENT/ACKNOWLEDGED/ACCEPTED (WAITING) /
    ARRIVED/IN_CONSULTATION/TREATMENT (IN_PROGRESS)
Dedup: one row per patient — the highest-priority (lowest sort key) entry
wins when a patient has both an appointment and a referral.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (Appointment, AppointmentStatus, Assessment, Patient,
                      Referral, ReferralStatus, RiskLevel, Role, User)

log = logging.getLogger("raksha.queue")

# Queue-management constants (operational, not clinical validation).
AGING_INTERVAL_MIN = 60
MAX_AGE_BOOST = 1

BASE_RANK: dict[str, int] = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

ACTIVE_APPT = {AppointmentStatus.SCHEDULED, AppointmentStatus.IN_QUEUE}
ACTIVE_REF = {
    ReferralStatus.SENT, ReferralStatus.ACKNOWLEDGED, ReferralStatus.ACCEPTED,
    ReferralStatus.ARRIVED, ReferralStatus.IN_CONSULTATION, ReferralStatus.TREATMENT,
}
WAITING_APPT = {AppointmentStatus.SCHEDULED}
WAITING_REF = {ReferralStatus.SENT, ReferralStatus.ACKNOWLEDGED, ReferralStatus.ACCEPTED}

PRIORITY_FROM_REF: dict[str, str] = {
    "EMERGENCY": "CRITICAL", "URGENT": "HIGH",
    "PRIORITY": "MEDIUM", "ROUTINE": "LOW",
}


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def triage_of(patient_id: str, latest: dict[str, str], fallback: str = "MEDIUM") -> str:
    lvl = latest.get(patient_id, fallback)
    return lvl if lvl in BASE_RANK else fallback


def effective_rank(base: str, wait_min: int) -> tuple[int, int]:
    """(effective_rank, age_boost) with bounded aging; CRITICAL never boosted."""
    b = BASE_RANK.get(base, 2)
    if b == 0:
        return 0, 0
    boost = min(MAX_AGE_BOOST, max(0, wait_min // AGING_INTERVAL_MIN))
    return max(1, b - boost), boost


def queue_status_of_appointment(s: AppointmentStatus) -> str:
    if s == AppointmentStatus.IN_QUEUE:
        return "IN_PROGRESS"
    if s == AppointmentStatus.COMPLETED:
        return "COMPLETED"
    if s == AppointmentStatus.CANCELLED:
        return "CANCELLED"
    return "WAITING"


def queue_status_of_referral(s: ReferralStatus) -> str:
    if s in (ReferralStatus.ARRIVED, ReferralStatus.IN_CONSULTATION, ReferralStatus.TREATMENT):
        return "IN_PROGRESS"
    if s == ReferralStatus.COMPLETED:
        return "COMPLETED"
    if s == ReferralStatus.CANCELLED:
        return "CANCELLED"
    return "WAITING"


def _appt_entry_time(a: Appointment) -> datetime:
    """Scheduled datetime (naive date+time → UTC) falling back to created_at."""
    try:
        hh, mm = (a.time or "09:00").split(":")[:2]
        naive = datetime(a.date.year, a.date.month, a.date.day,
                         int(hh), int(mm), tzinfo=timezone.utc)
        return naive
    except Exception:
        return _aware(a.created_at) or datetime.now(timezone.utc)


def build_queue(db: Session, user: User, *,
                status: str | None = None,
                priority: str | None = None,
                limit: int = 50, offset: int = 0,
                include_completed: bool = False) -> tuple[list[dict], int]:
    """Role-aware, facility-aware, deterministic queue. Returns (page, total)."""
    now = datetime.now(timezone.utc)
    fid = user.facility_id
    role = user.role

    # Latest assessment level per patient (single query, no N+1).
    latest: dict[str, str] = {}
    for pid, lvl in db.execute(
        select(Assessment.patient_id, Assessment.level)
        .order_by(Assessment.patient_id, Assessment.created_at.desc())
    ).all():
        if pid not in latest:
            latest[pid] = lvl.value if hasattr(lvl, "value") else str(lvl)

    candidates: list[dict] = []

    # ---- appointments at my facility (or mine, for specialists) ----
    appts = db.execute(select(Appointment)).scalars().all()
    for a in appts:
        if not include_completed and a.status not in ACTIVE_APPT:
            continue
        if role in (Role.PHC_DOCTOR, Role.CHC_DOCTOR):
            if not fid or a.facility_id != fid:
                continue
        elif role == Role.SPECIALIST:
            # Specialist: only own assignments or own-facility appointments.
            if not ((a.doctor_id and a.doctor_id == user.id) or (fid and a.facility_id == fid)):
                continue
        else:
            continue  # router enforces CLINICAL; defensive
        p = db.get(Patient, a.patient_id)
        if p is None:
            continue
        lvl = triage_of(p.id, latest, fallback="MEDIUM")
        entry = _aware(_appt_entry_time(a)) or now
        wait_min = max(0, int((now - entry).total_seconds() // 60)) if entry <= now else 0
        eff, boost = effective_rank(lvl, wait_min)
        qs = queue_status_of_appointment(a.status)
        candidates.append({
            "id": f"appt-{a.id}", "patient_id": p.id,
            "patient_name": p.name or "Unknown", "age": p.age or 0,
            "sex": (p.gender.value if hasattr(p.gender, "value") else str(p.gender or "")) or "",
            "phone": p.phone or "", "village": p.village or "",
            "queue_status": qs, "priority": lvl,
            "priority_score": eff * 10000 - min(wait_min, 9999),
            "triage_level": lvl, "arrival_time": entry,
            "scheduled_time": entry, "waiting_minutes": wait_min,
            "assigned_facility_id": a.facility_id or "",
            "assigned_clinician_id": a.doctor_id or "",
            "referral_id": None, "reason": a.purpose or "OPD visit",
            "source": "appointment", "_eff": eff,
            "_entry": entry, "_sid": f"appt-{a.id}",
        })

    # ---- referrals to my facility ----
    refs = db.execute(select(Referral)).scalars().all()
    for r in refs:
        if not include_completed and r.status not in ACTIVE_REF:
            continue
        if role in (Role.PHC_DOCTOR, Role.CHC_DOCTOR):
            if not fid or r.to_facility_id != fid:
                continue
        elif role == Role.SPECIALIST:
            # Schema has no target_specialty column: scope = my facility +
            # active clinical states. Specialty matching is best-effort on
            # clinical_summary/reason text; documented limitation.
            if not fid or r.to_facility_id != fid:
                continue
            if user.specialty:
                blob = f"{r.clinical_summary or ''} {r.reason or ''}".lower()
                # Do not exclude on text miss — facility scope is authoritative.
                _ = blob  # specialty hint only; see docs
        else:
            continue
        p = db.get(Patient, r.patient_id)
        if p is None:
            continue
        fallback = PRIORITY_FROM_REF.get(
            (r.priority.value if hasattr(r.priority, "value") else str(r.priority)), "MEDIUM")
        lvl = triage_of(p.id, latest, fallback=fallback)
        entry = _aware(r.created_at) or now
        wait_min = max(0, int((now - entry).total_seconds() // 60))
        eff, boost = effective_rank(lvl, wait_min)
        qs = queue_status_of_referral(r.status)
        candidates.append({
            "id": f"ref-{r.id}", "patient_id": p.id,
            "patient_name": p.name or "Unknown", "age": p.age or 0,
            "sex": (p.gender.value if hasattr(p.gender, "value") else str(p.gender or "")) or "",
            "phone": p.phone or "", "village": p.village or "",
            "queue_status": qs, "priority": lvl,
            "priority_score": eff * 10000 - min(wait_min, 9999),
            "triage_level": lvl, "arrival_time": entry,
            "scheduled_time": entry, "waiting_minutes": wait_min,
            "assigned_facility_id": r.to_facility_id or "",
            "assigned_clinician_id": r.created_by_id or "",
            "referral_id": r.id,
            "reason": r.reason or "Referred case",
            "source": "referral", "_eff": eff,
            "_entry": entry, "_sid": f"ref-{r.id}",
        })

    # ---- dedup: one row per patient (highest priority wins) ----
    best: dict[str, dict] = {}
    for c in candidates:
        cur = best.get(c["patient_id"])
        key = (c["_eff"], c["_entry"], c["_sid"])
        if cur is None or key < (cur["_eff"], cur["_entry"], cur["_sid"]):
            best[c["patient_id"]] = c

    rows = list(best.values())
    # ---- deterministic order: effective rank, entry time, stable id ----
    rows.sort(key=lambda c: (c["_eff"], c["_entry"], c["_sid"]))

    # ---- optional filters (backend-enforced, frontend may only narrow) ----
    if status in ("WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED"):
        rows = [c for c in rows if c["queue_status"] == status]
    if priority in BASE_RANK:
        rows = [c for c in rows if c["priority"] == priority]

    total = len(rows)
    page = rows[offset: offset + limit]
    for c in page:
        c.pop("_eff", None)
        c.pop("_entry", None)
        c.pop("_sid", None)
    log.info("queue user=%s role=%s facility=%s returned=%s total=%s",
             user.id, role.value, fid, len(page), total)
    return page, total
