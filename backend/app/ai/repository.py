from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Protocol

from sqlalchemy.orm import Session

from backend.app.ai.schemas import RespiratoryRiskRequest, RespiratoryRiskResponse
from backend.app.db.models import TriageAssessment


class TriageAssessmentRepository(Protocol):
    def create(
        self,
        *,
        request: RespiratoryRiskRequest,
        response: RespiratoryRiskResponse,
        actor_user_id: uuid.UUID,
    ) -> uuid.UUID:
        pass


class SqlAlchemyTriageAssessmentRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(
        self,
        *,
        request: RespiratoryRiskRequest,
        response: RespiratoryRiskResponse,
        actor_user_id: uuid.UUID,
    ) -> uuid.UUID:
        assessment = TriageAssessment(
            patient_id=request.patient_id,
            encounter_id=request.encounter_id,
            symptom_report_id=request.symptom_report_id,
            model_name=response.model_name,
            model_version=response.model_version,
            risk_level=response.risk_level,
            confidence=Decimal(str(response.confidence)) if response.confidence is not None else None,
            explanation=response.explanation,
            structured_output=response.structured_output.model_dump(mode="json"),
            human_review_required=True,
        )
        self.session.add(assessment)
        self.session.commit()
        self.session.refresh(assessment)
        return assessment.id

