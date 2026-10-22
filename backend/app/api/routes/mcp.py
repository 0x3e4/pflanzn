"""MCP server (Streamable HTTP transport, stateless JSON responses).

Clients POST JSON-RPC messages to /api/mcp. Every request carries an OAuth bearer
token from /api/oauth (AUTH_MODE=no excepted, where the app is open anyway), so
there is no session to keep and GET/SSE streams are not offered.
"""
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core import security
from app.core.audit import record_audit
from app.core.config import APP_VERSION, settings
from app.database import get_db
from app.models import User
from app.services import mcp_external_auth, mcp_oauth, mcp_tools

logger = logging.getLogger(__name__)

SUPPORTED_PROTOCOL_VERSIONS = ("2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05")
LAST_USED_RESOLUTION = timedelta(minutes=5)

PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


def require_mcp() -> None:
    if not settings.mcp_available:
        raise HTTPException(status_code=404, detail="MCP is disabled on this server")


router = APIRouter(dependencies=[Depends(require_mcp)])


@dataclass
class Principal:
    user: Optional[User]
    scopes: set[str]


def _unauthorized(request: Request, error: Optional[str] = None) -> JSONResponse:
    base = mcp_oauth.public_base(request)
    challenge = f'Bearer resource_metadata="{mcp_oauth.protected_resource_metadata_url(base)}"'
    scopes = mcp_oauth.EXTERNAL_SCOPES if settings.MCP_OAUTH_ISSUER else mcp_oauth.SUPPORTED_SCOPES
    challenge += f', scope="{" ".join(scopes)}"'
    if error:
        challenge += f', error="{error}"'
    return JSONResponse(
        {"error": error or "unauthorized", "error_description": "A valid OAuth access token is required"},
        status_code=401,
        headers={"WWW-Authenticate": challenge},
    )


def _authenticate_external(request: Request, db: Session, token: str) -> Principal | JSONResponse:
    """Token from MCP_OAUTH_ISSUER, mapped to the Pflanzn account with the same email."""
    claims = mcp_external_auth.verify_token(token)
    if not claims:
        return _unauthorized(request, "invalid_token")
    if settings.OIDC_REQUIRE_VERIFIED_EMAIL and str(claims.get("email_verified")).lower() != "true":
        return _unauthorized(request, "invalid_token")

    email = claims.get("email")
    user = db.query(User).filter(User.email == email).first() if email else None
    if not user and security.AUTH_MODE != "no":
        return _unauthorized(request, "invalid_token")

    # Pflanzn scopes on the token narrow access; a plain OIDC token gets read + write.
    scopes = {s for s in mcp_external_auth.token_scopes(claims) if s in mcp_oauth.SUPPORTED_SCOPES}
    if mcp_oauth.SCOPE_WRITE in scopes:
        scopes.add(mcp_oauth.SCOPE_READ)
    return Principal(user=user, scopes=scopes or set(mcp_oauth.SUPPORTED_SCOPES))


def _authenticate(request: Request, db: Session) -> Principal | JSONResponse:
    if security.AUTH_MODE == "no" and not settings.MCP_OAUTH_ISSUER:
        return Principal(user=None, scopes=set(mcp_oauth.SUPPORTED_SCOPES))

    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return _unauthorized(request)
    if settings.MCP_OAUTH_ISSUER:
        return _authenticate_external(request, db, header[7:].strip())
    grant = mcp_oauth.find_grant_by_access_token(db, header[7:].strip())
    if not grant or not grant.user:
        return _unauthorized(request, "invalid_token")

    now = datetime.utcnow()
    if not grant.last_used_at or now - grant.last_used_at > LAST_USED_RESOLUTION:
        grant.last_used_at = now
        db.commit()
    return Principal(user=grant.user, scopes=set(grant.scope.split()))


