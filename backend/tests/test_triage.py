"""Triage decision-support tests: classification, red flags, validation."""
from app.models import Role

from .conftest import auth_headers, make_patient, make_user


def _asha(db):
    return make_user(db, Role.ASHA, email="triage-asha@test.raksha")


def test_critical_low_spo2(client, db):
    asha = _asha(db)
    r = client.post("/triage/assess", headers=auth_headers(asha),
                    json={"age": 55, "spo2": 86, "respiratory_rate": 30, "breathing_difficulty": True})
    assert r.status_code == 200
    body = r.json()
    assert body["risk_level"] == "CRITICAL"
    assert body["recommended_action"] == "EMERGENCY_REFERRAL"
    assert any("SpO₂" in f for f in body["red_flags"])
    assert body["disclaimer"]


def test_high_fever_flags(client, db):
    asha = _asha(db)
    r = client.post("/triage/assess", headers=auth_headers(asha),
                    json={"age": 30, "temperature": 39.8, "cough": True, "duration_days": 9})
    body = r.json()
    assert body["risk_level"] in ("HIGH", "CRITICAL")
    assert any("temperature" in f.lower() or "fever" in f.lower() for f in body["red_flags"])


def test_low_risk_home_care(client, db):
    asha = _asha(db)
    r = client.post("/triage/assess", headers=auth_headers(asha),
                    json={"age": 25, "spo2": 98, "temperature": 36.8, "cough": True})
    body = r.json()
    assert body["risk_level"] == "LOW"
    assert body["recommended_action"] == "HOME_CARE_ADVICE"
    assert body["contributing_factors"], "assessment must be explainable"


def test_invalid_input_422(client, db):
    asha = _asha(db)
    r = client.post("/triage/assess", headers=auth_headers(asha), json={"age": 25, "spo2": 250})
    assert r.status_code == 422


def test_assessment_persisted_for_patient(client, db):
    asha = _asha(db)
    p = make_patient(db, asha_id=asha.id)
    r = client.post("/triage/assess", headers=auth_headers(asha),
                    json={"patient_id": p.id, "age": 42, "spo2": 91, "breathing_difficulty": True})
    body = r.json()
    assert body["assessment_id"]
    assert body["rule_version"]
    tl = client.get(f"/patients/{p.id}/timeline", headers=auth_headers(asha)).json()
    assert any(e["kind"] == "assessment" for e in tl)


def test_thresholds_exposed(client, db):
    asha = _asha(db)
    r = client.get("/triage/config", headers=auth_headers(asha))
    assert r.status_code == 200
    assert "spo2_critical" in r.json()["thresholds"]
