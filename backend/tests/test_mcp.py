import base64
import hashlib
import json
import time
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest

from app.core.config import settings
from app.models import OAuthClient, OAuthGrant, Plant, Tag, User

BASE = "https://plants.example"
REDIRECT = "https://claude.ai/api/mcp/auth_callback"


class FakeRedis:
    def __init__(self):
        self.store = {}

    def setex(self, key, ttl, value):
        self.store[key] = value

    def get(self, key):
        return self.store.get(key)

    def getdel(self, key):
        return self.store.pop(key, None)

    def delete(self, key):
        self.store.pop(key, None)

    def incr(self, key):
        self.store[key] = int(self.store.get(key, 0)) + 1
        return self.store[key]

    def expire(self, key, ttl):
        pass


@pytest.fixture(autouse=True)
def _env():
    """MCP on, a fixed public origin, no real Redis or audit database."""
    fake = FakeRedis()
    with patch.object(settings, "MCP_ENABLED", True), \
         patch.object(settings, "AI_ENABLED", True), \
         patch.object(settings, "DOMAIN", BASE), \
         patch("app.services.mcp_oauth.redis_client", fake), \
         patch("app.core.audit.SessionLocal"):
        yield fake


def _route_queries(mock_db, results):
    """db.query(Model) returns a chain whose .first() / .all() yield results[Model]."""
    def query(model, *args):
        chain = MagicMock()
        value = results.get(model)
        chain.filter.return_value = chain
        chain.order_by.return_value = chain
        chain.options.return_value = chain
        chain.first.return_value = value[0] if isinstance(value, list) and value else value
        chain.all.return_value = value if isinstance(value, list) else ([value] if value else [])
        return chain
    mock_db.query.side_effect = query


def _rpc(method, params=None, msg_id=1):
    message = {"jsonrpc": "2.0", "method": method, "id": msg_id}
    if params is not None:
        message["params"] = params
    return message


def _pkce():
    verifier = "v" * 64
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


# ==============================================================================
# Feature flags
# ==============================================================================

class TestFeatureFlags:
    @pytest.fixture(autouse=True)
    def _open_mode(self):
        with patch("app.core.security.AUTH_MODE", "no"):
            yield

    def test_config_exposes_flags(self, client):
        with patch.object(settings, "PLANTNET_API_KEY", "k"), patch.object(settings, "LLM_PROVIDER", "claude"):
            data = client.get("/api/config").json()
        assert data["ai_enabled"] is True
        assert data["mcp_enabled"] is True
        assert data["identification_enabled"] is True
        assert data["llm_provider"] == "claude"

    def test_ai_master_switch_turns_everything_off(self, client):
        with patch.object(settings, "AI_ENABLED", False), patch.object(settings, "PLANTNET_API_KEY", "k"), \
             patch.object(settings, "LLM_PROVIDER", "claude"):
            data = client.get("/api/config").json()
            mcp = client.post("/api/mcp", json=_rpc("ping"))
        assert data["llm_provider"] == ""
        assert data["identification_enabled"] is False
        assert data["mcp_enabled"] is False
        assert mcp.status_code == 404

    def test_llm_switch_only_hides_llm(self, client):
        with patch.object(settings, "LLM_ENABLED", False), patch.object(settings, "LLM_PROVIDER", "claude"), \
             patch.object(settings, "PLANTNET_API_KEY", "k"):
            data = client.get("/api/config").json()
        assert data["llm_provider"] == ""
        assert data["identification_enabled"] is True
        assert data["mcp_enabled"] is True

    def test_identification_off_without_plantnet_key(self, client):
        with patch.object(settings, "PLANTNET_API_KEY", None):
            assert client.get("/api/config").json()["identification_enabled"] is False
            response = client.post("/api/plants/1/identify")
        assert response.status_code == 404

    @pytest.mark.parametrize("path", [
        "/api/plants/1/care_advice",
        "/api/plants/1/care_helper",
        "/api/plants/1/generate_description",
    ])
    def test_llm_endpoints_404_when_disabled(self, client, path):
        with patch.object(settings, "LLM_ENABLED", False), patch.object(settings, "LLM_PROVIDER", "claude"):
            response = client.post(path)
        assert response.status_code == 404
        assert "disabled" in response.json()["detail"]

    def test_llm_endpoints_404_without_provider(self, client):
        """No API key configured used to surface as a 500 'Unsupported LLM provider'."""
        with patch.object(settings, "LLM_PROVIDER", ""):
            response = client.post("/api/plants/1/care_advice")
        assert response.status_code == 404

    def test_mcp_disabled_by_default(self, client):
        with patch.object(settings, "MCP_ENABLED", False):
            assert client.post("/api/mcp", json=_rpc("ping")).status_code == 404
            assert client.get("/.well-known/oauth-authorization-server").status_code == 404


