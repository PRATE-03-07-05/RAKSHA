from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.db.enums import UserRole
from backend.app.db.models import User


@dataclass(frozen=True)
class UserRecord:
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    password_hash: str
    is_active: bool


class UserRepository(Protocol):
    def get_by_email(self, email: str) -> UserRecord | None:
        pass

    def get_by_id(self, user_id: uuid.UUID) -> UserRecord | None:
        pass

    def list_users(self) -> list[UserRecord]:
        pass


def _to_user_record(user: User) -> UserRecord:
    role = user.role if isinstance(user.role, UserRole) else UserRole(str(user.role))
    return UserRecord(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=role,
        password_hash=user.password_hash,
        is_active=user.is_active,
    )


class SqlAlchemyUserRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_email(self, email: str) -> UserRecord | None:
        statement = select(User).where(func.lower(User.email) == email.lower())
        user = self.session.execute(statement).scalar_one_or_none()
        return _to_user_record(user) if user else None

    def get_by_id(self, user_id: uuid.UUID) -> UserRecord | None:
        user = self.session.get(User, user_id)
        return _to_user_record(user) if user else None

    def list_users(self) -> list[UserRecord]:
        statement = select(User).order_by(User.full_name)
        return [_to_user_record(user) for user in self.session.execute(statement).scalars().all()]

