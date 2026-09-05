import os
import unittest
import uuid

from fastapi.testclient import TestClient

from backend.app.audit.service import InMemoryAuditSink
from backend.app.auth.dependencies import get_audit_sink, get_user_repository
from backend.app.auth.passwords import hash_password
from backend.app.auth.repository import UserRecord
from backend.app.db.enums import UserRole
from backend.app.main import app


class FakeUserRepository:
    def __init__(self, users: list[UserRecord]):
        self.users_by_id = {user.id: user for user in users}
        self.users_by_email = {user.email.lower(): user for user in users}

    def get_by_email(self, email: str) -> UserRecord | None:
        return self.users_by_email.get(email.lower())

    def get_by_id(self, user_id: uuid.UUID) -> UserRecord | None:
        return self.users_by_id.get(user_id)

    def list_users(self) -> list[UserRecord]:
        return sorted(self.users_by_id.values(), key=lambda user: user.full_name)


class AuthApiTest(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["RAKSHA_TOKEN_SECRET"] = "unit-test-token-secret-with-enough-entropy"
        os.environ["RAKSHA_ACCESS_TOKEN_MINUTES"] = "30"
        self.admin = UserRecord(
            id=uuid.UUID("00000000-0000-4000-8000-000000000901"),
            email="admin@raksha.test",
            full_name="Admin User",
            role=UserRole.ADMIN,
            password_hash=hash_password("admin-password", salt=b"admin-test-salt!"),
            is_active=True,
        )
        self.doctor = UserRecord(
            id=uuid.UUID("00000000-0000-4000-8000-000000000902"),
            email="doctor@raksha.test",
            full_name="Doctor User",
            role=UserRole.DOCTOR,
            password_hash=hash_password("doctor-password", salt=b"doctor-test-salt"),
            is_active=True,
        )
        self.inactive_user = UserRecord(
            id=uuid.UUID("00000000-0000-4000-8000-000000000903"),
            email="inactive@raksha.test",
            full_name="Inactive User",
            role=UserRole.FRONTLINE_WORKER,
            password_hash=hash_password("inactive-password", salt=b"inactive-salt!!"),
            is_active=False,
        )
        self.repository = FakeUserRepository([self.admin, self.doctor, self.inactive_user])
        self.audit_sink = InMemoryAuditSink()

        app.dependency_overrides[get_user_repository] = lambda: self.repository
        app.dependency_overrides[get_audit_sink] = lambda: self.audit_sink
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        os.environ.pop("RAKSHA_TOKEN_SECRET", None)
        os.environ.pop("RAKSHA_ACCESS_TOKEN_MINUTES", None)

    def login(self, email: str, password: str) -> str:
        response = self.client.post("/auth/login", json={"email": email, "password": password})
        self.assertEqual(response.status_code, 200)
        return response.json()["access_token"]

    def test_login_returns_bearer_token_and_user_profile(self) -> None:
        response = self.client.post(
            "/auth/login",
            json={"email": "doctor@raksha.test", "password": "doctor-password"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["token_type"], "bearer")
        self.assertEqual(payload["expires_in"], 1800)
        self.assertEqual(payload["user"]["role"], "DOCTOR")
        self.assertTrue(payload["access_token"].startswith("raksha.v1."))
        self.assertEqual(self.audit_sink.events[-1].action, "AUTH_LOGIN_SUCCEEDED")

    def test_login_rejects_invalid_password_with_error_envelope(self) -> None:
        response = self.client.post(
            "/auth/login",
            json={"email": "doctor@raksha.test", "password": "bad-password"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "INVALID_CREDENTIALS")
        self.assertEqual(self.audit_sink.events[-1].action, "AUTH_LOGIN_FAILED")

    def test_login_rejects_inactive_user(self) -> None:
        response = self.client.post(
            "/auth/login",
            json={"email": "inactive@raksha.test", "password": "inactive-password"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "USER_INACTIVE")
        self.assertEqual(self.audit_sink.events[-1].action, "AUTH_LOGIN_INACTIVE_USER")

    def test_login_validation_uses_consistent_error_envelope(self) -> None:
        response = self.client.post("/auth/login", json={"email": "not-an-email"})

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")

    def test_read_current_user_requires_bearer_token(self) -> None:
        response = self.client.get("/auth/me")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "AUTH_REQUIRED")

    def test_read_current_user_returns_authenticated_user(self) -> None:
        token = self.login("doctor@raksha.test", "doctor-password")

        response = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "doctor@raksha.test")
        self.assertEqual(response.json()["role"], "DOCTOR")

    def test_invalid_token_is_rejected(self) -> None:
        response = self.client.get("/auth/me", headers={"Authorization": "Bearer invalid"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "INVALID_TOKEN")

    def test_admin_can_list_users(self) -> None:
        token = self.login("admin@raksha.test", "admin-password")

        response = self.client.get("/users", headers={"Authorization": f"Bearer {token}"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["users"]), 3)
        self.assertEqual(self.audit_sink.events[-1].action, "USER_LIST_ACCESSED")

    def test_non_admin_cannot_list_users(self) -> None:
        token = self.login("doctor@raksha.test", "doctor-password")

        response = self.client.get("/users", headers={"Authorization": f"Bearer {token}"})

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "INSUFFICIENT_ROLE")


if __name__ == "__main__":
    unittest.main()

