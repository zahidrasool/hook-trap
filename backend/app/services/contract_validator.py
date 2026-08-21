import json
from jsonschema import validate as json_validate, ValidationError


def validate_request_against_spec(spec: dict, method: str, path: str, request_body, response_status: int, response_body) -> dict:
    """Validate a mock request/response against an OpenAPI spec."""
    errors = []

    # Find matching path in spec
    paths = spec.get("paths", {})
    matched_path = None
    for spec_path in paths:
        import re
        pattern = re.sub(r'\{(\w+)\}', r'[^/]+', spec_path)
        if re.match(f"^{pattern}$", path):
            matched_path = spec_path
            break

    if not matched_path:
        return {"valid": True, "errors": []}

    operation = paths[matched_path].get(method.lower())
    if not operation:
        return {"valid": True, "errors": []}

    # Validate response status
    responses = operation.get("responses", {})
    status_str = str(response_status)
    if status_str not in responses and "default" not in responses:
        errors.append({"type": "status", "message": f"Unexpected response status: {response_status}"})

    # Validate response body against schema
    if status_str in responses:
        resp_spec = responses[status_str]
        content = resp_spec.get("content", {})
        json_content = content.get("application/json", {})
        schema = json_content.get("schema")

        if schema and response_body:
            schemas = spec.get("components", {}).get("schemas", {})
            resolved = _resolve_refs(schema, schemas)
            try:
                body = json.loads(response_body) if isinstance(response_body, str) else response_body
                json_validate(instance=body, schema=resolved)
            except ValidationError as e:
                errors.append({"type": "schema", "message": str(e.message)})
            except (json.JSONDecodeError, Exception):
                pass

    return {"valid": len(errors) == 0, "errors": errors}


def _resolve_refs(schema: dict, schemas: dict, depth: int = 0) -> dict:
    if depth > 10 or not isinstance(schema, dict):
        return schema
    if "$ref" in schema:
        ref_name = schema["$ref"].split("/")[-1]
        return _resolve_refs(schemas.get(ref_name, {}), schemas, depth + 1)
    result = {}
    for k, v in schema.items():
        if isinstance(v, dict):
            result[k] = _resolve_refs(v, schemas, depth + 1)
        elif isinstance(v, list):
            result[k] = [_resolve_refs(i, schemas, depth + 1) if isinstance(i, dict) else i for i in v]
        else:
            result[k] = v
    return result
