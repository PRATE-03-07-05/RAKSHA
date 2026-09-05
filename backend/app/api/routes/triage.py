from fastapi import APIRouter, Depends, Request

from backend.app.ai.dependencies import get_respiratory_triage_service, get_triage_assessment_repository
from backend.app.ai.repository import TriageAssessmentRepository
from backend.app.ai.respiratory_triage import (
    RespiratoryRiskTriageService,
    RespiratoryTriageUnavailable,
    manual_review_fallback,
)
from backend.app.ai.schemas import RespiratoryRiskRequest, RespiratoryRiskResponse
from backend.app.api.errors import ErrorResponse
from backend.app.audit.service import AuditEvent, AuditSink
from backend.app.auth.dependencies import get_audit_sink, get_client_ip, require_roles
from backend.app.auth.repository import UserRecord
from backend.app.db.enums import UserRole


router = APIRouter(prefix="/triage", tags=["triage"])


@router.post(
    "/respiratory-risk",
    response_model=RespiratoryRiskResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def assess_respiratory_risk(
    payload: RespiratoryRiskRequest,
    request: Request,
    current_user: UserRecord = Depends(
        require_roles(
            UserRole.FRONTLINE_WORKER,
            UserRole.DOCTOR,
            UserRole.FACILITY_COORDINATOR,
            UserRole.ADMIN,
        )
    ),
    service: RespiratoryRiskTriageService = Depends(get_respiratory_triage_service),
    repository: TriageAssessmentRepository = Depends(get_triage_assessment_repository),
    audit_sink: AuditSink = Depends(get_audit_sink),
) -> RespiratoryRiskResponse:
    try:
        response = service.assess(payload)
    except RespiratoryTriageUnavailable:
        response = manual_review_fallback(payload)

    assessment_id = repository.create(request=payload, response=response, actor_user_id=current_user.id)
    response = response.model_copy(update={"assessment_id": assessment_id})

    audit_sink.record(
        AuditEvent(
            action="AI_RESPIRATORY_TRIAGE_ASSESSED",
            actor_user_id=current_user.id,
            patient_id=payload.patient_id,
            entity_type="triage_assessments",
            entity_id=assessment_id,
            access_reason="respiratory_triage_decision_support",
            ip_address=get_client_ip(request),
            details={
                "risk_level": response.risk_level.value,
                "model_name": response.model_name,
                "model_version": response.model_version,
                "fallback_mode": response.structured_output.fallback_mode,
                "human_review_required": response.human_review_required,
            },
        )
    )
    return response
