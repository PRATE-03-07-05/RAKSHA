"""Feature schema — the single source of truth for train/inference consistency.

Every model input passes through ``build_feature_frame``. Training reads rows
from the dataset CSV; inference converts a live ``TriageRequest`` via
``request_to_record``. Because both paths end in the same function, the
feature ordering, types and missing-value handling are identical by
construction — there is no duplicated preprocessing logic.

Only features the RAKSHA frontend actually collects are used (Part K):
age, SpO2, respiratory rate, temperature, heart rate, cough, breathing
difficulty, chest pain, symptom duration, pregnancy, chronic conditions and
self-reported severity. No feature is invented that the app cannot capture.
"""
from __future__ import annotations

from typing import Any

import pandas as pd

# Ordered, fixed feature schema. The CSV dataset MUST contain exactly these
# columns (plus the ``level`` target column). See ml/data/README.md.
FEATURE_NAMES: list[str] = [
    "age",
    "spo2",
    "respiratory_rate",
    "temperature",
    "heart_rate",
    "cough",
    "breathing_difficulty",
    "chest_pain",
    "duration_days",
    "pregnant",
    "has_chronic_condition",
    "severity_reported",
]

# All non-categorical features (continuous AND 0/1 binary) share one numeric
# branch: median imputation + standard scaling. Keeping the binary flags here
# (rather than a separate passthrough) means the transformed column order is
# simply ``NUMERIC_FEATURES + [severity_reported]``, which inference relies on
# when mapping model importances back to feature names.
NUMERIC_FEATURES: list[str] = [
    "age", "spo2", "respiratory_rate", "temperature", "heart_rate",
    "duration_days",
    "cough", "breathing_difficulty", "chest_pain",
    "pregnant", "has_chronic_condition",
]

SEVERITY_VALUES: list[str] = ["MILD", "MODERATE", "SEVERE"]

# Target classes — the SAME categories the existing RAKSHA triage engine uses,
# preserved per the requirement to keep the current clinical vocabulary.
CLASS_NAMES: list[str] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

_CHRONIC_KEYWORDS = {
    "diabetes", "hypertension", "asthma", "copd", "tuberculosis", "tb",
    "cardiac", "heart", "kidney", "cancer",
}


def request_to_record(req: Any) -> dict[str, Any]:
    """Convert a live ``TriageRequest`` (duck-typed) into a raw feature record.

    Uses ``getattr`` with safe defaults so this stays decoupled from the API
    schema layer and is trivially unit-testable.
    """
    conditions = list(getattr(req, "conditions", []) or [])
    has_chronic = int(any(any(k in c.strip().lower() for k in _CHRONIC_KEYWORDS)
                          for c in conditions if isinstance(c, str)))
    severity = (getattr(req, "severity_reported", None) or "MILD").upper()
    if severity not in SEVERITY_VALUES:
        severity = "MILD"
    return {
        "age": getattr(req, "age", None),
        "spo2": getattr(req, "spo2", None),
        "respiratory_rate": getattr(req, "respiratory_rate", None),
        "temperature": getattr(req, "temperature", None),
        "heart_rate": getattr(req, "heart_rate", None),
        "cough": int(bool(getattr(req, "cough", False))),
        "breathing_difficulty": int(bool(getattr(req, "breathing_difficulty", False))),
        "chest_pain": int(bool(getattr(req, "chest_pain", False))),
        "duration_days": getattr(req, "duration_days", None),
        "pregnant": int(bool(getattr(req, "pregnant", False))),
        "has_chronic_condition": has_chronic,
        "severity_reported": severity,
    }


def build_feature_frame(record: dict[str, Any]) -> pd.DataFrame:
    """Build a single-row DataFrame in the exact, fixed feature order.

    Missing values are left as ``NaN`` — the persisted ColumnTransformer
    performs the imputation, so train and inference treat gaps identically.
    """
    row = {name: record.get(name) for name in FEATURE_NAMES}
    return pd.DataFrame([row], columns=FEATURE_NAMES)
