"""ML decision-support tests: fallback behaviour, engine status endpoint,
artifact loading and inference.

The suite is deterministic: tests run with RAKSHA_ML_DISABLED=1 unless they
explicitly build a tiny artifact, so results never depend on whether a real
model happens to be trained in the environment.
"""
import os

import pytest

from app.models import Role

from .conftest import auth_headers, make_user

DISABLE_ENV = "RAKSHA_ML_DISABLED"


@pytest.fixture(autouse=True)
def _ml_disabled(monkeypatch):
    """Force the transparent rule fallback unless a test opts out."""
    monkeypatch.setenv(DISABLE_ENV, "1")
    from ml.inference import loader
    loader._reset_cache()
    yield
    loader._reset_cache()


def _asha(db):
    return make_user(db, Role.ASHA, email="ml-asha@test.raksha")


def test_fallback_mode_labelled_when_model_disabled(client, db):
    asha = _asha(db)
    r = client.post("/triage/assess", headers=auth_headers(asha),
                    json={"age": 40, "spo2": 88, "breathing_difficulty": True})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "RULE_BASED_FALLBACK"
    assert body["model_version"] is None
    assert body["confidence"] is None
    assert body["risk_level"] == "CRITICAL"          # rule engine still fully functional
    assert "not a medical diagnosis" in body["disclaimer"]


def test_model_status_endpoint_reports_fallback(client, db):
    asha = _asha(db)
    r = client.get("/triage/model", headers=auth_headers(asha))
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is False
    assert body["mode"] == "RULE_BASED_FALLBACK"


def test_is_ml_available_respects_disable_flag():
    from ml.inference import is_ml_available
    assert is_ml_available() is False


def test_inference_with_real_artifact():
    """End-to-end inference test — skipped unless scikit-learn is installed.

    Builds a tiny, genuine fitted pipeline (not the shipped model), persists it
    in the artifact format, and verifies loading + prediction + explanation.
    """
    pytest.importorskip("sklearn")
    import joblib
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier

    from ml.inference import loader
    from ml.paths import ARTIFACT_PATH
    from ml.preprocessing import CLASS_NAMES, FEATURE_NAMES, build_pipeline

    rng_seed = 7
    n = 120
    import numpy as np
    rng = np.random.default_rng(rng_seed)
    X = pd.DataFrame({
        "age": rng.integers(1, 90, n).astype(float),
        "spo2": rng.integers(85, 100, n).astype(float),
        "respiratory_rate": rng.integers(12, 40, n).astype(float),
        "temperature": rng.normal(37.5, 1, n).round(1),
        "heart_rate": rng.integers(55, 150, n).astype(float),
        "cough": rng.binomial(1, 0.5, n).astype(float),
        "breathing_difficulty": rng.binomial(1, 0.4, n).astype(float),
        "chest_pain": rng.binomial(1, 0.2, n).astype(float),
        "duration_days": rng.integers(0, 14, n).astype(float),
        "pregnant": rng.binomial(1, 0.1, n).astype(float),
        "has_chronic_condition": rng.binomial(1, 0.3, n).astype(float),
        "severity_reported": rng.choice(["MILD", "MODERATE", "SEVERE"], n),
    })
    y = np.where(X["spo2"] < 90, "CRITICAL",
                 np.where(X["spo2"] < 94, "HIGH",
                          np.where(X["temperature"] > 38, "MEDIUM", "LOW")))

    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    backup = None
    if ARTIFACT_PATH.exists():
        backup = ARTIFACT_PATH.read_bytes()
    try:
        pipe = build_pipeline(RandomForestClassifier(n_estimators=40, random_state=0))
        pipe.fit(X, y)
        joblib.dump({
            "pipeline": pipe, "classes": list(np.unique(y)) or CLASS_NAMES,
            "feature_names": FEATURE_NAMES, "model_name": "random_forest",
            "model_version": "test-tiny", "trained_at": "2026-01-01T00:00:00Z",
            "dataset": {"source": "unit-test", "rows": n, "seed": rng_seed},
            "cv_results": {}, "test_metrics": {},
        }, ARTIFACT_PATH)
        loader._reset_cache()
        os.environ.pop(DISABLE_ENV, None)

        from ml.inference import is_ml_available, predict_record
        assert is_ml_available() is True
        result = predict_record({"age": 60, "spo2": 86, "respiratory_rate": 32,
                                 "temperature": 39.0, "heart_rate": 120,
                                 "cough": 1, "breathing_difficulty": 1, "chest_pain": 0,
                                 "duration_days": 5, "pregnant": 0,
                                 "has_chronic_condition": 1,
                                 "severity_reported": "SEVERE"})
        assert result.risk_level in CLASS_NAMES
        assert 0.0 <= result.confidence <= 1.0
        assert sum(result.probabilities.values()) == pytest.approx(1.0, abs=0.01)
        assert result.model_version == "test-tiny"
        assert result.contributing_features, "explanation must not be empty"
        assert all("label" in f and "relative_weight" in f for f in result.contributing_features)
    finally:
        loader._reset_cache()
        if backup is not None:
            ARTIFACT_PATH.write_bytes(backup)
        elif ARTIFACT_PATH.exists():
            ARTIFACT_PATH.unlink()
        os.environ[DISABLE_ENV] = "1"
