"""Rule-based respiratory-risk decision support.

TRANSPARENT + DETERMINISTIC: every risk level is explained by weighted
contributing factors. This is decision support for healthcare workers —
it never claims a diagnosis. Thresholds are configurable via environment
(see app/config.py) so rules live in exactly one place.
"""
import logging

from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..config import get_settings
from ..models import Assessment, RiskLevel, User
from ..schemas import TriageFactor, TriageRequest, TriageResponse

log = logging.getLogger("raksha.triage")

_CHRONIC = {"diabetes", "hypertension", "asthma", "copd", "tuberculosis", "tb", "cardiac", "heart"}

ACTION_BY_LEVEL = {
    RiskLevel.LOW: "HOME_CARE_ADVICE",
    RiskLevel.MEDIUM: "PHC_EVALUATION",
    RiskLevel.HIGH: "URGENT_REFERRAL",
    RiskLevel.CRITICAL: "EMERGENCY_REFERRAL",
}


def assess(req: TriageRequest) -> TriageResponse:
    s = get_settings()
    score = 0
    factors: list[TriageFactor] = []
    red_flags: list[str] = []

    def add(code: str, label: str, weight: int, red_flag: bool = False) -> None:
        nonlocal score
        score += weight
        factors.append(TriageFactor(code=code, label=label, weight=weight))
        if red_flag:
            red_flags.append(label)

    # Oxygen saturation — strongest single signal
    if req.spo2 is not None:
        if req.spo2 < s.triage_spo2_critical:
            add("SPO2_CRITICAL", f"Severely low SpO₂ ({req.spo2}%)", 50, red_flag=True)
        elif req.spo2 < s.triage_spo2_high:
            add("SPO2_LOW", f"Low SpO₂ ({req.spo2}%)", 30, red_flag=req.spo2 < s.triage_spo2_high - 1)

    # Breathing
    if req.breathing_difficulty:
        add("BREATHING_DIFFICULTY", "Breathing difficulty reported", 20)
    if req.respiratory_rate is not None:
        if req.respiratory_rate >= s.triage_rr_high + 6:
            add("RR_SEVERE", f"Very high respiratory rate ({req.respiratory_rate}/min)", 30, red_flag=True)
        elif req.respiratory_rate >= s.triage_rr_high:
            add("RR_HIGH", f"Elevated respiratory rate ({req.respiratory_rate}/min)", 20)

    # Temperature
    if req.temperature is not None:
        if req.temperature >= s.triage_temp_critical:
            add("TEMP_CRITICAL", f"High fever ({req.temperature}°C)", 25, red_flag=True)
        elif req.temperature >= s.triage_temp_high:
            add("TEMP_HIGH", f"Elevated temperature ({req.temperature}°C)", 15)

    # Cardiac signals
    if req.heart_rate is not None and req.heart_rate >= s.triage_hr_high:
        add("HR_HIGH", f"Elevated heart rate ({req.heart_rate}/min)", 15)
    if req.chest_pain:
        add("CHEST_PAIN", "Chest pain reported", 25, red_flag=True)

    # History & context
    if req.cough and (req.duration_days or 0) >= 7:
        add("PERSISTENT_COUGH", f"Cough for {req.duration_days}+ days", 10)
    if req.age >= 60:
        add("AGE_SENIOR", f"Age {req.age} — higher vulnerability", 10)
    if req.age < 5:
        add("AGE_CHILD", f"Age {req.age} — infant/child risk", 15, red_flag=True)
    if req.pregnant:
        add("PREGNANCY", "Pregnancy — treat with extra caution", 10)
    chronic = [c for c in req.conditions if c.lower() in _CHRONIC]
    if chronic:
        add("CHRONIC_CONDITIONS", f"Known conditions: {', '.join(chronic)}", min(8 * len(chronic), 16))

    # Explainability guarantee: every assessment states what was observed,
    # including clean ones. These factors carry weight 0 — they document
    # the reasoning without changing the score or the risk level.
    if req.cough and not any(f.code == "PERSISTENT_COUGH" for f in factors):
        add("COUGH_NO_WARNING", "Cough reported — no prolonged duration or warning signs", 0)
    normal_checks: list[str] = []
    if req.spo2 is not None and req.spo2 >= s.triage_spo2_high:
        normal_checks.append(f"SpO₂ {req.spo2}%")
    if req.temperature is not None and req.temperature < s.triage_temp_high:
        normal_checks.append(f"temperature {req.temperature}°C")
    if req.respiratory_rate is not None and req.respiratory_rate < s.triage_rr_high:
        normal_checks.append(f"respiratory rate {req.respiratory_rate}/min")
    if normal_checks and not factors:
        factors.append(TriageFactor(
            code="VITALS_WITHIN_RANGE",
            label="Recorded observations within configured normal ranges: " + ", ".join(normal_checks),
            weight=0,
        ))
    if not factors:
        factors.append(TriageFactor(
            code="NO_RISK_SIGNALS",
            label="No red-flag symptoms or abnormal observations reported",
            weight=0,
        ))

    # Level from score, then hard escalations for red-flag combinations
    if score >= 60:
        level = RiskLevel.CRITICAL
    elif score >= 35:
        level = RiskLevel.HIGH
    elif score >= 15:
        level = RiskLevel.MEDIUM
    else:
        level = RiskLevel.LOW

    if req.spo2 is not None and req.spo2 < s.triage_spo2_critical:
        level = RiskLevel.CRITICAL
    elif req.chest_pain and req.breathing_difficulty:
        level = max(level, RiskLevel.CRITICAL, key=list(RiskLevel).index)
    elif any(f.code in {"SPO2_LOW", "RR_SEVERE", "CHEST_PAIN", "TEMP_CRITICAL"} for f in factors):
        level = max(level, RiskLevel.HIGH, key=list(RiskLevel).index)

    factors.sort(key=lambda f: f.weight, reverse=True)
    return TriageResponse(
        risk_level=level.value,
        score=score,
        recommended_action=ACTION_BY_LEVEL[level],
        red_flags=red_flags,
        contributing_factors=factors,
        rule_version=s.triage_rule_version,
    )


