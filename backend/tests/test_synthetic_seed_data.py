import json
import unittest
from pathlib import Path
from uuid import UUID

from backend.app.db.enums import AppointmentStatus, FollowUpStatus, ReferralStatus, SyncStatus


SEED_PATH = Path(__file__).resolve().parents[1] / "seeds" / "synthetic_demo.json"


class SyntheticSeedDataTest(unittest.TestCase):
    def test_seed_data_is_clearly_synthetic(self) -> None:
        payload = json.loads(SEED_PATH.read_text(encoding="utf-8"))

        self.assertIn("SYNTHETIC", payload["label"])
        self.assertTrue(payload["patient"]["synthetic_label"])
        self.assertIn("not clinical validation", payload["clinical_safety_note"].lower())

    def test_demo_identifiers_are_valid_uuids(self) -> None:
        payload = json.loads(SEED_PATH.read_text(encoding="utf-8"))

        UUID(payload["patient"]["id"])
        for organization in payload["organizations"]:
            UUID(organization["id"])
        for identifier in payload["journey_ids"].values():
            UUID(identifier)

    def test_seed_status_values_match_canonical_statuses(self) -> None:
        payload = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        statuses = payload["initial_statuses"]

        self.assertIn(statuses["appointment"], [status.value for status in AppointmentStatus])
        self.assertIn(statuses["referral"], [status.value for status in ReferralStatus])
        self.assertIn(statuses["follow_up"], [status.value for status in FollowUpStatus])
        self.assertIn(statuses["sync"], [status.value for status in SyncStatus])


if __name__ == "__main__":
    unittest.main()

