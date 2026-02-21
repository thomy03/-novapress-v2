"""
NovaPress Web Push Notifications — VAPID-based
Stores subscriptions in Redis, sends notifications via pywebpush.

Setup:
  1. pip install pywebpush
  2. Generate keys: python -c "from pywebpush import Vapid; v = Vapid(); v.generate_keys(); print(v.private_key, v.public_key)"
  3. Set in .env:
       VAPID_PRIVATE_KEY=<private>
       VAPID_PUBLIC_KEY=<public>
       VAPID_EMAIL=mailto:admin@novapress.ai
  4. Set in .env.local (frontend):
       NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>
"""
import hashlib
import json
from typing import Any, Dict, Optional, Tuple

import redis.asyncio as aioredis
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from loguru import logger

from app.core.config import settings

router = APIRouter()

# Redis key schema
_SUBS_SET_KEY = "novapress:push:subscriptions"   # SET of hashed endpoints
_SUB_PREFIX = "novapress:push:sub:"              # HASH per subscription
_SUB_TTL = 90 * 24 * 3600                        # 90-day TTL


# ─── Helpers ───

def _hash(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode()).hexdigest()[:20]


async def _get_redis() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


# ─── Routes ───

@router.post("/subscribe")
async def subscribe(request: Request) -> JSONResponse:
    """Store a Web Push subscription returned by PushManager.subscribe()."""
    try:
        data = await request.json()
        endpoint: Optional[str] = data.get("endpoint")
        if not endpoint:
            raise HTTPException(status_code=400, detail="Missing endpoint")

        key = _hash(endpoint)
        r = await _get_redis()
        try:
            await r.sadd(_SUBS_SET_KEY, key)
            await r.hset(f"{_SUB_PREFIX}{key}", mapping={"data": json.dumps(data)})
            await r.expire(f"{_SUB_PREFIX}{key}", _SUB_TTL)
        finally:
            await r.aclose()

        logger.info(f"Push subscription stored: ...{endpoint[-30:]}")
        return JSONResponse({"ok": True})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Push subscribe error: {e}")
        raise HTTPException(status_code=500, detail="Failed to store subscription")


@router.post("/unsubscribe")
async def unsubscribe(request: Request) -> JSONResponse:
    """Remove a Web Push subscription."""
    try:
        data = await request.json()
        endpoint: Optional[str] = data.get("endpoint")
        if not endpoint:
            raise HTTPException(status_code=400, detail="Missing endpoint")

        key = _hash(endpoint)
        r = await _get_redis()
        try:
            await r.srem(_SUBS_SET_KEY, key)
            await r.delete(f"{_SUB_PREFIX}{key}")
        finally:
            await r.aclose()

        return JSONResponse({"ok": True})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Push unsubscribe error: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove subscription")


@router.post("/send")
async def send_notification(request: Request) -> JSONResponse:
    """
    Broadcast a push notification to all subscribers.
    Protected by x-admin-key header.

    Body: {"title": "...", "body": "...", "url": "/synthesis/xxx", "tag": "..."}
    """
    admin_key = request.headers.get("x-admin-key", "")
    if admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        payload = await request.json()
        sent, failed = await broadcast_push(payload)
        return JSONResponse({"ok": True, "sent": sent, "failed": failed})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Push broadcast error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send notifications")


@router.get("/count")
async def subscription_count(request: Request) -> JSONResponse:
    """Return number of active push subscriptions. Requires admin key."""
    admin_key = request.headers.get("x-admin-key", "")
    if admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    r = await _get_redis()
    try:
        count = await r.scard(_SUBS_SET_KEY)
    finally:
        await r.aclose()

    return JSONResponse({"count": count})


# ─── Public helper for other services (alert_service, pipeline) ───

async def broadcast_push(payload: Dict[str, Any]) -> Tuple[int, int]:
    """
    Send a Web Push notification to all stored subscriptions.
    Returns (sent_count, failed_count).

    Gracefully degrades if pywebpush is not installed or VAPID keys are missing.
    """
    try:
        from pywebpush import webpush, WebPushException  # type: ignore
    except ImportError:
        logger.warning("pywebpush not installed — Web Push disabled. Install with: pip install pywebpush")
        return 0, 0

    vapid_private = getattr(settings, "VAPID_PRIVATE_KEY", "")
    vapid_email = getattr(settings, "VAPID_EMAIL", "")

    if not vapid_private or not vapid_email:
        logger.warning("VAPID_PRIVATE_KEY or VAPID_EMAIL not configured — Web Push disabled")
        return 0, 0

    r = await _get_redis()
    sent = failed = 0

    try:
        sub_keys = await r.smembers(_SUBS_SET_KEY)

        for key in sub_keys:
            raw = await r.hget(f"{_SUB_PREFIX}{key}", "data")
            if not raw:
                continue
            sub_data = json.loads(raw)

            try:
                webpush(
                    subscription_info=sub_data,
                    data=json.dumps(payload),
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": vapid_email},
                )
                sent += 1

            except Exception as e:
                err_str = str(e)
                # 410 Gone = subscription expired → clean up
                if "410" in err_str or "404" in err_str:
                    await r.srem(_SUBS_SET_KEY, key)
                    await r.delete(f"{_SUB_PREFIX}{key}")
                    logger.info(f"Removed expired push subscription: {key}")
                else:
                    logger.warning(f"Push send failed for {key}: {e}")
                failed += 1

    finally:
        await r.aclose()

    if sent or failed:
        logger.info(f"Web Push broadcast: {sent} sent, {failed} failed")

    return sent, failed
