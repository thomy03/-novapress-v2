"""
NovaPress AI v2 -- Stripe Billing API

Endpoints:
  POST /checkout  -- create a Stripe Checkout session (auth required)
  POST /portal    -- create a Stripe Customer Portal session (auth required)
  GET  /status    -- current subscription status (auth required)
  POST /webhook   -- Stripe webhook handler (NO auth -- verified via signature)
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.services.stripe_service import get_stripe_service

router = APIRouter()


# ------------------------------------------------------------------ #
#  Request / Response schemas
# ------------------------------------------------------------------ #

class CheckoutRequest(BaseModel):
    priceId: str
    annual: bool = False


class UrlResponse(BaseModel):
    url: str


class SubscriptionStatusResponse(BaseModel):
    tier: str
    expiresAt: str | None = None
    cancelAtPeriodEnd: bool = False


# ------------------------------------------------------------------ #
#  Helpers
# ------------------------------------------------------------------ #

def _ensure_stripe_configured() -> None:
    """Raise 503 if Stripe is not configured."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing service is not configured",
        )


# ------------------------------------------------------------------ #
#  POST /checkout
# ------------------------------------------------------------------ #

@router.post("/checkout", response_model=UrlResponse)
async def create_checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a Stripe Checkout Session for the current user.
    Redirects the browser to Stripe's hosted payment page.
    """
    _ensure_stripe_configured()

    service = get_stripe_service()

    # Resolve the actual Stripe price_id
    # The frontend may send the exact price_id OR we can resolve from annual flag
    price_id = body.priceId
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="priceId is required",
        )

    # Build success / cancel URLs relative to the frontend origin
    frontend_origin = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:3000"
    success_url = f"{frontend_origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{frontend_origin}/billing/cancel"

    try:
        result = await service.create_checkout_session(
            user_id=str(current_user.id),
            price_id=price_id,
            success_url=success_url,
            cancel_url=cancel_url,
            customer_id=current_user.stripe_customer_id,
        )
        return UrlResponse(url=result["url"])
    except RuntimeError as e:
        logger.error(f"Stripe checkout runtime error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing service is unavailable",
        )
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create checkout session",
        )


# ------------------------------------------------------------------ #
#  POST /portal
# ------------------------------------------------------------------ #

@router.post("/portal", response_model=UrlResponse)
async def create_portal(
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a Stripe Customer Portal session so the user can manage
    their subscription, update payment method, or cancel.
    """
    _ensure_stripe_configured()

    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active subscription found",
        )

    service = get_stripe_service()
    frontend_origin = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:3000"
    return_url = f"{frontend_origin}/billing"

    try:
        result = await service.create_customer_portal_session(
            customer_id=current_user.stripe_customer_id,
            return_url=return_url,
        )
        return UrlResponse(url=result["url"])
    except RuntimeError as e:
        logger.error(f"Stripe portal runtime error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing service is unavailable",
        )
    except Exception as e:
        logger.error(f"Stripe portal error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create portal session",
        )


# ------------------------------------------------------------------ #
#  GET /status
# ------------------------------------------------------------------ #

@router.get("/status", response_model=SubscriptionStatusResponse)
async def get_status(
    current_user: User = Depends(get_current_active_user),
):
    """Return the current subscription status for the authenticated user."""
    _ensure_stripe_configured()

    # If user has no Stripe customer, they are on the free tier
    if not current_user.stripe_customer_id:
        return SubscriptionStatusResponse(
            tier=current_user.subscription_tier or "free",
            expiresAt=(
                current_user.subscription_expires_at.isoformat()
                if current_user.subscription_expires_at
                else None
            ),
            cancelAtPeriodEnd=False,
        )

    service = get_stripe_service()

    try:
        stripe_status = await service.get_subscription_status(
            current_user.stripe_customer_id,
        )
        return SubscriptionStatusResponse(
            tier=stripe_status["tier"],
            expiresAt=stripe_status["current_period_end"],
            cancelAtPeriodEnd=stripe_status["cancel_at_period_end"],
        )
    except RuntimeError as e:
        logger.error(f"Stripe status runtime error: {e}")
        # Fallback to DB values when Stripe is unreachable
        return SubscriptionStatusResponse(
            tier=current_user.subscription_tier or "free",
            expiresAt=(
                current_user.subscription_expires_at.isoformat()
                if current_user.subscription_expires_at
                else None
            ),
            cancelAtPeriodEnd=False,
        )
    except Exception as e:
        logger.error(f"Stripe status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to retrieve subscription status",
        )


