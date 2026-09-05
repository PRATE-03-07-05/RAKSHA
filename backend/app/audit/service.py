from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Protocol

from sqlalchemy.orm import Session

from backend.app.db.models import AuditLog


@dataclass(frozen=True)
class AuditEvent:
    action: str
    entity_type: str
    actor_user_id: uuid.UUID | None = None
    patient_id: uuid.UUID | None = None
    entity_id: uuid.UUID | None = None
    access_reason: str | None = None
    ip_address: str | None = None
    details: dict = field(default_factory=dict)


class AuditSink(Protocol):
    def record(self, event: AuditEvent) -> None:
        pass


class SqlAlchemyAuditSink:
    def __init__(self, session: Session):
        self.session = session

    def record(self, event: AuditEvent) -> None:
        self.session.add(
            AuditLog(
                actor_user_id=event.actor_user_id,
                patient_id=event.patient_id,
                action=event.action,
                entity_type=event.entity_type,
                entity_id=event.entity_id,
                access_reason=event.access_reason,
                ip_address=event.ip_address,
                event_metadata=event.details,
            )
        )
        self.session.commit()


class InMemoryAuditSink:
    def __init__(self):
        self.events: list[AuditEvent] = []

    def record(self, event: AuditEvent) -> None:
        self.events.append(event)

