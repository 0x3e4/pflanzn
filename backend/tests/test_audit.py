import asyncio
import types
from unittest.mock import MagicMock, patch


def _fake_request(method="POST", path="/api/test"):
    return types.SimpleNamespace(
        method=method,
        url=types.SimpleNamespace(path=path),
        state=types.SimpleNamespace(),
        headers={},
        cookies={},
        client=types.SimpleNamespace(host="1.2.3.4"),
    )


class TestParseEntity:
    def test_parses_entity_and_id(self):
        from app.core.audit import parse_entity

        assert parse_entity("/api/plants/12/water") == ("plant", 12)
        assert parse_entity("/api/users/3") == ("user", 3)
        assert parse_entity("/api/tags/") == ("tag", None)
        assert parse_entity("/health") == (None, None)


class TestRecordAudit:
    def test_record_audit_inserts_row(self):
        from app.core import audit

        with patch("app.core.audit.SessionLocal") as mock_sl:
            sess = MagicMock()
            mock_sl.return_value = sess
            audit.record_audit(
                _fake_request(),
                action="test.action",
                entity_type="thing",
                entity_id=7,
                username="bob",
                status_code=200,
                details={"a": 1},
            )

        assert sess.add.called
        row = sess.add.call_args[0][0]
        assert row.action == "test.action"
        assert row.entity_type == "thing"
        assert row.entity_id == 7
        assert row.username == "bob"
        assert sess.commit.called

    def test_record_audit_never_raises_on_failure(self):
        # SessionLocal blows up -> record_audit must swallow it.
        with patch("app.core.audit.SessionLocal", side_effect=RuntimeError("boom")):
            from app.core import audit

            audit.record_audit(_fake_request(), action="x")  # should not raise


class TestAuditMiddleware:
    def _run(self, method, path, status=200):
        from app.core import audit_middleware as am

        req = _fake_request(method, path)

        async def call_next(_):
            return types.SimpleNamespace(status_code=status)

        with patch("app.core.audit_middleware.record_audit") as rec:
            asyncio.run(am.audit_middleware(req, call_next))
        return rec

    def test_baseline_logs_generic_write(self):
        rec = self._run("POST", "/api/plants/")
        assert rec.called
        kwargs = rec.call_args.kwargs
        assert kwargs["action"] == "create"
        assert kwargs["entity_type"] == "plant"

    def test_skips_read_requests(self):
        rec = self._run("GET", "/api/plants/")
        assert not rec.called

    def test_skips_audit_endpoint(self):
        rec = self._run("DELETE", "/api/audit/")
        assert not rec.called

    def test_skips_semantic_login(self):
        rec = self._run("POST", "/api/auth/login")
        assert not rec.called

    def test_skips_semantic_user_update(self):
        rec = self._run("PUT", "/api/users/5")
        assert not rec.called


class TestLoginAudit:
    def test_login_failure_records_audit(self, client, mock_db):
        """A failed login writes a 'login_failed' audit row."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.core.audit.SessionLocal") as mock_sl:
            sess = MagicMock()
            mock_sl.return_value = sess
            resp = client.post("/api/auth/login", json={"username": "ghost", "password": "x"})

        assert resp.status_code == 401
        assert sess.add.called
        row = sess.add.call_args[0][0]
        assert row.action == "login_failed"
        assert row.username == "ghost"


class TestAuditRead:
    def _stub_query(self, mock_db, total=0, rows=None):
        q = mock_db.query.return_value
        q.count.return_value = total
        q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = rows or []
        # filters return the same query object
        q.filter.return_value = q
        return q

    def test_returns_paginated_page(self, client, mock_db):
        self._stub_query(mock_db, total=0)
        resp = client.get("/api/audit/")
        assert resp.status_code == 200
        assert resp.json() == {"items": [], "total": 0, "page": 1, "per_page": 50}

    def test_echoes_pagination_params(self, client, mock_db):
        self._stub_query(mock_db, total=5)
        resp = client.get("/api/audit/?page=2&per_page=10")
        body = resp.json()
        assert body["page"] == 2
        assert body["per_page"] == 10
        assert body["total"] == 5

    def test_forbidden_when_admin_required(self, client):
        """With roles enabled and no admin user, the endpoint returns 403."""
        with patch("app.api.routes.audit.AUTH_MODE", "local"):
            resp = client.get("/api/audit/")
        assert resp.status_code == 403
