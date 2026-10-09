import pytest

from app.core.phone import normalize_identifier, normalize_phone_number


@pytest.mark.parametrize('value', [
    '+919000000001', '+91 90000 00001', '+91-90000-00001', '919000000001', '9000000001',
])
def test_indian_phone_formats_share_one_e164_value(value):
    assert normalize_identifier(value) == '+919000000001'


def test_username_is_not_rewritten():
    assert normalize_identifier('Maya.Iyer') == 'Maya.Iyer'


@pytest.mark.parametrize('value', ['+910123456789', '123', '+1234567890123456'])
def test_invalid_phone_is_rejected(value):
    with pytest.raises(ValueError):
        normalize_phone_number(value)


def test_equivalent_phone_formats_resolve_to_the_same_account(client):
    first_challenge = client.post('/api/v1/auth/request-otp', json={'identifier': '+91-90000-00001'})
    assert first_challenge.json()['demo_code'] == '123456'
    first = client.post('/api/v1/auth/verify-otp', json={'identifier': '+919000000001', 'code': '123456'}).json()
    client.post('/api/v1/auth/request-otp', json={'identifier': '9000000001'})
    second = client.post('/api/v1/auth/verify-otp', json={'identifier': '919000000001', 'code': '123456'}).json()
    assert first['user']['id'] == second['user']['id']
    assert first['is_new_user'] is True
    assert second['is_new_user'] is False
    assert second['user']['phone_number'] == '+919000000001'
