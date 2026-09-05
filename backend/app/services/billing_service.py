import logging
import stripe
from app.config import get_settings

logger = logging.getLogger(__name__)

# "limits" are ceilings on things that exist at a point in time; "quotas" are
# consumed per calendar month and reset. Both are surfaced in the dashboard so a
# user can see where they stand rather than discovering a ceiling by hitting it.
PLANS = {
    "free": {
        "name": "Free",
        "limits": {"workspaces": 2, "mocks_per_workspace": 10, "sandboxes": 1},
        "quotas": {"mock_requests": 10_000, "webhook_captures": 1_000, "emails": 200, "scenario_runs": 100},
    },
    "pro": {
        "name": "Pro",
        "limits": {"workspaces": 10, "mocks_per_workspace": 100, "sandboxes": 10},
        "quotas": {"mock_requests": 250_000, "webhook_captures": 50_000, "emails": 5_000, "scenario_runs": 5_000},
    },
    "team": {
        "name": "Team",
        "limits": {"workspaces": 50, "mocks_per_workspace": 500, "sandboxes": 50},
        "quotas": {"mock_requests": 1_000_000, "webhook_captures": 250_000, "emails": 25_000, "scenario_runs": 50_000},
    },
}


def get_stripe():
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key
    return stripe


async def get_or_create_customer(user) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id

    s = get_stripe()
    customer = s.Customer.create(email=user.email, metadata={"user_id": str(user.id)})
    return customer.id


async def create_checkout_session(user, price_id: str, success_url: str, cancel_url: str) -> str:
    s = get_stripe()
    customer_id = await get_or_create_customer(user)

    session = s.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": str(user.id)},
    )
    return session.url


async def create_portal_session(user, return_url: str) -> str:
    s = get_stripe()
    if not user.stripe_customer_id:
        raise ValueError("No billing account found")

    session = s.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=return_url,
    )
    return session.url


def handle_webhook_event(payload: bytes, sig_header: str) -> dict | None:
    settings = get_settings()
    s = get_stripe()

    if settings.stripe_webhook_secret:
        event = s.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    else:
        import json
        event = s.Event.construct_from(json.loads(payload), s.api_key)

    return event
