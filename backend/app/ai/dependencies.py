from fastapi import Depends

from backend.app.ai.repository import SqlAlchemyTriageAssessmentRepository, TriageAssessmentRepository
from backend.app.ai.respiratory_triage import RespiratoryRiskTriageService
from backend.app.db.session import get_session


def get_respiratory_triage_service() -> RespiratoryRiskTriageService:
    return RespiratoryRiskTriageService()


def get_triage_assessment_repository(session=Depends(get_session)) -> TriageAssessmentRepository:
    return SqlAlchemyTriageAssessmentRepository(session)

