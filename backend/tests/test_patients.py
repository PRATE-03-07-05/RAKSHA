"""Patient + medical record tests: create, search, update, vitals append-only."""
from app.models import Role

from .conftest import auth_headers, make_patient, make_user, seed_facilities


def test_create_patient_generates_rak_id(client, db):
    asha = make_user(db, Role.ASHA, email="pat-asha@test.raksha")
    r = client.post("/patients", headers=auth_headers(asha),
                    json={"name": "Naya Patient", "age": 33, "gender": "FEMALE",
                          "village": "Testpur", "conditions": ["Asthma"]})
    assert r.status_code == 201
    body = r.json()
    assert body["rak_id"].startswith("RAK-PAT-")
    assert body["conditions"] == ["Asthma"]


def test_search_by_name_and_rak_id(client, db):
    asha = make_user(db, Role.ASHA, email="pat-search@test.raksha")
    make_patient(db, name="Unique Zebra", rak_id="RAK-PAT-2026-00999")
    r1 = client.get("/patients?q=Zebra", headers=auth_headers(asha))
    assert r1.status_code == 200 and r1.json()["total"] == 1
    r2 = client.get("/patients?q=2026-00999", headers=auth_headers(asha))
    assert r2.json()["total"] == 1


def test_update_version_conflict(client, db):
    asha = make_user(db, Role.ASHA, email="pat-upd@test.raksha")
    p = make_patient(db, asha_id=asha.id, name="Versioned Person")
    ok = client.patch(f"/patients/{p.id}", headers=auth_headers(asha),
                      json={"phone": "9999999999", "version": p.version})
    assert ok.status_code == 200
    assert ok.json()["version"] == p.version + 1
    stale = client.patch(f"/patients/{p.id}", headers=auth_headers(asha),
                         json={"phone": "8888888888", "version": p.version})
    assert stale.status_code == 409


def test_vitals_are_append_only(client, db):
    asha = make_user(db, Role.ASHA, email="pat-vitals@test.raksha")
    p = make_patient(db, asha_id=asha.id)
    for spo2 in (94, 90):
        r = client.post(f"/patients/{p.id}/vitals", headers=auth_headers(asha),
                        json={"spo2": spo2, "temperature": 38.1})
        assert r.status_code == 201
    records = client.get(f"/patients/{p.id}/records", headers=auth_headers(asha))
    vitals = records.json()["vitals"]
    assert len(vitals) == 2                       # history preserved, never overwritten
    assert {v["spo2"] for v in vitals} == {94, 90}


def test_vitals_requires_measurement(client, db):
    asha = make_user(db, Role.ASHA, email="pat-vitals2@test.raksha")
    p = make_patient(db, asha_id=asha.id)
    r = client.post(f"/patients/{p.id}/vitals", headers=auth_headers(asha), json={})
    assert r.status_code == 422


def test_timeline_contains_all_event_kinds(client, db):
    seed_facilities(db)
    asha = make_user(db, Role.ASHA, email="pat-tl@test.raksha", facility_id="F-TEST-PHC")
    dr = make_user(db, Role.PHC_DOCTOR, email="pat-tl-dr@test.raksha", facility_id="F-TEST-PHC")
    p = make_patient(db, asha_id=asha.id)
    client.post(f"/patients/{p.id}/visits", headers=auth_headers(asha),
                json={"symptoms": ["Fever"], "complaint": "fever 2 days"})
    client.post(f"/patients/{p.id}/vitals", headers=auth_headers(asha), json={"spo2": 95})
    client.post(f"/patients/{p.id}/consultations", headers=auth_headers(dr),
                json={"complaint": "fever", "assessment": "viral"})
    r = client.get(f"/patients/{p.id}/timeline", headers=auth_headers(asha))
    assert r.status_code == 200
    kinds = {e["kind"] for e in r.json()}
    assert {"registered", "visit", "vitals", "consultation"} <= kinds
