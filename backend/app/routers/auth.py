"""Authentication: login + current user. JWT bearer everywhere else."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import AuditAction, log_action
from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, TokenResponse, UserOut
from ..security import create_access_token, get_current_user, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse,
             summary="Exchange email + password for a JWT bearer token")
def login(body: LoginRequest, request: Request, db: Annotated[Session, Depends(get_db)]):
    user = db.execute(select(User).where(User.email == body.email.lower())).scalar_one_or_none()
    ip = request.client.host if request.client else None

    # Generic message for all failures (bad email, bad password, disabled)
    # to avoid an account-validity oracle. Details go to audit log only.
    if user is None or not verify_password(body.password, user.password_hash) or not user.is_active:
        log_action(db, None, AuditAction.LOGIN_FAILED, "user", None,
                   detail={"email": body.email.lower()}, ip=ip)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    token = create_access_token(user.id, user.role.value)
    log_action(db, user, AuditAction.LOGIN, "user", user.id, ip=ip)
    db.commit()
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut, summary="Current authenticated user")
def me(user: Annotated[User, Depends(get_current_user)]):
    return user
