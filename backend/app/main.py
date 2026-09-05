from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict

from backend.app.api.errors import ErrorResponse, install_error_handlers
from backend.app.api.routes import auth, triage, users


APP_VERSION = "0.1.0"


class HealthResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "service": "raksha-backend",
                "status": "ok",
                "version": APP_VERSION,
                "docs_ready": True,
            }
        }
    )

    service: Literal["raksha-backend"]
    status: Literal["ok"]
    version: str
    docs_ready: bool


app = FastAPI(
    title="RAKSHA API",
    version=APP_VERSION,
    description=(
        "Backend API for RAKSHA, an AI-enabled healthcare access and "
        "care-coordination platform. Current implementation exposes only "
        "foundational system endpoints."
    ),
)
install_error_handlers(app)
app.include_router(auth.router)
app.include_router(triage.router)
app.include_router(users.router)


@app.get("/health", response_model=HealthResponse, tags=["system"], responses={500: {"model": ErrorResponse}})
def health() -> HealthResponse:
    return HealthResponse(
        service="raksha-backend",
        status="ok",
        version=APP_VERSION,
        docs_ready=True,
    )
