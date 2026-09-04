import re
import json
import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mock_endpoint import MockEndpoint
from app.models.openapi_spec import OpenAPISpec


def parse_openapi_spec(spec_content: str) -> dict:
    """Parse an OpenAPI spec and return detected endpoints without creating anything."""
    # Try YAML first, then JSON
    spec = None
    parse_error = None
    try:
        spec = yaml.safe_load(spec_content)
    except yaml.YAMLError:
        try:
            spec = json.loads(spec_content)
        except json.JSONDecodeError as e:
            parse_error = str(e)

    if spec is None:
        return {"success": False, "error": f"Invalid spec format: {parse_error}"}

    if not isinstance(spec, dict) or "paths" not in spec:
        return {"success": False, "error": "Invalid OpenAPI spec: missing 'paths'"}

    base_path = ""
    if "servers" in spec and spec["servers"]:
        from urllib.parse import urlparse
        server_url = spec["servers"][0].get("url", "")
        parsed = urlparse(server_url)
        base_path = parsed.path.rstrip("/")

    endpoints = []
    for path, path_item in spec.get("paths", {}).items():
        if not isinstance(path_item, dict):
            continue
        mocklane_path = re.sub(r'\{(\w+)\}', r':\1', path)
        full_path = f"{base_path}{mocklane_path}" if base_path else mocklane_path

        for method in ["get", "post", "put", "patch", "delete"]:
            if method not in path_item:
                continue
            operation = path_item[method]
            if not isinstance(operation, dict):
                continue
            endpoints.append({
                "path": full_path,
                "method": method.upper(),
                "summary": operation.get("summary", ""),
            })

    return {"success": True, "endpoints": endpoints}


async def import_openapi_spec(
    workspace_id,
    spec_content: str,
    spec_format: str,
    name: str | None,
    uploaded_by,
    db: AsyncSession,
    selected_endpoints: list[dict] | None = None,
) -> dict:
    """Parse OpenAPI spec and create/update mock endpoints."""
    try:
        if spec_format == "yaml":
            spec = yaml.safe_load(spec_content)
        else:
            spec = json.loads(spec_content)
    except (yaml.YAMLError, json.JSONDecodeError) as e:
        return {"success": False, "error": f"Invalid spec format: {str(e)}"}

    # Validate spec structure (best-effort — don't block import on validator issues)
    try:
        from openapi_spec_validator import validate
        validate(spec)
    except ImportError:
        pass  # Validator not installed, skip
    except Exception:
        # Validator may fail on edge cases — proceed if basic structure looks valid
        if not isinstance(spec, dict) or "paths" not in spec:
            return {"success": False, "error": "Invalid OpenAPI spec: missing 'paths' section"}

    spec_title = spec.get("info", {}).get("title", "Imported API")
    spec_version = spec.get("info", {}).get("version", "1.0")

    base_path = ""
    if "servers" in spec and spec["servers"]:
        from urllib.parse import urlparse
        server_url = spec["servers"][0].get("url", "")
        parsed = urlparse(server_url)
        base_path = parsed.path.rstrip("/")

    schemas = spec.get("components", {}).get("schemas", {})

    results = []
    for path, path_item in spec.get("paths", {}).items():
        if not isinstance(path_item, dict):
            continue
        mocklane_path = re.sub(r'\{(\w+)\}', r':\1', path)
        full_path = f"{base_path}{mocklane_path}" if base_path else mocklane_path

        for method in ["get", "post", "put", "patch", "delete"]:
            if method not in path_item:
                continue
            operation = path_item[method]
            if not isinstance(operation, dict):
                continue

            # Skip endpoints not in the selected list (if provided)
            if selected_endpoints is not None:
                is_selected = any(
                    se.get("path") == full_path and se.get("method") == method.upper()
                    for se in selected_endpoints
                )
                if not is_selected:
                    continue

            response_body = generate_response_from_schema(operation, schemas)

            existing = await db.execute(
                select(MockEndpoint).where(
                    MockEndpoint.workspace_id == workspace_id,
                    MockEndpoint.scenario_id.is_(None),
                    MockEndpoint.path == full_path,
                    MockEndpoint.method == method.upper(),
                )
            )
            existing_mock = existing.scalar_one_or_none()

            if existing_mock:
                existing_mock.response_body = json.dumps(response_body, indent=2) if response_body else None
                existing_mock.name = operation.get("summary", existing_mock.name)
                existing_mock.description = operation.get("description")
                results.append({
                    "path": full_path, "method": method.upper(),
                    "action": "updated", "summary": operation.get("summary")
                })
            else:
                mock = MockEndpoint(
                    workspace_id=workspace_id,
                    created_by=uploaded_by,
                    path=full_path,
                    method=method.upper(),
                    name=operation.get("summary", f"{method.upper()} {path}"),
                    description=operation.get("description"),
                    response_body=json.dumps(response_body, indent=2) if response_body else '{"message": "OK"}',
                    response_status=200,
                )
                db.add(mock)
                results.append({
                    "path": full_path, "method": method.upper(),
                    "action": "created", "summary": operation.get("summary")
                })

    openapi_spec = OpenAPISpec(
        workspace_id=workspace_id,
        name=name or spec_title,
        version=spec_version,
        spec_content=spec_content,
        spec_format=spec_format,
        uploaded_by=uploaded_by,
    )
    db.add(openapi_spec)
    await db.flush()

    created = sum(1 for r in results if r["action"] == "created")
    updated = sum(1 for r in results if r["action"] == "updated")

    return {
        "success": True,
        "data": {
            "spec_id": str(openapi_spec.id),
            "name": name or spec_title,
            "endpoints_created": created,
            "endpoints_updated": updated,
            "endpoints_skipped": 0,
            "details": results,
        }
    }


