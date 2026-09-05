from __future__ import annotations

import math
from datetime import datetime, timezone

from backend.app.ai.schemas import (
    FeatureContribution,
    RespiratoryRiskRequest,
    RespiratoryRiskResponse,
    RespiratoryRiskStructuredOutput,
)
from backend.app.db.enums import TriageRiskLevel


MODEL_NAME = "raksha-respiratory-risk-logistic-baseline"
MODEL_VERSION = "2026-09-04.v0"
FALLBACK_MODEL_NAME = "manual-review-fallback"
FALLBACK_MODEL_VERSION = "2026-09-04.v0"
MODEL_LIMITATIONS = [
    "This baseline is guideline-informed scaffolding, not a trained or clinically validated model.",
    "It does not diagnose disease, prescribe treatment, or replace clinician judgment.",
    "Local protocols, altitude, chronic lung disease, device quality, and clinician assessment can change urgency.",
]

EMERGENCY_DANGER_SIGNS = {
    "severe_respiratory_distress": ("SEVERE_RESPIRATORY_DISTRESS", 3.5, "Severe respiratory distress is present."),
    "cyanosis": ("CYANOSIS", 4.0, "Cyanosis or blue/gray coloring is present."),
    "confusion_or_unresponsive": (
        "ALTERED_MENTAL_STATUS",
        3.6,
        "Confusion, inability to stay awake, or unresponsiveness is present.",
    ),
    "seizures": ("SEIZURES", 3.4, "Seizure activity is present."),
    "unable_to_drink_or_feed": (
        "UNABLE_TO_DRINK_OR_FEED",
        3.0,
        "The patient is unable to drink, breastfeed, or feed.",
    ),
    "persistent_chest_pain_or_pressure": (
        "PERSISTENT_CHEST_PAIN_OR_PRESSURE",
        3.0,
        "Persistent chest pain or pressure is present.",
    ),
    "not_urinating": ("DEHYDRATION_OR_LOW_OUTPUT", 2.4, "Not urinating may indicate severe dehydration or illness."),
    "severe_weakness": ("SEVERE_WEAKNESS", 2.0, "Severe weakness or unsteadiness is present."),
}

HIGH_RISK_COMORBIDITIES = {
    "asthma",
    "copd",
    "chronic_lung_disease",
    "heart_disease",
    "diabetes",
    "immunocompromised",
    "pregnancy",
    "chronic_kidney_disease",
}


class RespiratoryTriageUnavailable(RuntimeError):
    pass


