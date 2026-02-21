"""
NovaPress User Profile Manager
Learns user preferences from interactions and persists to Redis.
Zero LLM calls — pure counter-based implicit learning.
"""
import json
import time
from typing import Dict, List, Optional, Tuple

import redis.asyncio as aioredis
from loguru import logger

from app.core.config import settings


class UserProfileManager:
    """Manages user profiles and interest learning via Redis."""

    # Learning constants
    IMPLICIT_BOOST = 1.0   # +1 point per question touching a category
    EXPLICIT_BOOST = 5.0   # +5 points for /follow
    DECAY_RATE = 0.9       # -10% per week without interaction on that topic
    INTEREST_THRESHOLD = 2.0  # Minimum score to consider "interested"

    # Redis key patterns
    PREFIX = "novapress:user"

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def close(self):
        if self._redis:
            await self._redis.aclose()
            self._redis = None

    # ─── Profile CRUD ───

    async def get_profile(self, chat_id: int) -> Dict:
        """Get full user profile."""
        r = await self._get_redis()
        key = f"{self.PREFIX}:{chat_id}:profile"
        data = await r.hgetall(key)
        if not data:
            # Create default profile
            data = {
                "preferred_persona": "neutral",
                "language": "fr",
                "alert_frequency": "off",
                "briefing_time": "07:00",
                "registered_at": str(int(time.time())),
            }
            await r.hset(key, mapping=data)
        return data

    async def set_preference(self, chat_id: int, key: str, value: str) -> None:
        """Set a single user preference."""
        r = await self._get_redis()
        await r.hset(f"{self.PREFIX}:{chat_id}:profile", key, value)

    async def get_preference(self, chat_id: int, key: str, default: str = "") -> str:
        """Get a single preference value."""
        r = await self._get_redis()
        val = await r.hget(f"{self.PREFIX}:{chat_id}:profile", key)
        return val or default

    # ─── Interest Learning ───

    async def update_from_interaction(
        self, chat_id: int, matched_categories: List[str]
    ) -> None:
        """Implicitly learn from user interaction — zero LLM calls."""
        if not matched_categories:
            return
        r = await self._get_redis()
        key = f"{self.PREFIX}:{chat_id}:interests"
        for cat in matched_categories:
            await r.zincrby(key, self.IMPLICIT_BOOST, cat)
        # Also record timestamp for decay
        now = time.time()
        history_key = f"{self.PREFIX}:{chat_id}:topic_history"
        for cat in matched_categories:
            await r.zadd(history_key, {cat: now})

    async def get_top_interests(
        self, chat_id: int, limit: int = 5
    ) -> List[Tuple[str, float]]:
        """Get top interests sorted by score descending."""
        r = await self._get_redis()
        key = f"{self.PREFIX}:{chat_id}:interests"
        results = await r.zrevrange(key, 0, limit - 1, withscores=True)
        return [(name, score) for name, score in results]

    async def apply_weekly_decay(self, chat_id: int) -> None:
        """Decay all interest scores by DECAY_RATE. Call weekly."""
        r = await self._get_redis()
        key = f"{self.PREFIX}:{chat_id}:interests"
        interests = await r.zrangebyscore(key, "-inf", "+inf", withscores=True)
        if not interests:
            return
        for name, score in interests:
            new_score = score * self.DECAY_RATE
            if new_score < 0.1:
                await r.zrem(key, name)
            else:
                await r.zadd(key, {name: new_score})

    # ─── Explicit Topic Following ───

    async def follow_topic(self, chat_id: int, topic: str) -> None:
        """Explicitly follow a topic."""
        r = await self._get_redis()
        await r.sadd(f"{self.PREFIX}:{chat_id}:follows", topic)
        # Also boost interest score
        await r.zincrby(
            f"{self.PREFIX}:{chat_id}:interests",
            self.EXPLICIT_BOOST,
            topic.upper(),
        )

    async def unfollow_topic(self, chat_id: int, topic: str) -> None:
        """Unfollow a topic."""
        r = await self._get_redis()
        await r.srem(f"{self.PREFIX}:{chat_id}:follows", topic)

    async def get_followed_topics(self, chat_id: int) -> List[str]:
        """Get all followed topics."""
        r = await self._get_redis()
        members = await r.smembers(f"{self.PREFIX}:{chat_id}:follows")
        return sorted(members) if members else []

    # ─── Personalization Filters ───

    async def get_personalized_filters(self, chat_id: int) -> Dict:
        """Return Qdrant-compatible filters based on user profile."""
        top = await self.get_top_interests(chat_id, limit=3)
        follows = await self.get_followed_topics(chat_id)
        persona = await self.get_preference(chat_id, "preferred_persona", "neutral")
        return {
            "categories": [name for name, score in top if score >= self.INTEREST_THRESHOLD],
            "entities": follows,
            "persona": persona,
        }

    # ─── Category Detection (lightweight, no LLM) ───

    CATEGORY_KEYWORDS = {
        "TECH": [
            "ia", "intelligence artificielle", "ai", "tech", "startup", "google",
            "apple", "microsoft", "openai", "chatgpt", "robot", "algorithme",
            "cyber", "blockchain", "crypto", "bitcoin", "logiciel", "app",
            "deepseek", "claude", "gpt", "llm", "machine learning",
        ],
        "POLITIQUE": [
            "macron", "politique", "election", "parlement", "loi", "gouvernement",
            "senat", "assemblee", "president", "ministre", "trump", "biden",
            "parti", "vote", "reformer", "opposition", "droite", "gauche",
        ],
        "ECONOMIE": [
            "economie", "bourse", "inflation", "pib", "croissance", "emploi",
            "chomage", "banque", "euro", "dollar", "marche", "commerce",
            "dette", "budget", "impot", "entreprise", "cac", "nasdaq",
        ],
        "MONDE": [
            "ukraine", "russie", "chine", "gaza", "israel", "guerre",
            "conflit", "otan", "onu", "diplomatie", "geopolitique",
            "migration", "refugie", "moyen-orient", "afrique", "asie",
        ],
        "SCIENCES": [
            "science", "espace", "nasa", "climat", "environnement",
            "recherche", "decouverte", "sante", "medical", "vaccin",
            "cancer", "adn", "physique", "mars", "lune", "co2",
        ],
        "SPORT": [
            "football", "tennis", "jeux olympiques", "ligue", "champion",
            "match", "equipe", "psg", "real madrid", "coupe", "sport",
        ],
        "CULTURE": [
            "cinema", "film", "musique", "livre", "art", "festival",
            "exposition", "theatre", "serie", "netflix", "jeux video",
        ],
    }

    @classmethod
    def detect_categories(cls, text: str) -> List[str]:
        """Detect categories from user message text (no LLM)."""
        text_lower = text.lower()
        matches = []
        for cat, keywords in cls.CATEGORY_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    matches.append(cat)
                    break
        return matches


# Global instance
_profile_manager: Optional[UserProfileManager] = None


def get_profile_manager() -> UserProfileManager:
    global _profile_manager
    if _profile_manager is None:
        _profile_manager = UserProfileManager()
    return _profile_manager