# ------------------------------------------------------------------ #
#  POST /webhook  (NO auth -- verified via Stripe signature)
# ------------------------------------------------------------------ #

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive and process Stripe webhook events.

    This endpoint is called by Stripe's servers and does NOT require user
    authentication.  Instead, events are verified using the webhook
    signing secret (STRIPE_WEBHOOK_SECRET).
    """
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing service is not configured",
        )

    # Read the raw body -- we need it for signature verification
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing stripe-signature header",
        )

    service = get_stripe_service()

    try:
        result = await service.handle_webhook(payload, sig_header)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )
    except RuntimeError as e:
        logger.error(f"Stripe webhook runtime error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing service is unavailable",
        )

    action = result.get("action")

    # ----- activate_subscription (checkout.session.completed) -----
    if action == "activate_subscription":
        user_id = result.get("user_id")
        customer_id = result.get("customer_id")
        subscription_id = result.get("subscription_id")

        if user_id:
            try:
                import uuid as _uuid

                user_uuid = _uuid.UUID(user_id)
                stmt = select(User).where(User.id == user_uuid)
                db_result = await db.execute(stmt)
                user = db_result.scalar_one_or_none()

                if user:
                    user.stripe_customer_id = customer_id

                    # Determine the tier from the subscription
                    if subscription_id:
                        try:
                            sub_status = await service.get_subscription_status(
                                customer_id,
                            )
                            user.subscription_tier = sub_status.get("tier", "pro")
                            period_end = sub_status.get("current_period_end")
                            if period_end:
                                user.subscription_expires_at = datetime.fromisoformat(
                                    period_end
                                )
                        except Exception as sub_err:
                            logger.warning(
                                f"Could not fetch subscription details: {sub_err}"
                            )
                            user.subscription_tier = "pro"
                    else:
                        user.subscription_tier = "pro"

                    logger.info(
                        f"User {user_id} activated: tier={user.subscription_tier}"
                    )
                else:
                    logger.warning(
                        f"Webhook: user {user_id} not found in database"
                    )
            except Exception as e:
                logger.error(f"Webhook activate_subscription DB error: {e}")

    # ----- update_subscription (customer.subscription.updated) -----
    elif action == "update_subscription":
        customer_id = result.get("customer_id")
        tier = result.get("tier", "free")
        expires_at = result.get("expires_at")

        if customer_id:
            try:
                stmt = select(User).where(
                    User.stripe_customer_id == customer_id
                )
                db_result = await db.execute(stmt)
                user = db_result.scalar_one_or_none()

                if user:
                    user.subscription_tier = tier
                    if expires_at and isinstance(expires_at, datetime):
                        user.subscription_expires_at = expires_at
                    logger.info(
                        f"User {user.id} subscription updated: tier={tier}"
                    )
                else:
                    logger.warning(
                        f"Webhook: customer {customer_id} not found in database"
                    )
            except Exception as e:
                logger.error(f"Webhook update_subscription DB error: {e}")

    # ----- downgrade_to_free (customer.subscription.deleted) -----
    elif action == "downgrade_to_free":
        customer_id = result.get("customer_id")

        if customer_id:
            try:
                stmt = select(User).where(
                    User.stripe_customer_id == customer_id
                )
                db_result = await db.execute(stmt)
                user = db_result.scalar_one_or_none()

                if user:
                    user.subscription_tier = "free"
                    user.subscription_expires_at = None
                    logger.info(
                        f"User {user.id} downgraded to free tier"
                    )
                else:
                    logger.warning(
                        f"Webhook: customer {customer_id} not found in database"
                    )
            except Exception as e:
                logger.error(f"Webhook downgrade_to_free DB error: {e}")

    # ----- payment_failed (invoice.payment_failed) -----
    elif action == "payment_failed":
        customer_id = result.get("customer_id")
        attempt_count = result.get("attempt_count", 0)
        logger.warning(
            f"Payment failed for customer {customer_id} "
            f"(attempt {attempt_count})"
        )

    return JSONResponse({"received": True})
