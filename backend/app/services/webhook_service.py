# Webhook service - additional webhook processing logic

from app.models.webhook import WebhookCapture


def generate_curl_command(capture: WebhookCapture) -> str:
    """Generate a cURL command from a captured webhook request."""
    cmd = f"curl -X {capture.http_method} '{capture.source_ip or 'https://example.com'}{capture.path or '/'}'"
    for key, value in (capture.headers or {}).items():
        if key.lower() not in ["host", "content-length"]:
            cmd += f" \\\n  -H '{key}: {value}'"
    if capture.body:
        body_escaped = capture.body.replace("'", "'\"'\"'")
        cmd += f" \\\n  -d '{body_escaped}'"
    return cmd
