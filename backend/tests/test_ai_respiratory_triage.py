import os
import unittest
import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from backend.app.ai.dependencies import get_respiratory_triage_service, get_triage_assessment_repository
from backend.app.ai.respiratory_triage import (
    MODEL_NAME,
    MODEL_VERSION,
    RespiratoryRiskTriageService,
    RespiratoryTriageUnavailable,
    manual_review_fallback,
)
from backend.app.ai.schemas import RespiratoryRiskRequest, RespiratoryRiskResponse
from backend.app.audit.service import InMemoryAuditSink
from backend.app.auth.dependencies import get_audit_sink, get_user_repository
from backend.app.auth.passwords import hash_password
from backend.app.auth.repository import UserRecord
from backend.app.db.enums import TriageRiskLevel, UserRole
from backend.app.main import app


PATIENT_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
ENCOUNTER_ID = uuid.UUID("00000000-0000-4000-8000-000000000202")
SYMPTOM_REPORT_ID = uuid.UUID("00000000-0000-4000-8000-000000000301")
ASSESSMENT_ID = uuid.UUID("00000000-0000-4000-8000-000000000901")


class FakeUserRepository:
    def __init__(self, users: list[UserRecord]):
        self.users_by_id = {user.id: user for user in users}
        self.users_by_email = {user.email.lower(): user for user in users}

    def get_by_email(self, email: str) -> UserRecord | None:
        return self.users_by_email.get(email.lower())

    def get_by_id(self, user_id: uuid.UUID) -> UserRecord | None:
        return self.users_by_id.get(user_id)

    def list_users(self) -> list[UserRecord]:
        return list(self.users_by_id.values())


class FakeTriageAssessmentRepository:
    def __init__(self) -> None:
        self.created: list[dict] = []

    def create(
        self,
        *,
        request: RespiratoryRiskRequest,
        response: RespiratoryRiskResponse,
        actor_user_id: uuid.UUID,
    ) -> uuid.UUID:
        self.created.append(
            {
                "request": request,
                "response": response,
                "actor_user_id": actor_user_id,
            }
        )
        return ASSESSMENT_ID


class UnavailableTriageService:
    def assess(self, payload: RespiratoryRiskRequest) -> RespiratoryRiskResponse:
        raise RespiratoryTriageUnavailable("synthetic outage")


class RespiratoryRiskTriageServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.service = RespiratoryRiskTriageService()
        self.assessed_at = datetime(2026, 9, 4, 12, 30, tzinfo=timezone.utc)

    def request(self, **overrides) -> RespiratoryRiskRequest:
        payload = {
            "patient_id": PATIENT_ID,
            "encounter_id": ENCOUNTER_ID,
            "symptom_report_id": SYMPTOM_REPORT_ID,
            "age_months": 485,
            "symptoms": {"cough": True, "breathlessness": True, "fever": True},
            "vitals": {"respiratory_rate": 24, "spo2": 97, "temperature_c": 38.2},
            "danger_signs": {},
            "comorbidities": [],
        }
        payload.update(overrides)
        return RespiratoryRiskRequest.model_validate(payload)

    def test_low_spo2_forces_urgent_human_review_without_diagnosis(self) -> None:
        result = self.service.assess(
            self.request(vitals={"respiratory_rate": 32, "spo2": 88, "temperature_c": 38.5}),
            assessed_at=self.assessed_at,
        )

        self.assertEqual(result.model_name, MODEL_NAME)
        self.assertEqual(result.model_version, MODEL_VERSION)
        self.assertEqual(result.assessed_at, self.assessed_at)
        self.assertEqual(result.risk_level, TriageRiskLevel.URGENT)
        self.assertGreaterEqual(result.confidence or 0, 0.9)
        self.assertTrue(result.human_review_required)
        self.assertTrue(result.clinical_decision_support_only)
        self.assertIsNone(result.diagnosis)
        self.assertIsNone(result.treatment_recommendation)
        self.assertIn("SEVERE_LOW_OXYGEN_SATURATION", result.structured_output.safety_flags)
        self.assertTrue(result.structured_output.urgent_review_required)

    def test_child_fast_breathing_is_high_risk_prompt_review(self) -> None:
        result = self.service.assess(
            self.request(
                age_months=7,
                symptoms={"cough": True, "fever": True},
                vitals={"respiratory_rate": 52, "spo2": 97, "temperature_c": 38.3},
            )
        )

        self.assertEqual(result.risk_level, TriageRiskLevel.HIGH)
        self.assertTrue(result.structured_output.prompt_review_required)
        self.assertFalse(result.structured_output.urgent_review_required)
        self.assertIn("FAST_BREATHING", result.structured_output.safety_flags)

    def test_missing_critical_inputs_are_structured_and_lower_confidence(self) -> None:
        result = self.service.assess(
            self.request(
                age_months=None,
                symptoms={"cough": True},
                vitals={},
            )
        )

        self.assertEqual(result.risk_level, TriageRiskLevel.MODERATE)
        self.assertLess(result.confidence or 1, 0.5)
        self.assertEqual(
            result.structured_output.missing_inputs,
            ["age_months", "vitals.respiratory_rate", "vitals.spo2"],
        )
        self.assertTrue(result.human_review_required)

    def test_manual_review_fallback_has_no_confidence_or_automated_score(self) -> None:
        result = manual_review_fallback(
            self.request(danger_signs={"cyanosis": True}),
            assessed_at=self.assessed_at,
        )

        self.assertEqual(result.risk_level, TriageRiskLevel.URGENT)
        self.assertIsNone(result.confidence)
        self.assertIsNone(result.structured_output.risk_score)
        self.assertTrue(result.structured_output.fallback_mode)
        self.assertIn("CYANOSIS", result.structured_output.safety_flags)
        self.assertTrue(result.human_review_required)


