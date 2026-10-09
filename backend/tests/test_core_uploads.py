from fastapi.testclient import TestClient
from test_core import login


def test_validated_uploads_avatar_and_message_attachment(
    client: TestClient, db_session, monkeypatch,
) -> None:
    from dataclasses import replace
    from pathlib import Path
    from app.models.message import Attachment
    from app.models.user import User
    from app.services import upload_service

    first = login(client, '+91 90000 00018')
    second = login(client, '+91 90000 00019')
    outsider = login(client, '+91 90000 00022')
    first_headers = {'Authorization': f"Bearer {first['token']}"}
    second_headers = {'Authorization': f"Bearer {second['token']}"}
    upload_settings = upload_service.settings
    monkeypatch.setattr(upload_service, 'settings', replace(upload_settings, max_upload_bytes=4))
    oversized = client.post(
        '/api/v1/uploads', headers=first_headers,
        files={'file': ('large.txt', b'12345', 'text/plain')},
    )
    assert oversized.status_code == 413
    assert oversized.json()['error']['code'] == 'REQUEST_ERROR'
    monkeypatch.setattr(upload_service, 'settings', upload_settings)
    mismatched = client.post(
        '/api/v1/uploads', headers=first_headers,
        files={'file': ('fake.png', b'not png', 'image/png')},
    )
    assert mismatched.status_code == 422
    assert mismatched.json()['error']['code'] == 'VALIDATION_ERROR'
    rejected = client.post(
        '/api/v1/uploads',
        headers=first_headers,
        files={'file': ('script.exe', b'not an image', 'application/x-msdownload')},
    )
    assert rejected.status_code == 415
    assert rejected.json()['error']['code'] == 'REQUEST_ERROR'

    upload = client.post(
        '/api/v1/uploads',
        headers=first_headers,
        files={'file': ('notes.txt', b'hello attachment', 'text/plain')},
    )
    assert upload.status_code == 200
    attachment = upload.json()
    assert attachment['file_name'] == 'notes.txt'
    assert client.get(attachment['url']).status_code == 401

    conversation = client.post(
        '/api/v1/conversations/direct',
        headers=first_headers,
        json={'user_id': second['user']['id']},
    ).json()
    denied_send = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        headers=second_headers,
        json={'client_message_id': 'not-owner-upload', 'attachment_ids': [attachment['id']]},
    )
    assert denied_send.status_code == 404
    sent = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        headers=first_headers,
        json={'client_message_id': 'attachment-send-1', 'attachment_ids': [attachment['id']]},
    )
    assert sent.status_code == 200
    assert sent.json()['type'] == 'file'
    assert sent.json()['attachments'][0]['id'] == attachment['id']
    assert client.get(attachment['url'], headers=first_headers).status_code == 200
    assert client.get(attachment['url'], headers=second_headers).status_code == 200
    assert client.get(
        attachment['url'], headers={'Authorization': f"Bearer {outsider['token']}"}
    ).status_code == 403
    used_again = client.post(
        f"/api/v1/conversations/{conversation['id']}/messages",
        headers=first_headers,
        json={'client_message_id': 'attachment-send-2', 'attachment_ids': [attachment['id']]},
    )
    assert used_again.status_code == 409

    avatar = client.post(
        '/api/v1/users/me/avatar',
        headers=first_headers,
        files={'file': ('avatar.png', b'\x89PNG\r\n\x1a\nsmall-png', 'image/png')},
    )
    assert avatar.status_code == 200
    assert client.get(avatar.json()['avatar_url'], headers=first_headers).content.startswith(b'\x89PNG')

    attachment_row = db_session.get(Attachment, attachment['id'])
    avatar_user = db_session.get(User, first['user']['id'])
    assert attachment_row is not None and avatar_user is not None
    upload_file = Path('uploads') / attachment_row.storage_path
    avatar_file = Path('uploads') / str(avatar_user.avatar_storage_path)
    upload_file.unlink(missing_ok=True)
    avatar_file.unlink(missing_ok=True)
