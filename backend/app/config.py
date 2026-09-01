from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache

# Infrastructure seeds unset third-party credentials with this sentinel (SSM
# Parameter Store does not accept empty values). Treat it as unset so the
# "not configured" paths behave correctly instead of calling the API with it.
_PLACEHOLDER = "REPLACE_ME"


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mocklane"
    redis_url: str = "redis://localhost:6379"

    # Auth
    secret_key: str = "change-me-to-a-random-string-min-32-chars-long"
    magic_link_expiry_hours: int = 24
    session_expiry_days: int = 30
    algorithm: str = "HS256"

    # Email
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "info@mocklane.com"

    # App
    environment: str = "development"
    api_base_url: str = "http://localhost:8000"
    frontend_base_url: str = "http://localhost:3000"

    # Monitoring
    sentry_dsn: str = ""

    # SMTP Fake Inbox
    smtp_server_host: str = "127.0.0.1"
    smtp_server_port: int = 2525
    smtp_server_hostname: str = "inbox.mocklane.com"

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # Rate Limiting
    rate_limit_enabled: bool = True

    @field_validator(
        "sendgrid_api_key",
        "stripe_secret_key",
        "stripe_publishable_key",
        "stripe_webhook_secret",
        "sentry_dsn",
        mode="after",
    )
    @classmethod
    def _blank_placeholders(cls, v: str) -> str:
        return "" if v == _PLACEHOLDER else v

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
