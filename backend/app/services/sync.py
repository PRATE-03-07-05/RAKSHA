"""Offline-first synchronization ledger.

Contract with the frontend (IndexedDB sync queue):
- Every queued client operation carries a stable client `id` → the ledger
  primary key, which makes replaying a batch idempotent.
- Creates are applied with the client's id/timestamps (append-only medical
  events merge without conflict).
- Updates use optimistic versioning: if the server row has moved past the
  client's `version`, the op is recorded as CONFLICT (never silently
  overwritten) and the client keeps both states for review.
"""
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..models import (Assessment, FollowUp, Patient, Referral, ReferralStatus,
                      SyncOperation, SyncStatus, User, Visit, VitalObservation)
from ..schemas import SyncBatchIn, SyncOpOut
from .patients import generate_rak_id

_CREATORS = {
    "visit": Visit,
    "vital": VitalObservation,
    "followup": FollowUp,
    "referral": Referral,
}


def _apply_assessment(db: Session, user: User, op, payload: dict[str, Any]) -> dict[str, Any]:
    """Assessments captured offline are re-evaluated SERVER-SIDE on sync.

    The client queues only the raw inputs; the decision-support engine (ML
    model or rule fallback — whatever is active) computes the level, factors
    and recommendation here. Clients never dictate the authoritative result,
    and no ML output is ever fabricated while offline.
    """
    from ..schemas import TriageRequest
    from .triage import assess_with_fallback, persist

    raw = payload.get("input") or payload.get("input_snapshot") or {}
    req = TriageRequest(
        patient_id=payload.get("patient_id"),
        age=int(raw.get("age") or 0),
        spo2=raw.get("spo2"), respiratory_rate=raw.get("rr"),
        temperature=raw.get("temp"), heart_rate=raw.get("hr"),
        cough=bool(raw.get("cough")), breathing_difficulty=bool(raw.get("breathing_difficulty")),
        chest_pain=bool(raw.get("chest_pain")), duration_days=raw.get("duration_days"),
        pregnant=bool(raw.get("pregnant")), conditions=list(raw.get("conditions") or []),
        severity_reported=raw.get("severity"), symptoms=list(raw.get("symptoms") or []),
    )
    result = assess_with_fallback(req)
    assessment = persist(db, user, req, result)
    return {"id": assessment.id, "level": result.risk_level, "mode": result.mode}


def _apply_one(db: Session, user: User, op) -> dict[str, Any]:
    payload = dict(op.payload)

    if op.operation == "create":
        if op.entity == "patient":
            if not payload.get("name") or "age" not in payload:
                raise ValueError("patient payload requires name and age")
            rak_id = payload.pop("rak_id", None) or generate_rak_id(db)
            p = Patient(id=payload.pop("id", None) or None, rak_id=rak_id, **{
                k: v for k, v in payload.items()
                if k in {"name", "date_of_birth", "age", "gender", "phone", "village", "address",
                         "district", "emergency_contact", "emergency_phone", "blood_group",
                         "conditions", "allergies", "pregnant", "asha_id", "phc_id",
                         "consent_granted", "consent_at"}
            })
            db.add(p)
            db.flush()
            return {"id": p.id, "rak_id": p.rak_id}

        if op.entity == "assessment":
            return _apply_assessment(db, user, op, payload)

        model = _CREATORS.get(op.entity)
        if model is None:
            raise ValueError(f"Unsupported entity '{op.entity}'")
        kwargs = {k: v for k, v in payload.items() if k not in {"workerName", "createdByName"}}
        if op.entity == "referral":
            from .referrals import generate_code
            kwargs.setdefault("code", generate_code(db))
            kwargs.setdefault("status", ReferralStatus.SENT)
        obj = model(**kwargs)
        db.add(obj)
        db.flush()
        return {"id": obj.id}

    # ---- update (optimistic) ----
    if op.entity != "patient":
        raise ValueError("Only patient updates are supported in sync v1")
    pid = payload.get("id")
    p = db.get(Patient, pid) if pid else None
    if p is None:
        raise LookupError("patient not found")
    client_version = payload.get("version")
    if client_version is not None and p.version > client_version:
        return {"conflict": True, "server_version": p.version,
                "message": "Sync conflict — the server record is newer. Review required; nothing was overwritten."}
    for field in ("name", "phone", "village", "address", "emergency_contact",
                  "emergency_phone", "conditions", "allergies", "pregnant", "consent_granted"):
        if field in payload and payload[field] is not None:
            setattr(p, field, payload[field])
    p.version += 1
    return {"id": p.id, "version": p.version}


def apply_batch(db: Session, user: User, batch: SyncBatchIn) -> tuple[list[SyncOpOut], int, int, int]:
    results: list[SyncOpOut] = []
    applied = conflicts = duplicates = 0

    for op in batch.ops:
        existing = db.get(SyncOperation, op.id)
        if existing is not None:  # idempotent replay
            duplicates += 1
            results.append(SyncOpOut.model_validate(existing))
            continue

        row = SyncOperation(id=op.id, user_id=user.id, entity=op.entity,
                            operation=op.operation, payload=op.payload,
                            client_ts=op.client_ts)
        try:
            outcome = _apply_one(db, user, op)
            if outcome.get("conflict"):
                row.status = SyncStatus.CONFLICT
                row.result = outcome
                conflicts += 1
            else:
                row.status = SyncStatus.APPLIED
                row.result = outcome
                applied += 1
        except LookupError as e:
            row.status = SyncStatus.CONFLICT
            row.result = {"error": str(e)}
            conflicts += 1
        except (ValueError, TypeError) as e:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Op {op.id}: {e}")

        db.add(row)
        results.append(SyncOpOut.model_validate(row))

    log_action(db, user, AuditAction.SYNC_BATCH, "sync", None,
               detail={"ops": len(batch.ops), "applied": applied, "conflicts": conflicts,
                       "duplicates": duplicates})
    return results, applied, conflicts, duplicates
