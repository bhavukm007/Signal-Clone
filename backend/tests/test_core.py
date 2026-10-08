import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope='module')
def client():
    with TestClient(app) as c: yield c

def login(client, identifier='+91 90000 00001'):
    client.post('/api/v1/auth/request-otp',json={'identifier':identifier})
    r=client.post('/api/v1/auth/verify-otp',json={'identifier':identifier,'code':'123456'})
    assert r.status_code==200
    return r.json()

def test_health_and_login(client):
    assert client.get('/health').json()['status']=='ok'
    result=login(client)
    assert result['token'].startswith('demo-')
    assert client.get('/api/v1/auth/me',headers={'Authorization':'Bearer '+result['token']}).status_code==200

def test_message_round_trip(client):
    a=login(client)
    headers={'Authorization':'Bearer '+a['token']}
    chats=client.get('/api/v1/conversations',headers=headers).json()
    assert chats
    cid=chats[0]['id']
    response=client.post(f'/api/v1/conversations/{cid}/messages',headers=headers,json={'body':'pytest check','client_message_id':'pytest-message-once'})
    assert response.status_code==200 and response.json()['body']=='pytest check'
    repeat=client.post(f'/api/v1/conversations/{cid}/messages',headers=headers,json={'body':'duplicate payload','client_message_id':'pytest-message-once'})
    assert repeat.json()['id']==response.json()['id']

def test_group_admin_rules(client):
    a=login(client)
    h={'Authorization':'Bearer '+a['token']}
    group=client.post('/api/v1/groups',headers=h,json={'name':'Test Group','member_ids':[]}).json()
    assert group['type']=='group'
    assert client.get(f"/api/v1/groups/{group['id']}/members",headers=h).status_code==200
