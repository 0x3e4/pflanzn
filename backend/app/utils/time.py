from datetime import datetime, timezone


def utcnow() -> datetime:
    """The current time as naive UTC, the way the database columns store it.
    Stands in for datetime.utcnow, which Python deprecates."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
