from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass
from typing import Any

from backend.app.core.config import AuthSettings, get_auth_settings
from backend.app.db.enums import UserRole


TOKEN_PREFIX = "raksha.v1"


class TokenError(ValueError):
    pass


@dataclass(frozen=True)
class TokenPayload:
    subject: uuid.UUID
    role: UserRole
    expires_at: int
    issued_at: int
    issuer: str
    token_id: str


def _encode_json(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_json(segment: str) -> dict[str, Any]:
    padding = "=" * (-len(segment) % 4)
    try:
        raw = base64.urlsafe_b64decode(segment + padding)
        decoded = json.loads(raw)
    except (ValueError, json.JSONDecodeError) as exc:
        raise TokenError("Token payload is invalid.") from exc
    if not isinstance(decoded, dict):
        raise TokenError("Token payload must be an object.")
    return decoded


def _sign(payload_segment: str, settings: AuthSettings) -> str:
    digest = hmac.new(
        settings.token_secret.encode("utf-8"),
        payload_segment.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def issue_access_token(
    *,
    subject: uuid.UUID,
    role: UserRole,
    settings: AuthSettings | None = None,
    now: int | None = None,
) -> str:
    token_settings = settings or get_auth_settings()
    issued_at = int(now or time.time())
    expires_at = issued_at + token_settings.access_token_ttl_seconds
    payload_segment = _encode_json(
        {
            "sub": str(subject),
            "role": role.value,
            "iat": issued_at,
            "exp": expires_at,
            "iss": token_settings.issuer,
            "jti": str(uuid.uuid4()),
        }
    )
    signature = _sign(payload_segment, token_settings)
    return f"{TOKEN_PREFIX}.{payload_segment}.{signature}"


def decode_access_token(
    token: str,
    *,
    settings: AuthSettings | None = None,
    now: int | None = None,
) -> TokenPayload:
    token_settings = settings or get_auth_settings()
    try:
        prefix, version, payload_segment, signature = token.split(".", 3)
    except ValueError as exc:
        raise TokenError("Token structure is invalid.") from exc

    if f"{prefix}.{version}" != TOKEN_PREFIX:
        raise TokenError("Token prefix is invalid.")

    expected_signature = _sign(payload_segment, token_settings)
    if not hmac.compare_digest(signature, expected_signature):
        raise TokenError("Token signature is invalid.")

    payload = _decode_json(payload_segment)
    current_time = int(now or time.time())

    try:
        expires_at = int(payload["exp"])
        issued_at = int(payload["iat"])
        subject = uuid.UUID(str(payload["sub"]))
        role = UserRole(str(payload["role"]))
        issuer = str(payload["iss"])
        token_id = str(payload["jti"])
    except (KeyError, TypeError, ValueError) as exc:
        raise TokenError("Token claims are invalid.") from exc

    if issuer != token_settings.issuer:
        raise TokenError("Token issuer is invalid.")
    if expires_at <= current_time:
        raise TokenError("Token has expired.")

    return TokenPayload(
        subject=subject,
        role=role,
        expires_at=expires_at,
        issued_at=issued_at,
        issuer=issuer,
        token_id=token_id,
    )

