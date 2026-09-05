import os
from dataclasses import dataclass


class ConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class AuthSettings:
    token_secret: str
    access_token_ttl_seconds: int
    issuer: str


def get_auth_settings() -> AuthSettings:
    token_secret = os.getenv("RAKSHA_TOKEN_SECRET")
    if not token_secret:
        raise ConfigurationError("RAKSHA_TOKEN_SECRET must be set before issuing or validating tokens.")

    ttl_minutes = int(os.getenv("RAKSHA_ACCESS_TOKEN_MINUTES", "30"))
    issuer = os.getenv("RAKSHA_TOKEN_ISSUER", "raksha-backend")

    return AuthSettings(
        token_secret=token_secret,
        access_token_ttl_seconds=ttl_minutes * 60,
        issuer=issuer,
    )

