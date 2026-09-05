from fastapi import APIRouter, Depends, Request

from backend.app.api.errors import ErrorResponse
from backend.app.audit.service import AuditEvent, AuditSink
from backend.app.auth.dependencies import (
    get_audit_sink,
    get_client_ip,
    get_user_repository,
    require_roles,
)
from backend.app.auth.repository import UserRecord, UserRepository
from backend.app.auth.schemas import UserListResponse
from backend.app.api.routes.auth import to_user_response
from backend.app.db.enums import UserRole


router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "",
    response_model=UserListResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
def list_users(
    request: Request,
    current_user: UserRecord = Depends(require_roles(UserRole.ADMIN)),
    user_repository: UserRepository = Depends(get_user_repository),
    audit_sink: AuditSink = Depends(get_audit_sink),
) -> UserListResponse:
    audit_sink.record(
        AuditEvent(
            action="USER_LIST_ACCESSED",
            actor_user_id=current_user.id,
            entity_type="users",
            ip_address=get_client_ip(request),
            access_reason="admin_user_management",
        )
    )
    return UserListResponse(users=[to_user_response(user) for user in user_repository.list_users()])

