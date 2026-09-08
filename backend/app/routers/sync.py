"""Offline-first synchronization endpoints.

The frontend's IndexedDB queue replays operations here. Client operation
ids make batches idempotent; append-only medical events merge cleanly;
entity updates use optimistic versions and surface conflicts instead of
overwriting.
"""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Role, SyncOperation, SyncStatus
from ..schemas import SyncBatchIn, SyncBatchOut, SyncStatusOut
from ..security import CLINICAL, FIELD_WORKERS, CurrentUser, require_roles
from ..services.sync import apply_batch

router = APIRouter(prefix="/sync", tags=["sync"])
DB = Annotated[Session, Depends(get_db)]


@router.post("/batch", response_model=SyncBatchOut,
             summary="Apply a batch of queued offline operations (idempotent)",
             dependencies=[Depends(require_roles(*FIELD_WORKERS, *CLINICAL, Role.DISTRICT_ADMIN))])
def sync_batch(body: SyncBatchIn, user: CurrentUser, db: DB):
    results, applied, conflicts, duplicates = apply_batch(db, user, body)
    db.commit()
    return SyncBatchOut(applied=applied, conflicts=conflicts, duplicates=duplicates, results=results)


@router.get("/status", response_model=SyncStatusOut, summary="Sync ledger status for the caller")
def sync_status(user: CurrentUser, db: DB):
    rows = db.execute(select(SyncOperation).where(SyncOperation.user_id == user.id)).scalars().all()
    pending = sum(1 for r in rows if r.status == SyncStatus.PENDING)
    applied = sum(1 for r in rows if r.status == SyncStatus.APPLIED)
    conflicts = sum(1 for r in rows if r.status == SyncStatus.CONFLICT)
    last = db.execute(select(func.max(SyncOperation.created_at))
                      .where(SyncOperation.user_id == user.id)).scalar()
    return SyncStatusOut(pending=pending, applied=applied, conflicts=conflicts, last_sync_at=last)
