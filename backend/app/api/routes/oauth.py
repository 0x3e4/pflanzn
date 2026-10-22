"""OAuth endpoints that let MCP clients (Claude web/desktop, …) connect to /api/mcp.

Flow: the client discovers us via the /.well-known documents, registers itself
(RFC 7591), and sends the user's browser to /api/oauth/authorize. That validates
the request and hands over to the SPA consent page (/oauth/authorize), which makes
sure the user is logged in — locally or via OIDC — and posts the decision back.
The client then trades the code for tokens at /api/oauth/token (PKCE required).
"""
import base64
import binascii
import hmac
import json
import logging
import re
import secrets
from datetime import datetime
from typing import List, Optional
from urllib.parse import unquote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.api.routes.auth import COOKIE_SECURE
from app.core import security
from app.core.audit import client_ip, record_audit
from app.core.config import settings
from app.core.security import require_write_access
from app.database import get_db
from app.models import OAuthClient, OAuthGrant, User
from app.schemas import OAuthDecision, OAuthGrantResponse, OAuthRedirect, OAuthRequestInfo
from app.services import mcp_external_auth, mcp_login, mcp_oauth

logger = logging.getLogger(__name__)


def _mcp_auth() -> str:
    # Re-derived per call so tests can patch security.AUTH_MODE.
    if settings.MCP_OAUTH_ISSUER:
        return "external"
    return "none" if security.AUTH_MODE == "no" else "builtin"


def require_mcp_oauth() -> None:
    """Protected-resource metadata: whenever MCP needs a token."""
    if not settings.mcp_available or _mcp_auth() == "none":
        raise HTTPException(status_code=404, detail="Not found")


def require_builtin_oauth() -> None:
    """Pflanzn's own authorization server: only when no external one is configured.
    In AUTH_MODE=no the MCP endpoint is open like the rest of the app."""
    if not settings.mcp_available or _mcp_auth() != "builtin":
        raise HTTPException(status_code=404, detail="Not found")


router = APIRouter(dependencies=[Depends(require_builtin_oauth)])
well_known_router = APIRouter(dependencies=[Depends(require_mcp_oauth)])

_NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def _oauth_error(error: str, description: str, status_code: int = 400, headers: Optional[dict] = None):
    return JSONResponse(
        {"error": error, "error_description": description},
        status_code=status_code,
        headers={**_NO_STORE, **(headers or {})},
    )


# ==============================================================================
# Discovery
# ==============================================================================

@well_known_router.get("/.well-known/oauth-protected-resource")
@well_known_router.get("/.well-known/oauth-protected-resource/api/mcp")
def protected_resource_metadata(request: Request):
    base = mcp_oauth.public_base(request)
    if _mcp_auth() == "external":
        return mcp_oauth.protected_resource_metadata(
            base, mcp_external_auth.issuer(), mcp_oauth.EXTERNAL_SCOPES
        )
    return mcp_oauth.protected_resource_metadata(base)


@well_known_router.get("/.well-known/oauth-authorization-server", dependencies=[Depends(require_builtin_oauth)])
def authorization_server_metadata(request: Request):
    return mcp_oauth.authorization_server_metadata(mcp_oauth.public_base(request))


# ==============================================================================
# Dynamic client registration (RFC 7591)
# ==============================================================================

@router.post("/register", status_code=201)
async def register_client(request: Request, db: Session = Depends(get_db)):
    if not mcp_oauth.registration_allowed(client_ip(request)):
        return _oauth_error("invalid_request", "Too many client registrations, try again later", 429)

    try:
        metadata = await request.json()
    except (ValueError, UnicodeDecodeError):
        metadata = None
    if not isinstance(metadata, dict):
        return _oauth_error("invalid_client_metadata", "Body must be a JSON object")

    redirect_uris = metadata.get("redirect_uris")
    if (
        not isinstance(redirect_uris, list)
        or not 1 <= len(redirect_uris) <= mcp_oauth.MAX_REDIRECT_URIS
        or not all(mcp_oauth.is_valid_redirect_uri(u) for u in redirect_uris)
    ):
        return _oauth_error(
            "invalid_redirect_uri",
            "redirect_uris must list 1-10 https, loopback http or app-scheme URIs without fragments",
        )

    grant_types = metadata.get("grant_types") or ["authorization_code"]
    if not isinstance(grant_types, list) or "authorization_code" not in grant_types:
        return _oauth_error("invalid_client_metadata", "grant_types must include authorization_code")
    response_types = metadata.get("response_types") or ["code"]
    if not isinstance(response_types, list) or "code" not in response_types:
        return _oauth_error("invalid_client_metadata", "response_types must include code")

    auth_method = metadata.get("token_endpoint_auth_method") or "client_secret_basic"
    if auth_method not in ("none", "client_secret_post", "client_secret_basic"):
        return _oauth_error("invalid_client_metadata", f"Unsupported token_endpoint_auth_method: {auth_method}")

    client_name = metadata.get("client_name")
    client_name = _CONTROL_CHARS.sub("", client_name).strip()[:255] if isinstance(client_name, str) else ""

    client_id = secrets.token_urlsafe(24)
    client_secret = None if auth_method == "none" else secrets.token_urlsafe(32)
    client = OAuthClient(
        client_id=client_id,
        client_secret_hash=mcp_oauth.hash_token(client_secret) if client_secret else None,
        client_name=client_name or None,
        redirect_uris=json.dumps(redirect_uris),
    )
    db.add(client)
    db.commit()
    logger.info(f"Registered OAuth client {client_id} ({client_name or 'unnamed'})")

    body = {
        "client_id": client_id,
        "client_id_issued_at": int(datetime.utcnow().timestamp()),
        "client_name": client_name or None,
        "redirect_uris": redirect_uris,
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": auth_method,
        "scope": " ".join(mcp_oauth.SUPPORTED_SCOPES),
    }
    if client_secret:
        body["client_secret"] = client_secret
        body["client_secret_expires_at"] = 0
    return JSONResponse(body, status_code=201, headers=_NO_STORE)


