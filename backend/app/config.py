from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/hooktrap"
    redis_url: str = "redis://localhost:6379"

    # Auth
    secret_key: str = "change-me-to-a-random-string-min-32-chars-long"
    magic_link_expiry_hours: int = 24
    session_expiry_days: int = 30
    algorithm: str = "HS256"

    # Email
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "noreply@hooktrap.dev"

    # App
    environment: str = "development"
    api_base_url: str = "http://localhost:8000"
    frontend_base_url: str = "http://localhost:3000"

    # Monitoring
    sentry_dsn: str = ""

    # Rate Limiting
    rate_limit_enabled: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
