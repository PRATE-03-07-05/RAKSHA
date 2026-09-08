"""Canonical clinical queue tests — priority, aging, scope, RBAC, stability."""
from datetime import date, datetime, timedelta, timezone

from app.models import (Appointment, AppointmentStatus, AppointmentType,
                        Assessment, Facility, Patient, Priority, Referral,
                        ReferralStatus, RiskLevel, Role)

from .conftest import auth_headers, make_patient, make_user, seed_facilities


def _assess(db, pid, level, hours_ago=1):
    a = Assessment(patient_id=pid, level=level, score=10,
                   factors=[], red_flags=[], recommendation="X",
                   rule_version="t", input_snapshot={},
                   created_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago))
    db.add(a)
    db.commit()
    return a


def _appt(db, pid, fid, did, status=AppointmentStatus.SCHEDULED, days=0, hh="09:00"):
    a = Appointment(patient_id=pid, facility_id=fid, doctor_id=did,
                    date=date.today() + timedelta(days=days), time=hh,
                    purpose="OPD", appointment_type=AppointmentType.OPD,
                    status=status, queue_pos=1)
    db.add(a)
    db.commit()
    return a


def _ref(db, pid, frm, to, by, status=ReferralStatus.SENT, prio=Priority.ROUTINE, hours_ago=1):
    r = Referral(code=f"REF-T-{abs(hash((pid, to))) % 99999:05d}-{status.value[:2]}",
                 patient_id=pid, from_facility_id=frm, to_facility_id=to,
                 created_by_id=by, reason="test", priority=prio, status=status,
                 created_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago))
    # ensure unique code
    import uuid
    r.code = f"REF-{uuid.uuid4().hex[:8].upper()}"
    db.add(r)
    db.commit()
    return r


def _setup_roles(db):
    phc, chc, dh = seed_facilities(db)
    phcdr = make_user(db, Role.PHC_DOCTOR, name="PHC Doc", facility_id=phc.id,
                      email="queue-phcdr@test.raksha")
    chcdr = make_user(db, Role.CHC_DOCTOR, name="CHC Doc", facility_id=chc.id,
                      email="queue-chcdr@test.raksha")
    spec = make_user(db, Role.SPECIALIST, name="Spec", facility_id=dh.id,
                     email="queue-spec@test.raksha")
    spec.specialty = "Cardiology"
    db.commit()
    asha = make_user(db, Role.ASHA, name="ASHA", facility_id=phc.id,
                     email="queue-asha@test.raksha")
    return phc, chc, dh, phcdr, chcdr, spec, asha


def test_priority_order_critical_high_medium_low(client, db):
    phc, chc, dh, phcdr, *_ = _setup_roles(db)
    pats = {}
    for lvl, nm in [("CRITICAL", "pc"), ("HIGH", "ph"), ("MEDIUM", "pm"), ("LOW", "pl")]:
        p = make_patient(db, name=f"Q {nm}", rak_id=f"RAK-Q-{nm}", phc_id=phc.id)
        pats[lvl] = p
        _assess(db, p.id, RiskLevel(lvl), hours_ago=0)
        # Referrals created now → wait ~0min → no aging boost interferes.
        _ref(db, p.id, phc.id, phc.id, phcdr.id, hours_ago=0)
    r = client.get("/clinical/queue?limit=50", headers=auth_headers(phcdr))
    assert r.status_code == 200
    got = [i["priority"] for i in r.json()["items"]]
    assert got.index("CRITICAL") < got.index("HIGH") < got.index("MEDIUM") < got.index("LOW")


def test_waiting_time_wins_within_priority(client, db):
    phc, _, _, phcdr, *_ = _setup_roles(db)
    p1 = make_patient(db, name="Q early", rak_id="RAK-Q-E1", phc_id=phc.id)
    p2 = make_patient(db, name="Q late", rak_id="RAK-Q-L1", phc_id=phc.id)
    for p in (p1, p2):
        _assess(db, p.id, RiskLevel.MEDIUM)
    _ref(db, p1.id, phc.id, phc.id, phcdr.id, hours_ago=5)
    _ref(db, p2.id, phc.id, phc.id, phcdr.id, hours_ago=1)
    r = client.get("/clinical/queue?limit=50", headers=auth_headers(phcdr))
    ids = [i["patient_id"] for i in r.json()["items"]]
    assert ids.index(p1.id) < ids.index(p2.id)


