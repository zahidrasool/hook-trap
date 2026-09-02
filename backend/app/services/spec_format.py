"""Detect which import format a document uses.

MockLane accepts two quite different YAML/JSON documents:

  openapi   An OpenAPI 3.x or Swagger 2.x description of an existing API.
            Endpoints are read from `paths`.
  mocklane  MockLane's own declarative config, keyed on `models`, from which
            CRUD endpoints are generated.

Users reasonably expect either to work in either importer, so both endpoints
detect the format and dispatch instead of failing on the wrong one.
"""

import json
from typing import Literal

import yaml

SpecFormat = Literal["openapi", "mocklane", "unknown"]


def _load(content: str) -> dict | None:
    """Parse YAML or JSON, returning None when the document is not a mapping."""
    if not content or not content.strip():
        return None
    try:
        # YAML is a superset of JSON, so this covers both. json.loads is tried
        # first only because it gives a faster path for large JSON specs.
        try:
            parsed = json.loads(content)
        except ValueError:
            parsed = yaml.safe_load(content)
    except (yaml.YAMLError, ValueError):
        return None

    return parsed if isinstance(parsed, dict) else None


def detect_spec_format(content: str) -> SpecFormat:
    """Classify a document as an OpenAPI spec or a MockLane config."""
    doc = _load(content)
    if doc is None:
        return "unknown"

    # OpenAPI 3 uses "openapi", Swagger 2 uses "swagger". Require `paths` too so
    # a config that merely mentions the word is not misread.
    if ("openapi" in doc or "swagger" in doc) and isinstance(doc.get("paths"), dict):
        return "openapi"

    if isinstance(doc.get("models"), dict):
        return "mocklane"

    # Fall back on the distinguishing key alone: a spec missing `paths` is still
    # more useful routed to the OpenAPI importer, which reports why it failed.
    if "openapi" in doc or "swagger" in doc:
        return "openapi"

    return "unknown"


def preview_mocklane_config(content: str) -> dict:
    """List the endpoints a MockLane config would generate, without writing.

    Mirrors the CRUD expansion in config_import_service so the import wizard can
    show the same preview it shows for an OpenAPI spec.
    """
    doc = _load(content)
    if doc is None or not isinstance(doc.get("models"), dict):
        return {"success": False, "error": "Config must contain a top-level 'models' mapping.", "endpoints": []}

    # Keep in step with CRUD_METHODS in config_import_service.
    crud = {
        "list": ("GET", "/{plural}", "List {model}"),
        "detail": ("GET", "/{plural}/:id", "Get {model} by id"),
        "create": ("POST", "/{plural}", "Create {model}"),
        "update": ("PUT", "/{plural}/:id", "Update {model}"),
        "delete": ("DELETE", "/{plural}/:id", "Delete {model}"),
    }

    endpoints: list[dict] = []
    for model_name, model_def in doc["models"].items():
        if not isinstance(model_def, dict):
            continue

        requested = model_def.get("endpoints")
        wanted = [e for e in requested if e in crud] if isinstance(requested, list) else list(crud)

        plural = model_name if model_name.endswith("s") else f"{model_name}s"
        for kind in wanted:
            method, path_tpl, summary_tpl = crud[kind]
            endpoints.append(
                {
                    "path": path_tpl.format(plural=plural),
                    "method": method,
                    "summary": summary_tpl.format(model=model_name),
                }
            )

    return {"success": True, "endpoints": endpoints, "error": None}