# ==============================================================================
# MCP protocol (AUTH_MODE=no: open, like the rest of the app)
# ==============================================================================

class TestMcpProtocol:
    @pytest.fixture(autouse=True)
    def _open_mode(self):
        with patch("app.core.security.AUTH_MODE", "no"):
            yield

    def test_initialize_negotiates_version(self, client):
        body = client.post("/api/mcp", json=_rpc("initialize", {"protocolVersion": "2025-06-18"})).json()
        assert body["result"]["protocolVersion"] == "2025-06-18"
        assert body["result"]["serverInfo"]["name"] == "pflanzn"
        assert "tools" in body["result"]["capabilities"]

    def test_unknown_version_gets_latest(self, client):
        body = client.post("/api/mcp", json=_rpc("initialize", {"protocolVersion": "1999-01-01"})).json()
        assert body["result"]["protocolVersion"] == "2025-11-25"

    def test_notification_is_accepted_without_body(self, client):
        response = client.post("/api/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"})
        assert response.status_code == 202
        assert response.content == b""

    def test_parse_error(self, client):
        response = client.post("/api/mcp", content=b"{not json", headers={"Content-Type": "application/json"})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == -32700

    def test_unknown_method(self, client):
        assert client.post("/api/mcp", json=_rpc("nope")).json()["error"]["code"] == -32601

    def test_get_is_not_allowed(self, client):
        assert client.get("/api/mcp").status_code == 405

    def test_tools_list_open_mode_has_write_tools(self, client):
        tools = client.post("/api/mcp", json=_rpc("tools/list")).json()["result"]["tools"]
        names = {t["name"] for t in tools}
        assert {"list_plants", "get_plant", "water_plants", "add_plant_note"} <= names
        for tool in tools:
            assert tool["inputSchema"]["type"] == "object"
            assert tool["annotations"]["destructiveHint"] is False

    def test_batch(self, client):
        response = client.post("/api/mcp", json=[_rpc("ping", msg_id=1), _rpc("ping", msg_id=2)])
        assert [r["id"] for r in response.json()] == [1, 2]

    def test_unknown_tool_is_invalid_params(self, client):
        body = client.post("/api/mcp", json=_rpc("tools/call", {"name": "drop_db", "arguments": {}})).json()
        assert body["error"]["code"] == -32602

    def test_tool_error_is_reported_in_result(self, client, mock_db):
        _route_queries(mock_db, {Plant: None})
        body = client.post("/api/mcp", json=_rpc("tools/call", {"name": "get_plant", "arguments": {"plant_id": 9}}))
        result = body.json()["result"]
        assert result["isError"] is True
        assert "not found" in result["content"][0]["text"]

    def test_bad_argument_type(self, client):
        body = client.post("/api/mcp", json=_rpc("tools/call", {"name": "get_plant", "arguments": {"plant_id": "x"}}))
        assert body.json()["result"]["isError"] is True

    def test_water_plants_rejects_unknown_ids_without_writing(self, client, mock_db):
        _route_queries(mock_db, {Plant: [Plant(id=1, name="Fern")]})
        body = client.post("/api/mcp", json=_rpc("tools/call", {
            "name": "water_plants", "arguments": {"plant_ids": [1, 2]},
        })).json()
        assert body["result"]["isError"] is True
        assert "[2]" in body["result"]["content"][0]["text"]
        mock_db.commit.assert_not_called()

    def test_water_plants(self, client, mock_db):
        _route_queries(mock_db, {Plant: [Plant(id=1, name="Fern"), Plant(id=2, name="Monstera")]})
        body = client.post("/api/mcp", json=_rpc("tools/call", {
            "name": "water_plants", "arguments": {"plant_ids": [1, 2], "watered_at": "2026-01-02T08:00"},
        })).json()
        payload = json.loads(body["result"]["content"][0]["text"])
        assert [p["name"] for p in payload["watered"]] == ["Fern", "Monstera"]
        assert mock_db.add.call_count == 2
        mock_db.commit.assert_called_once()

    def test_future_timestamp_rejected(self, client, mock_db):
        _route_queries(mock_db, {Plant: [Plant(id=1, name="Fern")]})
        future = (datetime.utcnow() + timedelta(days=2)).isoformat()
        body = client.post("/api/mcp", json=_rpc("tools/call", {
            "name": "water_plants", "arguments": {"plant_ids": [1], "watered_at": future},
        })).json()
        assert body["result"]["isError"] is True

    def test_list_locations_hidden_when_feature_off(self, client):
        with patch.object(settings, "ENABLE_LOCATIONS", False):
            tools = client.post("/api/mcp", json=_rpc("tools/list")).json()["result"]["tools"]
        assert "list_locations" not in {t["name"] for t in tools}