def generate_response_from_schema(operation: dict, schemas: dict):
    responses = operation.get("responses", {})
    response = None
    for status in ["200", "201", "202", "204"]:
        if status in responses:
            response = responses[status]
            break
    if not response:
        return {"message": "OK"}

    content = response.get("content", {}) if isinstance(response, dict) else {}
    json_content = content.get("application/json", {})
    schema = json_content.get("schema", {})

    if "example" in json_content:
        return json_content["example"]
    if "example" in schema:
        return schema["example"]
    if "$ref" in schema:
        ref_name = schema["$ref"].split("/")[-1]
        schema = schemas.get(ref_name, {})

    return generate_from_type(schema, schemas)


def generate_from_type(schema: dict, schemas: dict, depth: int = 0):
    if depth > 5:
        return None
    if not isinstance(schema, dict):
        return None
    if "$ref" in schema:
        ref_name = schema["$ref"].split("/")[-1]
        schema = schemas.get(ref_name, {})
    if not isinstance(schema, dict):
        return None

    schema_type = schema.get("type", "object")

    if "example" in schema:
        return schema["example"]
    if "enum" in schema:
        return schema["enum"][0]
    if "default" in schema:
        return schema["default"]

    if schema_type == "string":
        fmt = schema.get("format", "")
        if fmt == "email": return "{{faker.email}}"
        if fmt == "uuid": return "{{randomUUID}}"
        if fmt == "date-time": return "{{now}}"
        if fmt == "date": return "2026-04-08"
        if fmt == "uri": return "https://example.com"
        return "{{faker.word}}"
    elif schema_type == "integer":
        return "{{randomInt 1 1000}}"
    elif schema_type == "number":
        return "{{randomFloat 0 100 2}}"
    elif schema_type == "boolean":
        return True
    elif schema_type == "array":
        items = schema.get("items", {})
        item = generate_from_type(items, schemas, depth + 1)
        return [item, item]
    elif schema_type == "object":
        result = {}
        for prop_name, prop_schema in schema.get("properties", {}).items():
            result[prop_name] = generate_from_type(prop_schema, schemas, depth + 1)
        return result
    return None
