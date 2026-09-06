"""initial RAKSHA schema — users, patients, facilities, longitudinal record
events, referrals + referral_events, followups, appointments,
teleconsultations, emergency_events, notifications, audit_logs,
sync_operations.

For the prototype the tables are created from the SQLAlchemy metadata so
models remain the single source of truth. Subsequent schema changes must
add proper incremental revisions.

Revision ID: 0001
Revises:
Create Date: 2026-01-10

"""
from typing import Sequence, Union

from alembic import op

from app import models  # noqa: F401
from app.database import Base

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
