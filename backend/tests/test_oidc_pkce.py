"""The OIDC login sends a PKCE challenge and keeps the verifier for the token exchange.

Regression: code_challenge_method was passed to authorize_redirect instead of the client's
kwargs, so authlib sent the method without a challenge and no verifier: PKCE was off.
"""
import asyncio
from urllib.parse import parse_qs, urlparse

from authlib.integrations.starlette_client import OAuth

from app.api.routes.auth import OIDC_CLIENT_KWARGS


def test_authorization_url_carries_an_s256_challenge():
    oauth = OAuth()
    oauth.register(
        name="idp",
        client_id="pflanzn",
        client_secret="secret",
        authorize_url="https://idp.example/authorize",
        access_token_url="https://idp.example/token",
        client_kwargs=OIDC_CLIENT_KWARGS,
    )
    rv = asyncio.run(oauth.idp.create_authorization_url(redirect_uri="https://plants.example/cb", nonce="n"))

    query = parse_qs(urlparse(rv["url"]).query)
    assert query["code_challenge_method"] == ["S256"]
    assert query["code_challenge"][0]
    assert rv["code_verifier"]  # kept in the session state for the token exchange
