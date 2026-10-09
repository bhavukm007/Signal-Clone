from fastapi.testclient import TestClient
from test_core import login


def test_group_admin_management_system_messages_and_membership(client: TestClient) -> None:
    admin = login(client, '+91 90000 00013')
    first_member = login(client, '+91 90000 00014')
    second_member = login(client, '+91 90000 00015')
    admin_headers = {'Authorization': f"Bearer {admin['token']}"}
    first_headers = {'Authorization': f"Bearer {first_member['token']}"}
    group = client.post('/api/v1/groups', headers=admin_headers, json={
        'name': 'Review crew', 'member_ids': [first_member['user']['id']],
    }).json()
    group_id = group['id']

    denied = client.patch(
        f"/api/v1/groups/{group_id}/members/{admin['user']['id']}/role",
        headers=first_headers,
        json={'role': 'admin'},
    )
    assert denied.status_code == 403

    promoted = client.patch(
        f"/api/v1/groups/{group_id}/members/{first_member['user']['id']}/role",
        headers=admin_headers,
        json={'role': 'admin'},
    )
    assert promoted.status_code == 200
    members = client.get(f"/api/v1/groups/{group_id}/members", headers=first_headers).json()
    first_row = next(row for row in members if row['user']['id'] == first_member['user']['id'])
    assert first_row['role'] == 'admin'

    added = client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=first_headers,
        json={'user_ids': [second_member['user']['id']]},
    )
    assert added.json()['added_count'] == 1
    changed = client.patch(
        f"/api/v1/groups/{group_id}",
        headers=admin_headers,
        json={'name': 'Review crew 2'},
    )
    assert changed.json()['title'] == 'Review crew 2'

    history = client.get(
        f"/api/v1/conversations/{group_id}/messages",
        headers=admin_headers,
    ).json()
    system_text = [row['body'] for row in history if row['type'] == 'system']
    assert any('created the group' in text for text in system_text)
    assert any('made' in text and 'an admin' in text for text in system_text)
    assert any('added' in text for text in system_text)
    assert any('changed the group name' in text for text in system_text)

    left = client.delete(
        f"/api/v1/groups/{group_id}/members/{second_member['user']['id']}",
        headers={'Authorization': f"Bearer {second_member['token']}"},
    )
    assert left.status_code == 200
    removed_headers = {'Authorization': f"Bearer {second_member['token']}"}
    denied_after_leave = client.get(
        f"/api/v1/groups/{group_id}/members",
        headers=removed_headers,
    )
    assert denied_after_leave.status_code == 403
    denied_history = client.get(
        f'/api/v1/conversations/{group_id}/messages', headers=removed_headers,
    )
    denied_send = client.post(
        f'/api/v1/conversations/{group_id}/messages',
        headers=removed_headers,
        json={'body': 'I left', 'client_message_id': 'removed-member-send'},
    )
    assert denied_history.status_code == 403
    assert denied_send.status_code == 403

def test_group_changes_broadcast_system_message_and_update(client: TestClient) -> None:
    admin = login(client, '+91 90000 00016')
    member = login(client, '+91 90000 00017')
    admin_headers = {'Authorization': f"Bearer {admin['token']}"}
    group = client.post('/api/v1/groups', headers=admin_headers, json={
        'name': 'Broadcast test', 'member_ids': [member['user']['id']],
    }).json()

    with client.websocket_connect(f"/ws?token={admin['token']}") as admin_socket:
        with client.websocket_connect(f"/ws?token={member['token']}") as member_socket:
            admin_presence = admin_socket.receive_json()
            assert admin_presence['type'] == 'presence'
            pending_status = admin_socket.receive_json()
            assert pending_status['type'] == 'message.status'
            response = client.patch(
                f"/api/v1/groups/{group['id']}",
                headers=admin_headers,
                json={'name': 'Broadcast test renamed'},
            )
            assert response.status_code == 200
            member_message = member_socket.receive_json()
            member_update = member_socket.receive_json()
            admin_message = admin_socket.receive_json()
            admin_delivery = admin_socket.receive_json()
            admin_update = admin_socket.receive_json()
            assert member_message['type'] == 'message.new'
            assert 'changed the group name' in member_message['payload']['message']['body']
            assert member_update['type'] == 'conversation.updated'
            assert admin_message['type'] == 'message.new'
            assert admin_delivery['type'] == 'message.status'
            assert admin_update['type'] == 'conversation.updated'