# ==============================================================================
# Authorization + consent
# ==============================================================================

@router.get("/authorize")
def authorize(request: Request, db: Session = Depends(get_db)):
    params = request.query_params
    client = db.query(OAuthClient).filter(OAuthClient.client_id == params.get("client_id", "")).first()
    if not client:
        # Never redirect to an unverified URI — show the error here instead.
        raise HTTPException(status_code=400, detail="Unknown client_id. Remove and re-add the connector.")

    registered = mcp_oauth.client_redirect_uris(client)
    redirect_uri = params.get("redirect_uri")
    if not redirect_uri and len(registered) == 1:
        redirect_uri = registered[0]
    if not redirect_uri or redirect_uri not in registered:
        raise HTTPException(status_code=400, detail="redirect_uri does not match the registered client")

    base = mcp_oauth.public_base(request)
    state = params.get("state")

    def fail(error: str, description: str):
        return RedirectResponse(
            mcp_oauth.build_redirect(
                redirect_uri, {"error": error, "error_description": description, "state": state, "iss": base}
            ),
            status_code=302,
        )

    if params.get("response_type") != "code":
        return fail("unsupported_response_type", "Only response_type=code is supported")
    if not params.get("code_challenge") or params.get("code_challenge_method") != "S256":
        return fail("invalid_request", "PKCE with code_challenge_method=S256 is required")

    request_id = mcp_oauth.save_pending_request({
        "client_pk": client.id,
        "redirect_uri": redirect_uri,
        "state": state,
        "code_challenge": params["code_challenge"],
        "scopes": mcp_oauth.parse_scopes(params.get("scope")),
    })
    return RedirectResponse(f"/oauth/authorize?request_id={request_id}", status_code=302)


def _pending_or_404(request_id: str) -> dict:
    pending = mcp_oauth.load_pending_request(request_id)
    if not pending:
        raise HTTPException(status_code=404, detail="This authorization request has expired. Start again from your app.")
    return pending


# Set after signing in with the MCP login provider. Binds that login to this browser,
# so a request_id leaked mid-flow can't be approved from somewhere else.
LOGIN_COOKIE = "mcp_login"


def _provider_user(request: Request, pending: dict, db: Session) -> Optional[User]:
    """User who signed in for this request via MCP_LOGIN_PROVIDER, in this browser."""
    expected = pending.get("login_binding")
    if not expected or not pending.get("login_user_id"):
        return None
    if not hmac.compare_digest(expected, mcp_login.binding_hash(request.cookies.get(LOGIN_COOKIE))):
        return None
    return db.query(User).filter(User.id == pending["login_user_id"]).first()


