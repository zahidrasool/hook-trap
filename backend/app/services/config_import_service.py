import uuid
import json

import yaml
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mock_endpoint import MockEndpoint

# Generators that produce numeric/boolean values (no quotes in templates)
UNQUOTED_GENERATORS = {
    "randomInt",
    "randomFloat",
    "randomBool",
    "timestamp",
    "randomUnixTimestamp",
}

# Known generator prefixes for validation warnings
KNOWN_GENERATORS = {
    "faker.",
    "randomUUID",
    "randomInt",
    "randomFloat",
    "randomString",
    "randomBool",
    "randomEmail",
    "randomAvatar",
    "now",
    "timestamp",
    "randomUnixTimestamp",
    "oneOf",
}

CRUD_METHODS = ["list", "detail", "create", "update", "delete"]


async def import_config(
    config_yaml: str,
    workspace_id: uuid.UUID,
    created_by: uuid.UUID,
    db: AsyncSession,
    overwrite: bool = False,
) -> dict:
    """Parse a YAML config and auto-generate CRUD mock endpoints for each model."""
    errors: list[str] = []
    created: list[dict] = []

    # --- 1. Parse YAML ---
    try:
        config = yaml.safe_load(config_yaml)
    except yaml.YAMLError as e:
        return {
            "models_processed": 0,
            "created": [],
            "errors": [f"Invalid YAML: {e}"],
        }

    if not isinstance(config, dict) or "models" not in config:
        return {
            "models_processed": 0,
            "created": [],
            "errors": ["Config must contain a top-level 'models' key."],
        }

    models = config["models"]
    if not isinstance(models, dict) or len(models) == 0:
        return {
            "models_processed": 0,
            "created": [],
            "errors": ["No models defined under 'models' key."],
        }

    # Collect model counts for belongs_to references
    model_counts: dict[str, int] = {}
    for model_name, model_def in models.items():
        if not isinstance(model_def, dict):
            errors.append(f"Model '{model_name}' must be a mapping.")
            continue
        model_counts[model_name] = model_def.get("_count", 10)

    # --- 2. Validate & process each model ---
    models_processed = 0
    for model_name, model_def in models.items():
        if not isinstance(model_def, dict):
            continue

        fields = model_def.get("fields")
        if not fields or not isinstance(fields, dict):
            errors.append(f"Model '{model_name}': must have a 'fields' mapping.")
            continue

        # Validate generator names (warn but don't skip)
        for field_name, generator in fields.items():
            if not _is_known_generator(str(generator)):
                errors.append(
                    f"Model '{model_name}.{field_name}': unknown generator '{generator}' (will be used as-is)."
                )

        count = model_def.get("_count", 10)
        has_many = _normalize_list(model_def.get("has_many"))
        belongs_to = _normalize_list(model_def.get("belongs_to"))

        # Inject foreign-key fields from belongs_to
        augmented_fields = dict(fields)
        for parent in belongs_to:
            fk_field = f"{_singularize(parent)}_id"
            if fk_field not in augmented_fields:
                parent_count = model_counts.get(parent, 100)
                augmented_fields[fk_field] = f"randomInt 1 {parent_count}"

        # Determine which endpoints to generate
        explicit_endpoints = model_def.get("endpoints")
        if explicit_endpoints and isinstance(explicit_endpoints, list):
            endpoint_types = [e for e in explicit_endpoints if e in CRUD_METHODS]
        else:
            endpoint_types = list(CRUD_METHODS)

        # --- 3. Overwrite handling ---
        if overwrite:
            base_path = f"/{model_name}"
            paths_to_clear = [
                base_path,
                f"{base_path}/:id",
            ]
            for p in paths_to_clear:
                await db.execute(
                    delete(MockEndpoint).where(
                        MockEndpoint.workspace_id == workspace_id,
                        MockEndpoint.path == p,
                    )
                )
            await db.flush()

        # --- 4. Generate endpoints ---
        for ep_type in endpoint_types:
            try:
                mock = _build_endpoint(
                    ep_type=ep_type,
                    model_name=model_name,
                    fields=augmented_fields,
                    count=count,
                    has_many=has_many,
                    models=models,
                    workspace_id=workspace_id,
                    created_by=created_by,
                )
                if mock is None:
                    continue

                # Check for duplicate before inserting
                existing = await db.execute(
                    select(MockEndpoint).where(
                        MockEndpoint.workspace_id == workspace_id,
                        MockEndpoint.path == mock.path,
                        MockEndpoint.method == mock.method,
                    )
                )
                if existing.scalar_one_or_none():
                    errors.append(
                        f"Endpoint {mock.method} {mock.path} already exists (skipped)."
                    )
                    continue

                db.add(mock)
                created.append(
                    {
                        "method": mock.method,
                        "path": mock.path,
                        "name": mock.name or "",
                        "status_code": mock.response_status,
                    }
                )
            except Exception as exc:
                errors.append(f"Model '{model_name}' endpoint '{ep_type}': {exc}")

        models_processed += 1

    await db.flush()

    return {
        "models_processed": models_processed,
        "created": created,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# Endpoint builders
# ---------------------------------------------------------------------------

def _build_endpoint(
    ep_type: str,
    model_name: str,
    fields: dict,
    count: int,
    has_many: list[str],
    models: dict,
    workspace_id: uuid.UUID,
    created_by: uuid.UUID,
) -> MockEndpoint | None:
    builders = {
        "list": _build_list_endpoint,
        "detail": _build_detail_endpoint,
        "create": _build_create_endpoint,
        "update": _build_update_endpoint,
        "delete": _build_delete_endpoint,
    }
    builder = builders.get(ep_type)
    if not builder:
        return None
    return builder(
        model_name=model_name,
        fields=fields,
        count=count,
        has_many=has_many,
        models=models,
        workspace_id=workspace_id,
        created_by=created_by,
    )


def _build_list_endpoint(
    model_name: str,
    fields: dict,
    count: int,
    has_many: list[str],
    models: dict,
    workspace_id: uuid.UUID,
    created_by: uuid.UUID,
) -> MockEndpoint:
    item_template = _build_object_template(fields, id_expr="{{randomInt 1 10000}}")
    body = f"[{{{{repeat {count} '{item_template}'}}}}]"
    return MockEndpoint(
        workspace_id=workspace_id,
        created_by=created_by,
        path=f"/{model_name}",
        method="GET",
        name=f"List {model_name}",
        description=f"Auto-generated list endpoint for {model_name}",
        response_status=200,
        response_body=body,
    )


def _build_detail_endpoint(
    model_name: str,
    fields: dict,
    count: int,
    has_many: list[str],
    models: dict,
    workspace_id: uuid.UUID,
    created_by: uuid.UUID,
) -> MockEndpoint:
    parts = ['"id": {{request.params.id}}']
    for fname, gen in fields.items():
        parts.append(f'"{fname}": {_field_template(gen)}')

    # Nested has_many relations
    for child_name in has_many:
        child_def = models.get(child_name, {})
        child_fields = child_def.get("fields", {})
        if child_fields:
            child_obj = _build_object_template(child_fields, id_expr="{{randomInt 1 10000}}")
            parts.append(f'"{child_name}": [{{{{repeat 5 \'{child_obj}\'}}}}]')

    body = "{" + ", ".join(parts) + "}"
    return MockEndpoint(
        workspace_id=workspace_id,
        created_by=created_by,
        path=f"/{model_name}/:id",
        method="GET",
        name=f"Get {_singularize(model_name)}",
        description=f"Auto-generated detail endpoint for {model_name}",
        response_status=200,
        response_body=body,
    )


def _build_create_endpoint(
    model_name: str,
    fields: dict,
    count: int,
    has_many: list[str],
    models: dict,
    workspace_id: uuid.UUID,
    created_by: uuid.UUID,
) -> MockEndpoint:
    parts = ['"id": {{randomInt 1 10000}}']
    for fname in fields:
        parts.append(f'"{ fname}": "{{{{request.body.{fname}}}}}"')
    parts.append('"created_at": "{{now}}"')
    body = "{" + ", ".join(parts) + "}"
    return MockEndpoint(
        workspace_id=workspace_id,
        created_by=created_by,
        path=f"/{model_name}",
        method="POST",
        name=f"Create {_singularize(model_name)}",
        description=f"Auto-generated create endpoint for {model_name}",
        response_status=201,
        response_body=body,
    )


def _build_update_endpoint(
    model_name: str,
    fields: dict,
    count: int,
    has_many: list[str],
    models: dict,
    workspace_id: uuid.UUID,
    created_by: uuid.UUID,
) -> MockEndpoint:
    parts = ['"id": {{request.params.id}}']
    for fname in fields:
        parts.append(f'"{fname}": "{{{{request.body.{fname}}}}}"')
    parts.append('"updated_at": "{{now}}"')
    body = "{" + ", ".join(parts) + "}"
    return MockEndpoint(
        workspace_id=workspace_id,
        created_by=created_by,
        path=f"/{model_name}/:id",
        method="PUT",
        name=f"Update {_singularize(model_name)}",
        description=f"Auto-generated update endpoint for {model_name}",
        response_status=200,
        response_body=body,
    )


def _build_delete_endpoint(
    model_name: str,
    fields: dict,
    count: int,
    has_many: list[str],
    models: dict,
    workspace_id: uuid.UUID,
    created_by: uuid.UUID,
) -> MockEndpoint:
    return MockEndpoint(
        workspace_id=workspace_id,
        created_by=created_by,
        path=f"/{model_name}/:id",
        method="DELETE",
        name=f"Delete {_singularize(model_name)}",
        description=f"Auto-generated delete endpoint for {model_name}",
        response_status=204,
        response_body="",
    )


# ---------------------------------------------------------------------------
# Template helpers
# ---------------------------------------------------------------------------

def _field_template(generator: str) -> str:
    """Convert a generator value to a Handlebars-style template expression.

    Numeric / boolean generators are emitted without surrounding quotes so the
    resulting JSON is type-correct.
    """
    gen_str = str(generator)
    base_name = gen_str.split()[0]

    if base_name in UNQUOTED_GENERATORS:
        return "{{" + gen_str + "}}"
    return '"{{' + gen_str + '}}"'


def _build_object_template(fields: dict, id_expr: str = "{{randomInt 1 10000}}") -> str:
    """Build a JSON object template string from a fields dict."""
    parts = [f'"id": {id_expr}']
    for fname, gen in fields.items():
        parts.append(f'"{ fname}": {_field_template(gen)}')
    return "{" + ", ".join(parts) + "}"


def _singularize(name: str) -> str:
    """Naive singularization: strip trailing 's'."""
    if name.endswith("ies"):
        return name[:-3] + "y"
    if name.endswith("ses"):
        return name[:-2]
    if name.endswith("s") and not name.endswith("ss"):
        return name[:-1]
    return name


def _normalize_list(value) -> list[str]:
    """Ensure a value is a list of strings (handles str, list, or None)."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(v) for v in value]
    return []


def _is_known_generator(generator: str) -> bool:
    """Check if a generator string matches a known pattern."""
    base = generator.split()[0]
    for prefix in KNOWN_GENERATORS:
        if prefix.endswith("."):
            if base.startswith(prefix):
                return True
        elif base == prefix:
            return True
    return False
