import unittest
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from backend.app.audit.service import InMemoryAuditSink
from backend.app.db.enums import AppointmentStatus, CarePlanStatus, FollowUpStatus, ReferralStatus
from backend.app.workflows.rules import ALLOWED_TRANSITIONS, WorkflowType
from backend.app.workflows.service import WorkflowTransitionError, WorkflowTransitionService


@dataclass
class WorkflowRecord:
    id: uuid.UUID
    patient_id: uuid.UUID
    status: object
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    checked_in_at: datetime | None = None


class WorkflowTransitionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.audit_sink = InMemoryAuditSink()
        self.service = WorkflowTransitionService(self.audit_sink)
        self.actor_user_id = uuid.UUID("00000000-0000-4000-8000-000000000902")
        self.patient_id = uuid.UUID("00000000-0000-4000-8000-000000000001")

    def make_record(self, status: object) -> WorkflowRecord:
        return WorkflowRecord(
            id=uuid.uuid4(),
            patient_id=self.patient_id,
            status=status,
        )

    def test_referral_happy_path_reaches_completion(self) -> None:
        record = self.make_record(ReferralStatus.CREATED)
        path = [
            ReferralStatus.ACCEPTED,
            ReferralStatus.APPOINTMENT_PENDING,
            ReferralStatus.APPOINTMENT_BOOKED,
            ReferralStatus.PATIENT_NOTIFIED,
            ReferralStatus.PATIENT_ARRIVED,
            ReferralStatus.CONSULTATION_COMPLETED,
            ReferralStatus.REFERRED_BACK,
            ReferralStatus.COMPLETED,
        ]

        for next_status in path:
            self.service.transition(
                record=record,
                workflow_type=WorkflowType.REFERRAL,
                target_status=next_status,
                actor_user_id=self.actor_user_id,
                reason="synthetic demo progression",
            )

        self.assertEqual(record.status, ReferralStatus.COMPLETED)
        self.assertIsNotNone(record.completed_at)
        self.assertEqual(len(self.audit_sink.events), len(path))
        self.assertEqual(self.audit_sink.events[-1].details["to_status"], "COMPLETED")

    def test_referral_rejects_invalid_skip_to_completed(self) -> None:
        record = self.make_record(ReferralStatus.CREATED)

        with self.assertRaises(WorkflowTransitionError):
            self.service.transition(
                record=record,
                workflow_type=WorkflowType.REFERRAL,
                target_status=ReferralStatus.COMPLETED,
                actor_user_id=self.actor_user_id,
            )

        self.assertEqual(record.status, ReferralStatus.CREATED)
        self.assertEqual(self.audit_sink.events, [])

    def test_terminal_referral_status_blocks_further_transitions(self) -> None:
        record = self.make_record(ReferralStatus.CANCELLED)

        with self.assertRaises(WorkflowTransitionError):
            self.service.transition(
                record=record,
                workflow_type=WorkflowType.REFERRAL,
                target_status=ReferralStatus.ACCEPTED,
                actor_user_id=self.actor_user_id,
            )

    def test_appointment_queue_progression(self) -> None:
        record = self.make_record(AppointmentStatus.REQUESTED)
        check_in_time = datetime(2026, 9, 4, 10, 30, tzinfo=timezone.utc)

        self.service.transition(
            record=record,
            workflow_type=WorkflowType.APPOINTMENT,
            target_status=AppointmentStatus.CONFIRMED,
            actor_user_id=self.actor_user_id,
        )
        self.service.transition(
            record=record,
            workflow_type=WorkflowType.APPOINTMENT,
            target_status=AppointmentStatus.CHECKED_IN,
            actor_user_id=self.actor_user_id,
            occurred_at=check_in_time,
        )
        self.service.transition(
            record=record,
            workflow_type=WorkflowType.APPOINTMENT,
            target_status=AppointmentStatus.IN_QUEUE,
            actor_user_id=self.actor_user_id,
        )
        self.service.transition(
            record=record,
            workflow_type=WorkflowType.APPOINTMENT,
            target_status=AppointmentStatus.IN_CONSULTATION,
            actor_user_id=self.actor_user_id,
        )

        self.assertEqual(record.status, AppointmentStatus.IN_CONSULTATION)
        self.assertEqual(record.checked_in_at, check_in_time)

    def test_appointment_rejects_consultation_without_queue(self) -> None:
        record = self.make_record(AppointmentStatus.CONFIRMED)

        with self.assertRaises(WorkflowTransitionError):
            self.service.transition(
                record=record,
                workflow_type=WorkflowType.APPOINTMENT,
                target_status=AppointmentStatus.IN_CONSULTATION,
                actor_user_id=self.actor_user_id,
            )

    def test_follow_up_can_be_attempted_then_completed(self) -> None:
        record = self.make_record(FollowUpStatus.PENDING)

        self.service.transition(
            record=record,
            workflow_type=WorkflowType.FOLLOW_UP,
            target_status=FollowUpStatus.CONTACT_ATTEMPTED,
            actor_user_id=self.actor_user_id,
        )
        self.service.transition(
            record=record,
            workflow_type=WorkflowType.FOLLOW_UP,
            target_status=FollowUpStatus.COMPLETED,
            actor_user_id=self.actor_user_id,
        )

        self.assertEqual(record.status, FollowUpStatus.COMPLETED)
        self.assertIsNotNone(record.completed_at)

    def test_care_plan_can_be_completed_or_cancelled_only_from_active(self) -> None:
        record = self.make_record(CarePlanStatus.ACTIVE)

        self.service.transition(
            record=record,
            workflow_type=WorkflowType.CARE_PLAN,
            target_status=CarePlanStatus.COMPLETED,
            actor_user_id=self.actor_user_id,
        )

        with self.assertRaises(WorkflowTransitionError):
            self.service.transition(
                record=record,
                workflow_type=WorkflowType.CARE_PLAN,
                target_status=CarePlanStatus.CANCELLED,
                actor_user_id=self.actor_user_id,
            )

    def test_string_statuses_are_supported_for_database_loaded_records(self) -> None:
        record = self.make_record("CREATED")

        result = self.service.transition(
            record=record,
            workflow_type="referrals",
            target_status="ACCEPTED",
            actor_user_id=self.actor_user_id,
        )

        self.assertEqual(result.from_status, ReferralStatus.CREATED)
        self.assertEqual(result.to_status, ReferralStatus.ACCEPTED)
        self.assertEqual(record.status, ReferralStatus.ACCEPTED)

    def test_transition_rules_cover_every_canonical_status(self) -> None:
        self.assertEqual(set(ALLOWED_TRANSITIONS[WorkflowType.REFERRAL]), set(ReferralStatus))
        self.assertEqual(set(ALLOWED_TRANSITIONS[WorkflowType.APPOINTMENT]), set(AppointmentStatus))
        self.assertEqual(set(ALLOWED_TRANSITIONS[WorkflowType.FOLLOW_UP]), set(FollowUpStatus))
        self.assertEqual(set(ALLOWED_TRANSITIONS[WorkflowType.CARE_PLAN]), set(CarePlanStatus))

    def test_audit_event_records_transition_context(self) -> None:
        record = self.make_record(ReferralStatus.CREATED)

        self.service.transition(
            record=record,
            workflow_type=WorkflowType.REFERRAL,
            target_status=ReferralStatus.ACCEPTED,
            actor_user_id=self.actor_user_id,
            reason="destination facility accepted referral",
        )

        event = self.audit_sink.events[-1]
        self.assertEqual(event.action, "WORKFLOW_TRANSITION")
        self.assertEqual(event.actor_user_id, self.actor_user_id)
        self.assertEqual(event.patient_id, self.patient_id)
        self.assertEqual(event.entity_type, "referrals")
        self.assertEqual(event.entity_id, record.id)
        self.assertEqual(event.details["from_status"], "CREATED")
        self.assertEqual(event.details["to_status"], "ACCEPTED")


if __name__ == "__main__":
    unittest.main()

