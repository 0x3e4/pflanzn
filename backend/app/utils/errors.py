def public_error(message: str, exc: BaseException) -> str:
    """The `detail` of an error response: what failed and the kind of error, never the
    exception's own text. That text can carry a request URL with an API key in it
    (requests puts the full URL into its errors), SQL, or file paths. Log `exc` instead."""
    return f"{message} ({type(exc).__name__})"
