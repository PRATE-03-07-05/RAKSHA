import unittest
from pathlib import Path

from backend.app.db.enums import AppointmentStatus, FollowUpStatus, ReferralStatus, SyncStatus


MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "20260904_0001_initial_database_foundation.py"
)


class DatabaseMigrationContractTest(unittest.TestCase):
    def test_initial_migration_exists(self) -> None:
        self.assertTrue(MIGRATION_PATH.exists())

    def test_initial_migration_contains_required_tables(self) -> None:
        migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

        for table_name in [
            "patients",
            "consents",
            "encounters",
            "observations",
            "triage_assessments",
            "appointments",
            "referrals",
            "care_plans",
            "follow_ups",
            "audit_logs",
            "sync_records",
        ]:
            self.assertIn(f'"{table_name}"', migration_text)

    def test_initial_migration_contains_canonical_status_values(self) -> None:
        migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

        for enum_cls in [ReferralStatus, AppointmentStatus, FollowUpStatus, SyncStatus]:
            for status in enum_cls:
                self.assertIn(status.value, migration_text)


if __name__ == "__main__":
    unittest.main()