# ==============================================================================
# MCP authentication (local / oidc)
# ==============================================================================

def _grant(scope="pflanzn:read pflanzn:write"):
    user = User(id=5, username="alice", email="a@example.com", role="user")
    grant = OAuthGrant(id=1, client_id=7, user_id=5, scope=scope,
                       access_expires_at=datetime.utcnow() + timedelta(hours=1))
    grant.user = user
    return grant


class TestMcpAuth:
    @pytest.fixture(autouse=True)
    def _oidc(self):
        with patch("app.core.security.AUTH_MODE", "oidc"):
            yield

    def test_missing_token_challenges_with_metadata(self, client):
        response = client.post("/api/mcp", json=_rpc("initialize"))
        assert response.status_code == 401
        challenge = response.headers["www-authenticate"]
        assert challenge.startswith("Bearer ")
        assert f'resource_metadata="{BASE}/.well-known/oauth-protected-resource/api/mcp"' in challenge

    def test_invalid_token(self, client, mock_db):
        _route_queries(mock_db, {OAuthGrant: None})
        response = client.post("/api/mcp", json=_rpc("ping"), headers={"Authorization": "Bearer nope"})
        assert response.status_code == 401
        assert 'error="invalid_token"' in response.headers["www-authenticate"]

    def test_expired_token(self, client, mock_db):
        grant = _grant()
        grant.access_expires_at = datetime.utcnow() - timedelta(seconds=1)
        _route_queries(mock_db, {OAuthGrant: grant})
        response = client.post("/api/mcp", json=_rpc("ping"), headers={"Authorization": "Bearer t"})
        assert response.status_code == 401

    def test_session_cookie_is_not_enough(self, client):
        client.cookies.set("access_token", "x")
        try:
            assert client.post("/api/mcp", json=_rpc("ping")).status_code == 401
        finally:
            client.cookies.clear()

    def test_read_only_grant_hides_write_tools(self, client, mock_db):
        _route_queries(mock_db, {OAuthGrant: _grant("pflanzn:read")})
        headers = {"Authorization": "Bearer t"}
        tools = client.post("/api/mcp", json=_rpc("tools/list"), headers=headers).json()["result"]["tools"]
        assert "water_plants" not in {t["name"] for t in tools}

        body = client.post("/api/mcp", json=_rpc("tools/call", {
            "name": "water_plants", "arguments": {"plant_ids": [1]},
        }), headers=headers).json()
        assert body["result"]["isError"] is True
        assert "read-only" in body["result"]["content"][0]["text"]

    def test_write_is_attributed_to_grant_user(self, client, mock_db):
        grant = _grant()
        results = {OAuthGrant: grant, Plant: [Plant(id=3, name="Basil")]}
        _route_queries(mock_db, results)
        client.post("/api/mcp", json=_rpc("tools/call", {
            "name": "water_plants", "arguments": {"plant_ids": [3]},
        }), headers={"Authorization": "Bearer t"})
        watering = mock_db.add.call_args.args[0]
        assert watering.user_id == 5


# ==============================================================================
# OAuth authorization server
# ==============================================================================

