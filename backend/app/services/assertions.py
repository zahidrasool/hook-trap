"""Assertion strings, parsed into a structured form and evaluated.

Strings keep the YAML readable; parsing keeps the results machine-checkable.
Every evaluation returns the assertion, whether it passed, what was expected
and what was actually there — because a failed run whose report says only
"failed" tells the user nothing about why.

The set is deliberately small. Anything not expressible here belongs in the
customer's own test suite, not in a mock platform's assertion language.
"""

import json
import re
from dataclasses import dataclass

from app.services.scenario_variables import MISSING, resolve_path

COMPARISONS = ("==", "!=", "<=", ">=", "<", ">")

_TIMING = re.compile(r"^received_within\s+(\d+(?:\.\d+)?)\s*s$")
_EXISTENCE = re.compile(r"^(?P<path>\S+)\s+exists$")
_CONTAINMENT = re.compile(r"^(?P<path>\S+)\s+contains\s+(?P<value>.+)$")


class AssertionSyntaxError(Exception):
    """The assertion string could not be parsed."""


@dataclass
class Assertion:
    raw: str
    kind: str          # comparison | existence | containment | timing
    path: str
    op: str | None
    expected: object


def _literal(token: str):
    """Interpret a right-hand side: quoted string, number, bool, or null."""
    token = token.strip()
    if len(token) >= 2 and token[0] == token[-1] and token[0] in "\"'":
        return token[1:-1]
    lowered = token.lower()
    if lowered in ("true", "false"):
        return lowered == "true"
    if lowered in ("null", "none"):
        return None
    try:
        return json.loads(token)
    except (json.JSONDecodeError, ValueError):
        return token


def parse_assertion(raw: str) -> Assertion:
    text = (raw or "").strip()
    if not text:
        raise AssertionSyntaxError("Empty assertion")

    timing = _TIMING.match(text)
    if timing:
        return Assertion(raw, "timing", "_elapsed_s", None, float(timing.group(1)))

    existence = _EXISTENCE.match(text)
    if existence:
        return Assertion(raw, "existence", existence.group("path"), None, None)

    containment = _CONTAINMENT.match(text)
    if containment:
        return Assertion(
            raw,
            "containment",
            containment.group("path"),
            None,
            _literal(containment.group("value")),
        )

    # Longest operators first, so "<=" is not read as "<".
    for op in sorted(COMPARISONS, key=len, reverse=True):
        marker = f" {op} "
        if marker in text:
            left, _, right = text.partition(marker)
            if left.strip() and right.strip():
                return Assertion(raw, "comparison", left.strip(), op, _literal(right))

    raise AssertionSyntaxError(f"Could not parse assertion: {raw!r}")


def _compare(op: str, actual, expected) -> bool:
    try:
        if op == "==":
            return actual == expected
        if op == "!=":
            return actual != expected
        if op == "<":
            return actual < expected
        if op == "<=":
            return actual <= expected
        if op == ">":
            return actual > expected
        if op == ">=":
            return actual >= expected
    except TypeError:
        # Comparing a string to a number is a failed assertion, not a crash.
        return False
    return False


def evaluate(assertion: Assertion, context: dict) -> dict:
    found = resolve_path(context, assertion.path)
    actual = None if found is MISSING else found

    if assertion.kind == "existence":
        passed = found is not MISSING
        expected = "present"
        actual = "present" if passed else "missing"
    elif assertion.kind == "containment":
        passed = found is not MISSING and str(assertion.expected) in str(found)
        expected = assertion.expected
    elif assertion.kind == "timing":
        passed = found is not MISSING and _compare("<=", found, assertion.expected)
        expected = f"within {assertion.expected}s"
    else:
        passed = found is not MISSING and _compare(assertion.op, found, assertion.expected)
        expected = assertion.expected

    return {
        "assertion": assertion.raw,
        "passed": passed,
        "expected": expected,
        "actual": actual,
    }


def evaluate_all(raws: list[str], context: dict) -> list[dict]:
    """Evaluate every assertion; a syntax error becomes a failed result.

    One malformed assertion must not hide the outcome of the others.
    """
    results = []
    for raw in raws or []:
        try:
            results.append(evaluate(parse_assertion(raw), context))
        except AssertionSyntaxError as exc:
            results.append(
                {"assertion": raw, "passed": False, "expected": "parseable assertion", "actual": str(exc)}
            )
    return results
