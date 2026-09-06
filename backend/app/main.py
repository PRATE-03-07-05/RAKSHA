"""RAKSHA API — FastAPI application entrypoint.

Connecting Rural Healthcare. Closing the Referral Loop.

Swagger UI: /docs · ReDoc: /redoc · Health: /health
"""
import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from . import __version__
from .config import get_settings
from .database import SessionLocal
from .routers import (admin, appointments, auth, emergencies, facilities,
                      notifications, patients, records, referrals, sync,
                      triage)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description=(
        "**RAKSHA — Responsive AI-enabled Knowledge & Smart Healthcare Assistance.**\n\n"
        "Connecting Rural Healthcare. Closing the Referral Loop.\n\n"
        "Integrated digital healthcare platform connecting patients, ASHA/ANM field workers, "
        "PHCs, CHCs, specialists and district administrators through one longitudinal record.\n\n"
        "*Decision-support endpoints are transparent rule-based prototypes — not medical devices.*"
    ),
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Access-Purpose"],
)


@app.exception_handler(IntegrityError)
async def integrity_handler(_: Request, exc: IntegrityError):
    return JSONResponse(status_code=409, content={"detail": "Conflict: unique constraint violation"})


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Standard 422 response — plus server-side field-level detail so
    contract mismatches are diagnosable from the logs alone."""
    logging.getLogger("raksha.api").warning(
        "Request validation failed: %s %s -> %s",
        request.method, request.url.path, exc.errors(),
    )
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors())})


@app.get("/health", tags=["system"], summary="Liveness + database probe")
def health():
    db_ok = False
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        db.close()
    return {"status": "ok" if db_ok else "degraded", "database": "up" if db_ok else "down",
            "version": __version__, "environment": settings.environment}


for r in (auth.router, patients.router, records.router, referrals.router,
          facilities.router, appointments.router, triage.router,
          emergencies.router, notifications.router, sync.router, admin.router):
    app.include_router(r)
