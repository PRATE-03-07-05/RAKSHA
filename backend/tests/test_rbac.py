"""RBAC tests: allowed roles, forbidden roles, unauthorized patient access."""
from app.models import Role

from .conftest import auth_headers, make_patient, make_user, seed_facilities


def test_patient_cannot_list_other_patients(client, db):
    patient_user = make_user(db, Role.PATIENT, email="rbac-patient@test.raksha")
    make_patient(db, name="Someone Else")
    r = client.get("/patients?q=Someone", headers=auth_headers(patient_user))
    assert r.status_code == 200
    assert r.json()["total"] == 0  # sees only own (linked) records


def test_patient_cannot_open_foreign_record(client, db):
    patient_user = make_user(db, Role.PATIENT, email="rbac-p2@test.raksha")
    other = make_patient(db, name="Foreign Record")
    r = client.get(f"/patients/{other.id}", headers=auth_headers(patient_user))
    assert r.status_code == 403


def test_patient_can_open_own_record(client, db):
    patient_user = make_user(db, Role.PATIENT, email="rbac-own@test.raksha")
    mine = make_patient(db, name="My Own Record", user_id=patient_user.id)
    r = client.get(f"/patients/{mine.id}", headers=auth_headers(patient_user))
    assert r.status_code == 200
    assert r.json()["name"] == "My Own Record"


def test_asha_cannot_access_admin_analytics(client, db):
    asha = make_user(db, Role.ASHA, email="rbac-asha@test.raksha")
    r = client.get("/admin/analytics", headers=auth_headers(asha))
    assert r.status_code == 403


def test_admin_can_access_analytics(client, db):
    seed_facilities(db)
    admin = make_user(db, Role.DISTRICT_ADMIN, email="rbac-admin@test.raksha")
    r = client.get("/admin/analytics", headers=auth_headers(admin))
    assert r.status_code == 200
    assert "total_patients" in r.json()


def test_asha_cannot_write_consultation(client, db):
    asha = make_user(db, Role.ASHA, email="rbac-asha2@test.raksha")
    p = make_patient(db, asha_id=asha.id)
    r = client.post(f"/patients/{p.id}/consultations", headers=auth_headers(asha),
                    json={"complaint": "fever", "assessment": "viral"})
    assert r.status_code == 403


def test_phc_doctor_can_write_consultation(client, db):
    seed_facilities(db)
    dr = make_user(db, Role.PHC_DOCTOR, email="rbac-dr@test.raksha", facility_id="F-TEST-PHC")
    p = make_patient(db)
    r = client.post(f"/patients/{p.id}/consultations", headers=auth_headers(dr),
                    json={"complaint": "fever", "assessment": "viral fever",
                          "meds": [{"medicine": "Paracetamol", "dose": "500mg"}]})
    assert r.status_code == 201
    assert r.json()["meds"][0]["medicine"] == "Paracetamol"


def test_unauthenticated_everywhere(client, db):
    assert client.get("/patients").status_code == 401
    assert client.get("/referrals").status_code == 401
    assert client.post("/referrals", json={}).status_code == 401


def test_patient_cannot_register_patient(client, db):
    patient_user = make_user(db, Role.PATIENT, email="rbac-reg@test.raksha")
    r = client.post("/patients", headers=auth_headers(patient_user),
                    json={"name": "X Y", "age": 30, "gender": "MALE"})
    assert r.status_code == 403
