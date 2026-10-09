from datetime import datetime, timezone


def utc_iso(value: datetime) -> str:
    """Serialize a datetime as UTC ISO 8601, treating SQLite-naive values as UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace('+00:00', 'Z')