class TestOAuth:
    @pytest.fixture(autouse=True)
    def _oidc(self):
        with patch("app.core.security.AUTH_MODE", "oidc"):
            yield

    def test_not_available_in_open_mode(self, client):
        with patch("app.core.security.AUTH_MODE", "no"):
            assert client.get("/.well-known/oauth-authorization-server").status_code == 404
            assert client.post("/api/oauth/register", json={}).status_code == 404

    def test_metadata(self, client):
        prm = client.get("/.well-known/oauth-protected-resource/api/mcp").json()
        assert prm["resource"] == f"{BASE}/api/mcp"
        assert prm["authorization_servers"] == [BASE]

        asm = client.get("/.well-known/oauth-authorization-server").json()
        assert asm["issuer"] == BASE
        assert asm["registration_endpoint"] == f"{BASE}/api/oauth/register"
        assert asm["code_challenge_methods_supported"] == ["S256"]

    @pytest.mark.parametrize("uri", [
        "http://evil.example/cb",
        "javascript:alert(1)",
        "https://claude.ai/cb#frag",
        "",
    ])
    def test_register_rejects_bad_redirects(self, client, uri):
        response = client.post("/api/oauth/register", json={"redirect_uris": [uri]})
        assert response.status_code == 400
        assert response.json()["error"] == "invalid_redirect_uri"

    def test_register_public_client(self, client, mock_db):
        response = client.post("/api/oauth/register", json={
            "redirect_uris": [REDIRECT, "http://localhost:3334/cb"],
            "client_name": "Claude\x00",
            "token_endpoint_auth_method": "none",
        })
        assert response.status_code == 201
        body = response.json()
        assert "client_secret" not in body
        stored = mock_db.add.call_args.args[0]
        assert stored.client_secret_hash is None
        assert stored.client_name == "Claude"

    def test_register_confidential_client_stores_only_hash(self, client, mock_db):
        body = client.post("/api/oauth/register", json={"redirect_uris": [REDIRECT]}).json()
        stored = mock_db.add.call_args.args[0]
        assert body["client_secret"]
        assert stored.client_secret_hash == hashlib.sha256(body["client_secret"].encode()).hexdigest()

    def test_register_rate_limited(self, client, _env):
        _env.store["oauth:register:testclient"] = 20
        response = client.post("/api/oauth/register", json={"redirect_uris": [REDIRECT]})
        assert response.status_code == 429

    def test_authorize_unknown_client_does_not_redirect(self, client, mock_db):
        _route_queries(mock_db, {OAuthClient: None})
        response = client.get("/api/oauth/authorize", params={"client_id": "x", "redirect_uri": REDIRECT},
                              follow_redirects=False)
        assert response.status_code == 400

    def test_authorize_unregistered_redirect(self, client, mock_db):
        _route_queries(mock_db, {OAuthClient: OAuthClient(id=7, client_id="c", redirect_uris=json.dumps([REDIRECT]))})
        response = client.get("/api/oauth/authorize", params={
            "client_id": "c", "redirect_uri": "https://evil.example/cb",
        }, follow_redirects=False)
        assert response.status_code == 400

    def test_authorize_requires_pkce(self, client, mock_db):
        _route_queries(mock_db, {OAuthClient: OAuthClient(id=7, client_id="c", redirect_uris=json.dumps([REDIRECT]))})
        response = client.get("/api/oauth/authorize", params={
            "client_id": "c", "redirect_uri": REDIRECT, "response_type": "code", "state": "s",
        }, follow_redirects=False)
        assert response.status_code == 302
        query = parse_qs(urlparse(response.headers["location"]).query)
        assert query["error"] == ["invalid_request"]
        assert query["state"] == ["s"]

    def test_approve_requires_login(self, client, _env):
        _env.store["oauth:req:r1"] = json.dumps({"client_pk": 7, "redirect_uri": REDIRECT, "state": None,
                                                  "code_challenge": "c", "scopes": ["pflanzn:read"]})
        assert client.post("/api/oauth/requests/r1/approve", json={}).status_code == 401
        assert "oauth:req:r1" in _env.store

    def test_full_flow(self, client, mock_db, override_dep, _env):
        from app.api.routes.oauth import consent_user as require_write_access

        user = User(id=5, username="alice", email="a@example.com", role="user")
        oauth_client = OAuthClient(id=7, client_id="c", client_name="Claude", client_secret_hash=None,
                                   redirect_uris=json.dumps([REDIRECT]))
        results = {OAuthClient: oauth_client, User: user}
        _route_queries(mock_db, results)
        verifier, challenge = _pkce()

        # 1) authorize -> SPA consent page
        response = client.get("/api/oauth/authorize", params={
            "client_id": "c", "redirect_uri": REDIRECT, "response_type": "code", "state": "xyz",
            "code_challenge": challenge, "code_challenge_method": "S256", "scope": "pflanzn:read pflanzn:write",
        }, follow_redirects=False)
        assert response.status_code == 302
        location = urlparse(response.headers["location"])
        assert location.path == "/oauth/authorize"
        request_id = parse_qs(location.query)["request_id"][0]

        info = client.get(f"/api/oauth/requests/{request_id}").json()
        assert info["client_name"] == "Claude" and info["redirect_host"] == "claude.ai"
        assert info["scopes"] == ["pflanzn:read", "pflanzn:write"] and info["login"] == "app"

        # 2) user approves, read-only
        override_dep(require_write_access, user)
        approved = client.post(f"/api/oauth/requests/{request_id}/approve", json={"allow_write": False}).json()
        callback = parse_qs(urlparse(approved["redirect_url"]).query)
        assert callback["state"] == ["xyz"]
        assert callback["iss"] == [BASE]
        code = callback["code"][0]

        # 3) wrong verifier fails and burns the code
        bad = client.post("/api/oauth/token", data={
            "grant_type": "authorization_code", "code": code, "client_id": "c", "code_verifier": "w" * 64,
        })
        assert bad.status_code == 400 and bad.json()["error"] == "invalid_grant"

        # 4) a fresh code with the right verifier yields tokens
        response = client.get("/api/oauth/authorize", params={
            "client_id": "c", "redirect_uri": REDIRECT, "response_type": "code",
            "code_challenge": challenge, "code_challenge_method": "S256",
        }, follow_redirects=False)
        request_id = parse_qs(urlparse(response.headers["location"]).query)["request_id"][0]
        approved = client.post(f"/api/oauth/requests/{request_id}/approve", json={"allow_write": False}).json()
        code = parse_qs(urlparse(approved["redirect_url"]).query)["code"][0]

        tokens = client.post("/api/oauth/token", data={
            "grant_type": "authorization_code", "code": code, "client_id": "c",
            "code_verifier": verifier, "redirect_uri": REDIRECT,
        })
        assert tokens.status_code == 200
        assert tokens.headers["cache-control"] == "no-store"
        body = tokens.json()
        assert body["token_type"] == "Bearer"
        assert body["scope"] == "pflanzn:read"
        assert body["access_token"].startswith("pfz_at_")
        grant = mock_db.add.call_args.args[0]
        assert grant.access_token_hash == hashlib.sha256(body["access_token"].encode()).hexdigest()

        # 5) the code is single use
        replay = client.post("/api/oauth/token", data={
            "grant_type": "authorization_code", "code": code, "client_id": "c", "code_verifier": verifier,
        })
        assert replay.json()["error"] == "invalid_grant"

        # 6) refresh rotates both tokens
        results[OAuthGrant] = grant
        refreshed = client.post("/api/oauth/token", data={
            "grant_type": "refresh_token", "refresh_token": body["refresh_token"], "client_id": "c",
        }).json()
        assert refreshed["access_token"] != body["access_token"]
        assert grant.refresh_token_hash == hashlib.sha256(refreshed["refresh_token"].encode()).hexdigest()

    def test_confidential_client_needs_secret(self, client, mock_db):
        secret = "s3cret"
        oauth_client = OAuthClient(id=7, client_id="c", redirect_uris=json.dumps([REDIRECT]),
                                   client_secret_hash=hashlib.sha256(secret.encode()).hexdigest())
        _route_queries(mock_db, {OAuthClient: oauth_client})
        response = client.post("/api/oauth/token", data={"grant_type": "refresh_token", "client_id": "c"})
        assert response.status_code == 401
        assert response.json()["error"] == "invalid_client"

        basic = base64.b64encode(f"c:{secret}".encode()).decode()
        _route_queries(mock_db, {OAuthClient: oauth_client, OAuthGrant: None})
        response = client.post("/api/oauth/token", data={"grant_type": "refresh_token", "refresh_token": "x"},
                               headers={"Authorization": f"Basic {basic}"})
        assert response.json()["error"] == "invalid_grant"

    def test_refresh_token_bound_to_client(self, client, mock_db):
        grant = OAuthGrant(id=1, client_id=99, user_id=5, scope="pflanzn:read",
                           refresh_expires_at=datetime.utcnow() + timedelta(days=1))
        _route_queries(mock_db, {OAuthClient: OAuthClient(id=7, client_id="c", redirect_uris="[]"),
                                 OAuthGrant: grant})
        response = client.post("/api/oauth/token", data={
            "grant_type": "refresh_token", "refresh_token": "x", "client_id": "c",
        })
        assert response.json()["error"] == "invalid_grant"

    def test_users_cannot_revoke_others_grants(self, client, mock_db, override_dep):
        from app.core.security import require_write_access

        other = OAuthGrant(id=1, client_id=7, user_id=99, scope="pflanzn:read")
        _route_queries(mock_db, {OAuthGrant: other})
        override_dep(require_write_access, User(id=5, username="alice", email="a@x", role="user"))
        assert client.delete("/api/oauth/grants/1").status_code == 404
        mock_db.delete.assert_not_called()


