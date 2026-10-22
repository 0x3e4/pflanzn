"""Caps request body size before anything parses it.

Multipart bodies are spooled to temporary files while FastAPI resolves a route's
parameters — before its auth dependencies run — so without a cap an anonymous
client could fill the disk with one large upload. Reverse proxies often limit this
too, but a self-hosted install can't rely on how its proxy is configured.
"""
from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class _TooLarge(HTTPException):
    """Raised from receive(): the app's own exception handling turns it into a 413
    (FastAPI re-raises HTTPExceptions that occur while parsing a body)."""

    def __init__(self):
        super().__init__(status_code=413, detail="Request body is too large")


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def _reject(self, send: Send) -> None:
        body = b'{"detail":"Request body is too large"}'
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
        })
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = dict(scope.get("headers") or []).get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_bytes:
            await self._reject(send)
            return

        # Chunked bodies have no Content-Length: count as they stream in.
        received = 0
        started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _TooLarge()
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _TooLarge:
            if not started:
                await self._reject(send)