def _ml_to_response(ml) -> TriageResponse:
    """Adapt an ``ml.inference.MLResult`` into the shared TriageResponse."""
    level = RiskLevel(ml.risk_level)
    factors = []
    for feat in ml.contributing_features:
        rel = feat.get("relative_weight", 0.0)
        severity = "high" if rel >= 0.3 else ("warn" if rel >= 0.15 else "info")
        value = feat.get("value")
        value_txt = "not recorded" if value is None else str(value)
        factors.append(TriageFactor(
            code=feat["feature"].upper(),
            label=f"{feat['label']}: {value_txt}",
            weight=int(round(rel * 100)),
        ))
    return TriageResponse(
        risk_level=level.value,
        score=int(round(ml.confidence * 100)),
        recommended_action=ACTION_BY_LEVEL[level],
        red_flags=ml.red_flags,
        contributing_factors=factors,
        rule_version=f"ml-{ml.model_name}@{ml.model_version}",
        mode="ML_MODEL",
        confidence=ml.confidence,
        model_version=ml.model_version,
    )


def assess_with_fallback(req: TriageRequest) -> TriageResponse:
    """ML-first decision support with a transparent rule-based fallback.

    If a trained model is persisted it is used (``mode=ML_MODEL``). If the
    model or its dependencies are unavailable — or anything at all goes wrong
    during inference — the deterministic rule engine serves the request and the
    response is clearly labelled ``mode=RULE_BASED_FALLBACK``. The app never
    crashes and never silently pretends a rule result came from the model.
    """
    try:
        from ml.inference import is_ml_available, predict_record  # noqa: PLC0415
        from ml.preprocessing import request_to_record  # noqa: PLC0415

        if is_ml_available():
            record = request_to_record(req)
            result = predict_record(record)
            log.info("triage served by ML model (%s): %s", result.model_version, result.risk_level)
            return _ml_to_response(result)
        log.info("triage: ML model unavailable — using rule-based fallback")
    except Exception as exc:  # noqa: BLE001 - degrade gracefully, never crash
        log.warning("triage: ML inference failed (%s) — using rule-based fallback", exc)

    result = assess(req)
    result.mode = "RULE_BASED_FALLBACK"
    result.confidence = None
    result.model_version = None
    return result


def persist(db: Session, actor: User, req: TriageRequest, result: TriageResponse,
            visit_id: str | None = None) -> Assessment:
    """Store the assessment in the longitudinal record with the rule version."""
    a = Assessment(
        patient_id=req.patient_id or "",
        visit_id=visit_id,
        level=RiskLevel(result.risk_level),
        score=result.score,
        factors=[f.model_dump() for f in result.contributing_factors],
        red_flags=result.red_flags,
        recommendation=result.recommended_action,
        rule_version=result.rule_version,
        input_snapshot=req.model_dump(mode="json"),
    )
    db.add(a)
    db.flush()
    log_action(db, actor, AuditAction.TRIAGE_ASSESS, "assessment", a.id,
               patient_id=req.patient_id, detail={"level": result.risk_level, "rule": result.rule_version})
    return a
