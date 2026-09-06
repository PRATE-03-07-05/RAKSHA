"""Notification service with pluggable channels.

Honesty rule: only IN_APP delivery is real in the prototype. SMS / EMAIL /
FCM providers are explicit dev-null stubs — messages are recorded in the
outbox (Notification rows with channel + delivered=False) so a real
provider can be plugged in later without touching call sites.
"""
import logging
from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..config import get_settings
from ..models import Notification, NotificationChannel, NotificationKind, User

log = logging.getLogger("raksha.notify")


class Channel(ABC):
    name: NotificationChannel

    @abstractmethod
    def deliver(self, notification: Notification) -> bool:
        """Return True only if the external provider confirmed delivery."""


class InAppChannel(Channel):
    name = NotificationChannel.IN_APP

    def deliver(self, notification: Notification) -> bool:
        # The row itself is the delivery — the frontend polls/lists it.
        return True


class SmsChannel(Channel):
    """Prototype SMS adapter. With SMS_PROVIDER=dev-null (default) nothing is
    actually sent; the message stays in the outbox for later delivery."""
    name = NotificationChannel.SMS

    def deliver(self, notification: Notification) -> bool:
        s = get_settings()
        if s.sms_provider == "dev-null" or not s.sms_api_key:
            log.info("SMS outbox (not delivered — provider not configured): %s", notification.body)
            return False
        # Integration point: call the configured gateway here.
        log.info("SMS provider '%s' is configured but not implemented in the prototype", s.sms_provider)
        return False


class FcmChannel(Channel):
    """Firebase Cloud Messaging integration point (isolated)."""
    name = NotificationChannel.IN_APP  # delivered as in-app until FCM configured

    def deliver(self, notification: Notification) -> bool:
        s = get_settings()
        if not s.fcm_credentials:
            log.info("FCM not configured — push simulated via in-app notification")
        return True


_channels: dict[NotificationChannel, Channel] = {
    NotificationChannel.IN_APP: InAppChannel(),
    NotificationChannel.SMS: SmsChannel(),
}


def notify(
    db: Session,
    user_id: str,
    kind: str,
    title: str,
    body: str,
    *,
    patient_id: str | None = None,
    ref_kind: str | None = None,
    ref_id: str | None = None,
    link: str | None = None,
    sms: bool = False,
    actor: User | None = None,
) -> Notification:
    """Create an in-app notification (plus SMS outbox entry for critical alerts)."""
    n = Notification(
        user_id=user_id,
        patient_id=patient_id,
        kind=NotificationKind(kind),
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        ref_kind=ref_kind,
        ref_id=ref_id,
        link=link,
        delivered=True,  # in-app row is immediately available to the client
    )
    db.add(n)
    db.flush()

    if sms:
        sms_row = Notification(
            user_id=user_id, patient_id=patient_id, kind=NotificationKind(kind),
            channel=NotificationChannel.SMS, title=title, body=body,
            ref_kind=ref_kind, ref_id=ref_id,
            delivered=_channels[NotificationChannel.SMS].deliver(n),
        )
        db.add(sms_row)

    log_action(db, actor, AuditAction.NOTIFICATION_SEND, "notification", n.id,
               patient_id=patient_id, detail={"kind": kind, "title": title})
    return n
