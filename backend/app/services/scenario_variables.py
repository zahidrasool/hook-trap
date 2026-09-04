"""The per-run variable namespace.

One namespace per run, seeded in increasing precedence from workspace defaults,
the scenario's own variables, and whatever was supplied at trigger time. Steps
read it through `{{name}}` interpolation and write to it via `capture`.

An unresolved `{{var}}` is an error, never an empty string. Substituting
nothing produces a request that looks plausible and fails somewhere else, which
is far harder to debug than the step failing where the variable was missing.
"""

import re

_PLACEHOLDER = re.compile(r"\{\{\s*([^}\s]+)\s*\}\}")


class _Missing:
    """Sentinel for 'this path is not present', distinct from a null value."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __repr__(self):
        return "MISSING"

    def __bool__(self):
        return False


MISSING = _Missing()


class UnresolvedVariable(Exception):
    """A referenced variable or captured path was not present."""


def resolve_path(data, dotpath: str):
    """Value at `dotpath`, or MISSING. Null values are returned as None."""
    if not dotpath:
        return MISSING

    current = data
    for key in dotpath.split("."):
        if isinstance(current, dict):
            if key not in current:
                return MISSING
            current = current[key]
        elif isinstance(current, list) and key.lstrip("-").isdigit():
            index = int(key)
            if not -len(current) <= index < len(current):
                return MISSING
            current = current[index]
        else:
            return MISSING
    return current


def build_namespace(*layers: dict | None) -> dict:
    """Merge variable layers, later ones winning."""
    namespace: dict = {}
    for layer in layers:
        if layer:
            namespace.update(layer)
    return namespace


def interpolate(value, namespace: dict):
    """Substitute {{name}} throughout `value`, recursing into dicts and lists."""
    if isinstance(value, dict):
        return {key: interpolate(item, namespace) for key, item in value.items()}
    if isinstance(value, list):
        return [interpolate(item, namespace) for item in value]
    if not isinstance(value, str):
        return value

    # A string that is exactly one placeholder yields the value itself, so a
    # number stays a number in a JSON body rather than becoming a string.
    whole = _PLACEHOLDER.fullmatch(value.strip())
    if whole:
        return _lookup(whole.group(1), namespace)

    def _replace(match):
        return str(_lookup(match.group(1), namespace))

    return _PLACEHOLDER.sub(_replace, value)


def _lookup(name: str, namespace: dict):
    found = resolve_path(namespace, name)
    if found is MISSING:
        raise UnresolvedVariable(
            f"Variable {{{{{name}}}}} is not defined in this run"
        )
    return found


def capture_values(spec: dict[str, str], source: dict) -> dict:
    """Extract `{name: dotted.path}` from a step's result into new variables."""
    captured = {}
    for name, dotpath in (spec or {}).items():
        found = resolve_path(source, dotpath)
        if found is MISSING:
            raise UnresolvedVariable(
                f"Cannot capture {name!r}: {dotpath!r} is not present in the step result"
            )
        captured[name] = found
    return captured
