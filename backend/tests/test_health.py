import unittest

from fastapi.testclient import TestClient

from backend.app.main import APP_VERSION, app


class HealthEndpointTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_endpoint_contract(self) -> None:
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "service": "raksha-backend",
                "status": "ok",
                "version": APP_VERSION,
                "docs_ready": True,
            },
        )

    def test_openapi_documents_health_endpoint(self) -> None:
        response = self.client.get("/openapi.json")

        self.assertEqual(response.status_code, 200)
        schema = response.json()
        self.assertIn("/health", schema["paths"])
        self.assertEqual(schema["info"]["title"], "RAKSHA API")


if __name__ == "__main__":
    unittest.main()

