from fastapi import APIRouter, Depends, Request, status

from backend.app.api.errors import ErrorResponse, raise_api_error
from backend.app.audit.service import AuditEvent, AuditSink
from backend.app.auth.dependencies import get_audit_sink, get_client_ip, get_current_user, get_user_repository
from backend.app.auth.passwords import verify_password
from backend.app.auth.repository import UserRecord, UserRepository
from backend.app.auth.schemas import LoginRequest, TokenResponse, UserResponse
from backend.app.auth.tokens import issue_access_token
from backend.app.core.config import get_auth_settings


router = APIRouter(prefix="/auth", tags=["authentication"])


def to_user_response(user: UserRecord) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def login(
    payload: LoginRequest,
    request: Request,
    user_repository: UserRepository = Depends(get_user_repository),
    audit_sink: AuditSink = Depends(get_audit_sink),
) -> TokenResponse:
    user = user_repository.get_by_email(payload.email)
    client_ip = get_client_ip(request)

    if user is None or not verify_password(payload.password, user.password_hash):
        audit_sink.record(
            AuditEvent(
                action="AUTH_LOGIN_FAILED",
                entity_type="users",
                ip_address=client_ip,
                details={"email": payload.email},
            )
        )
        raise_api_error(
            status.HTTP_401_UNAUTHORIZED,
            "INVALID_CREDENTIALS",
            "Email or password is incorrect.",
        )

    if not user.is_active:
        audit_sink.record(
            AuditEvent(
                action="AUTH_LOGIN_INACTIVE_USER",
                actor_user_id=user.id,
                entity_type="users",
                entity_id=user.id,
                ip_address=client_ip,
            )
        )
        raise_api_error(
            status.HTTP_403_FORBIDDEN,
            "USER_INACTIVE",
            "User account is inactive.",
        )

    settings = get_auth_settings()
    access_token = issue_access_token(subject=user.id, role=user.role, settings=settings)
    audit_sink.record(
        AuditEvent(
            action="AUTH_LOGIN_SUCCEEDED",
            actor_user_id=user.id,
            entity_type="users",
            entity_id=user.id,
            ip_address=client_ip,
        )
    )

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_ttl_seconds,
        user=to_user_response(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
def read_current_user(current_user: UserRecord = Depends(get_current_user)) -> UserResponse:
    return to_user_response(current_user)

