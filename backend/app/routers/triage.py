"""AI-assisted preliminary risk assessment — transparent rule-based
decision support. It assists healthcare workers; it never diagnoses."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Role
from ..schemas import TriageRequest, TriageResponse
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
