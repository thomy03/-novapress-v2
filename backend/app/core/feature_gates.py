"""
Feature gating by subscription tier for NovaPress AI v2.
Controls access to premium features based on user's subscription.
"""
from enum import Enum
from typing import Optional
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from loguru import logger
import redis.asyncio as aioredis

from app.api.deps import optional_current_user
from app.models.user import User
from app.core.config import settings


class Tier(str, Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class Feature(str, Enum):
    SYNTHESES_UNLIMITED = "syntheses_unlimited"
    PERSONA_SWITCH = "persona_switch"
    CAUSAL_GRAPH = "causal_graph"
    TIMELINE = "timeline"
    AUDIO_BRIEFING = "audio_briefing"
    TELEGRAM_ALERTS = "telegram_alerts"
    SEMANTIC_SEARCH = "semantic_search"
    BOOKMARKS = "bookmarks"
    NEWS_XRAY = "news_xray"
    API_ACCESS = "api_access"
    CUSTOM_SOURCES = "custom_sources"
    CUSTOM_PERSONAS = "custom_personas"
    WHITE_LABEL = "white_label"


# Feature -> minimum required tier
FEATURE_TIERS: dict[Feature, Tier] = {
    Feature.SYNTHESES_UNLIMITED: Tier.PRO,
    Feature.PERSONA_SWITCH: Tier.PRO,
    Feature.CAUSAL_GRAPH: Tier.PRO,
    Feature.TIMELINE: Tier.PRO,
    Feature.AUDIO_BRIEFING: Tier.PRO,
    Feature.TELEGRAM_ALERTS: Tier.PRO,
    Feature.SEMANTIC_SEARCH: Tier.PRO,
    Feature.BOOKMARKS: Tier.PRO,
    Feature.NEWS_XRAY: Tier.PRO,
    Feature.API_ACCESS: Tier.ENTERPRISE,
    Feature.CUSTOM_SOURCES: Tier.ENTERPRISE,
    Feature.CUSTOM_PERSONAS: Tier.ENTERPRISE,
    Feature.WHITE_LABEL: Tier.ENTERPRISE,
}

# Tier hierarchy for comparison
TIER_LEVEL = {Tier.FREE: 0, Tier.PRO: 1, Tier.ENTERPRISE: 2}

# Daily limits for free tier
FREE_DAILY_SYNTHESIS_LIMIT = 5

# Redis connection singleton
_redis_client: Optional[aioredis.Redis] = None


async def _get_redis() -> aioredis.Redis:
    """Get or create async Redis connection for feature gating."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


def get_user_tier(user: Optional[User]) -> Tier:
    """
    Get effective tier for a user, accounting for subscription expiration.

    Rules:
    - Anonymous (None) users -> FREE
    - Users with no subscription_tier field -> FREE
    - Users whose subscription has expired -> FREE
    - Otherwise -> their stored tier
    """
    if user is None:
        return Tier.FREE

    raw_tier = getattr(user, "subscription_tier", "free") or "free"

    # Normalize to Tier enum
    try:
        tier = Tier(raw_tier.lower())
    except ValueError:
        logger.warning(f"Unknown subscription tier '{raw_tier}' for user {user.id}, defaulting to FREE")
        return Tier.FREE

    # If the tier is paid, check expiration
    if tier != Tier.FREE:
        expires_at = getattr(user, "subscription_expires_at", None)
        if expires_at is not None:
            # Make sure we compare timezone-aware datetimes
            now = datetime.now(timezone.utc)
            if expires_at.tzinfo is None:
                # Treat naive datetime as UTC
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now > expires_at:
                logger.info(f"Subscription expired for user {user.id} (expired {expires_at.isoformat()})")
                return Tier.FREE

    return tier


def has_feature(user: Optional[User], feature: Feature) -> bool:
    """
    Check if a user has access to a specific feature.

    Returns True if the user's effective tier meets or exceeds
    the minimum tier required for the feature.
    """
    user_tier = get_user_tier(user)
    required_tier = FEATURE_TIERS.get(feature)

    # If the feature is not in FEATURE_TIERS, it's available to everyone
    if required_tier is None:
        return True

    return TIER_LEVEL[user_tier] >= TIER_LEVEL[required_tier]


def get_tier_features(tier: Tier) -> list[Feature]:
    """
    List all features available for a given tier.

    A tier has access to all features whose minimum tier is at or below
    the given tier's level.
    """
    tier_level = TIER_LEVEL[tier]
    return [
        feature
        for feature, min_tier in FEATURE_TIERS.items()
        if TIER_LEVEL[min_tier] <= tier_level
    ]


async def check_daily_limit(user: User, feature: str, limit: int) -> bool:
    """
    Check and increment a daily usage counter in Redis.

    Key pattern: novapress:limits:{user_id}:{feature}:{YYYY-MM-DD}
    TTL: 86400 seconds (24 hours)

    Returns True if the user is within the limit (usage allowed).
    Returns False if the limit has been reached.
    """
    r = await _get_redis()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"novapress:limits:{user.id}:{feature}:{today}"

    try:
        current = await r.get(key)
        current_count = int(current) if current is not None else 0

        if current_count >= limit:
            return False

        # Increment and set TTL atomically via pipeline
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, 86400)
        await pipe.execute()

        return True
    except Exception as e:
        # If Redis is unavailable, allow the request (fail open)
        logger.warning(f"Redis error in check_daily_limit: {e}. Allowing request.")
        return True


async def get_daily_usage(user: User, feature: str) -> int:
    """
    Get the current daily usage count for a user and feature.
    Returns 0 if no usage recorded or Redis is unavailable.
    """
    r = await _get_redis()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"novapress:limits:{user.id}:{feature}:{today}"

    try:
        current = await r.get(key)
        return int(current) if current is not None else 0
    except Exception as e:
        logger.warning(f"Redis error in get_daily_usage: {e}")
        return 0


def require_feature(feature: Feature):
    """
    FastAPI dependency that raises 403 if the user does not have access
    to the specified feature.

    Usage:
        @router.get("/causal-graph", dependencies=[Depends(require_feature(Feature.CAUSAL_GRAPH))])
        async def get_causal_graph(...): ...

    Or in the function signature:
        async def get_causal_graph(
            _gate=Depends(require_feature(Feature.CAUSAL_GRAPH)),
        ): ...
    """
    async def _check_feature(
        user: Optional[User] = Depends(optional_current_user),
    ) -> None:
        if not has_feature(user, feature):
            user_tier = get_user_tier(user)
            required_tier = FEATURE_TIERS.get(feature, Tier.FREE)
            logger.info(
                f"Feature gate blocked: feature={feature.value}, "
                f"user_tier={user_tier.value}, required={required_tier.value}, "
                f"user_id={getattr(user, 'id', 'anonymous')}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "feature_not_available",
                    "feature": feature.value,
                    "required_tier": required_tier.value,
                    "current_tier": user_tier.value,
                    "message": f"This feature requires a {required_tier.value} subscription.",
                },
            )
    return _check_feature


def require_tier(min_tier: Tier):
    """
    FastAPI dependency that raises 403 if the user's tier is below
    the specified minimum tier.

    Usage:
        @router.get("/enterprise-data", dependencies=[Depends(require_tier(Tier.ENTERPRISE))])
        async def get_enterprise_data(...): ...
    """
    async def _check_tier(
        user: Optional[User] = Depends(optional_current_user),
    ) -> None:
        user_tier = get_user_tier(user)
        if TIER_LEVEL[user_tier] < TIER_LEVEL[min_tier]:
            logger.info(
                f"Tier gate blocked: required={min_tier.value}, "
                f"user_tier={user_tier.value}, "
                f"user_id={getattr(user, 'id', 'anonymous')}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "tier_insufficient",
                    "required_tier": min_tier.value,
                    "current_tier": user_tier.value,
                    "message": f"This endpoint requires a {min_tier.value} subscription.",
                },
            )
    return _check_tier
