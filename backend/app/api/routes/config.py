from fastapi import APIRouter

from app.core.config import APP_VERSION, settings
from app.schemas import AppConfigResponse

router = APIRouter()


@router.get("", response_model=AppConfigResponse)
def get_app_config():
    """Runtime configuration consumed by the frontend on startup.

    Unauthenticated on purpose so the SPA can bootstrap before the user is known.
    """
    return AppConfigResponse(
        version=APP_VERSION,
        tz=settings.TZ,
        locale=settings.LOCALE,
        auth_mode=settings.AUTH_MODE,
        show_protected_view=settings.SHOW_PROTECTED_VIEW,
        enable_locations=settings.ENABLE_LOCATIONS,
        # Empty when text generation is off, so the frontend hides every LLM button.
        llm_provider=(settings.LLM_PROVIDER or "") if settings.llm_available else "",
        ai_enabled=settings.AI_ENABLED,
        identification_enabled=settings.identification_available,
        mcp_enabled=settings.mcp_available,
        mcp_auth=settings.mcp_auth,
        mcp_login=(settings.MCP_LOGIN_PROVIDER or "").lower() or "app",
        domain=settings.DOMAIN or "",
        oidc_name=settings.OIDC_NAME or "",
        admin_user=settings.ADMIN_USER or None,
    )
