"""Scenario identity and creation.

A scenario owns a URL namespace, so creating one allocates two addresses at
once: a `short_id` for its mocks at /s/{short_id}/... and a capture endpoint
for its inbound webhooks at /h/{endpoint_short_id}. Allocating the capture
endpoint eagerly means `wait_for_webhook` always has somewhere to wait, with no
lazy-creation race inside the run.
"""

import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.endpoint import Endpoint
from app.models.scenario import Scenario
from app.utils.short_id import generate_short_id


def slugify(name: str) -> str:
    """URL-safe slug from a display name."""
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return slug[:120] or "scenario"


async def allocate_short_id(db: AsyncSession) -> str:
    """A globally unique short_id. Collisions are vanishingly rare; retry anyway."""
    for _ in range(10):
        candidate = generate_short_id()
        existing = await db.execute(
            select(Scenario.id).where(Scenario.short_id == candidate)
        )
        if existing.scalar_one_or_none() is None:
            return candidate
    raise RuntimeError("Could not allocate a unique scenario short_id")


async def allocate_slug(workspace_id: uuid.UUID, name: str, db: AsyncSession) -> str:
    """Slug unique within the workspace, suffixed when the base is taken."""
    base = slugify(name)
    result = await db.execute(
        select(Scenario.slug).where(Scenario.workspace_id == workspace_id)
    )
    taken = set(result.scalars().all())

    if base not in taken:
        return base
    for suffix in range(2, 1000):
        candidate = f"{base}-{suffix}"
        if candidate not in taken:
            return candidate
    raise RuntimeError("Could not allocate a unique scenario slug")


async def create_scenario(
    workspace,
    name: str,
    description: str | None,
    user,
    db: AsyncSession,
) -> Scenario:
    scenario = Scenario(
        workspace_id=workspace.id,
        short_id=await allocate_short_id(db),
        name=name,
        slug=await allocate_slug(workspace.id, name, db),
        description=description,
        steps=[],
        variables={},
        created_by=user.id,
    )
    db.add(scenario)
    await db.flush()

    capture_endpoint = Endpoint(
        user_id=user.id,
        scenario_id=scenario.id,
        short_id=generate_short_id(),
        name=f"{name} (scenario)",
        description="Capture endpoint owned by a scenario.",
    )
    db.add(capture_endpoint)
    await db.flush()
    await db.refresh(scenario)
    return scenario


async def get_scenario_by_slug(
    workspace_id: uuid.UUID, slug: str, db: AsyncSession
) -> Scenario | None:
    result = await db.execute(
        select(Scenario).where(
            Scenario.workspace_id == workspace_id,
            Scenario.slug == slug,
        )
    )
    return result.scalar_one_or_none()


async def get_scenario_by_short_id(short_id: str, db: AsyncSession) -> Scenario | None:
    result = await db.execute(select(Scenario).where(Scenario.short_id == short_id))
    return result.scalar_one_or_none()


async def get_capture_endpoint(scenario_id: uuid.UUID, db: AsyncSession) -> Endpoint | None:
    result = await db.execute(
        select(Endpoint).where(Endpoint.scenario_id == scenario_id).limit(1)
    )
    return result.scalar_one_or_none()
