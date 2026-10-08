from app.models.user import User


def serialize_user(user: User) -> dict[str, object]:
    """Build the shared public user shape for REST and WebSocket payloads."""
    return {
        'id': user.id,
        'phone_number': user.phone_number,
        'username': user.username,
        'display_name': user.display_name,
        'about': user.about,
        'avatar_url': user.avatar_url,
        'avatar_color': user.avatar_color,
        'is_online': user.is_online,
        'last_seen_at': user.last_seen_at.isoformat(),
    }