# ==============================================================================
# Helpers
# ==============================================================================

class TestHelpers:
    @pytest.mark.parametrize("path,expected", [
        ("/oauth/authorize?request_id=abc", "/oauth/authorize?request_id=abc"),
        ("/plants", "/plants"),
        ("//evil.example", None),
        ("/\\evil.example", None),
        ("https://evil.example", None),
        ("plants", None),
        (None, None),
    ])
    def test_safe_next(self, path, expected):
        from app.api.routes.auth import _safe_next

        assert _safe_next(path) == expected

    def test_parse_scopes(self):
        from app.services.mcp_oauth import parse_scopes

        assert parse_scopes(None) == ["pflanzn:read", "pflanzn:write"]
        assert parse_scopes("openid") == ["pflanzn:read", "pflanzn:write"]
        assert parse_scopes("pflanzn:read") == ["pflanzn:read"]

    def test_build_redirect_keeps_existing_query(self):
        from app.services.mcp_oauth import build_redirect

        assert build_redirect("https://a.example/cb?x=1", {"code": "c", "state": None}) == \
            "https://a.example/cb?x=1&code=c"

    def test_tag_names_are_deduplicated(self):
        from app.services.mcp_tools import _arg_tags

        assert _arg_tags({"tags": [" herbs", "herbs", ""]}, "tags") == ["herbs"]

    def test_set_plant_tags_creates_missing(self, mock_db):
        from app.services.mcp_tools import ToolContext, set_plant_tags

        plant = Plant(id=1, name="Basil")
        _route_queries(mock_db, {Plant: plant, Tag: None})
        result = set_plant_tags(ToolContext(db=mock_db, user=None, scopes=set()),
                                {"plant_id": 1, "tags": ["kitchen"]})
        assert result["tags"] == ["kitchen"]


