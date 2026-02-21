"""
NovaPress Alert Service
Sends proactive alerts when new syntheses match user interests.
Called by the pipeline after synthesis storage.
"""
import json
import time
from typing import Any, Dict, List, Optional

import redis.asyncio as aioredis
from loguru import logger

from app.core.config import settings


class AlertService:
    """Match new syntheses against user profiles and dispatch alerts."""

    PREFIX = "novapress"
    INTEREST_THRESHOLD = 3.0  # Minimum interest score to trigger alert

    def __init__(self, bot=None):
        self._bot = bot  # TelegramBot instance (set after init)
        self._redis: Optional[aioredis.Redis] = None

    def set_bot(self, bot) -> None:
        """Inject the TelegramBot instance after initialization."""
        self._bot = bot

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def close(self):
        if self._redis:
            await self._redis.aclose()
            self._redis = None

    # ─── Registration ───

    async def register_user(self, chat_id: int) -> None:
        """Add user to the active alerts set."""
        r = await self._get_redis()
        await r.sadd(f"{self.PREFIX}:alerts:active_users", str(chat_id))

    async def unregister_user(self, chat_id: int) -> None:
        """Remove user from the active alerts set."""
        r = await self._get_redis()
        await r.srem(f"{self.PREFIX}:alerts:active_users", str(chat_id))

    async def get_active_users(self) -> List[int]:
        """Get all users with alerts enabled."""
        r = await self._get_redis()
        members = await r.smembers(f"{self.PREFIX}:alerts:active_users")
        result = []
        for m in members:
            try:
                result.append(int(m))
            except ValueError:
                pass
        return result

    # ─── Main Hook ───

    async def check_new_synthesis(self, synthesis: Dict[str, Any]) -> int:
        """
        Called after a new synthesis is stored.
        Returns number of notifications dispatched.
        """
        if not self._bot or not self._bot._initialized:
            return 0

        active_users = await self.get_active_users()
        if not active_users:
            return 0

        from app.services.messaging.user_profile import get_profile_manager
        profile_mgr = get_profile_manager()

        sent = 0
        for chat_id in active_users:
            try:
                freq = await profile_mgr.get_preference(
                    chat_id, "alert_frequency", "off"
                )
                if freq == "off":
                    continue

                if not await self._matches_user_interests(chat_id, synthesis, profile_mgr):
                    continue

                if freq == "realtime":
                    await self._send_alert(chat_id, synthesis)
                    sent += 1
                elif freq == "daily":
                    await self._queue_alert(chat_id, synthesis)

            except Exception as e:
                logger.warning(f"Alert check failed for chat {chat_id}: {e}")

        return sent

    # ─── Matching Logic ───

    async def _matches_user_interests(
        self, chat_id: int, synthesis: Dict, profile_mgr
    ) -> bool:
        """Check if synthesis matches user's follows or category interests."""
        r = await self._get_redis()

        # 1. Check explicit follows (keyword matching)
        follows = await r.smembers(f"{self.PREFIX}:user:{chat_id}:follows")
        if follows:
            title_lower = synthesis.get("title", "").lower()
            key_entities = [
                e.lower() for e in synthesis.get("key_entities", [])
            ]
            for followed in follows:
                fl = followed.lower()
                if fl in title_lower or any(fl in e for e in key_entities):
                    return True

        # 2. Check category interest score
        cat = synthesis.get("category", "")
        if cat:
            score_str = await r.zscore(
                f"{self.PREFIX}:user:{chat_id}:interests", cat
            )
            if score_str and float(score_str) >= self.INTEREST_THRESHOLD:
                return True

        return False

    # ─── Dispatching ───

    async def _send_alert(self, chat_id: int, synthesis: Dict) -> None:
        """Send immediate Telegram alert."""
        title = synthesis.get("title", "Nouvelle synthèse")
        category = synthesis.get("category", "")
        sources = synthesis.get("source_count", 0)
        intro = synthesis.get("introduction", synthesis.get("summary", ""))[:200]

        bot = self._bot
        esc = bot._escape_md_static

        text = (
            f"🔔 *Nouvelle synthèse sur votre suivi \\!*\n\n"
            f"*{esc(title)}*\n"
            f"_{esc(intro)}_\n\n"
            f"📂 {esc(category)} · 📰 {sources} sources\n\n"
            f"Tapez /briefing pour le briefing complet\\."
        )
        await bot.send_message(chat_id, text)

    async def _queue_alert(self, chat_id: int, synthesis: Dict) -> None:
        """Queue alert for daily digest."""
        r = await self._get_redis()
        payload = json.dumps({
            "chat_id": chat_id,
            "synthesis_id": synthesis.get("id", ""),
            "title": synthesis.get("title", ""),
            "category": synthesis.get("category", ""),
            "queued_at": time.time(),
        }, ensure_ascii=False)
        await r.lpush(f"{self.PREFIX}:alerts:pending", payload)

    # ─── Daily Digest ───

    async def send_pending_digest(self) -> int:
        """Send all pending queued alerts as a digest. Call once per day."""
        r = await self._get_redis()
        pending_key = f"{self.PREFIX}:alerts:pending"

        # Group by chat_id
        all_pending: Dict[int, List[Dict]] = {}
        while True:
            raw = await r.rpop(pending_key)
            if not raw:
                break
            try:
                item = json.loads(raw)
                cid = int(item.get("chat_id", 0))
                if cid:
                    all_pending.setdefault(cid, []).append(item)
            except (json.JSONDecodeError, ValueError):
                continue

        if not all_pending or not self._bot:
            return 0

        bot = self._bot
        esc = bot._escape_md_static
        sent = 0

        for chat_id, items in all_pending.items():
            try:
                lines = ["🗞️ *Digest de vos alertes*\n"]
                for item in items[:10]:
                    title = esc(item.get("title", "Synthèse"))
                    cat = esc(item.get("category", ""))
                    lines.append(f"• *{title}*  _{cat}_")

                lines.append("\nTapez /briefing pour lire le briefing complet\\.")
                await bot.send_message(chat_id, "\n".join(lines))
                sent += 1
            except Exception as e:
                logger.warning(f"Failed to send digest to {chat_id}: {e}")

        return sent


# Global instance
_alert_service: Optional[AlertService] = None


def get_alert_service() -> AlertService:
    global _alert_service
    if _alert_service is None:
        _alert_service = AlertService()
    return _alert_service
