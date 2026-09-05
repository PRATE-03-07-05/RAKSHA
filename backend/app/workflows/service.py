from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from backend.app.audit.service import AuditEvent, AuditSink
from backend.app.db.enums import AppointmentStatus, CarePlanStatus, FollowUpStatus, ReferralStatus
from backend.app.workflows.rules import ALLOWED_TRANSITIONS, STATUS_ENUM_BY_WORKFLOW, WorkflowType


class WorkflowTransitionError(ValueError):
    pass


@dataclass(frozen=True)
class WorkflowTransitionResult:
    workflow_type: WorkflowType
    entity_id: uuid.UUID
    from_status: Enum
    to_status: Enum
    actor_user_id: uuid.UUID
    reason: str | None
    occurred_at: datetime


def _coerce_workflow_type(workflow_type: WorkflowType | str) -> WorkflowType:
    try:
        return workflow_type if isinstance(workflow_type, WorkflowType) else WorkflowType(workflow_type)
    except ValueError as exc:
        raise WorkflowTransitionError(f"Unsupported workflow type: {workflow_type}") from exc


def _coerce_status(workflow_type: WorkflowType, status: Enum | str) -> Enum:
    status_enum = STATUS_ENUM_BY_WORKFLOW[workflow_type]
    try:
        return status if isinstance(status, status_enum) else status_enum(str(status))
    except ValueError as exc:
        raise WorkflowTransitionError(f"Unsupported {workflow_type.value} status: {status}") from exc


def _set_if_present(record: Any, field_name: str, value: datetime) -> None:
    if hasattr(record, field_name) and getattr(record, field_name) is None:
        setattr(record, field_name, value)


def _apply_lifecycle_timestamps(record: Any, workflow_type: WorkflowType, target_status: Enum, occurred_at: datetime) -> None:
    if workflow_type == WorkflowType.REFERRAL:
        if target_status == ReferralStatus.COMPLETED:
            _set_if_present(record, "completed_at", occurred_at)
        elif target_status == ReferralStatus.CANCELLED:
            _set_if_present(record, "cancelled_at", occurred_at)

    if workflow_type == WorkflowType.APPOINTMENT:
        if target_status == AppointmentStatus.CHECKED_IN:
            _set_if_present(record, "checked_in_at", occurred_at)

    if workflow_type == WorkflowType.FOLLOW_UP:
        if target_status == FollowUpStatus.COMPLETED:
            _set_if_present(record, "completed_at", occurred_at)

    if workflow_type == WorkflowType.CARE_PLAN:
        if target_status == CarePlanStatus.COMPLETED:
            _set_if_present(record, "completed_at", occurred_at)


class WorkflowTransitionService:
    def __init__(self, audit_sink: AuditSink):
        self.audit_sink = audit_sink

    def transition(
        self,
        *,
        record: Any,
        workflow_type: WorkflowType | str,
        target_status: Enum | str,
        actor_user_id: uuid.UUID,
        reason: str | None = None,
        occurred_at: datetime | None = None,
    ) -> WorkflowTransitionResult:
        normalized_workflow_type = _coerce_workflow_type(workflow_type)
        source_status = _coerce_status(normalized_workflow_type, getattr(record, "status"))
        normalized_target_status = _coerce_status(normalized_workflow_type, target_status)

        if source_status == normalized_target_status:
            raise WorkflowTransitionError(
                f"{normalized_workflow_type.value} is already in status {normalized_target_status.value}."
            )

        allowed_targets = ALLOWED_TRANSITIONS[normalized_workflow_type][source_status]
        if normalized_target_status not in allowed_targets:
            raise WorkflowTransitionError(
                (
                    f"Invalid {normalized_workflow_type.value} transition "
                    f"from {source_status.value} to {normalized_target_status.value}."
                )
            )

        transition_time = occurred_at or datetime.now(timezone.utc)
        setattr(record, "status", normalized_target_status)
        _apply_lifecycle_timestamps(record, normalized_workflow_type, normalized_target_status, transition_time)

        entity_id = getattr(record, "id")
        patient_id = getattr(record, "patient_id", None)
        self.audit_sink.record(
            AuditEvent(
                action="WORKFLOW_TRANSITION",
                actor_user_id=actor_user_id,
                patient_id=patient_id,
                entity_type=normalized_workflow_type.value,
                entity_id=entity_id,
                access_reason="workflow_transition",
                details={
                    "from_status": source_status.value,
                    "to_status": normalized_target_status.value,
                    "reason": reason,
                },
            )
        )

        return WorkflowTransitionResult(
            workflow_type=normalized_workflow_type,
            entity_id=entity_id,
            from_status=source_status,
            to_status=normalized_target_status,
            actor_user_id=actor_user_id,
            reason=reason,
            occurred_at=transition_time,
        )