def test_oidc_callback_returns_to_saved_page(client, mock_db):
    """The MCP consent page sends users through /api/auth/oidc-login?next=…; the
    callback must bring them back there instead of to the home page."""
    from app.api.routes import auth as auth_routes

    user = User(id=5, username="alice", email="a@example.com", role="user", auth_type="oidc")
    _route_queries(mock_db, {User: user})
    token = {"access_token": "a", "expires_in": 300}
    session = {"post_login_next": "/oauth/authorize?request_id=abc"}

    async def fake_token(request):
        request.scope["session"] = session
        return token

    async def fake_userinfo(token):
        return {"email": "a@example.com", "email_verified": True, "preferred_username": "alice"}

    fake_oidc = MagicMock(authorize_access_token=fake_token, userinfo=fake_userinfo)
    with patch.object(auth_routes, "AUTH_MODE", "oidc"), patch.object(auth_routes.oauth, "oidc", fake_oidc, create=True), \
         patch("app.core.security.redis_client"), patch("app.api.routes.auth.record_audit"):
        response = client.get("/api/auth/oidc/callback", follow_redirects=False)
    assert response.headers["location"] == "/oauth/authorize?request_id=abc"
    assert "post_login_next" not in session


# ==============================================================================
# External OAuth server (MCP_OAUTH_ISSUER)
# ==============================================================================

ISSUER = "https://id.example/application/o/pflanzn/"


