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
