from fastapi import APIRouter

from app.core.config import settings
from app.schemas import AppConfigResponse

router = APIRouter()


@router.get("", response_model=AppConfigResponse)
def get_app_config():
    """Runtime configuration consumed by the frontend on startup.

    Unauthenticated on purpose so the SPA can bootstrap before the user is known.
    """
    return AppConfigResponse(
        tz=settings.TZ,
        locale=settings.LOCALE,
        auth_mode=settings.AUTH_MODE,
        show_protected_view=settings.SHOW_PROTECTED_VIEW,
        enable_locations=settings.ENABLE_LOCATIONS,
        llm_provider=settings.LLM_PROVIDER or "",
        domain=settings.DOMAIN or "",
        oidc_name=settings.OIDC_NAME or "",
        admin_user=settings.ADMIN_USER or None,
    )