class TestExternalOAuth:
    @pytest.fixture(autouse=True)
    def _external(self):
        with patch("app.core.security.AUTH_MODE", "oidc"), \
             patch.object(settings, "MCP_OAUTH_ISSUER", ISSUER), \
             patch.object(settings, "OIDC_REQUIRE_VERIFIED_EMAIL", False), \
             patch("app.services.mcp_external_auth.issuer", return_value=ISSUER):
            yield

    def test_metadata_points_to_external_issuer(self, client):
        prm = client.get("/.well-known/oauth-protected-resource/api/mcp").json()
        assert prm["authorization_servers"] == [ISSUER]
        assert "openid" in prm["scopes_supported"]

    def test_builtin_server_is_off(self, client):
        assert client.get("/.well-known/oauth-authorization-server").status_code == 404
        assert client.post("/api/oauth/register", json={"redirect_uris": [REDIRECT]}).status_code == 404

    def test_valid_token_maps_to_user_by_email(self, client, mock_db):
        user = User(id=5, username="alice", email="a@example.com", role="user")
        _route_queries(mock_db, {User: user, Plant: [Plant(id=3, name="Basil")]})
        with patch("app.services.mcp_external_auth.verify_token", return_value={"email": "a@example.com"}):
            client.post("/api/mcp", json=_rpc("tools/call", {
                "name": "water_plants", "arguments": {"plant_ids": [3]},
            }), headers={"Authorization": "Bearer ext"})
        assert mock_db.add.call_args.args[0].user_id == 5

    def test_unknown_email_rejected(self, client, mock_db):
        _route_queries(mock_db, {User: None})
        with patch("app.services.mcp_external_auth.verify_token", return_value={"email": "x@example.com"}):
            response = client.post("/api/mcp", json=_rpc("ping"), headers={"Authorization": "Bearer ext"})
        assert response.status_code == 401

    def test_invalid_token_rejected(self, client):
        with patch("app.services.mcp_external_auth.verify_token", return_value=None):
            response = client.post("/api/mcp", json=_rpc("ping"), headers={"Authorization": "Bearer ext"})
        assert response.status_code == 401
        assert 'scope="openid' in response.headers["www-authenticate"]

    def test_pflanzn_read_scope_narrows_access(self, client, mock_db):
        _route_queries(mock_db, {User: User(id=5, username="alice", email="a@example.com", role="user")})
        claims = {"email": "a@example.com", "scope": "openid pflanzn:read"}
        with patch("app.services.mcp_external_auth.verify_token", return_value=claims):
            tools = client.post("/api/mcp", json=_rpc("tools/list"),
                                headers={"Authorization": "Bearer ext"}).json()["result"]["tools"]
        assert "water_plants" not in {t["name"] for t in tools}


class TestExternalJwt:
    KEY = {"kty": "oct", "k": base64.urlsafe_b64encode(b"k" * 32).rstrip(b"=").decode(), "alg": "HS256"}
    META = {"issuer": ISSUER, "jwks_uri": "https://id.example/jwks", "userinfo_endpoint": "https://id.example/ui"}

    @pytest.fixture(autouse=True)
    def _cache(self):
        from app.services import mcp_external_auth

        with patch.dict(mcp_external_auth._cache, {"metadata": self.META, "jwks": {"keys": [self.KEY]},
                                                   "fetched_at": 9e18}), \
             patch.object(settings, "MCP_OAUTH_ISSUER", ISSUER):
            yield

    def _token(self, **claims):
        from jose import jwt

        payload = {"iss": ISSUER, "aud": "claude", "exp": int(time.time()) + 60,
                   "email": "a@example.com", **claims}
        return jwt.encode(payload, b"k" * 32, algorithm="HS256")

    def test_valid_jwt(self):
        from app.services.mcp_external_auth import verify_token

        assert verify_token(self._token())["email"] == "a@example.com"

    def test_wrong_issuer(self):
        from app.services.mcp_external_auth import verify_token

        assert verify_token(self._token(iss="https://other.example/")) is None

    def test_audience_enforced_when_configured(self):
        from app.services.mcp_external_auth import verify_token

        with patch.object(settings, "MCP_OAUTH_AUDIENCE", "pflanzn-mcp"):
            assert verify_token(self._token()) is None
            assert verify_token(self._token(aud="pflanzn-mcp")) is not None

    def test_forged_jwt_never_falls_back_to_userinfo(self):
        from jose import jwt

        from app.services.mcp_external_auth import verify_token

        forged = jwt.encode({"iss": ISSUER, "email": "a@example.com"}, b"x" * 32, algorithm="HS256")
        with patch("app.services.mcp_external_auth._userinfo") as userinfo:
            assert verify_token(forged) is None
        userinfo.assert_not_called()


