import uuid

from pydantic import BaseModel, ConfigDict, Field

from backend.app.db.enums import UserRole


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=1, max_length=256)


class UserResponse(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: uuid.UUID
    email: str = Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    full_name: str
    role: UserRole
    is_active: bool


class TokenResponse(BaseModel):
    token_type: str = "bearer"
    access_token: str
    expires_in: int
    user: UserResponse


class UserListResponse(BaseModel):
    users: list[UserResponse]
