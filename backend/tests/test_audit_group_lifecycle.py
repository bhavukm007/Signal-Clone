from fastapi.testclient import TestClient
from audit_helpers import headers, login
def test_departed_member_does_not_hold_group_receipt_status(client: TestClient) -> None:
    sender = login(client, '+91 92222 00003')
    departed = login(client, '+91 92222 00004')
    reader = login(client, '+91 92222 00005')
    group = client.post('/api/v1/groups', headers=headers(sender), json={
        'name': 'Receipt policy',
        'member_ids': [departed['user']['id'], reader['user']['id']],
    }).json()
    path = f"/api/v1/conversations/{group['id']}/messages"
    sent = client.post(path, headers=headers(sender), json={
        'body': 'read by current member', 'client_message_id': 'group-read-after-leave',
    })
    message_id = sent.json()['id']
    removed = client.delete(
        f"/api/v1/groups/{group['id']}/members/{departed['user']['id']}",
        headers=headers(sender),
    )
    assert removed.status_code == 200
    marked = client.post(
        f"/api/v1/conversations/{group['id']}/read",
        headers=headers(reader), json={'up_to_message_id': message_id},
    )
    assert marked.status_code == 200
    history = client.get(path, headers=headers(sender)).json()
    assert next(row for row in history if row['id'] == message_id)['status'] == 'read'
def test_last_group_admin_cannot_leave_or_demote_self(client: TestClient) -> None:
    admin = login(client, '+91 92222 00006')
    group = client.post('/api/v1/groups', headers=headers(admin), json={
        'name': 'Keep admin', 'member_ids': [],
    }).json()
    leave = client.delete(
        f"/api/v1/groups/{group['id']}/members/{admin['user']['id']}",
        headers=headers(admin),
    )
    demote = client.patch(
        f"/api/v1/groups/{group['id']}/members/{admin['user']['id']}/role",
        headers=headers(admin), json={'role': 'member'},
    )
    assert leave.status_code == 409
    assert demote.status_code == 409
