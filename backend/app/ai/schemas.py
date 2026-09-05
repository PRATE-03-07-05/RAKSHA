from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.app.db.enums import TriageRiskLevel


class RespiratorySymptoms(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cough: bool = False
    breathlessness: bool = False
    fever: bool = False
    chest_pain: bool = False
    symptom_days: int | None = Field(default=None, ge=0, le=60)
    worsening_after_improvement: bool = False


class RespiratoryVitals(BaseModel):
    model_config = ConfigDict(extra="forbid")

    respiratory_rate: int | None = Field(default=None, ge=0, le=120)
    spo2: float | None = Field(default=None, ge=0, le=100)
    temperature_c: float | None = Field(default=None, ge=25, le=45)
    pulse: int | None = Field(default=None, ge=0, le=260)


class RespiratoryDangerSigns(BaseModel):
    model_config = ConfigDict(extra="forbid")

    severe_respiratory_distress: bool = False
    cyanosis: bool = False
    confusion_or_unresponsive: bool = False
    seizures: bool = False
    unable_to_drink_or_feed: bool = False
    chest_indrawing: bool = False
    persistent_chest_pain_or_pressure: bool = False
    not_urinating: bool = False
    severe_weakness: bool = False


class RespiratoryRiskRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "patient_id": "00000000-0000-4000-8000-000000000001",
                "encounter_id": "00000000-0000-4000-8000-000000000202",
                "symptom_report_id": "00000000-0000-4000-8000-000000000301",
                "age_months": 485,
                "symptoms": {
                    "cough": True,
                    "breathlessness": True,
                    "fever": True,
                    "chest_pain": False,
                    "symptom_days": 3,
                    "worsening_after_improvement": False,
                },
                "vitals": {
                    "respiratory_rate": 32,
                    "spo2": 91,
                    "temperature_c": 38.4,
                    "pulse": 112,
                },
                "danger_signs": {
                    "severe_respiratory_distress": False,
                    "cyanosis": False,
                    "confusion_or_unresponsive": False,
                    "seizures": False,
                    "unable_to_drink_or_feed": False,
                    "chest_indrawing": False,
                    "persistent_chest_pain_or_pressure": False,
                    "not_urinating": False,
                    "severe_weakness": True,
                },
                "comorbidities": ["asthma"],
            }
        },
    )

    patient_id: uuid.UUID
    encounter_id: uuid.UUID | None = None
    symptom_report_id: uuid.UUID | None = None
    age_months: int | None = Field(default=None, ge=0, le=1560)
    symptoms: RespiratorySymptoms = Field(default_factory=RespiratorySymptoms)
    vitals: RespiratoryVitals = Field(default_factory=RespiratoryVitals)
    danger_signs: RespiratoryDangerSigns = Field(default_factory=RespiratoryDangerSigns)
    comorbidities: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("comorbidities")
    @classmethod
    def normalize_comorbidities(cls, values: list[str]) -> list[str]:
        normalized = []
        for value in values:
            cleaned = value.strip().lower().replace(" ", "_")
            if cleaned:
                normalized.append(cleaned[:80])
        return sorted(set(normalized))


class FeatureContribution(BaseModel):
    model_config = ConfigDict(extra="forbid")

    feature: str
    contribution: float
    reason: str


class RespiratoryRiskStructuredOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    risk_level: TriageRiskLevel
    risk_score: float | None
    urgent_review_required: bool
    prompt_review_required: bool
    recommended_action: str
    reasons: list[str]
    safety_flags: list[str]
    missing_inputs: list[str]
    feature_contributions: list[FeatureContribution]
    fallback_mode: bool = False
    limitations: list[str]


class RespiratoryRiskResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "assessment_id": "00000000-0000-4000-8000-000000000901",
                "model_name": "raksha-respiratory-risk-logistic-baseline",
                "model_version": "2026-09-04.v0",
                "assessed_at": "2026-09-04T12:30:00Z",
                "risk_level": "HIGH",
                "confidence": 0.82,
                "explanation": (
                    "Clinical decision support only; not a diagnosis. Classified as HIGH "
                    "because oxygen saturation is low and breathing symptoms are present. "
                    "Human review is required before any clinical decision."
                ),
                "human_review_required": True,
                "clinical_decision_support_only": True,
                "diagnosis": None,
                "treatment_recommendation": None,
                "structured_output": {
                    "risk_level": "HIGH",
                    "risk_score": 0.82,
                    "urgent_review_required": False,
                    "prompt_review_required": True,
                    "recommended_action": "Prioritize same-day clinician review.",
                    "reasons": ["SpO2 is 91%, which is below the prompt-review threshold."],
                    "safety_flags": ["LOW_OXYGEN_SATURATION"],
                    "missing_inputs": [],
                    "feature_contributions": [
                        {
                            "feature": "vitals.spo2",
                            "contribution": 2.6,
                            "reason": "SpO2 is between 90% and 93%.",
                        }
                    ],
                    "fallback_mode": False,
                    "limitations": [
                        "This baseline is not clinically validated and must not be used autonomously."
                    ],
                },
            }
        }
    )

    assessment_id: uuid.UUID | None = None
    model_name: str
    model_version: str
    assessed_at: datetime
    risk_level: TriageRiskLevel
    confidence: float | None = Field(default=None, ge=0, le=1)
    explanation: str
    human_review_required: Literal[True] = True
    clinical_decision_support_only: Literal[True] = True
    diagnosis: None = None
    treatment_recommendation: None = None
    structured_output: RespiratoryRiskStructuredOutput