# ==============================================================================
# Separate MCP login provider (MCP_LOGIN_PROVIDER)
# ==============================================================================

class TestMcpLoginProvider:
    PENDING = {"client_pk": 7, "redirect_uri": REDIRECT, "state": "s", "code_challenge": "c",
               "scopes": ["pflanzn:read", "pflanzn:write"]}

    @pytest.fixture(autouse=True)
    def _github(self, _env):
        _env.store["oauth:req:r1"] = json.dumps(self.PENDING)
        with patch("app.core.security.AUTH_MODE", "oidc"), \
             patch.object(settings, "MCP_LOGIN_PROVIDER", "github"), \
             patch.object(settings, "MCP_LOGIN_CLIENT_ID", "gh-client"), \
             patch("app.api.routes.oauth.COOKIE_SECURE", False):
            yield

    def _login(self, client, mock_db, emails=("a@example.com",), user="default"):
        if user == "default":
            user = User(id=5, username="alice", email="a@example.com", role="user")
        _route_queries(mock_db, {User: user, OAuthClient: OAuthClient(id=7, client_id="c", client_name="Claude",
                                                                      redirect_uris=json.dumps([REDIRECT]))})
        start = client.get("/api/oauth/login/start", params={"request_id": "r1"}, follow_redirects=False)
        assert start.status_code == 302
        location = urlparse(start.headers["location"])
        assert location.netloc == "github.com"
        query = parse_qs(location.query)
        assert query["client_id"] == ["gh-client"]
        assert query["redirect_uri"] == [f"{BASE}/api/oauth/login/callback"]
        with patch("app.services.mcp_login.verified_emails", return_value=list(emails)):
            return client.get("/api/oauth/login/callback", params={"state": query["state"][0], "code": "x"},
                              follow_redirects=False)

    def test_login_binds_request_to_browser(self, client, mock_db, _env):
        callback = self._login(client, mock_db)
        assert callback.headers["location"] == "/oauth/authorize?request_id=r1"
        assert "mcp_login" in callback.cookies

        info = client.get("/api/oauth/requests/r1").json()
        assert info["login"] == "github" and info["login_name"] == "GitHub" and info["username"] == "alice"

        approved = client.post("/api/oauth/requests/r1/approve", json={"allow_write": True})
        assert approved.status_code == 200
        code = parse_qs(urlparse(approved.json()["redirect_url"]).query)["code"][0]
        assert json.loads(_env.store[f"oauth:code:{hashlib.sha256(code.encode()).hexdigest()}"])["user_id"] == 5

    def test_other_browser_cannot_approve(self, client, mock_db, _env):
        self._login(client, mock_db)
        client.cookies.clear()
        assert client.get("/api/oauth/requests/r1").json()["username"] is None
        assert client.post("/api/oauth/requests/r1/approve", json={}).status_code == 401
        assert "oauth:req:r1" in _env.store

    def test_app_session_is_not_used(self, client, override_dep):
        from app.core.security import require_write_access

        override_dep(require_write_access, User(id=5, username="alice", email="a@x", role="user"))
        assert client.post("/api/oauth/requests/r1/approve", json={}).status_code == 401

    def test_unknown_email(self, client, mock_db):
        callback = self._login(client, mock_db, user=None)
        assert callback.headers["location"].endswith("&error=no_account")

    def test_state_is_single_use(self, client, mock_db):
        self._login(client, mock_db)
        assert client.get("/api/oauth/login/callback", params={"state": "bogus", "code": "x"}).status_code == 400

    def test_start_404_without_provider(self, client):
        with patch.object(settings, "MCP_LOGIN_PROVIDER", ""):
            assert client.get("/api/oauth/login/start", params={"request_id": "r1"}).status_code == 404


def test_github_only_verified_emails():
    from app.services import mcp_login

    emails = [{"email": "a@example.com", "verified": True}, {"email": "b@example.com", "verified": False}]
    token = MagicMock(status_code=200, json=lambda: {"access_token": "t"})
    listing = MagicMock(status_code=200, json=lambda: emails)
    http = MagicMock()
    http.__enter__.return_value = http
    http.post.return_value = token
    http.get.return_value = listing
    with patch.object(settings, "MCP_LOGIN_PROVIDER", "github"), patch("app.services.mcp_login.httpx.Client",
                                                                       return_value=http):
        assert mcp_login.verified_emails(BASE, "code", "verifier") == ["a@example.com"]
