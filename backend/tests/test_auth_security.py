import time
import unittest
import uuid

from backend.app.auth.passwords import hash_password, verify_password
from backend.app.auth.tokens import TokenError, decode_access_token, issue_access_token
from backend.app.core.config import AuthSettings
from backend.app.db.enums import UserRole


class AuthSecurityTest(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = AuthSettings(
            token_secret="unit-test-token-secret-with-enough-entropy",
            access_token_ttl_seconds=1800,
            issuer="raksha-test",
        )

    def test_password_hash_verifies_only_correct_password(self) -> None:
        stored_hash = hash_password("correct horse battery staple", salt=b"1234567890abcdef")

        self.assertTrue(verify_password("correct horse battery staple", stored_hash))
        self.assertFalse(verify_password("wrong password", stored_hash))
        self.assertFalse(verify_password("correct horse battery staple", "not-a-valid-hash"))

    def test_password_hash_does_not_store_plaintext(self) -> None:
        stored_hash = hash_password("frontline-password", salt=b"abcdef1234567890")

        self.assertNotIn("frontline-password", stored_hash)
        self.assertTrue(stored_hash.startswith("pbkdf2_sha256$"))

    def test_signed_access_token_round_trips_claims(self) -> None:
        user_id = uuid.uuid4()
        token = issue_access_token(
            subject=user_id,
            role=UserRole.DOCTOR,
            settings=self.settings,
            now=1_800_000_000,
        )

        payload = decode_access_token(token, settings=self.settings, now=1_800_000_010)

        self.assertEqual(payload.subject, user_id)
        self.assertEqual(payload.role, UserRole.DOCTOR)
        self.assertEqual(payload.issued_at, 1_800_000_000)
        self.assertEqual(payload.expires_at, 1_800_001_800)
        self.assertEqual(payload.issuer, "raksha-test")

    def test_signed_access_token_rejects_tampering(self) -> None:
        token = issue_access_token(
            subject=uuid.uuid4(),
            role=UserRole.ADMIN,
            settings=self.settings,
        )
        tampered = f"{token}x"

        with self.assertRaises(TokenError):
            decode_access_token(tampered, settings=self.settings)

    def test_signed_access_token_rejects_expired_token(self) -> None:
        token = issue_access_token(
            subject=uuid.uuid4(),
            role=UserRole.PATIENT,
            settings=self.settings,
            now=int(time.time()) - 3600,
        )

        with self.assertRaises(TokenError):
            decode_access_token(token, settings=self.settings, now=int(time.time()))


if __name__ == "__main__":
    unittest.main()

