import pytest

from app.services.scenario_variables import (
    MISSING,
    UnresolvedVariable,
    build_namespace,
    capture_values,
    interpolate,
    resolve_path,
)


def test_resolve_path_distinguishes_missing_from_null():
    data = {"a": {"b": None}}

    assert resolve_path(data, "a.b") is None
    assert resolve_path(data, "a.c") is MISSING
    assert resolve_path(data, "x.y.z") is MISSING


def test_resolve_path_indexes_lists():
    data = {"items": [{"id": 7}, {"id": 9}]}

    assert resolve_path(data, "items.1.id") == 9
    assert resolve_path(data, "items.5.id") is MISSING


def test_build_namespace_applies_layers_in_increasing_precedence():
    result = build_namespace(
        {"baseUrl": "https://env", "shared": "env"},
        {"baseUrl": "https://scenario"},
        {"baseUrl": "https://trigger"},
    )

    assert result == {"baseUrl": "https://trigger", "shared": "env"}


def test_build_namespace_ignores_none_layers():
    assert build_namespace({"a": 1}, None, {"b": 2}) == {"a": 1, "b": 2}


def test_interpolate_replaces_a_whole_string():
    assert interpolate("{{baseUrl}}/pay", {"baseUrl": "https://x"}) == "https://x/pay"


def test_interpolate_preserves_type_for_a_lone_placeholder():
    """{{amount}} alone yields the value, not its string form.

    A JSON body needs 4900, not "4900" — the difference decides whether the
    customer's API rejects the request.
    """
    assert interpolate("{{amount}}", {"amount": 4900}) == 4900
    assert interpolate("amount is {{amount}}", {"amount": 4900}) == "amount is 4900"


def test_interpolate_recurses_through_dicts_and_lists():
    result = interpolate(
        {"url": "{{base}}/x", "ids": ["{{one}}", "static"]},
        {"base": "https://x", "one": 1},
    )

    assert result == {"url": "https://x/x", "ids": [1, "static"]}


def test_interpolate_leaves_non_strings_alone():
    assert interpolate(7, {}) == 7
    assert interpolate(None, {}) is None
    assert interpolate(True, {}) is True


def test_an_unresolved_variable_is_an_error_not_an_empty_string():
    """Silently substituting nothing produces confusing downstream failures."""
    with pytest.raises(UnresolvedVariable) as exc:
        interpolate("{{nope}}/x", {"other": 1})
    assert "nope" in str(exc.value)


def test_capture_values_reads_dotted_paths_from_a_step_result():
    source = {"response": {"body": {"paymentId": "pay_1"}}, "captured_at": "t0"}

    assert capture_values(
        {"paymentId": "response.body.paymentId", "at": "captured_at"}, source
    ) == {"paymentId": "pay_1", "at": "t0"}


def test_capturing_a_missing_path_is_an_error():
    with pytest.raises(UnresolvedVariable):
        capture_values({"x": "response.body.nope"}, {"response": {"body": {}}})