def _result(msg_id: Any, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def _error(msg_id: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def _instructions() -> str:
    return (
        "Pflanzn is the user's plant collection: plants with photos, watering/fertilizing logs, notes and "
        "care advice. Look up plant ids with list_plants before calling tools that take plant_id. "
        f"Times are in the {settings.TZ} timezone. Changes you make are attributed to the connected user "
        "and show up in the Pflanzn app immediately. There are no delete tools."
    )


def _initialize(params: dict) -> dict:
    requested = params.get("protocolVersion")
    version = requested if requested in SUPPORTED_PROTOCOL_VERSIONS else SUPPORTED_PROTOCOL_VERSIONS[0]
    return {
        "protocolVersion": version,
        "capabilities": {"tools": {"listChanged": False}},
        "serverInfo": {"name": "pflanzn", "title": "Pflanzn", "version": APP_VERSION},
        "instructions": _instructions(),
    }


def _call_tool(params: dict, principal: Principal, db: Session, request: Request, msg_id: Any) -> dict:
    name = params.get("name")
    arguments = params.get("arguments") or {}
    if not isinstance(arguments, dict):
        return _error(msg_id, INVALID_PARAMS, "arguments must be an object")

    tool = mcp_tools.find_tool(name, principal.scopes) if isinstance(name, str) else None
    if not tool:
        if name in {t.name for t in mcp_tools.TOOLS if t.write} and mcp_oauth.SCOPE_WRITE not in principal.scopes:
            return _result(msg_id, {
                "content": [{"type": "text", "text": "This connection is read-only. Reconnect Pflanzn and "
                                                     "allow changes to use this tool."}],
                "isError": True,
            })
        return _error(msg_id, INVALID_PARAMS, f"Unknown tool: {name}")

    ctx = mcp_tools.ToolContext(db=db, user=principal.user, scopes=principal.scopes)
    try:
        output = tool.handler(ctx, arguments)
    except mcp_tools.ToolError as exc:
        db.rollback()
        return _result(msg_id, {"content": [{"type": "text", "text": str(exc)}], "isError": True})
    except Exception:
        db.rollback()
        logger.exception(f"MCP tool {name} failed")
        return _result(msg_id, {"content": [{"type": "text", "text": "Internal error while running the tool."}],
                                "isError": True})

    if tool.write:
        plant_ids = arguments.get("plant_ids") or ([arguments["plant_id"]] if "plant_id" in arguments else None)
        if output and isinstance(output, dict) and "id" in output and not plant_ids:
            plant_ids = [output["id"]]
        record_audit(
            request,
            action=f"mcp.{tool.name}",
            entity_type="plant",
            entity_id=plant_ids[0] if plant_ids and len(plant_ids) == 1 else None,
            user_id=principal.user.id if principal.user else None,
            username=principal.user.username if principal.user else "mcp",
            status_code=200,
            details={"plant_ids": plant_ids},
        )

    if isinstance(output, list):  # tool built its own content blocks (e.g. images)
        return _result(msg_id, {"content": output, "isError": False})
    return _result(msg_id, {
        "content": [{"type": "text", "text": json.dumps(output, ensure_ascii=False, default=str)}],
        "isError": False,
    })


def _handle(message: Any, principal: Principal, db: Session, request: Request) -> Optional[dict]:
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return _error(message.get("id") if isinstance(message, dict) else None, INVALID_REQUEST,
                      "Invalid JSON-RPC 2.0 message")

    method = message.get("method")
    if method is None or "id" not in message:
        return None  # a notification, or a response to something we never asked — nothing to answer
    msg_id = message["id"]
    params = message.get("params") or {}
    if not isinstance(params, dict):
        return _error(msg_id, INVALID_PARAMS, "params must be an object")

    if method == "initialize":
        return _result(msg_id, _initialize(params))
    if method == "ping":
        return _result(msg_id, {})
    if method == "tools/list":
        return _result(msg_id, {"tools": [t.definition() for t in mcp_tools.visible_tools(principal.scopes)]})
    if method == "tools/call":
        return _call_tool(params, principal, db, request, msg_id)
    if method in ("resources/list", "resources/templates/list", "prompts/list"):
        key = {"resources/list": "resources", "resources/templates/list": "resourceTemplates"}.get(method, "prompts")
        return _result(msg_id, {key: []})
    return _error(msg_id, METHOD_NOT_FOUND, f"Method not found: {method}")


def _dispatch(payload: Any, request: Request, db: Session) -> Response:
    principal = _authenticate(request, db)
    if isinstance(principal, Response):
        return principal

    if isinstance(payload, list):  # JSON-RPC batch (protocol 2025-03-26)
        if not payload:
            return JSONResponse(_error(None, INVALID_REQUEST, "Empty batch"), status_code=400)
        replies = [r for r in (_handle(m, principal, db, request) for m in payload) if r is not None]
        return JSONResponse(replies) if replies else Response(status_code=202)

    reply = _handle(payload, principal, db, request)
    return JSONResponse(reply) if reply is not None else Response(status_code=202)


@router.post("")
@router.post("/")
async def mcp_endpoint(request: Request, db: Session = Depends(get_db)):
    try:
        payload = json.loads(await request.body())
    except (ValueError, UnicodeDecodeError):
        return JSONResponse(_error(None, PARSE_ERROR, "Parse error"), status_code=400)
    # Tools are synchronous ORM code; keep them off the event loop.
    return await run_in_threadpool(_dispatch, payload, request, db)


@router.get("")
@router.get("/")
@router.delete("")
@router.delete("/")
def mcp_no_stream():
    """No server-initiated SSE stream and no sessions to terminate in stateless mode."""
    return Response(status_code=405, headers={"Allow": "POST"})
