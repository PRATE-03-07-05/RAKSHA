"""Rule-based respiratory-risk decision support.

TRANSPARENT + DETERMINISTIC: every risk level is explained by weighted
contributing factors. This is decision support for healthcare workers —
it never claims a diagnosis. Thresholds are configurable via environment
(see app/config.py) so rules live in exactly one place.
"""
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..config import get_settings
from ..models import Assessment, RiskLevel, User
from ..schemas import TriageFactor, TriageRequest, TriageResponse

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