class RespiratoryRiskTriageService:
    def assess(
        self,
        payload: RespiratoryRiskRequest,
        assessed_at: datetime | None = None,
    ) -> RespiratoryRiskResponse:
        assessment_time = assessed_at or datetime.now(timezone.utc)
        score = -3.0
        contributions: list[FeatureContribution] = []
        reasons: list[str] = []
        safety_flags: list[str] = []
        urgent_override = False
        high_override = False

        def add_signal(feature: str, contribution: float, reason: str, safety_flag: str | None = None) -> None:
            nonlocal score
            score += contribution
            contributions.append(
                FeatureContribution(
                    feature=feature,
                    contribution=round(contribution, 3),
                    reason=reason,
                )
            )
            reasons.append(reason)
            if safety_flag and safety_flag not in safety_flags:
                safety_flags.append(safety_flag)

        missing_inputs = _missing_critical_inputs(payload)

        spo2 = payload.vitals.spo2
        if spo2 is not None:
            if spo2 < 90:
                urgent_override = True
                add_signal("vitals.spo2", 4.2, "SpO2 is below 90%.", "SEVERE_LOW_OXYGEN_SATURATION")
            elif spo2 <= 93:
                high_override = True
                add_signal(
                    "vitals.spo2",
                    2.6,
                    "SpO2 is between 90% and 93%, which requires prompt professional review.",
                    "LOW_OXYGEN_SATURATION",
                )
            elif spo2 <= 95:
                add_signal("vitals.spo2", 0.9, "SpO2 is 94% to 95%; confirm reading and clinical context.")

        respiratory_rate_reason = _respiratory_rate_reason(payload.age_months, payload.vitals.respiratory_rate)
        if respiratory_rate_reason:
            high_override = True
            add_signal(
                "vitals.respiratory_rate",
                1.8,
                respiratory_rate_reason,
                "FAST_BREATHING",
            )

        for field_name, (safety_flag, contribution, reason) in EMERGENCY_DANGER_SIGNS.items():
            if getattr(payload.danger_signs, field_name):
                urgent_override = True
                add_signal(f"danger_signs.{field_name}", contribution, reason, safety_flag)

        if payload.danger_signs.chest_indrawing:
            high_override = True
            add_signal(
                "danger_signs.chest_indrawing",
                1.8,
                "Chest indrawing or rib retractions are present.",
                "CHEST_INDRAWING",
            )

        if payload.symptoms.breathlessness:
            add_signal("symptoms.breathlessness", 1.2, "Breathlessness is reported.")
        if payload.symptoms.chest_pain:
            add_signal("symptoms.chest_pain", 0.8, "Chest pain is reported.")
        if payload.symptoms.fever or _has_measured_fever(payload.vitals.temperature_c):
            add_signal("symptoms.fever", 0.5, "Fever is reported or measured.")
        if payload.symptoms.cough:
            add_signal("symptoms.cough", 0.2, "Cough is reported.")
        if payload.symptoms.worsening_after_improvement:
            high_override = True
            add_signal(
                "symptoms.worsening_after_improvement",
                1.0,
                "Symptoms improved and then returned or worsened.",
                "WORSENING_AFTER_IMPROVEMENT",
            )

        if _is_young_infant_with_fever(payload):
            urgent_override = True
            add_signal(
                "age_months",
                2.4,
                "Fever is present in an infant younger than 12 weeks.",
                "YOUNG_INFANT_FEVER",
            )

        if payload.vitals.temperature_c is not None and payload.vitals.temperature_c >= 40:
            high_override = True
            add_signal("vitals.temperature_c", 1.0, "Temperature is 40.0 C or higher.", "HIGH_FEVER")

        age_risk_reason = _age_risk_reason(payload.age_months)
        if age_risk_reason:
            add_signal("age_months", 0.6, age_risk_reason)

        matching_comorbidities = sorted(set(payload.comorbidities).intersection(HIGH_RISK_COMORBIDITIES))
        if matching_comorbidities:
            contribution = min(1.2, 0.4 * len(matching_comorbidities))
            add_signal(
                "comorbidities",
                contribution,
                "High-risk comorbidities are present: " + ", ".join(matching_comorbidities) + ".",
            )

        risk_score = round(_logistic(score), 4)
        risk_level = _risk_level(
            risk_score=risk_score,
            urgent_override=urgent_override,
            high_override=high_override,
            missing_inputs=missing_inputs,
            has_respiratory_symptoms=_has_respiratory_symptoms(payload),
        )
        confidence = _confidence_for(risk_level, risk_score, missing_inputs, urgent_override, high_override)

        if not reasons:
            reasons.append("No high-risk respiratory features were entered, but human review is still required.")

        recommended_action = _recommended_action(risk_level)
        structured_output = RespiratoryRiskStructuredOutput(
            risk_level=risk_level,
            risk_score=risk_score,
            urgent_review_required=risk_level == TriageRiskLevel.URGENT,
            prompt_review_required=risk_level in {TriageRiskLevel.MODERATE, TriageRiskLevel.HIGH, TriageRiskLevel.URGENT},
            recommended_action=recommended_action,
            reasons=reasons,
            safety_flags=safety_flags,
            missing_inputs=missing_inputs,
            feature_contributions=contributions,
            fallback_mode=False,
            limitations=MODEL_LIMITATIONS,
        )

        return RespiratoryRiskResponse(
            model_name=MODEL_NAME,
            model_version=MODEL_VERSION,
            assessed_at=assessment_time,
            risk_level=risk_level,
            confidence=confidence,
            explanation=_explanation(risk_level, reasons),
            human_review_required=True,
            clinical_decision_support_only=True,
            diagnosis=None,
            treatment_recommendation=None,
            structured_output=structured_output,
        )


def manual_review_fallback(
    payload: RespiratoryRiskRequest,
    assessed_at: datetime | None = None,
) -> RespiratoryRiskResponse:
    assessment_time = assessed_at or datetime.now(timezone.utc)
    safety_flags = _declared_emergency_flags(payload)
    risk_level = TriageRiskLevel.URGENT if safety_flags else TriageRiskLevel.HIGH
    reasons = ["Automated respiratory risk triage is unavailable; route this case to manual clinical review."]
    if safety_flags:
        reasons.append("One or more entered emergency warning signs are present.")

    structured_output = RespiratoryRiskStructuredOutput(
        risk_level=risk_level,
        risk_score=None,
        urgent_review_required=risk_level == TriageRiskLevel.URGENT,
        prompt_review_required=True,
        recommended_action=_recommended_action(risk_level),
        reasons=reasons,
        safety_flags=safety_flags,
        missing_inputs=_missing_critical_inputs(payload),
        feature_contributions=[],
        fallback_mode=True,
        limitations=MODEL_LIMITATIONS
        + ["No automated risk score was produced because the triage service was unavailable."],
    )
    return RespiratoryRiskResponse(
        model_name=FALLBACK_MODEL_NAME,
        model_version=FALLBACK_MODEL_VERSION,
        assessed_at=assessment_time,
        risk_level=risk_level,
        confidence=None,
        explanation=_explanation(risk_level, reasons),
        human_review_required=True,
        clinical_decision_support_only=True,
        diagnosis=None,
        treatment_recommendation=None,
        structured_output=structured_output,
    )


def _logistic(score: float) -> float:
    return 1 / (1 + math.exp(-score))