def consent_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Who is approving: the MCP login provider's user if one is configured,
    otherwise the normal app session."""
    if not mcp_login.provider():
        return require_write_access(request, db)
    request_id = request.path_params.get("request_id", "")
    user = _provider_user(request, _pending_or_404(request_id), db)
    if not user:
        raise HTTPException(status_code=401, detail=f"Sign in with {mcp_login.display_name()} first")
    return user


@router.get("/requests/{request_id}", response_model=OAuthRequestInfo)
def get_request(request_id: str, request: Request, db: Session = Depends(get_db)):
    pending = _pending_or_404(request_id)
    client = db.query(OAuthClient).filter(OAuthClient.id == pending["client_pk"]).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client no longer exists")
    login = mcp_login.provider()
    user = _provider_user(request, pending, db) if login else None
    return OAuthRequestInfo(
        client_name=client.client_name or "Unnamed client",
        redirect_host=mcp_oauth.redirect_host(pending["redirect_uri"]),
        scopes=pending["scopes"],
        login=login or "app",
        login_name=mcp_login.display_name() if login else None,
        username=user.username if user else None,
    )


@router.get("/login/start")
def login_start(request_id: str, request: Request):
    """Sends the browser to the MCP login provider for this pending request."""
    if not mcp_login.provider():
        raise HTTPException(status_code=404, detail="Not found")
    _pending_or_404(request_id)
    verifier, challenge = mcp_login.new_pkce()
    state = mcp_oauth.save_login_state({"request_id": request_id, "verifier": verifier})
    try:
        url = mcp_login.authorize_url(mcp_oauth.public_base(request), state, challenge)
    except httpx.HTTPError as exc:
        logger.error(f"MCP login provider unreachable: {exc}")
        raise HTTPException(status_code=502, detail="Login provider unreachable")
    return RedirectResponse(url, status_code=302)


@router.get("/login/callback")
def login_callback(request: Request, db: Session = Depends(get_db)):
    data = mcp_oauth.consume_login_state(request.query_params.get("state") or "")
    if not data:
        raise HTTPException(status_code=400, detail="Login expired. Start again from your app.")
    request_id = data["request_id"]
    consent_url = f"/oauth/authorize?request_id={request_id}"
    pending = mcp_oauth.load_pending_request(request_id)
    code = request.query_params.get("code")
    if not pending or not code:
        return RedirectResponse(f"{consent_url}&error=login_failed", status_code=302)

    try:
        emails = mcp_login.verified_emails(mcp_oauth.public_base(request), code, data["verifier"])
    except mcp_login.LoginError as exc:
        return RedirectResponse(f"{consent_url}&error={exc.code}", status_code=302)
    user = db.query(User).filter(User.email.in_(emails)).first() if emails else None
    if not user:
        return RedirectResponse(f"{consent_url}&error=no_account", status_code=302)

    binding = secrets.token_urlsafe(32)
    pending.update(login_user_id=user.id, login_binding=mcp_login.binding_hash(binding))
    mcp_oauth.update_pending_request(request_id, pending)
    response = RedirectResponse(consent_url, status_code=302)
    response.set_cookie(LOGIN_COOKIE, binding, max_age=mcp_oauth.REQUEST_TTL_SECONDS, httponly=True,
                        secure=COOKIE_SECURE, samesite="lax", path="/api/oauth")
    return response


@router.post("/requests/{request_id}/approve", response_model=OAuthRedirect)
def approve_request(
    request_id: str,
    decision: OAuthDecision,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(consent_user),
):
    pending = _pending_or_404(request_id)
    mcp_oauth.drop_pending_request(request_id)

    scopes = [s for s in pending["scopes"] if decision.allow_write or s != mcp_oauth.SCOPE_WRITE]
    if mcp_oauth.SCOPE_READ not in scopes:
        scopes.insert(0, mcp_oauth.SCOPE_READ)

    code = mcp_oauth.save_authorization_code({
        "client_pk": pending["client_pk"],
        "user_id": current_user.id,
        "redirect_uri": pending["redirect_uri"],
        "code_challenge": pending["code_challenge"],
        "scope": " ".join(scopes),
    })
    client = db.query(OAuthClient).filter(OAuthClient.id == pending["client_pk"]).first()
    record_audit(request, action="oauth.authorize", entity_type="oauth_client",
                 entity_id=pending["client_pk"], user_id=current_user.id, username=current_user.username,
                 status_code=200, details={"client": client.client_name if client else None, "scope": scopes})
    return OAuthRedirect(redirect_url=mcp_oauth.build_redirect(
        pending["redirect_uri"],
        {"code": code, "state": pending.get("state"), "iss": mcp_oauth.public_base(request)},
    ))


@router.post("/requests/{request_id}/deny", response_model=OAuthRedirect)
def deny_request(request_id: str, request: Request):
    pending = _pending_or_404(request_id)
    mcp_oauth.drop_pending_request(request_id)
    return OAuthRedirect(redirect_url=mcp_oauth.build_redirect(
        pending["redirect_uri"],
        {
            "error": "access_denied",
            "error_description": "The user denied access",
            "state": pending.get("state"),
            "iss": mcp_oauth.public_base(request),
        },
    ))


# ==============================================================================
# Token + revocation
# ==============================================================================

def _client_credentials(request: Request, form) -> tuple[Optional[str], Optional[str]]:
    """client_secret_basic wins over client_secret_post / public client_id."""
    header = request.headers.get("authorization", "")
    if header.lower().startswith("basic "):
        try:
            decoded = base64.b64decode(header[6:].strip()).decode()
            client_id, _, secret = decoded.partition(":")
            return unquote(client_id), unquote(secret)
        except (binascii.Error, UnicodeDecodeError):
            return None, None
    return form.get("client_id"), form.get("client_secret")


def _authenticate_client(request: Request, form, db: Session) -> Optional[OAuthClient]:
    client_id, secret = _client_credentials(request, form)
    if not client_id:
        return None
    client = db.query(OAuthClient).filter(OAuthClient.client_id == client_id).first()
    if not client or not mcp_oauth.verify_client_secret(client, secret):
        return None
    return client


@router.post("/token")
async def token(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    client = _authenticate_client(request, form, db)
    if not client:
        return _oauth_error("invalid_client", "Client authentication failed", 401,
                            headers={"WWW-Authenticate": 'Basic realm="pflanzn"'})

    grant_type = form.get("grant_type")

    if grant_type == "authorization_code":
        data = mcp_oauth.consume_authorization_code(form.get("code") or "")
        if not data or data["client_pk"] != client.id:
            return _oauth_error("invalid_grant", "Authorization code is invalid or expired")
        if form.get("redirect_uri") and form.get("redirect_uri") != data["redirect_uri"]:
            return _oauth_error("invalid_grant", "redirect_uri does not match the authorization request")
        verifier = form.get("code_verifier") or ""
        if not verifier or not mcp_oauth.verify_pkce(verifier, data["code_challenge"]):
            return _oauth_error("invalid_grant", "PKCE verification failed")
        user = db.query(User).filter(User.id == data["user_id"]).first()
        if not user:
            return _oauth_error("invalid_grant", "User no longer exists")

        grant = OAuthGrant(client_id=client.id, user_id=user.id, scope=data["scope"])
        db.add(grant)
        body = mcp_oauth.issue_tokens(grant)
        db.commit()
        return JSONResponse(body, headers=_NO_STORE)

    if grant_type == "refresh_token":
        grant = mcp_oauth.find_grant_by_refresh_token(db, form.get("refresh_token") or "")
        if not grant or grant.client_id != client.id:
            return _oauth_error("invalid_grant", "Refresh token is invalid, expired or revoked")
        body = mcp_oauth.issue_tokens(grant)
        db.commit()
        return JSONResponse(body, headers=_NO_STORE)

    return _oauth_error("unsupported_grant_type", "Use authorization_code or refresh_token")


@router.post("/revoke")
async def revoke(request: Request, db: Session = Depends(get_db)):
    """RFC 7009: always 200, whether or not the token existed."""
    form = await request.form()
    client = _authenticate_client(request, form, db)
    if not client:
        return _oauth_error("invalid_client", "Client authentication failed", 401)

    token_hash = mcp_oauth.hash_token(form.get("token") or "")
    grant = db.query(OAuthGrant).filter(
        OAuthGrant.client_id == client.id,
        (OAuthGrant.access_token_hash == token_hash) | (OAuthGrant.refresh_token_hash == token_hash),
    ).first()
    if grant:
        db.delete(grant)
        db.commit()
    return JSONResponse({}, headers=_NO_STORE)


# ==============================================================================
# Connected apps (Manage → MCP)
# ==============================================================================

@router.get("/grants", response_model=List[OAuthGrantResponse])
def list_grants(db: Session = Depends(get_db), current_user: User = Depends(require_write_access)):
    """The caller's connections; admins see everyone's. Expired grants are pruned."""
    db.query(OAuthGrant).filter(OAuthGrant.refresh_expires_at < datetime.utcnow()).delete(synchronize_session=False)
    db.commit()

    query = db.query(OAuthGrant)
    if current_user.role != "admin":
        query = query.filter(OAuthGrant.user_id == current_user.id)
    return [
        OAuthGrantResponse(
            id=g.id,
            client_name=(g.client.client_name if g.client else None) or "Unnamed client",
            username=g.user.username if g.user else None,
            scopes=g.scope.split(),
            created_at=g.created_at,
            last_used_at=g.last_used_at,
        )
        for g in query.order_by(OAuthGrant.created_at.desc()).all()
    ]


@router.delete("/grants/{grant_id}")
def delete_grant(
    grant_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write_access),
):
    grant = db.query(OAuthGrant).filter(OAuthGrant.id == grant_id).first()
    if not grant or (grant.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Connection not found")

    client_name = grant.client.client_name if grant.client else None
    db.delete(grant)
    db.commit()
    record_audit(request, action="oauth.revoke", entity_type="oauth_grant", entity_id=grant_id,
                 user_id=current_user.id, username=current_user.username, status_code=200,
                 details={"client": client_name})
    return {"message": "Connection revoked"}
