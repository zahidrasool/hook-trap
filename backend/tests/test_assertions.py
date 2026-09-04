import pytest

from app.services.assertions import (
    AssertionSyntaxError,
    evaluate,
    evaluate_all,
    parse_assertion,
)

CONTEXT = {
    "status": 200,
    "response": {
        "body": {"paymentId": "pay_1", "amount": 4900, "note": None},
        "time_ms": 812,
    },
    "body": {"event": "payment.completed"},
    "subject": "Payment confirmed for order 7",
    "_elapsed_s": 3.2,
}


@pytest.mark.parametrize(
    "raw,kind,path,op",
    [
        ("status == 200", "comparison", "status", "=="),
        ("response.time_ms < 2000", "comparison", "response.time_ms", "<"),
        ("status != 500", "comparison", "status", "!="),
        ("response.body.paymentId exists", "existence", "response.body.paymentId", None),
        ('subject contains "Payment"', "containment", "subject", None),
        ("received_within 10s", "timing", "_elapsed_s", None),
    ],
)
def test_parses_each_supported_form(raw, kind, path, op):
    parsed = parse_assertion(raw)

    assert parsed.raw == raw
    assert parsed.kind == kind
    assert parsed.path == path
    assert parsed.op == op


@pytest.mark.parametrize(
    "raw",
    ["", "   ", "status", "status ~= 200", "contains 'x'", "received_within soon"],
)
def test_unparseable_assertions_are_rejected(raw):
    with pytest.raises(AssertionSyntaxError):
        parse_assertion(raw)


def test_comparison_passes_and_reports_both_sides():
    result = evaluate(parse_assertion("status == 200"), CONTEXT)

    assert result == {
        "assertion": "status == 200",
        "passed": True,
        "expected": 200,
        "actual": 200,
    }


def test_a_failure_reports_the_actual_value():
    """A red X with no actual value is useless — this is the whole point."""
    result = evaluate(parse_assertion("status == 201"), CONTEXT)

    assert result["passed"] is False
    assert result["expected"] == 201
    assert result["actual"] == 200


def test_numeric_comparison():
    assert evaluate(parse_assertion("response.time_ms < 2000"), CONTEXT)["passed"] is True
    assert evaluate(parse_assertion("response.time_ms > 2000"), CONTEXT)["passed"] is False


def test_string_equality_on_a_path():
    parsed = parse_assertion('body.event == "payment.completed"')
    assert evaluate(parsed, CONTEXT)["passed"] is True


def test_existence_distinguishes_missing_from_null():
    assert evaluate(parse_assertion("response.body.paymentId exists"), CONTEXT)["passed"] is True
    assert evaluate(parse_assertion("response.body.nope exists"), CONTEXT)["passed"] is False
    # Present but null counts as existing — the key was returned by the API.
    assert evaluate(parse_assertion("response.body.note exists"), CONTEXT)["passed"] is True


def test_containment():
    assert evaluate(parse_assertion('subject contains "Payment"'), CONTEXT)["passed"] is True
    assert evaluate(parse_assertion('subject contains "Refund"'), CONTEXT)["passed"] is False


def test_timing():
    assert evaluate(parse_assertion("received_within 10s"), CONTEXT)["passed"] is True
    assert evaluate(parse_assertion("received_within 2s"), CONTEXT)["passed"] is False


def test_comparing_a_missing_path_fails_rather_than_erroring():
    result = evaluate(parse_assertion("response.body.nope == 1"), CONTEXT)

    assert result["passed"] is False
    assert result["actual"] is None


def test_comparing_incomparable_types_fails_cleanly():
    result = evaluate(parse_assertion("subject < 5"), CONTEXT)

    assert result["passed"] is False


def test_evaluate_all_returns_one_result_per_assertion_in_order():
    results = evaluate_all(["status == 200", "status == 500"], CONTEXT)

    assert [r["passed"] for r in results] == [True, False]
    assert [r["assertion"] for r in results] == ["status == 200", "status == 500"]