def test_deterministic_tie_break(client, db):
    phc, _, _, phcdr, *_ = _setup_roles(db)
    p1 = make_patient(db, name="Q t1", rak_id="RAK-Q-T1", phc_id=phc.id)
    p2 = make_patient(db, name="Q t2", rak_id="RAK-Q-T2", phc_id=phc.id)
    for p in (p1, p2):
        _assess(db, p.id, RiskLevel.LOW, hours_ago=2)
        _appt(db, p.id, phc.id, phcdr.id)
    first = [i["id"] for i in client.get("/clinical/queue", headers=auth_headers(phcdr)).json()["items"]]
    second = [i["id"] for i in client.get("/clinical/queue", headers=auth_headers(phcdr)).json()["items"]]
    assert first == second


def test_critical_not_overtaken_by_aging(client, db):
    phc, _, _, phcdr, *_ = _setup_roles(db)
    pc = make_patient(db, name="Q crit", rak_id="RAK-Q-C9", phc_id=phc.id)
    ph = make_patient(db, name="Q high-old", rak_id="RAK-Q-H9", phc_id=phc.id)
    _assess(db, pc.id, RiskLevel.CRITICAL, hours_ago=0)
    _assess(db, ph.id, RiskLevel.HIGH, hours_ago=10)
    _appt(db, pc.id, phc.id, phcdr.id)
    _appt(db, ph.id, phc.id, phcdr.id)
    items = client.get("/clinical/queue", headers=auth_headers(phcdr)).json()["items"]
    assert items[0]["patient_id"] == pc.id


def test_no_duplicate_rows_per_patient(client, db):
    phc, _, _, phcdr, *_ = _setup_roles(db)
    p = make_patient(db, name="Q dup", rak_id="RAK-Q-D1", phc_id=phc.id)
    _assess(db, p.id, RiskLevel.MEDIUM)
    _appt(db, p.id, phc.id, phcdr.id)
    _ref(db, p.id, phc.id, phc.id, phcdr.id)
    items = client.get("/clinical/queue", headers=auth_headers(phcdr)).json()["items"]
    assert sum(1 for i in items if i["patient_id"] == p.id) == 1


def test_phc_scope(client, db):
    phc, chc, _, phcdr, chcdr, *_ = _setup_roles(db)
    p_in = make_patient(db, name="Q in", rak_id="RAK-Q-IN", phc_id=phc.id)
    p_out = make_patient(db, name="Q out", rak_id="RAK-Q-OUT", phc_id=chc.id)
    for p in (p_in, p_out):
        _assess(db, p.id, RiskLevel.MEDIUM)
    _appt(db, p_in.id, phc.id, phcdr.id)
    _appt(db, p_out.id, chc.id, chcdr.id)
    ids = [i["patient_id"] for i in client.get("/clinical/queue", headers=auth_headers(phcdr)).json()["items"]]
    assert p_in.id in ids and p_out.id not in ids


def test_chc_scope(client, db):
    phc, chc, _, phcdr, chcdr, *_ = _setup_roles(db)
    p = make_patient(db, name="Q chc", rak_id="RAK-Q-CHC", phc_id=phc.id)
    _assess(db, p.id, RiskLevel.HIGH)
    _ref(db, p.id, phc.id, chc.id, phcdr.id, status=ReferralStatus.ACCEPTED)
    ids = [i["patient_id"] for i in client.get("/clinical/queue", headers=auth_headers(chcdr)).json()["items"]]
    assert p.id in ids


