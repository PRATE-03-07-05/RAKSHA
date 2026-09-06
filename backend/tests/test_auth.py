"""Authentication tests: login, token validation, expiry."""
from datetime import datetime, timedelta, timezone

import jwt as pyjwt

from app.config import get_settings
from app.models import Role

from .conftest import auth_headers, make_user

S = get_settings()


def test_login_valid(client, db):
    make_user(db, Role.ASHA, name="Login ASHA", email="login-asha@test.raksha")
    r = client.post("/auth/login", json={"email": "login-asha@test.raksha", "password": "testpass123"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["role"] == "ASHA"
    assert "password_hash" not in body["user"]


def test_login_wrong_password(client, db):
    make_user(db, Role.ASHA, email="wrongpw@test.raksha")
    r = client.post("/auth/login", json={"email": "wrongpw@test.raksha", "password": "nope12345"})
    assert r.status_code == 401


def test_login_unknown_email(client, db):
    r = client.post("/auth/login", json={"email": "ghost@test.raksha", "password": "whatever1"})
    assert r.status_code == 401


def test_me_with_valid_token(client, db):
    u = make_user(db, Role.CHC_DOCTOR, email="me-chc@test.raksha")
    r = client.get("/auth/me", headers=auth_headers(u))
    assert r.status_code == 200
    assert r.json()["email"] == "me-chc@test.raksha"


def test_me_without_token(client, db):
    r = client.get("/auth/me")
    assert r.status_code == 401


def test_me_with_garbage_token(client, db):
    r = client.get("/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


def test_me_with_expired_token(client, db):
    u = make_user(db, Role.PATIENT, email="expired@test.raksha")
    expired = pyjwt.encode(
        {"sub": u.id, "role": "PATIENT",
         "exp": datetime.now(timezone.utc) - timedelta(minutes=5)},
        S.jwt_secret, algorithm=S.jwt_algorithm,
    )
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401
    assert "expired" in r.json()["detail"].lower()
