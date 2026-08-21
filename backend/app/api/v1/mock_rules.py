import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.mock_endpoint import MockEndpoint
from app.models.mock_response_rule import MockResponseRule
from app.models.mock_sequence import MockSequence, MockSequenceStep
from app.models.user import User
from app.schemas.mock import (
    MockRuleCreate,
    MockRuleUpdate,
    MockRuleResponse,
    MockRuleListResponse,
    MockSequenceCreate,
    MockSequenceUpdate,
    MockSequenceResponse,
    MockSequenceListResponse,
    SequenceStepResponse,
)
from app.services.workspace_service import check_workspace_access

router = APIRouter()


async def _get_mock_and_check_access(
    mock_id: uuid.UUID,
    user: User,
    db: AsyncSession,
    min_role: str = "viewer",
) -> MockEndpoint:
    result = await db.execute(
        select(MockEndpoint).where(MockEndpoint.id == mock_id)
    )
    mock = result.scalar_one_or_none()
    if not mock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mock endpoint not found")

    member = await check_workspace_access(mock.workspace_id, user.id, db, min_role=min_role)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return mock


# ── Rules ──────────────────────────────────────────────────────────


@router.post(
    "/mocks/{mock_id}/rules",
    status_code=status.HTTP_201_CREATED,
    response_model=MockRuleResponse,
)
async def create_rule(
    mock_id: uuid.UUID,
    body: MockRuleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_mock_and_check_access(mock_id, user, db, min_role="editor")

    rule = MockResponseRule(
        mock_endpoint_id=mock_id,
        name=body.name,
        description=body.description,
        priority=body.priority,
        is_active=body.is_active,
        match_conditions=[c.model_dump() for c in body.match_conditions],
        response_status=body.response_status,
        response_headers=body.response_headers or {},
        response_body=body.response_body,
        response_delay_ms=body.response_delay_ms,
    )
    db.add(rule)
    await db.flush()
    await db.commit()
    await db.refresh(rule)

    return MockRuleResponse(
        id=rule.id,
        mock_endpoint_id=rule.mock_endpoint_id,
        name=rule.name,
        description=rule.description,
        priority=rule.priority,
        is_active=rule.is_active,
        match_conditions=rule.match_conditions if isinstance(rule.match_conditions, list) else [rule.match_conditions],
        response_status=rule.response_status,
        response_headers=rule.response_headers,
        response_body=rule.response_body,
        response_delay_ms=rule.response_delay_ms,
        created_at=rule.created_at,
    )


@router.get(
    "/mocks/{mock_id}/rules",
    response_model=MockRuleListResponse,
)
async def list_rules(
    mock_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_mock_and_check_access(mock_id, user, db)

    result = await db.execute(
        select(MockResponseRule)
        .where(MockResponseRule.mock_endpoint_id == mock_id)
        .order_by(MockResponseRule.priority.desc())
    )
    rules = list(result.scalars().all())

    return MockRuleListResponse(
        data=[
            MockRuleResponse(
                id=r.id,
                mock_endpoint_id=r.mock_endpoint_id,
                name=r.name,
                description=r.description,
                priority=r.priority,
                is_active=r.is_active,
                match_conditions=r.match_conditions if isinstance(r.match_conditions, list) else [r.match_conditions],
                response_status=r.response_status,
                response_headers=r.response_headers,
                response_body=r.response_body,
                response_delay_ms=r.response_delay_ms,
                created_at=r.created_at,
            )
            for r in rules
        ]
    )


@router.patch(
    "/mocks/{mock_id}/rules/{rule_id}",
    response_model=MockRuleResponse,
)
async def update_rule(
    mock_id: uuid.UUID,
    rule_id: uuid.UUID,
    body: MockRuleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_mock_and_check_access(mock_id, user, db, min_role="editor")

    result = await db.execute(
        select(MockResponseRule).where(
            MockResponseRule.id == rule_id,
            MockResponseRule.mock_endpoint_id == mock_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    update_data = body.model_dump(exclude_unset=True)
    if "match_conditions" in update_data and update_data["match_conditions"] is not None:
        update_data["match_conditions"] = [c.model_dump() if hasattr(c, "model_dump") else c for c in update_data["match_conditions"]]

    for key, value in update_data.items():
        setattr(rule, key, value)

    await db.flush()
    await db.commit()
    await db.refresh(rule)

    return MockRuleResponse(
        id=rule.id,
        mock_endpoint_id=rule.mock_endpoint_id,
        name=rule.name,
        description=rule.description,
        priority=rule.priority,
        is_active=rule.is_active,
        match_conditions=rule.match_conditions if isinstance(rule.match_conditions, list) else [rule.match_conditions],
        response_status=rule.response_status,
        response_headers=rule.response_headers,
        response_body=rule.response_body,
        response_delay_ms=rule.response_delay_ms,
        created_at=rule.created_at,
    )


@router.delete(
    "/mocks/{mock_id}/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_rule(
    mock_id: uuid.UUID,
    rule_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_mock_and_check_access(mock_id, user, db, min_role="editor")

    result = await db.execute(
        select(MockResponseRule).where(
            MockResponseRule.id == rule_id,
            MockResponseRule.mock_endpoint_id == mock_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    await db.delete(rule)
    await db.commit()


# ── Sequences ──────────────────────────────────────────────────────


@router.post(
    "/mocks/{mock_id}/sequences",
    status_code=status.HTTP_201_CREATED,
    response_model=MockSequenceResponse,
)
async def create_sequence(
    mock_id: uuid.UUID,
    body: MockSequenceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_mock_and_check_access(mock_id, user, db, min_role="editor")

    sequence = MockSequence(
        mock_endpoint_id=mock_id,
        name=body.name,
        is_active=body.is_active,
        loop=body.loop,
    )
    db.add(sequence)
    await db.flush()

    for step_data in body.steps:
        step = MockSequenceStep(
            sequence_id=sequence.id,
            step_order=step_data.step_order,
            response_status=step_data.response_status,
            response_headers=step_data.response_headers or {},
            response_body=step_data.response_body,
            response_delay_ms=step_data.response_delay_ms,
        )
        db.add(step)

    await db.flush()
    await db.commit()

    # Reload with steps
    result = await db.execute(
        select(MockSequence)
        .options(selectinload(MockSequence.steps))
        .where(MockSequence.id == sequence.id)
    )
    sequence = result.scalar_one()

    return _sequence_to_response(sequence)


@router.get(
    "/mocks/{mock_id}/sequences",
    response_model=MockSequenceListResponse,
)
async def list_sequences(
    mock_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_mock_and_check_access(mock_id, user, db)

    result = await db.execute(
        select(MockSequence)
        .options(selectinload(MockSequence.steps))
        .where(MockSequence.mock_endpoint_id == mock_id)
        .order_by(MockSequence.created_at.desc())
    )
    sequences = list(result.scalars().all())

    return MockSequenceListResponse(
        data=[_sequence_to_response(s) for s in sequences]
    )


@router.patch(
    "/mocks/{mock_id}/sequences/{seq_id}",
    response_model=MockSequenceResponse,
)
async def update_sequence(
    mock_id: uuid.UUID,
    seq_id: uuid.UUID,
    body: MockSequenceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_mock_and_check_access(mock_id, user, db, min_role="editor")

    result = await db.execute(
        select(MockSequence)
        .options(selectinload(MockSequence.steps))
        .where(
            MockSequence.id == seq_id,
            MockSequence.mock_endpoint_id == mock_id,
        )
    )
    sequence = result.scalar_one_or_none()
    if not sequence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sequence not found")

    update_data = body.model_dump(exclude_unset=True)
    steps_data = update_data.pop("steps", None)

    for key, value in update_data.items():
        setattr(sequence, key, value)

    # Replace steps if provided
    if steps_data is not None:
        # Delete existing steps
        for old_step in sequence.steps:
            await db.delete(old_step)
        await db.flush()

        # Create new steps
        for step_data in steps_data:
            step = MockSequenceStep(
                sequence_id=sequence.id,
                step_order=step_data["step_order"],
                response_status=step_data.get("response_status", 200),
                response_headers=step_data.get("response_headers") or {},
                response_body=step_data.get("response_body"),
                response_delay_ms=step_data.get("response_delay_ms", 0),
            )
            db.add(step)

    await db.flush()
    await db.commit()

    # Reload
    result = await db.execute(
        select(MockSequence)
        .options(selectinload(MockSequence.steps))
        .where(MockSequence.id == seq_id)
    )
    sequence = result.scalar_one()

    return _sequence_to_response(sequence)


@router.delete(
    "/mocks/{mock_id}/sequences/{seq_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_sequence(
    mock_id: uuid.UUID,
    seq_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_mock_and_check_access(mock_id, user, db, min_role="editor")

    result = await db.execute(
        select(MockSequence).where(
            MockSequence.id == seq_id,
            MockSequence.mock_endpoint_id == mock_id,
        )
    )
    sequence = result.scalar_one_or_none()
    if not sequence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sequence not found")

    await db.delete(sequence)
    await db.commit()


def _sequence_to_response(sequence: MockSequence) -> MockSequenceResponse:
    sorted_steps = sorted(sequence.steps, key=lambda s: s.step_order)
    return MockSequenceResponse(
        id=sequence.id,
        mock_endpoint_id=sequence.mock_endpoint_id,
        name=sequence.name,
        is_active=sequence.is_active,
        loop=sequence.loop,
        current_step=sequence.current_step,
        steps=[
            SequenceStepResponse(
                id=s.id,
                step_order=s.step_order,
                response_status=s.response_status,
                response_headers=s.response_headers,
                response_body=s.response_body,
                response_delay_ms=s.response_delay_ms,
            )
            for s in sorted_steps
        ],
        created_at=sequence.created_at,
    )
