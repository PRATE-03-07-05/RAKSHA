from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.api.errors import raise_api_error
from backend.app.audit.service import AuditSink, SqlAlchemyAuditSink
from backend.app.auth.repository import SqlAlchemyUserRepository, UserRecord, UserRepository
from backend.app.auth.tokens import TokenError, decode_access_token
from backend.app.db.enums import UserRole
from backend.app.db.session import get_session


bearer_scheme = HTTPBearer(auto_error=False)


def get_user_repository(session=Depends(get_session)) -> UserRepository:
    return SqlAlchemyUserRepository(session)


def get_audit_sink(session=Depends(get_session)) -> AuditSink:
    return SqlAlchemyAuditSink(session)


def get_client_ip(request: Request) -> str | None:
    if request.client is None:
        return None
    return request.client.host


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    user_repository: UserRepository = Depends(get_user_repository),
) -> UserRecord:
    if credentials is None:
        raise_api_error(
            status.HTTP_401_UNAUTHORIZED,
            "AUTH_REQUIRED",
            "Authentication is required.",
        )

    if credentials.scheme.lower() != "bearer":
        raise_api_error(
            status.HTTP_401_UNAUTHORIZED,
            "INVALID_AUTH_SCHEME",
            "Bearer authentication is required.",
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except TokenError:
        raise_api_error(
            status.HTTP_401_UNAUTHORIZED,
            "INVALID_TOKEN",
            "Access token is invalid or expired.",
        )

    user = user_repository.get_by_id(payload.subject)
    if user is None:
        raise_api_error(
            status.HTTP_401_UNAUTHORIZED,
            "INVALID_TOKEN_SUBJECT",
            "Access token subject is no longer valid.",
        )

    if not user.is_active:
        raise_api_error(
            status.HTTP_403_FORBIDDEN,
            "USER_INACTIVE",
            "User account is inactive.",
        )

    return user


def require_roles(*allowed_roles: UserRole) -> Callable[[UserRecord], UserRecord]:
    def dependency(current_user: UserRecord = Depends(get_current_user)) -> UserRecord:
        if current_user.role not in allowed_roles:
            raise_api_error(
                status.HTTP_403_FORBIDDEN,
                "INSUFFICIENT_ROLE",
                "This action is not allowed for the authenticated role.",
                {"allowed_roles": [role.value for role in allowed_roles]},
            )
        return current_user

    return dependency

