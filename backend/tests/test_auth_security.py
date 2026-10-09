import secrets
import uuid

import pytest
from pydantic import ValidationError


def test_otp_request_rate_limit_returns_retry_after(client) -> None:
    identifier = f'otp-limit-{uuid.uuid4().hex}'
    for _ in range(5):
        response = client.post('/api/v1/auth/request-otp', json={'identifier': identifier})
        assert response.status_code == 200

    limited = client.post('/api/v1/auth/request-otp', json={'identifier': identifier})
    assert limited.status_code == 429
    assert int(limited.headers['retry-after']) > 0


def test_login_verification_rate_limit_counts_invalid_codes(client) -> None:
    identifier = f'login-limit-{uuid.uuid4().hex}'
    client.post('/api/v1/auth/request-otp', json={'identifier': identifier}).raise_for_status()
    for _ in range(10):
        response = client.post(
            '/api/v1/auth/verify-otp', json={'identifier': identifier, 'code': '0000'}
        )
        assert response.status_code == 401

    limited = client.post(
        '/api/v1/auth/verify-otp', json={'identifier': identifier, 'code': '0000'}
    )
    assert limited.status_code == 429
    assert int(limited.headers['retry-after']) > 0


def test_production_requires_a_unique_random_jwt_secret(monkeypatch) -> None:
    from app.core.config import load_settings

    monkeypatch.setenv('ENVIRONMENT', 'production')
    for invalid_secret in ('', 'replace-me-with-a-random-secret', 'x' * 64):
        monkeypatch.setenv('JWT_SECRET', invalid_secret)
        with pytest.raises(RuntimeError, match='Production requires'):
            load_settings()

    monkeypatch.setenv('JWT_SECRET', secrets.token_hex(32))
    assert load_settings().environment == 'production'


def test_message_payload_rejects_body_over_public_demo_limit() -> None:
    from app.schemas.message import MessageCreate

    with pytest.raises(ValidationError):
        MessageCreate(client_message_id='too-long', body='x' * 10001)
