def test_direct_conversation_creation_recovers_unique_key_race(db_session, monkeypatch) -> None:
    from sqlalchemy.exc import IntegrityError
    from app.models.conversation import Conversation, Participant
    from app.models.user import User
    from app.services.conversation_service import get_or_create_direct

    owner = User(phone_number='+91 95555 00001', display_name='Race owner')
    peer = User(phone_number='+91 95555 00002', display_name='Race peer')
    db_session.add_all([owner, peer])
    db_session.flush()
    key = ':'.join(sorted((owner.id, peer.id)))
    winner = Conversation(type='direct', created_by=owner.id, direct_key=key)
    db_session.add(winner)
    db_session.flush()
    db_session.add_all([
        Participant(conversation_id=winner.id, user_id=owner.id, role='admin'),
        Participant(conversation_id=winner.id, user_id=peer.id),
    ])
    db_session.commit()

    original_scalar = db_session.scalar
    original_flush = db_session.flush
    first_lookup = True
    first_flush = True

    def hide_winner_once(statement):
        nonlocal first_lookup
        if first_lookup:
            first_lookup = False
            return None
        return original_scalar(statement)

    def simulate_unique_conflict(*args, **kwargs):
        nonlocal first_flush
        if first_flush:
            first_flush = False
            raise IntegrityError('INSERT conversation', {}, Exception('unique key'))
        return original_flush(*args, **kwargs)

    monkeypatch.setattr(db_session, 'scalar', hide_winner_once)
    monkeypatch.setattr(db_session, 'flush', simulate_unique_conflict)
    actual = get_or_create_direct(db_session, owner, peer.id)
    assert actual.id == winner.id
