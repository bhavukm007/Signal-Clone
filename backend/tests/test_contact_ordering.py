from audit_helpers import headers, login
from fastapi.testclient import TestClient


def test_contacts_api_orders_by_display_name(client: TestClient) -> None:
    owner = login(client, "+91 93333 00001")
    names = [
        ("+91 93333 00002", "zoë"),
        ("+91 93333 00003", "Élodie"),
        ("+91 93333 00004", "alice"),
        ("+91 93333 00005", "Bruno"),
    ]
    users = []
    for phone, name in names:
        person = login(client, phone)
        updated = client.put(
            "/api/v1/auth/profile",
            headers=headers(person),
            json={"display_name": name},
        )
        assert updated.status_code == 200
        users.append(person)
    for person in users:
        response = client.post(
            "/api/v1/contacts",
            headers=headers(owner),
            json={"user_id": person["user"]["id"]},
        )
        assert response.status_code == 200

    result = client.get("/api/v1/contacts", headers=headers(owner))
    assert result.status_code == 200
    assert [row["user"]["display_name"] for row in result.json()] == [
        "alice",
        "Bruno",
        "Élodie",
        "zoë",
    ]
