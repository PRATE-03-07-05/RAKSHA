"""Central environment configuration.

All secrets and tunables come from environment variables (see .env.example).
Triage thresholds are configurable here so rules are never hardcoded in
route handlers or frontend files.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core
    app_name: str = "RAKSHA API"
    environment: str = "development"

    # Database (PostgreSQL)
    database_url: str = "postgresql+psycopg2://raksha:raksha@localhost:5432/raksha"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720  # 12h

    # CORS — comma separated; never rely on "*" in production
    cors_origins: str = "http://localhost:5173,http://localhost:4173"

    # RAKSHA Patient ID
    patient_id_prefix: str = "RAK-PAT-2026"

    # Rule-based triage thresholds (decision support only)
    triage_spo2_critical: int = 90
    triage_spo2_high: int = 93
    triage_temp_high: float = 38.5
    triage_temp_critical: float = 39.5
    triage_rr_high: int = 24
    triage_hr_high: int = 120
    triage_rule_version: str = "respiratory-v1.2"

    # Integration placeholders — dev-null providers until real credentials exist
    sms_provider: str = "dev-null"
    sms_api_key: str = ""
    email_provider: str = "dev-null"
    email_api_key: str = ""
    fcm_credentials: str = ""
    abdm_client_id: str = ""
    abdm_client_secret: str = ""
    fhir_base_url: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
