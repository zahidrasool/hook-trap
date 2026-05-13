import re


def validate_path(path: str) -> bool:
    """Validate mock endpoint path format."""
    if not path.startswith("/"):
        return False
    if len(path) > 500:
        return False
    return True


def validate_http_method(method: str) -> bool:
    """Validate HTTP method."""
    return method.upper() in ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
