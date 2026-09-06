"""AI-assisted preliminary risk assessment — transparent rule-based
decision support. It assists healthcare workers; it never diagnoses."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..config import get_settings
from ..database import get_db
from ..models import Assessment, Role, User
from ..schemas import AssessmentOut, TriageFactor, TriageRequest, TriageResponse
from ..security import CLINICAL, FIELD_WORKERS, CurrentUser, require_roles
from ..services import triage as svc

router = APIRouter(prefix="/triage", tags=["triage"])
DB = Annotated[Session, Depends(get_db)]
ASSESSORS = (*FIELD_WORKERS, *CLINICAL)


@router.post("/assess", response_model=TriageResponse,
             summary="Rule-based preliminary risk assessment (decision support)",
             dependencies=[Depends(require_roles(*ASSESSORS))])
def assess(body: TriageRequest, user: CurrentUser, db: DB):
    result = svc.assess(body)
    if body.patient_id:
        a = svc.persist(db, user, body, result)
        db.commit()
        result.assessment_id = a.id
    return result


@router.post("/respiratory-risk", response_model=TriageResponse,
             summary="Alias kept for compatibility with the original contract",
             dependencies=[Depends(require_roles(*ASSESSORS))])
def respiratory_risk(body: TriageRequest, user: CurrentUser, db: DB):
    return assess(body, user, db)


@router.post("/assessments/{assessment_id}/confirm", response_model=TriageResponse,
             summary="Clinician confirms an AI-assisted assessment",
             dependencies=[Depends(require_roles(*ASSESSORS))])
def confirm_assessment(assessment_id: str, user: CurrentUser, db: DB):
    a = db.get(Assessment, assessment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    if a.confirmed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Assessment already confirmed")
    a.confirmed = True
    a.confirmed_by_id = user.id
    a.confirmed_at = datetime.now(timezone.utc)
    log_action(db, user, AuditAction.ASSESSMENT_CONFIRM, "assessment", a.id,
               patient_id=a.patient_id, detail={"level": a.level.value})
    db.commit()
    return TriageResponse(
        risk_level=a.level.value,
        score=a.score,
        recommended_action=a.recommendation,
        red_flags=a.red_flags,
        contributing_factors=[TriageFactor(**{k: f[k] for k in ("code", "label", "weight") if k in f})
                              for f in a.factors],
        rule_version=a.rule_version,
        assessment_id=a.id,
    )


@router.get("/assessments/latest", response_model=list[AssessmentOut],
            summary="Latest assessment per patient (decision-support flags)")
def latest_assessments(_: CurrentUser, db: DB, patient_id: str | None = None):
    q = select(Assessment).order_by(Assessment.created_at.asc())
    if patient_id:
        q = q.where(Assessment.patient_id == patient_id)
    latest: dict[str, Assessment] = {}
    for a in db.execute(q).scalars():
        latest[a.patient_id] = a
    outs: list[AssessmentOut] = []
    for a in latest.values():
        out = AssessmentOut.model_validate(a)
        if a.confirmed_by_id:
            cb = db.get(User, a.confirmed_by_id)
            out.confirmed_by_name = cb.name if cb else None
        outs.append(out)
    outs.sort(key=lambda o: o.created_at, reverse=True)
    return outs


@router.get("/config", summary="Current rule thresholds (configurable via environment)")
def config(_: CurrentUser):
    s = get_settings()
    return {
        "rule_version": s.triage_rule_version,
        "thresholds": {
            "spo2_critical": s.triage_spo2_critical,
            "spo2_high": s.triage_spo2_high,
            "temp_high": s.triage_temp_high,
            "temp_critical": s.triage_temp_critical,
            "rr_high": s.triage_rr_high,
            "hr_high": s.triage_hr_high,
        },
        "disclaimer": ("Transparent rule-based decision support. Not a medical diagnosis — "
                       "a qualified clinician makes the final decision."),
    }
