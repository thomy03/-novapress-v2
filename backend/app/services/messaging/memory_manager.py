"""
NovaPress Strategic Memory Manager

Extracts and retains key facts about users via periodic LLM calls.

Improvements (Feb 2026):
  B1 — Immediate trigger patterns: detect important info instantly, skip 5-msg counter
  B2 — ZSET-based scoring: score = last_used_timestamp + usage_count_bonus
  B3 — Temporal decay: -50% after 30d idle, deleted after 90d idle
  B4 — Lazy migration from old LIST to ZSET
"""
import json
import re
import time
from typing import List, Optional, Tuple

import redis.asyncio as aioredis
from loguru import logger

from app.core.config import settings


# ─── B1 — Immediate trigger patterns ───────────────────────────────────────
# If any of these match the user's message, extract a memory RIGHT NOW
# without waiting for the 5-message counter.

IMMEDIATE_TRIGGER_PATTERNS: List[re.Pattern] = [
    re.compile(
        r"\bje suis\b.{3,60}\b(journaliste|développeur|dev|médecin|ingénieur|ingé|"
        r"étudiant|professeur|prof|chef|directeur|avocat|comptable|chercheur|"
        r"architecte|designer|entrepreneur|freelance)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bj'?ai\b.{0,20}\ban[sz]\b", re.IGNORECASE),   # "j'ai 35 ans"
    re.compile(r"\bje travaille (chez|pour|à|au|aux)\b", re.IGNORECASE),
    re.compile(r"\bj'?habite (à|en|au|aux)\b", re.IGNORECASE),
    re.compile(
        r"\bje (préfère|aime|déteste|veux)\b.{5,80}\b(résumé|court|long|détaillé|simple|analyse)\b",
        re.IGNORECASE,
    ),
]


