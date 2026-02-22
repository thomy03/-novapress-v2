"""
Subscription feature endpoints for NovaPress AI v2.
Returns available features and limits based on user's subscription tier.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from loguru import logger

from app.api.deps import optional_current_user
from app.models.user import User
from app.core.feature_gates import (
    Tier,
    FREE_DAILY_SYNTHESIS_LIMIT,
    get_user_tier,
    get_tier_features,
    get_daily_usage,
)

router = APIRouter()


@router.get("/features")
async def get_subscription_features(
    user: Optional[User] = Depends(optional_current_user),
):
    """
    Returns the features available for the current user's subscription tier.

    Works for both authenticated and anonymous users:
    - Anonymous / expired subscription -> free tier
    - Authenticated with valid subscription -> their tier

    Response:
        {
            "tier": "free",
            "features": ["search"],
            "limits": {
                "syntheses_per_day": 5,
                "syntheses_used_today": 2
            }
        }
    """
    tier = get_user_tier(user)
    available_features = get_tier_features(tier)

    # Build feature name list
    feature_names = [f.value for f in available_features]

    # Free-tier always has basic search
    if "search" not in feature_names:
        feature_names.insert(0, "search")

    # Build limits based on tier
    limits: dict = {}

    if tier == Tier.FREE:
        limits["syntheses_per_day"] = FREE_DAILY_SYNTHESIS_LIMIT
        # Get current usage if user is authenticated
        if user is not None:
            try:
                used_today = await get_daily_usage(user, "synthesis_view")
                limits["syntheses_used_today"] = used_today
            except Exception as e:
                logger.warning(f"Could not fetch daily usage: {e}")
                limits["syntheses_used_today"] = 0
        else:
            limits["syntheses_used_today"] = 0
    else:
        # Pro and Enterprise have unlimited
        limits["syntheses_per_day"] = -1  # -1 = unlimited
        limits["syntheses_used_today"] = 0

    return {
        "tier": tier.value,
        "features": feature_names,
        "limits": limits,
    }
