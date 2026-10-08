def test_conversation_list_query_count_is_constant_with_fifty_chats(db_session) -> None:
    from sqlalchemy import event
    from app.models.conversation import Conversation, Participant
    from app.models.user import User
    from app.services.conversation_service import list_conversations

    owner = User(phone_number='+91 93333 00001', display_name='List owner')
    db_session.add(owner)
    db_session.flush()
    for index in range(50):
        peer = User(phone_number=f'+91 93333 {index + 100:05d}', display_name=f'Peer {index}')
        db_session.add(peer)
        db_session.flush()
        conversation = Conversation(
            type='direct', created_by=owner.id,
            direct_key=':'.join(sorted((owner.id, peer.id))),
        )
        db_session.add(conversation)
        db_session.flush()
        db_session.add_all([
            Participant(conversation_id=conversation.id, user_id=owner.id, role='admin'),
            Participant(conversation_id=conversation.id, user_id=peer.id),
        ])
    db_session.commit()

    statements: list[str] = []
    connection = db_session.connection()
    event.listen(connection, 'before_cursor_execute', lambda *_args: statements.append('query'))
    result = list_conversations(db_session, owner, None)
    assert len(result) == 50
    assert len(statements) <= 4
