import unittest

from sqlalchemy import CheckConstraint
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from backend.app.db.base import Base
from backend.app.db import models  # noqa: F401
from backend.app.db.enums import (
    AppointmentStatus,
    FollowUpStatus,
    ReferralStatus,
    SyncStatus,
)


class DatabaseModelContractTest(unittest.TestCase):
    def test_canonical_status_values_match_specification(self) -> None:
        self.assertEqual(
            [status.value for status in ReferralStatus],
            [
                "CREATED",
                "ACCEPTED",
                "APPOINTMENT_PENDING",
                "APPOINTMENT_BOOKED",
                "PATIENT_NOTIFIED",
                "PATIENT_ARRIVED",
                "CONSULTATION_COMPLETED",
                "REFERRED_BACK",
                "COMPLETED",
                "CANCELLED",
                "EXPIRED",
            ],
        )
        self.assertEqual(
            [status.value for status in AppointmentStatus],
            [
                "REQUESTED",
                "CONFIRMED",
                "CHECKED_IN",
                "IN_QUEUE",
                "IN_CONSULTATION",
                "COMPLETED",
                "CANCELLED",
                "NO_SHOW",
            ],
        )
        self.assertEqual(
            [status.value for status in FollowUpStatus],
            [
                "PENDING",
                "CONTACT_ATTEMPTED",
                "COMPLETED",
                "MISSED",
                "ESCALATED",
                "CANCELLED",
            ],
        )
        self.assertEqual(
            [status.value for status in SyncStatus],
            ["PENDING", "SYNCING", "SYNCED", "FAILED", "CONFLICT"],
        )

    def test_expected_normalized_tables_exist(self) -> None:
        expected_tables = {
            "users",
            "organizations",
            "patients",
            "practitioner_profiles",
            "consents",
            "encounters",
            "symptom_reports",
            "observations",
            "triage_assessments",
            "appointments",
            "consultations",
            "diagnostic_requests",
            "diagnostic_reports",
            "medication_requests",
            "referrals",
            "care_plans",
            "follow_ups",
            "audit_logs",
            "sync_records",
        }

        self.assertEqual(set(Base.metadata.tables), expected_tables)

    def test_clinical_history_is_not_collapsed_into_patient_table(self) -> None:
        patient_columns = set(Base.metadata.tables["patients"].columns.keys())

        self.assertNotIn("symptoms", patient_columns)
        self.assertNotIn("vitals", patient_columns)
        self.assertNotIn("diagnosis", patient_columns)

        for table_name in [
            "symptom_reports",
            "observations",
            "triage_assessments",
            "consultations",
            "diagnostic_requests",
            "diagnostic_reports",
            "medication_requests",
            "referrals",
            "care_plans",
            "follow_ups",
        ]:
            self.assertIn("patient_id", Base.metadata.tables[table_name].columns)

    def test_core_tables_have_foreign_keys_and_indexes(self) -> None:
        referrals = Base.metadata.tables["referrals"]
        appointments = Base.metadata.tables["appointments"]
        audit_logs = Base.metadata.tables["audit_logs"]

        self.assertGreaterEqual(len(referrals.foreign_keys), 5)
        self.assertGreaterEqual(len(appointments.foreign_keys), 3)
        self.assertGreaterEqual(len(audit_logs.indexes), 3)

    def test_status_constraints_compile_for_postgresql(self) -> None:
        ddl = "\n".join(
            str(CreateTable(table).compile(dialect=postgresql.dialect()))
            for table in Base.metadata.sorted_tables
        )

        for status in ReferralStatus:
            self.assertIn(status.value, ddl)
        for status in AppointmentStatus:
            self.assertIn(status.value, ddl)
        for status in FollowUpStatus:
            self.assertIn(status.value, ddl)

    def test_ai_triage_results_require_human_review(self) -> None:
        triage_table = Base.metadata.tables["triage_assessments"]
        check_constraints = "\n".join(
            str(constraint.sqltext)
            for constraint in triage_table.constraints
            if isinstance(constraint, CheckConstraint)
        )

        self.assertIn("human_review_required = true", check_constraints)
        self.assertIn(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            check_constraints,
        )


if __name__ == "__main__":
    unittest.main()
