"""Model loading + explained inference for the FastAPI triage endpoint.

Design rules:
* Importing this module never crashes the app — heavy deps (joblib/sklearn)
  are imported lazily and every failure degrades to ``is_ml_available()==False``
  so the caller can fall back to the transparent rule engine.
* The persisted artifact contains the WHOLE fitted Pipeline, so inference uses
  the exact preprocessing from training (no re-implementation).
* Explanations are model indicators (global importances / coefficients plus
  abnormal input values), framed as decision support — never a diagnosis.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..paths import ARTIFACT_PATH

# Set (e.g. in tests) to force the transparent rule-based fallback even when a
# trained artifact exists, keeping the API suite deterministic.
_DISABLE_ENV = "RAKSHA_ML_DISABLED"
from ..preprocessing.features import (CLASS_NAMES, FEATURE_NAMES,
                                      NUMERIC_FEATURES, build_feature_frame)

log = logging.getLogger("raksha.ml")

# Transformed column order emitted by the ColumnTransformer.
_POST_TRANSFORM = NUMERIC_FEATURES + ["severity_reported"]

FEATURE_LABELS: dict[str, str] = {
    "age": "Age",
    "spo2": "Oxygen saturation (SpO₂)",
    "respiratory_rate": "Respiratory rate",
    "temperature": "Temperature",
    "heart_rate": "Heart rate",
    "duration_days": "Symptom duration",
    "cough": "Cough",
    "breathing_difficulty": "Breathing difficulty",
    "chest_pain": "Chest pain",
    "pregnant": "Pregnancy",
    "has_chronic_condition": "Chronic condition",
    "severity_reported": "Reported severity",
}

_ARTIFACT: dict | None = None
_LOAD_FAILED = False


@dataclass
class MLResult:
    risk_level: str
    confidence: float
    probabilities: dict[str, float] = field(default_factory=dict)
    model_name: str = ""
    model_version: str = ""
    contributing_features: list[dict[str, Any]] = field(default_factory=list)
    red_flags: list[str] = field(default_factory=list)


def _reset_cache() -> None:
    """Test hook — forget any cached artifact so the next call re-evaluates."""
    global _ARTIFACT, _LOAD_FAILED
    _ARTIFACT = None
    _LOAD_FAILED = False


def _load() -> dict | None:
    global _ARTIFACT, _LOAD_FAILED
    if os.environ.get(_DISABLE_ENV):
        return None
    if _ARTIFACT is not None or _LOAD_FAILED:
        return _ARTIFACT
    try:
        import joblib  # noqa: PLC0415 (lazy by design)
        if not ARTIFACT_PATH.exists():
            log.info("ML artifact not found at %s — rule fallback active.", ARTIFACT_PATH)
            _LOAD_FAILED = True
            return None
        _ARTIFACT = joblib.load(ARTIFACT_PATH)
        log.info("ML artifact loaded: %s@%s", _ARTIFACT.get("model_name"),
                 _ARTIFACT.get("model_version"))
        return _ARTIFACT
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("Could not load ML artifact (%s) — rule fallback active.", exc)
        _LOAD_FAILED = True
        return None


def is_ml_available() -> bool:
    return _load() is not None


def model_info() -> dict[str, str] | None:
    art = _load()
    if art is None:
        return None
    return {"model_name": art.get("model_name", "unknown"),
            "model_version": art.get("model_version", "unknown")}


def _red_flags(record: dict[str, Any]) -> list[str]:
    flags: list[str] = []
    spo2 = record.get("spo2")
    if spo2 is not None and spo2 < 90:
        flags.append(f"Severely low oxygen saturation (SpO₂ {spo2:g}%)")
    elif spo2 is not None and spo2 < 93:
        flags.append(f"Low oxygen saturation (SpO₂ {spo2:g}%)")
    rr = record.get("respiratory_rate")
    if rr is not None and rr >= 30:
        flags.append(f"Very fast breathing ({rr:g}/min)")
    temp = record.get("temperature")
    if temp is not None and temp >= 39.5:
        flags.append(f"High fever ({temp:g}°C)")
    if record.get("chest_pain"):
        flags.append("Chest pain reported")
    return flags


def _explain(artifact: dict, record: dict[str, Any], top_k: int = 5) -> list[dict[str, Any]]:
    """Rank input features by the model's own weights (importances/coefficients)."""
    clf = artifact["pipeline"].named_steps["clf"]
    weights: dict[str, float] = {}
    try:
        if hasattr(clf, "feature_importances_"):
            importances = clf.feature_importances_
            for name, w in zip(_POST_TRANSFORM, importances):
                weights[name] = float(w)
        elif hasattr(clf, "coef_"):
            # Linear model: use |coefficient| of the predicted class.
            classes = list(getattr(clf, "classes_", CLASS_NAMES))
            predicted = record.get("_predicted")
            idx = classes.index(predicted) if predicted in classes else 0
            coefs = clf.coef_[idx] if clf.coef_.ndim > 1 else clf.coef_
            for name, w in zip(_POST_TRANSFORM, coefs):
                weights[name] = abs(float(w))
    except Exception as exc:  # pragma: no cover - explanation is best-effort
        log.debug("explanation unavailable: %s", exc)
        return []

    ranked = sorted(weights.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
    total = sum(w for _, w in ranked) or 1.0
    out = []
    for name, w in ranked:
        raw = record.get(name)
        out.append({
            "feature": name,
            "label": FEATURE_LABELS.get(name, name),
            "value": None if raw is None else (raw if isinstance(raw, str) else round(float(raw), 1)),
            "relative_weight": round(w / total, 3),
        })
    return out


def predict_record(record: dict[str, Any], top_k: int = 5) -> MLResult:
    """Run the persisted pipeline on one record (already feature-extracted)."""
    artifact = _load()
    if artifact is None:
        raise RuntimeError("ML model is not available")

    import numpy as np  # noqa: PLC0415 (lazy by design)

    frame = build_feature_frame(record)
    pipeline = artifact["pipeline"]
    proba = pipeline.predict_proba(frame)[0]
    classes = list(artifact.get("classes", CLASS_NAMES))
    best = int(np.argmax(proba))
    predicted = classes[best]

    record = dict(record)
    record["_predicted"] = predicted
    explanation = _explain(artifact, record, top_k=top_k)

    return MLResult(
        risk_level=predicted,
        confidence=round(float(proba[best]), 4),
        probabilities={c: round(float(p), 4) for c, p in zip(classes, proba)},
        model_name=artifact.get("model_name", "unknown"),
        model_version=artifact.get("model_version", "unknown"),
        contributing_features=explanation,
        red_flags=_red_flags(record),
    )


# Keep the unused import referenced for clarity of the schema contract.
_ = (FEATURE_NAMES, Path)