def _missing_critical_inputs(payload: RespiratoryRiskRequest) -> list[str]:
    missing = []
    if payload.age_months is None:
        missing.append("age_months")
    if payload.vitals.respiratory_rate is None:
        missing.append("vitals.respiratory_rate")
    if payload.vitals.spo2 is None:
        missing.append("vitals.spo2")
    return missing


def _has_measured_fever(temperature_c: float | None) -> bool:
    return temperature_c is not None and temperature_c >= 38.0


def _has_respiratory_symptoms(payload: RespiratoryRiskRequest) -> bool:
    return any(
        [
            payload.symptoms.cough,
            payload.symptoms.breathlessness,
            payload.symptoms.fever,
            payload.symptoms.chest_pain,
        ]
    )


def _is_young_infant_with_fever(payload: RespiratoryRiskRequest) -> bool:
    return (
        payload.age_months is not None
        and payload.age_months < 3
        and (payload.symptoms.fever or _has_measured_fever(payload.vitals.temperature_c))
    )


def _age_risk_reason(age_months: int | None) -> str | None:
    if age_months is None:
        return None
    if age_months < 2:
        return "Patient is younger than 2 months."
    if age_months >= 780:
        return "Patient is 65 years or older."
    return None


def _respiratory_rate_reason(age_months: int | None, respiratory_rate: int | None) -> str | None:
    if age_months is None or respiratory_rate is None:
        return None
    if age_months < 1 and respiratory_rate >= 60:
        return "Respiratory rate meets the fast-breathing threshold for age under 1 month."
    if 1 <= age_months < 2 and respiratory_rate >= 50:
        return "Respiratory rate meets the fast-breathing threshold for age 1 to 2 months."
    if 2 <= age_months < 12 and respiratory_rate >= 50:
        return "Respiratory rate meets the fast-breathing threshold for age 2 to 11 months."
    if 12 <= age_months <= 59 and respiratory_rate >= 40:
        return "Respiratory rate meets the fast-breathing threshold for age 1 to 5 years."
    if age_months >= 60 and respiratory_rate > 30:
        return "Respiratory rate is above 30 breaths per minute."
    return None


def _risk_level(
    *,
    risk_score: float,
    urgent_override: bool,
    high_override: bool,
    missing_inputs: list[str],
    has_respiratory_symptoms: bool,
) -> TriageRiskLevel:
    if urgent_override:
        return TriageRiskLevel.URGENT
    if high_override or risk_score >= 0.55:
        return TriageRiskLevel.HIGH
    if risk_score >= 0.30 or (missing_inputs and has_respiratory_symptoms):
        return TriageRiskLevel.MODERATE
    return TriageRiskLevel.LOW


def _confidence_for(
    risk_level: TriageRiskLevel,
    risk_score: float,
    missing_inputs: list[str],
    urgent_override: bool,
    high_override: bool,
) -> float:
    if urgent_override:
        raw_confidence = max(0.9, risk_score)
    elif high_override and risk_level == TriageRiskLevel.HIGH:
        raw_confidence = max(0.72, risk_score)
    elif risk_level in {TriageRiskLevel.HIGH, TriageRiskLevel.URGENT}:
        raw_confidence = risk_score
    elif risk_level == TriageRiskLevel.LOW:
        raw_confidence = 1 - risk_score
    else:
        raw_confidence = 0.62

    missing_penalty = min(0.25, 0.08 * len(missing_inputs))
    return round(max(0.0, min(0.99, raw_confidence - missing_penalty)), 4)


def _declared_emergency_flags(payload: RespiratoryRiskRequest) -> list[str]:
    flags = [
        safety_flag
        for field_name, (safety_flag, _contribution, _reason) in EMERGENCY_DANGER_SIGNS.items()
        if getattr(payload.danger_signs, field_name)
    ]
    if payload.vitals.spo2 is not None and payload.vitals.spo2 < 90:
        flags.append("SEVERE_LOW_OXYGEN_SATURATION")
    if _is_young_infant_with_fever(payload):
        flags.append("YOUNG_INFANT_FEVER")
    return sorted(set(flags))


def _recommended_action(risk_level: TriageRiskLevel) -> str:
    if risk_level == TriageRiskLevel.URGENT:
        return "Route immediately for urgent clinician review or emergency escalation per local protocol."
    if risk_level == TriageRiskLevel.HIGH:
        return "Prioritize same-day clinician review and confirm oxygen saturation and respiratory assessment."
    if risk_level == TriageRiskLevel.MODERATE:
        return "Arrange clinician review and complete missing vitals before disposition."
    return "Continue human review before any clinical decision and provide clinician-approved safety-net instructions."


def _explanation(risk_level: TriageRiskLevel, reasons: list[str]) -> str:
    primary_reasons = "; ".join(reasons[:3])
    return (
        f"Clinical decision support only; not a diagnosis. Classified as {risk_level.value} because "
        f"{primary_reasons}. Human review is required before any clinical decision."
    )