def test_specialist_scope(client, db):
    phc, _, dh, phcdr, _, spec, _ = _setup_roles(db)
    p = make_patient(db, name="Q sp", rak_id="RAK-Q-SP", phc_id=phc.id)
    _assess(db, p.id, RiskLevel.HIGH)
    _ref(db, p.id, phc.id, dh.id, phcdr.id, status=ReferralStatus.ACCEPTED, prio=Priority.URGENT)
    p2 = make_patient(db, name="Q sp2", rak_id="RAK-Q-SP2", phc_id=phc.id)
    _assess(db, p2.id, RiskLevel.HIGH)
    _ref(db, p2.id, phc.id, phc.id, phcdr.id, status=ReferralStatus.ACCEPTED)
    ids = [i["patient_id"] for i in client.get("/clinical/queue", headers=auth_headers(spec)).json()["items"]]
    assert p.id in ids and p2.id not in ids


def test_unauthorized_role_rejected(client, db):
    _, _, _, _, _, _, asha = _setup_roles(db)
    r = client.get("/clinical/queue", headers=auth_headers(asha))
    assert r.status_code == 403


def test_empty_queue_ok(client, db):
    _, _, _, phcdr, *_ = _setup_roles(db)
    r = client.get("/clinical/queue", headers=auth_headers(phcdr))
    assert r.status_code == 200
    assert r.json()["items"] == [] and r.json()["total"] == 0


def test_null_fields_no_crash(client, db):
    phc, _, _, phcdr, *_ = _setup_roles(db)
    p = Patient(rak_id="RAK-Q-N1", name="Q null", age=0, gender="FEMALE",
                village="", district="Pune", conditions=[], allergies=[],
                phc_id=phc.id, consent_granted=True)
    db.add(p)
    db.commit()
    _appt(db, p.id, phc.id, phcdr.id)
    r = client.get("/clinical/queue", headers=auth_headers(phcdr))
    assert r.status_code == 200


def test_limit_contract(client, db):
    _, _, _, phcdr, *_ = _setup_roles(db)
    assert client.get("/clinical/queue?limit=500", headers=auth_headers(phcdr)).status_code == 422
    r = client.get("/clinical/queue?limit=1", headers=auth_headers(phcdr))
    assert r.status_code == 200 and len(r.json()["items"]) <= 1


def test_status_filter(client, db):
    phc, _, _, phcdr, *_ = _setup_roles(db)
    p = make_patient(db, name="Q st", rak_id="RAK-Q-ST", phc_id=phc.id)
    _assess(db, p.id, RiskLevel.MEDIUM)
    _appt(db, p.id, phc.id, phcdr.id, status=AppointmentStatus.SCHEDULED)
    r = client.get("/clinical/queue?status=WAITING", headers=auth_headers(phcdr))
    assert all(i["queue_status"] == "WAITING" for i in r.json()["items"])
    r2 = client.get("/clinical/queue?status=IN_PROGRESS", headers=auth_headers(phcdr))
    assert all(i["queue_status"] == "IN_PROGRESS" for i in r2.json()["items"])


def test_completed_excluded_by_default(client, db):
    phc, _, _, phcdr, *_ = _setup_roles(db)
    p = make_patient(db, name="Q done", rak_id="RAK-Q-DONE", phc_id=phc.id)
    _assess(db, p.id, RiskLevel.MEDIUM)
    _appt(db, p.id, phc.id, phcdr.id, status=AppointmentStatus.COMPLETED)
    ids = [i["patient_id"] for i in client.get("/clinical/queue", headers=auth_headers(phcdr)).json()["items"]]
    assert p.id not in ids
    ids2 = [i["patient_id"] for i in
            client.get("/clinical/queue?include_completed=true", headers=auth_headers(phcdr)).json()["items"]]
    assert p.id in ids2


def test_waiting_minutes_present(client, db):
    phc, _, _, phcdr, *_ = _setup_roles(db)
    p = make_patient(db, name="Q wait", rak_id="RAK-Q-WT", phc_id=phc.id)
    _assess(db, p.id, RiskLevel.MEDIUM)
    _ref(db, p.id, phc.id, phc.id, phcdr.id, hours_ago=2)
    items = client.get("/clinical/queue", headers=auth_headers(phcdr)).json()["items"]
    row = next(i for i in items if i["patient_id"] == p.id)
    assert row["waiting_minutes"] >= 100
