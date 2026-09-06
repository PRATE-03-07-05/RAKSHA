"""Test fixtures — in-memory SQLite so the suite runs without Docker.

The application database remains PostgreSQL (see app/database.py); tests
simply override the get_db dependency, which is standard FastAPI practice.

Session architecture (mirrors production get_db semantics):
- Each HTTP request gets its OWN session, closed at request teardown —
  exactly like the real dependency. This gives requests an independent
  identity map, so router-side mutations never leak into test-side ORM
  objects (optimistic-version assertions stay meaningful).
- The fixture session used by `make_user` / `make_patient` helpers is a
  separate, long-lived session closed only at test teardown.
- `expire_on_commit=False` keeps committed fixture objects readable after
  request commits, preventing DetachedInstanceError-style expiry without
  ever swallowing real errors.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Facility, FacilityType, Patient, Role, User
from app.security import create_access_token, hash_password

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False,
                              expire_on_commit=False, future=True)


@pytest.fixture(autouse=True)
def db():
    Base.metadata.create_all(engine)
    session = TestingSession()  # long-lived session for test-side helpers

    def _override():
        # One fresh session per request — production-like transaction scope.
        request_session = TestingSession()
        try:
            yield request_session
        finally:
            request_session.close()

    app.dependency_overrides[get_db] = _override
    yield session
    app.dependency_overrides.clear()
    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture
def client():
    return TestClient(app)


def make_user(db, role: Role, name: str = "Test User", facility_id: str | None = None,
              email: str | None = None) -> User:
    u = User(
        email=email or f"{role.value.lower()}-{abs(hash((role.value, name))) % 10000}@test.raksha",
        name=name, password_hash=hash_password("testpass123"), role=role,
        facility_id=facility_id, district="Pune",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role.value)}"}


def seed_facilities(db) -> tuple[Facility, Facility, Facility]:
    phc = Facility(id="F-TEST-PHC", code="F-TEST-PHC", name="Test PHC",
                   facility_type=FacilityType.PHC, village="Testpur", district="Pune")
    chc = Facility(id="F-TEST-CHC", code="F-TEST-CHC", name="Test CHC",
                   facility_type=FacilityType.CHC, village="Testpur", district="Pune")
    dh = Facility(id="F-TEST-DH", code="F-TEST-DH", name="Test DH",
                  facility_type=FacilityType.DISTRICT_HOSPITAL, village="City", district="Pune")
    db.add_all([phc, chc, dh])
    db.commit()
    return phc, chc, dh


def make_patient(db, asha_id: str | None = None, phc_id: str = "F-TEST-PHC",
                 user_id: str | None = None, name: str = "Demo Patient",
                 rak_id: str | None = None) -> Patient:
    p = Patient(
        rak_id=rak_id or f"RAK-PAT-2026-{abs(hash(name)) % 100000:05d}",
        name=name, age=40, gender="FEMALE", village="Testpur", district="Pune",
        conditions=[], allergies=[], asha_id=asha_id, phc_id=phc_id,
        user_id=user_id, consent_granted=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
