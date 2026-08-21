import re
import json
import random
import asyncio
import time
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mock_endpoint import MockEndpoint
from app.models.mock_response_rule import MockResponseRule
from app.models.mock_request_log import MockRequestLog
from app.models.mock_sequence import MockSequence, MockSequenceStep
from app.models.workspace import Workspace
from app.db.redis import redis_client


async def get_active_mocks_for_workspace(workspace_id, db: AsyncSession) -> list[MockEndpoint]:
    result = await db.execute(
        select(MockEndpoint).where(
            MockEndpoint.workspace_id == workspace_id,
            MockEndpoint.is_active == True,
        )
    )
    return list(result.scalars().all())


def match_mock_endpoint(path: str, method: str, mocks: list[MockEndpoint]):
    """Match request path against configured mock endpoints."""
    # 1. Exact match
    exact = [m for m in mocks if m.path == path and m.method == method.upper()]
    if exact:
        return max(exact, key=lambda m: m.priority), {}

    # 2. Parameterized match
    param_matches = []
    for mock in mocks:
        if mock.method != method.upper():
            continue
        matched, params = match_path_pattern(mock.path, path)
        if matched:
            param_matches.append((mock, params))

    if param_matches:
        best = max(param_matches, key=lambda x: x[0].priority)
        return best[0], best[1]

    return None, {}


def match_path_pattern(pattern: str, actual_path: str) -> tuple[bool, dict]:
    """Match pattern like /api/users/:id against /api/users/123."""
    regex_pattern = re.sub(r':(\w+)', r'(?P<\1>[^/]+)', pattern)
    regex_pattern = regex_pattern.replace('/**', '/(?P<__wildcard>.*)')
    regex_pattern = f'^{regex_pattern}$'

    match = re.match(regex_pattern, actual_path)
    if match:
        params = {k: v for k, v in match.groupdict().items() if not k.startswith('_')}
        return True, params
    return False, {}


async def get_active_rules_for_mock(mock_endpoint_id, db: AsyncSession) -> list[MockResponseRule]:
    result = await db.execute(
        select(MockResponseRule).where(
            MockResponseRule.mock_endpoint_id == mock_endpoint_id,
            MockResponseRule.is_active == True,
        ).order_by(MockResponseRule.priority.desc())
    )
    return list(result.scalars().all())


def evaluate_condition(condition: dict, request_context: dict) -> bool:
    """Evaluate a single match condition against request context."""
    field_value = get_nested_value(request_context, condition.get("field", ""))
    operator = condition.get("operator", "equals")
    expected = condition.get("value")

    if operator == "exists":
        return field_value is not None

    if field_value is None:
        return False

    field_str = str(field_value)
    expected_str = str(expected) if expected is not None else ""

    if operator == "equals":
        return field_str == expected_str
    elif operator == "not_equals":
        return field_str != expected_str
    elif operator == "contains":
        return expected_str in field_str
    elif operator == "starts_with":
        return field_str.startswith(expected_str)
    elif operator == "ends_with":
        return field_str.endswith(expected_str)
    elif operator == "regex":
        return bool(re.match(expected_str, field_str))
    elif operator == "gt":
        try:
            return float(field_str) > float(expected_str)
        except ValueError:
            return False
    elif operator == "lt":
        try:
            return float(field_str) < float(expected_str)
        except ValueError:
            return False
    return False


def all_conditions_match(conditions: list | dict, request_context: dict) -> bool:
    """Check if all conditions match (AND logic)."""
    if isinstance(conditions, dict):
        conditions = [conditions]
    if not conditions:
        return False
    return all(evaluate_condition(c, request_context) for c in conditions)


def get_nested_value(data, dotpath: str):
    if data is None or not dotpath:
        return None
    keys = dotpath.split(".")
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list) and key.isdigit():
            idx = int(key)
            current = current[idx] if idx < len(current) else None
        else:
            return None
    return current


async def get_active_sequence(mock_endpoint_id, db: AsyncSession) -> MockSequence | None:
    result = await db.execute(
        select(MockSequence).where(
            MockSequence.mock_endpoint_id == mock_endpoint_id,
            MockSequence.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def get_sequence_steps(sequence_id, db: AsyncSession) -> list[MockSequenceStep]:
    result = await db.execute(
        select(MockSequenceStep).where(
            MockSequenceStep.sequence_id == sequence_id,
        ).order_by(MockSequenceStep.step_order)
    )
    return list(result.scalars().all())


async def increment_request_count(mock_endpoint_id, db: AsyncSession):
    await db.execute(
        update(MockEndpoint)
        .where(MockEndpoint.id == mock_endpoint_id)
        .values(request_count=MockEndpoint.request_count + 1)
    )


async def log_mock_request(
    mock_endpoint_id, workspace_id, method: str, path: str,
    query_params: dict, headers: dict, body: str | None,
    content_type: str | None, source_ip: str | None,
    response_status: int, response_delay_ms: int,
    matched_rule_id=None, matched_sequence_id=None,
    contract_valid=None, contract_errors=None,
    db: AsyncSession = None,
):
    log = MockRequestLog(
        mock_endpoint_id=mock_endpoint_id,
        workspace_id=workspace_id,
        method=method,
        path=path,
        query_params=query_params or {},
        headers=headers or {},
        body=body,
        body_size=len(body) if body else 0,
        content_type=content_type,
        source_ip=source_ip,
        matched_rule_id=matched_rule_id,
        matched_sequence_id=matched_sequence_id,
        response_status=response_status,
        response_delay_ms=response_delay_ms,
        contract_valid=contract_valid,
        contract_errors=contract_errors,
    )
    db.add(log)
    await db.flush()
    return log
