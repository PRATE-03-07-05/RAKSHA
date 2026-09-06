"""In-app notifications (plus SMS/EMAIL outbox rows from the channel layer)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Notification
from ..schemas import NotificationOut
from ..security import CurrentUser

router = APIRouter(prefix="/notifications", tags=["notifications"])
DB = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[NotificationOut], summary="My notifications (newest first)")
def list_notifications(user: CurrentUser, db: DB):
    rows = db.execute(
        select(Notification)
        .where(Notification.user_id == user.id, Notification.channel == "IN_APP")
        .order_by(Notification.created_at.desc())
        .limit(60)
    ).scalars().all()
    return [NotificationOut.model_validate(n) for n in rows]


@router.patch("/{notification_id}/read", response_model=NotificationOut, summary="Mark one as read")
def mark_read(notification_id: str, user: CurrentUser, db: DB):
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    n.read = True
    db.commit()
    db.refresh(n)
    return n


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT, summary="Mark all as read")
def mark_all_read(user: CurrentUser, db: DB):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(read=True))
    db.commit()
