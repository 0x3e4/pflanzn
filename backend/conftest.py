from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_db():
    """Provides a mock database session."""
    db = MagicMock()
    return db


@pytest.fixture
def client(mock_db):
    """TestClient with mocked DB and Redis."""
    # Patch Redis before importing app modules
    mock_redis = MagicMock()
    mock_redis.get.return_value = None
    mock_redis.setex.return_value = True
    mock_redis.set.return_value = True
    mock_redis.delete.return_value = True

    with patch("app.api.routes.auth.redis_client", mock_redis), \
         patch("app.database.init_db"):
        from app.database import get_db
        from app.main import app

        def override_get_db():
            yield mock_db

        app.dependency_overrides[get_db] = override_get_db

        with TestClient(app) as c:
            yield c

        app.dependency_overrides.clear()


@pytest.fixture
def override_dep(client):
    """Override a FastAPI dependency for the duration of a test.

    Patching the function in the route module does not work: FastAPI captures the
    dependency object at import time, so only dependency_overrides has any effect.
    """
    from app.main import app

    applied = []

    def _apply(dependency, value):
        app.dependency_overrides[dependency] = lambda: value
        applied.append(dependency)

    yield _apply

    for dependency in applied:
        app.dependency_overrides.pop(dependency, None)


@pytest.fixture
def make_user():
    """Builds a real User instance.

    Endpoints declare response_model=UserResponse with from_attributes=True, and a
    MagicMock fails that validation with a confusing 500 — use the real model.
    """
    from app.models import User

    def _make(id=2, username="bob", email="bob@example.com", role="user"):
        return User(id=id, username=username, email=email, role=role, password="x")

    return _make
