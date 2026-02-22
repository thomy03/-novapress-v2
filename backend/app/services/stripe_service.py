"""
Stripe subscription management for NovaPress AI v2
3 tiers: Free ($0), Pro ($4.99/mo or $49.99/yr), Enterprise (custom)

Setup:
  1. pip install stripe
  2. Set in .env:
       STRIPE_SECRET_KEY=sk_test_...
       STRIPE_WEBHOOK_SECRET=whsec_...
       STRIPE_PRO_MONTHLY_PRICE_ID=price_...
       STRIPE_PRO_ANNUAL_PRICE_ID=price_...
       STRIPE_ENTERPRISE_PRICE_ID=price_...
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from loguru import logger

from app.core.config import settings


def _get_stripe():
    """
    Lazy-import and configure the stripe module.
    Returns None if stripe is not installed or STRIPE_SECRET_KEY is empty.
    """
    if not settings.STRIPE_SECRET_KEY:
        logger.warning("STRIPE_SECRET_KEY not configured -- Stripe billing disabled")
        return None

    try:
        import stripe
    except ImportError:
        logger.warning("stripe package not installed -- run: pip install stripe")
        return None

    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def _price_id_to_tier(price_id: str) -> str:
    """Map a Stripe price_id to the internal subscription_tier string."""
    if price_id in (
        settings.STRIPE_PRO_MONTHLY_PRICE_ID,
        settings.STRIPE_PRO_ANNUAL_PRICE_ID,
    ):
        return "pro"
    if price_id == settings.STRIPE_ENTERPRISE_PRICE_ID:
        return "enterprise"
    return "free"


class StripeService:
    """
    Encapsulates all Stripe interactions for NovaPress billing.

    Every public method checks for stripe availability first and raises
    RuntimeError when the service is unconfigured so that the API layer
    can return a clean 503.
    """

    # ------------------------------------------------------------------ #
    #  Checkout
    # ------------------------------------------------------------------ #
    async def create_checkout_session(
        self,
        user_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        customer_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a Stripe Checkout Session for a new subscription.

        Returns:
            {"session_id": "cs_...", "url": "https://checkout.stripe.com/..."}
        """
        stripe = _get_stripe()
        if stripe is None:
            raise RuntimeError("Stripe is not configured")

        params: Dict[str, Any] = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": str(user_id),
            "metadata": {"user_id": str(user_id)},
        }

        # Attach to existing Stripe customer when we already have one
        if customer_id:
            params["customer"] = customer_id
        else:
            # Let Stripe create a new customer automatically
            params["customer_creation"] = "always"

        try:
            session = stripe.checkout.Session.create(**params)
            logger.info(
                f"Checkout session created for user {user_id}: {session.id}"
            )
            return {"session_id": session.id, "url": session.url}
        except stripe.error.StripeError as e:
            logger.error(f"Stripe checkout error: {e}")
            raise

    # ------------------------------------------------------------------ #
    #  Customer Portal
    # ------------------------------------------------------------------ #
    async def create_customer_portal_session(
        self,
        customer_id: str,
        return_url: str,
    ) -> Dict[str, str]:
        """
        Open the Stripe Customer Portal so the user can manage their
        subscription, update payment methods, or cancel.

        Returns:
            {"url": "https://billing.stripe.com/..."}
        """
        stripe = _get_stripe()
        if stripe is None:
            raise RuntimeError("Stripe is not configured")

        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            return {"url": session.url}
        except stripe.error.StripeError as e:
            logger.error(f"Stripe portal error: {e}")
            raise

    # ------------------------------------------------------------------ #
    #  Webhook Handler
    # ------------------------------------------------------------------ #
    async def handle_webhook(
        self,
        payload: bytes,
        sig_header: str,
    ) -> Dict[str, Any]:
        """
        Verify and process a Stripe webhook event.

        Returns a dict describing the action taken so the route can log it.
        Callers are expected to persist any DB changes themselves.
        """
        stripe = _get_stripe()
        if stripe is None:
            raise RuntimeError("Stripe is not configured")

        if not settings.STRIPE_WEBHOOK_SECRET:
            raise RuntimeError("STRIPE_WEBHOOK_SECRET not configured")

        try:
            event = stripe.Webhook.construct_event(
                payload,
                sig_header,
                settings.STRIPE_WEBHOOK_SECRET,
            )
        except stripe.error.SignatureVerificationError:
            logger.warning("Stripe webhook signature verification failed")
            raise ValueError("Invalid webhook signature")

        event_type: str = event["type"]
        data_object = event["data"]["object"]

        logger.info(f"Stripe webhook received: {event_type}")

        # --- checkout.session.completed ---
        if event_type == "checkout.session.completed":
            return self._handle_checkout_completed(data_object)

        # --- customer.subscription.updated ---
        if event_type == "customer.subscription.updated":
            return self._handle_subscription_updated(data_object)

        # --- customer.subscription.deleted ---
        if event_type == "customer.subscription.deleted":
            return self._handle_subscription_deleted(data_object)

        # --- invoice.payment_failed ---
        if event_type == "invoice.payment_failed":
            return self._handle_payment_failed(data_object)

        # Unhandled but not an error -- Stripe sends many event types
        logger.debug(f"Unhandled Stripe event type: {event_type}")
        return {"action": "ignored", "event_type": event_type}

    # -- private handlers -----------------------------------------------

    def _handle_checkout_completed(self, session: Dict) -> Dict[str, Any]:
        """Extract useful info from a completed checkout session."""
        user_id = session.get("client_reference_id") or session.get(
            "metadata", {}
        ).get("user_id")
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")

        logger.info(
            f"Checkout completed: user={user_id} customer={customer_id} "
            f"subscription={subscription_id}"
        )

        return {
            "action": "activate_subscription",
            "user_id": user_id,
            "customer_id": customer_id,
            "subscription_id": subscription_id,
        }

    def _handle_subscription_updated(self, subscription: Dict) -> Dict[str, Any]:
        """Determine the new tier from the subscription's price."""
        customer_id = subscription.get("customer")
        status = subscription.get("status")
        cancel_at_period_end = subscription.get("cancel_at_period_end", False)

        # Get the price_id from the first subscription item
        items = subscription.get("items", {}).get("data", [])
        price_id = items[0]["price"]["id"] if items else ""
        tier = _price_id_to_tier(price_id)

        # current_period_end is a Unix timestamp
        period_end_ts = subscription.get("current_period_end")
        expires_at = (
            datetime.fromtimestamp(period_end_ts, tz=timezone.utc)
            if period_end_ts
            else None
        )

        logger.info(
            f"Subscription updated: customer={customer_id} status={status} "
            f"tier={tier} cancel_at_period_end={cancel_at_period_end}"
        )

        return {
            "action": "update_subscription",
            "customer_id": customer_id,
            "tier": tier,
            "status": status,
            "expires_at": expires_at,
            "cancel_at_period_end": cancel_at_period_end,
        }

    def _handle_subscription_deleted(self, subscription: Dict) -> Dict[str, Any]:
        """Subscription cancelled or expired -- downgrade to free."""
        customer_id = subscription.get("customer")

        logger.info(f"Subscription deleted: customer={customer_id} -- downgrade to free")

        return {
            "action": "downgrade_to_free",
            "customer_id": customer_id,
        }

    def _handle_payment_failed(self, invoice: Dict) -> Dict[str, Any]:
        """Payment failed -- log a warning but do not change tier yet."""
        customer_id = invoice.get("customer")
        attempt_count = invoice.get("attempt_count", 0)

        logger.warning(
            f"Payment failed: customer={customer_id} attempt={attempt_count}"
        )

        return {
            "action": "payment_failed",
            "customer_id": customer_id,
            "attempt_count": attempt_count,
        }

    # ------------------------------------------------------------------ #
    #  Read helpers
    # ------------------------------------------------------------------ #
    async def get_subscription_status(
        self,
        customer_id: str,
    ) -> Dict[str, Any]:
        """
        Retrieve the active subscription for a Stripe customer.

        Returns:
            {
                "subscription_id": "sub_...",
                "status": "active",
                "tier": "pro",
                "current_period_end": "2026-03-22T...",
                "cancel_at_period_end": False,
            }
        """
        stripe = _get_stripe()
        if stripe is None:
            raise RuntimeError("Stripe is not configured")

        try:
            subscriptions = stripe.Subscription.list(
                customer=customer_id,
                status="active",
                limit=1,
            )

            if not subscriptions.data:
                return {
                    "subscription_id": None,
                    "status": "none",
                    "tier": "free",
                    "current_period_end": None,
                    "cancel_at_period_end": False,
                }

            sub = subscriptions.data[0]
            items = sub.get("items", {}).get("data", [])
            price_id = items[0]["price"]["id"] if items else ""
            tier = _price_id_to_tier(price_id)

            period_end_ts = sub.get("current_period_end")
            period_end = (
                datetime.fromtimestamp(period_end_ts, tz=timezone.utc).isoformat()
                if period_end_ts
                else None
            )

            return {
                "subscription_id": sub["id"],
                "status": sub["status"],
                "tier": tier,
                "current_period_end": period_end,
                "cancel_at_period_end": sub.get("cancel_at_period_end", False),
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe subscription status error: {e}")
            raise

    async def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """
        Cancel a subscription at the end of the current billing period.
        Does NOT immediately revoke access -- the user keeps Pro until
        current_period_end.

        Returns:
            {"subscription_id": "sub_...", "cancel_at_period_end": True}
        """
        stripe = _get_stripe()
        if stripe is None:
            raise RuntimeError("Stripe is not configured")

        try:
            sub = stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True,
            )
            logger.info(
                f"Subscription {subscription_id} set to cancel at period end"
            )
            return {
                "subscription_id": sub["id"],
                "cancel_at_period_end": sub["cancel_at_period_end"],
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe cancel error: {e}")
            raise


# Singleton
_stripe_service: Optional[StripeService] = None


def get_stripe_service() -> StripeService:
    """Return the singleton StripeService instance."""
    global _stripe_service
    if _stripe_service is None:
        _stripe_service = StripeService()
    return _stripe_service
