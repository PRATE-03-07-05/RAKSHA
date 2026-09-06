"""Authentication primitives: bcrypt hashing, JWT issuing/validation,
and FastAPI dependencies for RBAC.

Server-side authorization is enforced here and in service functions —
frontend role checks are UX only, never security.
"""
from datetime import datetime, timedelta, timezone
from typing import Annotated, Callable

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import Role, User

settings = get_settings()
_bearer = HTTPBearer(auto_error=False)


# ------------------------------------------------------------------ hashing

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# ---------------------------------------------------------------------- JWT

def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Raises jwt.ExpiredSignatureError / jwt.InvalidTokenError."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


# -------------------------------------------------------------- dependencies

async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token payload")

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or disabled")
    request.state.actor = user
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: Role) -> Callable[..., User]:
    """Dependency factory: restrict an endpoint to the given roles."""
    allowed = set(roles)

    def _check(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Role {user.role.value} is not permitted for this action",
            )
        return user

    return _check


# Convenience role sets used across routers
FIELD_WORKERS = (Role.ASHA, Role.ANM, Role.PHC_STAFF)
CLINICAL = (Role.PHC_DOCTOR, Role.CHC_DOCTOR, Role.SPECIALIST)
STAFF_OR_ADMIN = FIELD_WORKERS + CLINICAL + (Role.DISTRICT_ADMIN,)