class StrategicMemoryManager:
    """
    Extracts important facts from conversations and stores them durably in Redis.

    Storage:
      - ZSET key  novapress:user:{id}:memories_scored
        score = last_accessed_timestamp + usage_bonus
      - Legacy LIST novapress:user:{id}:memories is migrated lazily on first get_context()
    """

    EXTRACTION_INTERVAL = 5   # Full extraction every N interactions
    MAX_MEMORIES = 50
    USAGE_BONUS = 86_400      # +1 day per access — boosts frequently-read memories
    PREFIX = "novapress:user"

    def __init__(self) -> None:
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()
            self._redis = None

    # ─── B1 — Immediate trigger ───────────────────────────────────────────

    async def check_immediate_trigger(
        self,
        chat_id: int,
        message: str,
        llm_call,
    ) -> bool:
        """
        Check if the message matches an immediate-trigger pattern.
        If yes, extract and store a memory right now (no counter).
        Returns True if immediate extraction was performed.
        """
        for pattern in IMMEDIATE_TRIGGER_PATTERNS:
            if pattern.search(message):
                logger.debug(
                    f"Immediate memory trigger for chat {chat_id} — "
                    f"pattern: {pattern.pattern[:50]}..."
                )
                await self._immediate_extract(chat_id, message, llm_call)
                return True
        return False

    # ─── Periodic extraction (every 5 messages) ──────────────────────────

    async def maybe_extract(
        self,
        chat_id: int,
        history: List[dict],
        llm_call,
    ) -> None:
        """
        Extract memories if the message counter hits the interval.

        Args:
            chat_id: Telegram chat ID
            history: Recent conversation history list
            llm_call: Async callable(messages_list) -> str
        """
        r = await self._get_redis()
        count = await r.incr(f"{self.PREFIX}:{chat_id}:msg_count")

        if count % self.EXTRACTION_INTERVAL != 0:
            return

        recent = history[-10:] if len(history) > 10 else history
        if len(recent) < 2:
            return

        try:
            formatted = self._format_history(recent)
            prompt_messages = [
                {
                    "role": "system",
                    "content": (
                        "Tu es un assistant d'analyse conversationnelle. "
                        "Analyse la conversation et extrais les faits importants "
                        "à retenir sur l'utilisateur (intérêts, métier, préférences, "
                        "contexte personnel, opinions). "
                        "Retourne UNIQUEMENT un JSON array de 1-3 strings courts. "
                        "Si rien d'important, retourne []. "
                        'Exemple: ["L\'utilisateur est développeur web", '
                        '"Il s\'intéresse à l\'IA et ses impacts sur l\'emploi"]'
                    ),
                },
                {"role": "user", "content": f"Conversation récente :\n{formatted}"},
            ]

            response = await llm_call(prompt_messages)
            memories = self._parse_memories(response)

            for mem in memories:
                await self._store_memory(chat_id, mem)

            if memories:
                logger.info(
                    f"Extracted {len(memories)} strategic memories for chat {chat_id}"
                )

        except Exception as e:
            logger.warning(f"Memory extraction failed for chat {chat_id}: {e}")

    # ─── B2+B3 — Context retrieval with score boost ───────────────────────

    async def get_context(self, chat_id: int) -> str:
        """
        Return the top-10 memories formatted for the system prompt.
        Also boosts access score (recency signal).
        Lazily migrates legacy LIST → ZSET on first call.
        """
        r = await self._get_redis()
        scored_key = f"{self.PREFIX}:{chat_id}:memories_scored"

        # Try ZSET (new storage)
        raw: List[Tuple[str, float]] = await r.zrevrange(
            scored_key, 0, 9, withscores=True
        )

        if not raw:
            # Fall back to legacy LIST and migrate
            legacy_key = f"{self.PREFIX}:{chat_id}:memories"
            legacy: List[str] = await r.lrange(legacy_key, 0, -1)
            if not legacy:
                return ""
            # Migrate with slightly staggered timestamps to preserve order
            now = time.time()
            mapping = {mem: now - idx for idx, mem in enumerate(legacy)}
            await r.zadd(scored_key, mapping)
            await r.expire(scored_key, 90 * 24 * 3600)
            raw = [(mem, now - idx) for idx, mem in enumerate(legacy)]
            logger.info(f"Migrated {len(legacy)} memories from LIST → ZSET for chat {chat_id}")

        if not raw:
            return ""

        # Boost access score for the top-5 memories (marks them as recently used)
        now = time.time()
        for mem, _ in raw[:5]:
            await r.zadd(scored_key, {mem: now + self.USAGE_BONUS}, xx=True)

        memories = [m for m, _ in raw]
        return "Ce que tu sais sur cet utilisateur :\n" + "\n".join(
            f"- {m}" for m in memories
        )

    async def get_all_memories(self, chat_id: int) -> List[str]:
        """Return all stored memories, most relevant first."""
        r = await self._get_redis()
        scored_key = f"{self.PREFIX}:{chat_id}:memories_scored"
        scored: List[str] = await r.zrevrange(scored_key, 0, -1)
        if scored:
            return scored
        # Legacy fallback
        return await r.lrange(f"{self.PREFIX}:{chat_id}:memories", 0, -1)

    # ─── B3 — Temporal decay ─────────────────────────────────────────────

    async def apply_memory_decay(self, chat_id: int) -> dict:
        """
        Apply temporal decay to ZSET memories.
        - Unused > 30 days  → score halved
        - Unused > 90 days  → deleted

        Call weekly (e.g., after /reset or via a scheduled task).
        Returns {"removed": N, "decayed": N}.
        """
        r = await self._get_redis()
        scored_key = f"{self.PREFIX}:{chat_id}:memories_scored"
        now = time.time()
        cutoff_30d = now - 30 * 86_400
        cutoff_90d = now - 90 * 86_400
        removed = decayed = 0

        try:
            # Delete memories with raw score (= last_accessed) older than 90 days
            expired: List[str] = await r.zrangebyscore(scored_key, "-inf", cutoff_90d)
            if expired:
                await r.zrem(scored_key, *expired)
                removed = len(expired)

            # Halve the score of memories unused 30–90 days
            stale: List[Tuple[str, float]] = await r.zrangebyscore(
                scored_key, cutoff_90d, cutoff_30d, withscores=True
            )
            for mem, score in stale:
                await r.zadd(scored_key, {mem: score * 0.5}, xx=True)
                decayed += 1

        except Exception as e:
            logger.warning(f"Memory decay failed for chat {chat_id}: {e}")

        if removed or decayed:
            logger.info(
                f"Memory decay for chat {chat_id}: removed={removed}, decayed={decayed}"
            )

        return {"removed": removed, "decayed": decayed}

    # ─── Mutation helpers ────────────────────────────────────────────────

    async def clear_memories(self, chat_id: int) -> None:
        """Clear all strategic memories (both ZSET and legacy LIST)."""
        r = await self._get_redis()
        await r.delete(
            f"{self.PREFIX}:{chat_id}:memories",
            f"{self.PREFIX}:{chat_id}:memories_scored",
            f"{self.PREFIX}:{chat_id}:msg_count",
        )

    # ─── Private ─────────────────────────────────────────────────────────

    async def _immediate_extract(
        self,
        chat_id: int,
        message: str,
        llm_call,
    ) -> None:
        """Extract a memory immediately from a single user message."""
        try:
            prompt_messages = [
                {
                    "role": "system",
                    "content": (
                        "Extrais un fait concis et important sur l'utilisateur "
                        "à partir de ce message. "
                        "Retourne UNIQUEMENT un JSON array de 1-2 strings courts. "
                        'Si rien à retenir, retourne []. '
                        'Exemple: ["L\'utilisateur est développeur web"]'
                    ),
                },
                {"role": "user", "content": message},
            ]
            response = await llm_call(prompt_messages)
            memories = self._parse_memories(response)

            for mem in memories:
                await self._store_memory(chat_id, mem)

            if memories:
                logger.info(
                    f"Immediate memory extracted for chat {chat_id}: {memories}"
                )

        except Exception as e:
            logger.warning(f"Immediate memory extraction failed for chat {chat_id}: {e}")

    async def _store_memory(self, chat_id: int, memory: str) -> None:
        """Store a memory in the ZSET if it's not a duplicate."""
        if not memory or len(memory) < 10:
            return
        if await self._is_duplicate(chat_id, memory):
            return

        r = await self._get_redis()
        scored_key = f"{self.PREFIX}:{chat_id}:memories_scored"
        now = time.time()

        await r.zadd(scored_key, {memory: now})

        # Trim to MAX_MEMORIES (remove lowest-scored entries)
        count = await r.zcard(scored_key)
        if count > self.MAX_MEMORIES:
            excess = count - self.MAX_MEMORIES
            await r.zpopmin(scored_key, excess)

        await r.expire(scored_key, 90 * 24 * 3600)

    async def _is_duplicate(self, chat_id: int, new_memory: str) -> bool:
        """Simple substring check for near-duplicates."""
        existing = await self.get_all_memories(chat_id)
        nl = new_memory.lower().strip()
        for mem in existing:
            ml = mem.lower().strip()
            if nl == ml:
                return True
            if len(nl) > 15 and nl in ml:
                return True
            if len(ml) > 15 and ml in nl:
                return True
        return False

    @staticmethod
    def _format_history(history: List[dict]) -> str:
        lines = []
        for msg in history:
            role = msg.get("role", "unknown")
            content = str(msg.get("content", ""))[:300]
            prefix = "Utilisateur" if role == "user" else "NovaPress"
            lines.append(f"{prefix}: {content}")
        return "\n".join(lines)

    @staticmethod
    def _parse_memories(response: str) -> List[str]:
        """Parse LLM response into a list of memory strings."""
        try:
            text = response.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(m).strip() for m in parsed if m and len(str(m).strip()) > 5]
        except (json.JSONDecodeError, ValueError):
            pass

        # Fallback: line-by-line
        memories = []
        for line in response.strip().split("\n"):
            line = line.strip().strip("-•*").strip()
            if len(line) > 10 and not line.startswith("[") and not line.startswith("{"):
                memories.append(line)
        return memories[:3]


# ─── Global singleton ────────────────────────────────────────────────────────

_memory_manager: Optional[StrategicMemoryManager] = None


def get_memory_manager() -> StrategicMemoryManager:
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = StrategicMemoryManager()
    return _memory_manager