class RespiratoryRiskTriageApiTest(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["RAKSHA_TOKEN_SECRET"] = "unit-test-token-secret-with-enough-entropy"
        os.environ["RAKSHA_ACCESS_TOKEN_MINUTES"] = "30"
        self.doctor = UserRecord(
            id=uuid.UUID("00000000-0000-4000-8000-000000000902"),
            email="doctor@raksha.test",
            full_name="Doctor User",
            role=UserRole.DOCTOR,
            password_hash=hash_password("doctor-password", salt=b"doctor-test-salt"),
            is_active=True,
        )
        self.patient = UserRecord(
            id=uuid.UUID("00000000-0000-4000-8000-000000000904"),
            email="patient@raksha.test",
            full_name="Patient User",
            role=UserRole.PATIENT,
            password_hash=hash_password("patient-password", salt=b"patient-test-salt"),
            is_active=True,
        )
        self.user_repository = FakeUserRepository([self.doctor, self.patient])
        self.audit_sink = InMemoryAuditSink()
        self.triage_repository = FakeTriageAssessmentRepository()

        app.dependency_overrides[get_user_repository] = lambda: self.user_repository
        app.dependency_overrides[get_audit_sink] = lambda: self.audit_sink
        app.dependency_overrides[get_triage_assessment_repository] = lambda: self.triage_repository
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        os.environ.pop("RAKSHA_TOKEN_SECRET", None)
        os.environ.pop("RAKSHA_ACCESS_TOKEN_MINUTES", None)

    def login(self, email: str, password: str) -> str:
        response = self.client.post("/auth/login", json={"email": email, "password": password})
        self.assertEqual(response.status_code, 200)
        return response.json()["access_token"]

    def request_json(self) -> dict:
        return {
            "patient_id": str(PATIENT_ID),
            "encounter_id": str(ENCOUNTER_ID),
            "symptom_report_id": str(SYMPTOM_REPORT_ID),
            "age_months": 485,
            "symptoms": {"cough": True, "breathlessness": True, "fever": True},
            "vitals": {"respiratory_rate": 32, "spo2": 91, "temperature_c": 38.4},
            "danger_signs": {"severe_weakness": True},
            "comorbidities": ["Asthma"],
        }

    def test_doctor_can_create_structured_respiratory_risk_assessment(self) -> None:
        token = self.login("doctor@raksha.test", "doctor-password")

        response = self.client.post(
            "/triage/respiratory-risk",
            json=self.request_json(),
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["assessment_id"], str(ASSESSMENT_ID))
        self.assertEqual(payload["risk_level"], "URGENT")
        self.assertTrue(payload["human_review_required"])
        self.assertTrue(payload["clinical_decision_support_only"])
        self.assertIsNone(payload["diagnosis"])
        self.assertIsNone(payload["treatment_recommendation"])
        self.assertEqual(payload["structured_output"]["risk_level"], payload["risk_level"])
        self.assertFalse(payload["structured_output"]["fallback_mode"])
        self.assertEqual(len(self.triage_repository.created), 1)
        self.assertEqual(self.audit_sink.events[-1].action, "AI_RESPIRATORY_TRIAGE_ASSESSED")
        self.assertEqual(self.audit_sink.events[-1].details["model_version"], MODEL_VERSION)

    def test_patient_role_cannot_create_triage_assessment(self) -> None:
        token = self.login("patient@raksha.test", "patient-password")

        response = self.client.post(
            "/triage/respiratory-risk",
            json=self.request_json(),
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "INSUFFICIENT_ROLE")
        self.assertEqual(self.triage_repository.created, [])

    def test_endpoint_returns_manual_review_fallback_when_service_unavailable(self) -> None:
        app.dependency_overrides[get_respiratory_triage_service] = lambda: UnavailableTriageService()
        token = self.login("doctor@raksha.test", "doctor-password")

        response = self.client.post(
            "/triage/respiratory-risk",
            json=self.request_json(),
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["model_name"], "manual-review-fallback")
        self.assertIsNone(payload["confidence"])
        self.assertTrue(payload["structured_output"]["fallback_mode"])
        self.assertTrue(payload["human_review_required"])
        self.assertEqual(len(self.triage_repository.created), 1)


if __name__ == "__main__":
    unittest.main()
