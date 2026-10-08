from fastapi.testclient import TestClient


def login(client: TestClient, phone: str) -> dict:
    client.post('/api/v1/auth/request-otp', json={'identifier': phone})
    result = client.post('/api/v1/auth/verify-otp', json={
        'identifier': phone, 'code': '123456',
    })
    assert result.status_code == 200
    return result.json()

def headers(account: dict) -> dict[str, str]:
    return {'Authorization': f"Bearer {account['token']}"}
