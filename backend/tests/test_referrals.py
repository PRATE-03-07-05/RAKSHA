"""Referral lifecycle tests — the closed-loop core of RAKSHA."""
from datetime import date

from app.models import Role

from .conftest import auth_headers, make_patient, make_user, seed_facilities

PHC, CHC = "F-TEST-PHC", "F-TEST-CHC"


def _setup(db):
    seed_facilities(db)
    asha = make_user(db, Role.ASHA, email="ref-asha@test.raksha", facility_id=PHC)
    phc_staff = make_user(db, Role.PHC_STAFF, email="ref-staff@test.raksha", facility_id=PHC)
    phc_dr = make_user(db, Role.PHC_DOCTOR, email="ref-phcdr@test.raksha", facility_id=PHC)
    chc_dr = make_user(db, Role.CHC_DOCTOR, email="ref-chcdr@test.raksha", facility_id=CHC)
    patient = make_patient(db, asha_id=asha.id, phc_id=PHC)
    return asha, phc_staff, phc_dr, chc_dr, patient


def _create(client, user, patient_id):
    return client.post("/referrals", headers=auth_headers(user), json={
        "patient_id": patient_id, "from_facility_id": PHC, "to_facility_id": CHC,
        "reason": "Persistent fever, needs physician review", "priority": "PRIORITY",
        "expected_date": date.today().isoformat(),
    })


def test_create_referral_starts_sent_with_history(client, db):
    asha, *_rest, patient = _setup(db)
    r = _create(client, asha, patient.id)
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "SENT"
    assert body["code"].startswith("REF-")
    detail = client.get(f"/referrals/{body['id']}", headers=auth_headers(asha)).json()
    assert [e["to_status"] for e in detail["events"]] == ["CREATED", "SENT"]


def test_full_lifecycle_to_completion(client, db):
    asha, phc_staff, phc_dr, chc_dr, patient = _setup(db)
    rid = _create(client, asha, patient.id).json()["id"]

    ack = client.post(f"/referrals/{rid}/transition", headers=auth_headers(phc_staff),
                      json={"target": "ACKNOWLEDGED", "notes": "bed available"})
    assert ack.status_code == 200 and ack.json()["status"] == "ACKNOWLEDGED"

    for target, actor in (("ACCEPTED", chc_dr), ("ARRIVED", chc_dr),
                          ("IN_CONSULTATION", chc_dr), ("TREATMENT", chc_dr)):
        r = client.post(f"/referrals/{rid}/transition", headers=auth_headers(actor),
                        json={"target": target})
        assert r.status_code == 200, f"{target} failed: {r.text}"

    done = client.post(f"/referrals/{rid}/transition", headers=auth_headers(chc_dr),
                       json={"target": "COMPLETED", "outcome": "TREATED_AND_DISCHARGED",
                             "outcome_notes": "Antibiotics course; review in 5 days"})
    assert done.status_code == 200
    body = done.json()
    assert body["status"] == "COMPLETED"
    assert body["outcome"] == "TREATED_AND_DISCHARGED"
    assert body["completed_at"]

    history = client.get(f"/referrals/{rid}/history", headers=auth_headers(asha))
    assert [e["to_status"] for e in history.json()] == [
        "CREATED", "SENT", "ACKNOWLEDGED", "ACCEPTED", "ARRIVED",
        "IN_CONSULTATION", "TREATMENT", "COMPLETED"]


def test_invalid_transition_rejected(client, db):
    asha, *_rest, patient = _setup(db)
    rid = _create(client, asha, patient.id).json()["id"]
    r = client.post(f"/referrals/{rid}/transition", headers=auth_headers(asha),
                    json={"target": "COMPLETED"})
    assert r.status_code == 409  # SENT → COMPLETED is not in the state machine


def test_unauthorized_transition_rejected(client, db):
    asha, _phc_staff, phc_dr, _chc_dr, patient = _setup(db)
    rid = _create(client, asha, patient.id).json()["id"]
    # Source-facility doctor cannot acknowledge — only the receiving facility can.
    r = client.post(f"/referrals/{rid}/transition", headers=auth_headers(phc_dr),
                    json={"target": "ACKNOWLEDGED"})
    assert r.status_code == 403
    # ASHA cannot move clinical steps.
    r2 = client.post(f"/referrals/{rid}/transition", headers=auth_headers(asha),
                     json={"target": "TREATMENT"})
    assert r2.status_code == 403


def test_completion_requires_outcome(client, db):
    asha, _phc_staff, _phc_dr, chc_dr, patient = _setup(db)
    rid = _create(client, asha, patient.id).json()["id"]
    for t in ("ACKNOWLEDGED", "ACCEPTED", "ARRIVED", "IN_CONSULTATION", "TREATMENT"):
        r = client.post(f"/referrals/{rid}/transition", headers=auth_headers(chc_dr), json={"target": t})
        assert r.status_code == 200, f"{t} failed: {r.text}"
    r = client.post(f"/referrals/{rid}/transition", headers=auth_headers(chc_dr),
                    json={"target": "COMPLETED"})
    assert r.status_code == 422  # closing the loop requires a recorded outcome


def test_unknown_target_422(client, db):
    asha, *_rest, patient = _setup(db)
    rid = _create(client, asha, patient.id).json()["id"]
    r = client.post(f"/referrals/{rid}/transition", headers=auth_headers(asha),
                    json={"target": "TELEPORTED"})
    assert r.status_code == 422


def test_followup_against_referral(client, db):
    asha, *_rest, patient = _setup(db)
    rid = _create(client, asha, patient.id).json()["id"]
    r = client.post(f"/referrals/{rid}/followup", headers=auth_headers(asha),
                    json={"scheduled_date": date.today().isoformat(), "notes": "home visit"})
    assert r.status_code == 201
    ref = client.get(f"/referrals/{rid}", headers=auth_headers(asha)).json()
    assert ref["follow_up_date"] == date.today().isoformat()
