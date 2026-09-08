"""Canonical clinical queue endpoint — the single source of truth for the
Patient Queue UI (PHC Doctor, CHC Doctor, Specialist dashboards).

GET /clinical/queue authenticates via JWT, scopes by the authenticated
user's role/facility/specialty (never trusts frontend-provided scope),
queries PostgreSQL, applies the hybrid priority+aging algorithm in
services/queue.py, and returns the stable QueueResponse schema.

Queue-management prioritization only — not a clinically validated triage
device. Existing RAKSHA triage disclaimers remain authoritative.
"""
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import QueueItemOut, QueueResponse
from ..security import CLINICAL, CurrentUser, require_roles
from ..services import queue as svc

log = logging.getLogger("raksha.queue_api")

router = APIRouter(prefix="/clinical", tags=["clinical-queue"])
DB = Annotated[Session, Depends(get_db)]


@router.get("/queue", response_model=QueueResponse, summary="Role-aware clinical queue (canonical)",
            dependencies=[Depends(require_roles(*CLINICAL))],
            description="Deterministic priority queue from PostgreSQL. "
                        "Ordering: clinical priority, then waiting/arrival time, then stable id. "
                        "Bounded aging (60min→+1 class, max 1) never overtakes CRITICAL.")
def get_queue(user: CurrentUser, db: DB,
              status: str | None = Query(None, pattern="^(WAITING|IN_PROGRESS|COMPLETED|CANCELLED)$"),
              priority: str | None = Query(None, pattern="^(CRITICAL|HIGH|MEDIUM|LOW)$"),
              limit: int = Query(50, ge=1, le=200),
              offset: int = Query(0, ge=0),
              include_completed: bool = Query(False)):
    items, total = svc.build_queue(
        db, user, status=status, priority=priority,
        limit=limit, offset=offset, include_completed=include_completed)
    log.info("GET /clinical/queue user=%s role=%s facility=%s rows=%s",
             user.id, user.role.value, user.facility_id, len(items))
    return QueueResponse(
        items=[QueueItemOut.model_validate(i) for i in items],
        total=total, limit=limit, offset=offset,
        generated_at=datetime.now(timezone.utc),
        facility_id=user.facility_id, role=user.role.value)
