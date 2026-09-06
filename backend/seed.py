"""RAKSHA deterministic demo seed.

Run:  python seed.py          (idempotent — skips if already seeded)
Never uses real patient data. Everything is synthetic.
"""
from datetime import date, datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import (Appointment, AppointmentStatus, AppointmentType, Assessment,
                        AuditLog, Consultation, DiagnosticRecord, EmergencyEvent,
                        Facility, FacilityResource, FacilityType, FollowUp,
                        FollowUpStatus, Gender, Notification, NotificationChannel,
                        NotificationKind, Patient, Prescription, Priority,
                        Referral, ReferralEvent, ReferralStatus, RiskLevel, Role,
                        Teleconsultation, TeleStatus, User, Visit, VitalObservation)
from app.security import hash_password

NOW = datetime.now(timezone.utc)


def d(days: int, hours: int = 0) -> datetime:
    return NOW + timedelta(days=days, hours=hours)


def main() -> None:
    db = SessionLocal()
    if db.query(User).first() is not None:
        print("[seed] already seeded — skipping.")
        return

    pw = hash_password("raksha123")

    # ------------------------------------------------------------- facilities
    facilities = [
        Facility(id="F-SUB-01", code="F-SUB-01", name="Demapur Sub-Centre", facility_type=FacilityType.SUB_CENTER,
                 village="Demapur", district="Pune", phone="02112-240001", latitude=18.41, longitude=74.58),
        Facility(id="F-PHC-01", code="F-PHC-01", name="Demapur Primary Health Centre", facility_type=FacilityType.PHC,
                 village="Demapur", district="Pune", phone="02112-240002", latitude=18.42, longitude=74.60),
        Facility(id="F-PHC-02", code="F-PHC-02", name="Ranjani Primary Health Centre", facility_type=FacilityType.PHC,
                 village="Ranjani", district="Pune", phone="02112-240003", latitude=18.35, longitude=74.70),
        Facility(id="F-CHC-01", code="F-CHC-01", name="Shirur Community Health Centre", facility_type=FacilityType.CHC,
                 village="Shirur", district="Pune", phone="02112-240004", latitude=18.50, longitude=74.38),
        Facility(id="F-RH-01", code="F-RH-01", name="Indapur Rural Hospital", facility_type=FacilityType.RURAL_HOSPITAL,
                 village="Indapur", district="Pune", phone="02112-240005", latitude=18.28, longitude=74.95),
        Facility(id="F-DH-01", code="F-DH-01", name="Pune District Hospital", facility_type=FacilityType.DISTRICT_HOSPITAL,
                 village="Pune", district="Pune", phone="02112-240006", latitude=18.52, longitude=73.86),
    ]
    db.add_all(facilities)

    def res(fid, **kw):
        return FacilityResource(facility_id=fid, **kw)

    db.add_all([
        res("F-SUB-01", total_beds=4, available_beds=2, cbc="LIMITED", xray="UNAVAILABLE", ultrasound="UNAVAILABLE",
            medicines=[{"name": "Paracetamol", "status": "AVAILABLE", "qty": 340},
                       {"name": "ORS", "status": "AVAILABLE", "qty": 120},
                       {"name": "Iron + Folic Acid", "status": "LIMITED", "qty": 18}],
            workload_level="LOW"),
        res("F-PHC-01", total_beds=12, available_beds=5, oxygen_available=True, ambulance_available=True,
            emergency_available=True, cbc="AVAILABLE", xray="LIMITED", ultrasound="UNAVAILABLE",
            medicines=[{"name": "Amoxicillin", "status": "AVAILABLE", "qty": 210},
                       {"name": "Insulin", "status": "LIMITED", "qty": 12},
                       {"name": "Salbutamol inhaler", "status": "AVAILABLE", "qty": 26}],
            specialists=[{"specialty": "General Medicine", "available": True, "days": "Mon–Sat"}],
            workload_level="MODERATE"),
        res("F-PHC-02", total_beds=10, available_beds=1, cbc="LIMITED", xray="UNAVAILABLE",
            medicines=[{"name": "Paracetamol", "status": "AVAILABLE", "qty": 90},
                       {"name": "Metformin", "status": "UNAVAILABLE", "qty": 0}],
            workload_level="HIGH"),
        res("F-CHC-01", total_beds=30, available_beds=9, icu_beds=2, oxygen_available=True,
            ambulance_available=True, emergency_available=True, cbc="AVAILABLE", xray="AVAILABLE",
            ultrasound="LIMITED",
            medicines=[{"name": "Ceftriaxone", "status": "AVAILABLE", "qty": 160},
                       {"name": "Oxygen concentrators", "status": "AVAILABLE", "qty": 6}],
            specialists=[{"specialty": "General Medicine", "available": True, "days": "Daily"},
                         {"specialty": "Obstetrics", "available": True, "days": "Mon/Wed/Fri"}],
            workload_level="MODERATE"),
        res("F-RH-01", total_beds=24, available_beds=6, oxygen_available=True, ambulance_available=True,
            emergency_available=True, cbc="AVAILABLE", xray="AVAILABLE", ultrasound="AVAILABLE",
            workload_level="LOW"),
        res("F-DH-01", total_beds=120, available_beds=22, icu_beds=8, oxygen_available=True,
            ambulance_available=True, emergency_available=True, cbc="AVAILABLE", xray="AVAILABLE",
            ultrasound="AVAILABLE",
            specialists=[{"specialty": "Cardiology", "available": True, "days": "Mon/Wed"},
                         {"specialty": "Neurology", "available": False, "days": ""},
                         {"specialty": "Obstetrics", "available": True, "days": "Daily"}],
            workload_level="HIGH"),
    ])

    # ------------------------------------------------------------------ users
    users = [
        User(id="u-patient", email="patient@raksha.demo", name="Sita Devi", phone="9822010001",
             password_hash=pw, role=Role.PATIENT, village="Demapur", district="Pune"),
        User(id="u-asha", email="asha@raksha.demo", name="Sunita Bai", phone="9822010002",
             password_hash=pw, role=Role.ASHA, facility_id="F-SUB-01", village="Demapur", district="Pune"),
        User(id="u-anm", email="anm@raksha.demo", name="Kavita Pawar", phone="9822010003",
             password_hash=pw, role=Role.ANM, facility_id="F-SUB-01", village="Demapur", district="Pune"),
        User(id="u-phcstaff", email="phc.staff@raksha.demo", name="Mahesh Raut", phone="9822010004",
             password_hash=pw, role=Role.PHC_STAFF, facility_id="F-PHC-01", district="Pune"),
        User(id="u-phcdr", email="phc.doctor@raksha.demo", name="Dr. Anil Sharma", phone="9822010005",
             password_hash=pw, role=Role.PHC_DOCTOR, facility_id="F-PHC-01", district="Pune"),
        User(id="u-chcdr", email="chc.doctor@raksha.demo", name="Dr. Meera Joshi", phone="9822010006",
             password_hash=pw, role=Role.CHC_DOCTOR, facility_id="F-CHC-01", district="Pune"),
        User(id="u-specialist", email="specialist@raksha.demo", name="Dr. Vikram Rao", phone="9822010007",
             password_hash=pw, role=Role.SPECIALIST, specialty="Cardiology", facility_id="F-DH-01", district="Pune"),
        User(id="u-admin", email="admin@raksha.demo", name="Dr. N. Kulkarni", phone="9822010008",
             password_hash=pw, role=Role.DISTRICT_ADMIN, district="Pune"),
    ]
    db.add_all(users)

    # --------------------------------------------------------------- patients
    others = [
        ("Ramesh Jadhav", 58, Gender.MALE, "Demapur", ["Diabetes"], False),
        ("Kavita More", 29, Gender.FEMALE, "Ranjani", [], True),
        ("Arjun Kale", 67, Gender.MALE, "Shirur", ["Hypertension", "Cardiac"], False),
        ("Meera Shinde", 45, Gender.FEMALE, "Indapur", ["Asthma"], False),
        ("Suresh Bhosale", 51, Gender.MALE, "Demapur", ["Tuberculosis"], False),
        ("Anita Gaikwad", 34, Gender.FEMALE, "Ranjani", [], False),
        ("Vikas Patil", 12, Gender.MALE, "Demapur", [], False),
        ("Savita Chavan", 71, Gender.FEMALE, "Shirur", ["Hypertension", "Diabetes"], False),
        ("Ganesh Wagh", 39, Gender.MALE, "Indapur", [], False),
        ("Pooja Deshmukh", 26, Gender.FEMALE, "Demapur", [], True),
        ("Mahesh Thorat", 48, Gender.MALE, "Ranjani", ["COPD"], False),
        ("Nirmala Yadav", 63, Gender.FEMALE, "Shirur", ["Diabetes"], False),
    ]
    db.add(Patient(id="p-sita", rak_id="RAK-PAT-2026-00124", name="Sita Devi", age=42,
                   gender=Gender.FEMALE, phone="9822010001", village="Demapur", district="Pune",
                   emergency_contact="Ravi Devi (spouse)", emergency_phone="9822010011",
                   blood_group="B+", conditions=["Hypertension"], allergies=[], pregnant=False,
                   user_id="u-patient", asha_id="u-asha", phc_id="F-PHC-01",
                   consent_granted=True, consent_at=d(-90), created_at=d(-90), updated_at=d(-2)))
    for i, (name, age, gender, village, conds, preg) in enumerate(others):
        db.add(Patient(id=f"p-{i+2:02d}", rak_id=f"RAK-PAT-2026-{125+i:05d}", name=name, age=age,
                       gender=gender, phone=f"982201{i:04d}", village=village, district="Pune",
                       emergency_contact="Family", emergency_phone=f"982202{i:04d}",
                       conditions=conds, pregnant=preg,
                       asha_id="u-asha" if village == "Demapur" else "u-anm",
                       phc_id="F-PHC-01" if village == "Demapur" else "F-PHC-02",
                       consent_granted=True, consent_at=d(-60 + i), created_at=d(-60 + i)))
    db.flush()

    # ------------------------------------------------- Sita's longitudinal arc
    db.add(Visit(id="v-sita-1", patient_id="p-sita", worker_id="u-asha", facility_id="F-SUB-01",
                 location="Home visit — Demapur", symptoms=["Fever", "Cough", "Breathing difficulty"],
                 complaint="Fever since 3 days, worsening breathlessness",
                 observations="Audible wheeze, fatigue on mild exertion", source="FIELD",
                 created_at=d(-2)))
    db.add(VitalObservation(id="vo-sita-1", patient_id="p-sita", recorded_by_id="u-asha",
                            facility_id="F-SUB-01", systolic=142, diastolic=92, temperature=38.9,
                            spo2=91, heart_rate=98, respiratory_rate=24, device="Field pulse oximeter",
                            recorded_at=d(-2), created_at=d(-2)))
    db.add(Assessment(patient_id="p-sita", level=RiskLevel.HIGH, score=62,
                      factors=[{"code": "SPO2_LOW", "label": "Low SpO₂ (91%)", "weight": 30},
                               {"code": "RR_HIGH", "label": "Elevated respiratory rate (24/min)", "weight": 20},
                               {"code": "BREATHING_DIFFICULTY", "label": "Breathing difficulty reported", "weight": 20},
                               {"code": "TEMP_HIGH", "label": "Elevated temperature (38.9°C)", "weight": 15}],
                      red_flags=["Low SpO₂ (91%)"],
                      recommendation="URGENT_REFERRAL", rule_version="respiratory-v1.2",
                      input_snapshot={"age": 42, "spo2": 91, "temperature": 38.9},
                      confirmed=True, confirmed_by_id="u-phcdr", confirmed_at=d(-2, 3), created_at=d(-2, 1)))
    db.add(VitalObservation(id="vo-sita-2", patient_id="p-sita", recorded_by_id="u-chcdr",
                            facility_id="F-CHC-01", systolic=138, diastolic=90, temperature=38.2,
                            spo2=88, heart_rate=104, respiratory_rate=26, device="Ward monitor",
                            recorded_at=d(0, -20), created_at=d(0, -20)))
    db.add(Assessment(patient_id="p-sita", level=RiskLevel.CRITICAL, score=75,
                      factors=[{"code": "SPO2_CRITICAL", "label": "Severely low SpO₂ (88%)", "weight": 50},
                               {"code": "RR_HIGH", "label": "Elevated respiratory rate (26/min)", "weight": 20},
                               {"code": "HR_HIGH", "label": "Elevated heart rate (104/min)", "weight": 15}],
                      red_flags=["Severely low SpO₂ (88%)"],
                      recommendation="EMERGENCY_REFERRAL", rule_version="respiratory-v1.2",
                      input_snapshot={"age": 42, "spo2": 88}, created_at=d(0, -19)))
    db.add(Consultation(id="c-sita-1", patient_id="p-sita", doctor_id="u-phcdr", facility_id="F-PHC-01",
                        complaint="Routine BP review", findings="BP elevated, no acute distress",
                        assessment="Hypertension — continuing management",
                        plan="Continue Amlodipine; low-salt diet", created_at=d(-30)))
    db.add(Prescription(consultation_id="c-sita-1", patient_id="p-sita", medicine="Amlodipine",
                        dose="5mg", duration="Once daily, 30 days"))
    db.add(DiagnosticRecord(patient_id="p-sita", ordered_by_id="u-chcdr", facility_id="F-CHC-01",
                            test="CBC", status="ORDERED", created_at=d(0, -18)))
    db.add(Teleconsultation(id="t-sita-1", patient_id="p-sita", doctor_id="u-specialist",
                            facility_id="F-DH-01", scheduled_at=d(1, 2), status=TeleStatus.SCHEDULED,
                            room_code="RAK-SEED01"))
    db.add(EmergencyEvent(id="e-sita-1", code="EMG-RAK-2026-00021", patient_id="p-sita",
                          doctor_id="u-chcdr", facility_id="F-CHC-01", severity="CRITICAL",
                          clinical_note="SpO₂ dropped to 88% with respiratory distress. Oxygen started; "
                                        "district hospital escalation advised.",
                          status="ACTIVE", sms_token="RK4X92", sms_expires_at=d(0, 3),
                          created_at=d(0, -18)))

    # -------------------------------------------------------------- referrals
    def ref_events(rid, steps, facility):
        for i, (frm, to, actor, role, dt, note) in enumerate(steps):
            db.add(ReferralEvent(id=f"{rid}-ev{i}", referral_id=rid, from_status=frm, to_status=to,
                                 actor_id=actor, actor_role=role, facility_id=facility, notes=note,
                                 created_at=dt))

    r1 = Referral(id="r-sita-1", code="REF-2026-00001", patient_id="p-sita",
                  from_facility_id="F-PHC-01", to_facility_id="F-CHC-01", created_by_id="u-phcdr",
                  reason="Persistent fever with low SpO₂ — needs chest X-ray and physician review",
                  priority=Priority.URGENT, status=ReferralStatus.IN_CONSULTATION,
                  clinical_summary="42F, known hypertension. 3-day fever, cough, breathlessness. "
                                   "SpO₂ 91% at field assessment.",
                  vitals_snapshot="BP 142/92 · Temp 38.9°C · SpO₂ 91% · HR 98 · RR 24",
                  expected_date=date.today(), version=6, created_at=d(-1), updated_at=d(0, -18))
    db.add(r1)
    ref_events("r-sita-1", [
        (None, "CREATED", "u-phcdr", "PHC_DOCTOR", d(-1), "Referral created"),
        ("CREATED", "SENT", "u-phcdr", "PHC_DOCTOR", d(-1, 0.2), "Dispatched to CHC"),
        ("SENT", "ACKNOWLEDGED", "u-chcdr", "CHC_DOCTOR", d(-1, 1), "CHC acknowledged"),
        ("ACKNOWLEDGED", "ACCEPTED", "u-chcdr", "CHC_DOCTOR", d(-1, 1.5), "Bed reserved"),
        ("ACCEPTED", "ARRIVED", "u-anm", "ANM", d(0, -21), "Patient reached CHC"),
        ("ARRIVED", "IN_CONSULTATION", "u-chcdr", "CHC_DOCTOR", d(0, -20), "Physician review started"),
    ], "F-CHC-01")

    r2 = Referral(id="r-sita-0", code="REF-2026-00002", patient_id="p-sita",
                  from_facility_id="F-PHC-01", to_facility_id="F-CHC-01", created_by_id="u-phcdr",
                  reason="BP not controlled — physician review", priority=Priority.ROUTINE,
                  status=ReferralStatus.COMPLETED, outcome="TREATED_AND_DISCHARGED",
                  outcome_notes="Medication adjusted; advised follow-up with ASHA.",
                  expected_date=date.today() - timedelta(days=25), version=8,
                  completed_at=d(-25, 6), created_at=d(-26), updated_at=d(-25, 6))
    db.add(r2)
    ref_events("r-sita-0", [
        (None, "CREATED", "u-phcdr", "PHC_DOCTOR", d(-26), "Referral created"),
        ("CREATED", "SENT", "u-phcdr", "PHC_DOCTOR", d(-26, 0.1), "Dispatched"),
        ("SENT", "ACKNOWLEDGED", "u-chcdr", "CHC_DOCTOR", d(-26, 2), "Acknowledged"),
        ("ACKNOWLEDGED", "ACCEPTED", "u-chcdr", "CHC_DOCTOR", d(-26, 3), "Accepted"),
        ("ACCEPTED", "ARRIVED", "u-asha", "ASHA", d(-25, 1), "Patient arrived"),
        ("ARRIVED", "IN_CONSULTATION", "u-chcdr", "CHC_DOCTOR", d(-25, 2), "Consultation"),
        ("IN_CONSULTATION", "TREATMENT", "u-chcdr", "CHC_DOCTOR", d(-25, 4), "Treatment"),
        ("TREATMENT", "COMPLETED", "u-chcdr", "CHC_DOCTOR", d(-25, 6), "Outcome: treated and discharged"),
    ], "F-CHC-01")
    db.add(FollowUp(id="f-sita-1", patient_id="p-sita", referral_id="r-sita-0",
                    scheduled_date=date.today() + timedelta(days=6),
                    notes="Check BP at home; ensure medication adherence", assignee_role="ASHA"))

    db.add(Referral(id="r-ramesh", code="REF-2026-00003", patient_id="p-02",
                    from_facility_id="F-PHC-02", to_facility_id="F-CHC-01", created_by_id="u-anm",
                    reason="Uncontrolled diabetes with foot ulcer", priority=Priority.PRIORITY,
                    status=ReferralStatus.SENT, expected_date=date.today() - timedelta(days=1),
                    created_at=d(-3), updated_at=d(-3)))
    ref_events("r-ramesh", [
        (None, "CREATED", "u-anm", "ANM", d(-3), "Referral created"),
        ("CREATED", "SENT", "u-anm", "ANM", d(-3, 0.1), "Dispatched — awaiting CHC acknowledgement"),
    ], "F-CHC-01")

    db.add(Referral(id="r-arjun", code="REF-2026-00004", patient_id="p-04",
                    from_facility_id="F-CHC-01", to_facility_id="F-DH-01", created_by_id="u-chcdr",
                    reason="Suspected cardiac event — cardiology review", priority=Priority.URGENT,
                    status=ReferralStatus.ACKNOWLEDGED, expected_date=date.today() + timedelta(days=1),
                    created_at=d(0, -6), updated_at=d(0, -5)))
    ref_events("r-arjun", [
        (None, "CREATED", "u-chcdr", "CHC_DOCTOR", d(0, -6), "Escalated to district hospital"),
        ("CREATED", "SENT", "u-chcdr", "CHC_DOCTOR", d(0, -5.9), "Dispatched"),
        ("SENT", "ACKNOWLEDGED", "u-specialist", "SPECIALIST", d(0, -5), "Cardiology slot held"),
    ], "F-DH-01")

    db.add(Referral(id="r-kavita", code="REF-2026-00005", patient_id="p-03",
                    from_facility_id="F-PHC-01", to_facility_id="F-DH-01", created_by_id="u-phcdr",
                    reason="High-risk pregnancy — specialist review", priority=Priority.PRIORITY,
                    status=ReferralStatus.COMPLETED, outcome="UNDER_SPECIALIST_CARE",
                    expected_date=date.today() - timedelta(days=5), version=8,
                    completed_at=d(-4, 5), created_at=d(-5), updated_at=d(-4, 5)))
    ref_events("r-kavita", [
        (None, "CREATED", "u-phcdr", "PHC_DOCTOR", d(-5), "Created"),
        ("CREATED", "SENT", "u-phcdr", "PHC_DOCTOR", d(-5, 0.1), "Sent"),
        ("SENT", "ACKNOWLEDGED", "u-specialist", "SPECIALIST", d(-5, 2), "Acknowledged"),
        ("ACKNOWLEDGED", "ACCEPTED", "u-specialist", "SPECIALIST", d(-5, 3), "Accepted"),
        ("ACCEPTED", "ARRIVED", "u-asha", "ASHA", d(-4, 1), "Arrived"),
        ("ARRIVED", "IN_CONSULTATION", "u-specialist", "SPECIALIST", d(-4, 2), "Consultation"),
        ("IN_CONSULTATION", "TREATMENT", "u-specialist", "SPECIALIST", d(-4, 4), "Treatment"),
        ("TREATMENT", "COMPLETED", "u-specialist", "SPECIALIST", d(-4, 5), "Completed"),
    ], "F-DH-01")

    db.add(FollowUp(id="f-ramesh-over", patient_id="p-02", referral_id="r-ramesh",
                    scheduled_date=date.today() - timedelta(days=2),
                    notes="Diabetic foot review — patient missed visit", assignee_role="ASHA"))

    # ------------------------------------------------------------ appointments
    db.add(Appointment(patient_id="p-06", facility_id="F-PHC-01", doctor_id="u-phcdr",
                       date=date.today(), time="09:30", purpose="Antenatal check",
                       appointment_type=AppointmentType.OPD, status=AppointmentStatus.IN_QUEUE, queue_pos=1))
    db.add(Appointment(patient_id="p-07", facility_id="F-PHC-01", doctor_id="u-phcdr",
                       date=date.today(), time="10:00", purpose="Fever",
                       appointment_type=AppointmentType.OPD, status=AppointmentStatus.SCHEDULED, queue_pos=2))
    db.add(Appointment(patient_id="p-sita", facility_id="F-CHC-01", doctor_id="u-chcdr",
                       date=date.today(), time="11:00", purpose="Referred case review",
                       appointment_type=AppointmentType.FOLLOWUP, status=AppointmentStatus.SCHEDULED, queue_pos=1))

    # ----------------------------------------------------------- notifications
    db.add_all([
        Notification(user_id="u-chcdr", patient_id="p-sita", kind=NotificationKind.warning,
                     channel=NotificationChannel.IN_APP, title="Incoming referral REF-2026-00001 — URGENT",
                     body="Sita Devi referred from Demapur PHC. Persistent fever with low SpO₂.",
                     ref_kind="referral", ref_id="r-sita-1", link="/app/referrals/r-sita-1", delivered=True),
        Notification(user_id="u-asha", patient_id="p-sita", kind=NotificationKind.info,
                     channel=NotificationChannel.IN_APP, title="Follow-up due — Sita Devi",
                     body=f"BP review due {date.today() + timedelta(days=6).isoformat()}.",
                     ref_kind="followup", ref_id="f-sita-1", link="/app/followups", delivered=True),
        Notification(user_id="u-patient", kind=NotificationKind.info,
                     channel=NotificationChannel.IN_APP, title="Appointment booked",
                     body=f"Referred case review at Shirur CHC today 11:00.",
                     ref_kind="appointment", link="/app/appointments", delivered=True),
    ])

    db.add(AuditLog(actor_id="system", actor_name="system", actor_role="SYSTEM", action="SEED",
                    resource_kind="database", detail={"note": "deterministic demo seed"}))

    db.commit()
    print("[seed] RAKSHA demo data ready.")
    print("[seed] Login demo accounts (password: raksha123):")
    for u in ("patient", "asha", "anm", "phc.staff", "phc.doctor", "chc.doctor", "specialist", "admin"):
        print(f"        {u}@raksha.demo")


if __name__ == "__main__":
    main()
