import asyncio
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.db.database import Base, get_db
from app.models.user import User
from app.services.auth_service import create_session_token

# Tests run against a real Postgres database. SQLite is not an option: JSONB
# does not compile on it, and the scenario run queue needs FOR UPDATE SKIP
# LOCKED, which SQLite has no equivalent for.
#
# Addressed by IP, not by name, on purpose. Several test modules monkeypatch
# socket.getaddrinfo to exercise the SSRF guard, and an autouse fixture doing
# that is instantiated before the db fixtures connect — so a hostname here
# would be resolved through the patch and asyncpg would try to reach Postgres
# at whatever address the test's fake resolver returns.
TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/mocklane_test"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(email="test@example.com", email_verified=True)
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(test_user: User) -> dict:
    token = create_session_token(str(test_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def other_user(db_session: AsyncSession) -> User:
    user = User(email="other@example.com", email_verified=True)
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def other_auth_headers(other_user: User) -> dict:
    token = create_session_token(str(other_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def no_outbound_email(monkeypatch):
    """No test may send real mail.

    The magic-link endpoint calls Amazon SES, which fails in CI and — worse —
    succeeds against whatever AWS credentials are ambient. Every test runs with
    delivery stubbed out; assertions look at the token, not the inbox.
    """

    async def _noop(to, subject, html, *, required):
        return True

    monkeypatch.setattr("app.services.email_service._send", _noop)


@pytest_asyncio.fixture
async def test_workspace(db_session: AsyncSession, test_user: User):
    from app.services.workspace_service import create_workspace

    workspace = await create_workspace("Test Workspace", None, test_user, db_session)
    await db_session.commit()
    return workspace
