"""
NovaPress Strategic Memory Manager
Extracts and retains key facts about users via periodic LLM calls.
Injects memory context into the system prompt for personalized responses.
"""
import json
from typing import List, Optional

import redis.asyncio as aioredis
from loguru import logger

from app.core.config import settings


class StrategicMemoryManager:
    """Extracts important facts from conversations and stores them durably."""

    EXTRACTION_INTERVAL = 5  # Extract every N interactions
    MAX_MEMORIES = 50
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

    async def maybe_extract(self, chat_id: int, history: List[dict], llm_call) -> None:
        """
        Extract memories if the message counter hits the interval.

        Args:
            chat_id: Telegram chat ID
            history: Recent conversation history
            llm_call: Async callable(messages) -> str for LLM inference
        """
        r = await self._get_redis()
        count_key = f"{self.PREFIX}:{chat_id}:msg_count"
        count = await r.incr(count_key)

        if count % self.EXTRACTION_INTERVAL != 0:
            return

        # Only extract from the last few exchanges
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
                        "a retenir sur l'utilisateur (interets, metier, preferences, "
                        "contexte personnel, opinions). "
                        "Retourne UNIQUEMENT un JSON array de 1-3 strings courts. "
                        "Si rien d'important, retourne []. "
                        "Exemple: [\"L'utilisateur est développeur web\", "
                        "\"Il s'intéresse à l'IA et ses impacts sur l'emploi\"]"
                    ),
                },
                {"role": "user", "content": f"Conversation récente:\n{formatted}"},
            ]

            response = await llm_call(prompt_messages)
            memories = self._parse_memories(response)

            for mem in memories:
                if not await self._is_duplicate(chat_id, mem):
                    await r.lpush(f"{self.PREFIX}:{chat_id}:memories", mem)

            # Trim to max
            await r.ltrim(f"{self.PREFIX}:{chat_id}:memories", 0, self.MAX_MEMORIES - 1)

            if memories:
                logger.info(
                    f"Extracted {len(memories)} strategic memories for chat {chat_id}"
                )

        except Exception as e:
            logger.warning(f"Memory extraction failed for chat {chat_id}: {e}")

    async def get_context(self, chat_id: int) -> str:
        """Return formatted memories for injection into the system prompt."""
        r = await self._get_redis()
        memories = await r.lrange(f"{self.PREFIX}:{chat_id}:memories", 0, 9)
        if not memories:
            return ""
        return "Ce que tu sais sur cet utilisateur :\n" + "\n".join(
            f"- {m}" for m in memories
        )

    async def get_all_memories(self, chat_id: int) -> List[str]:
        """Get all stored memories for a user."""
        r = await self._get_redis()
        return await r.lrange(f"{self.PREFIX}:{chat_id}:memories", 0, -1)

    async def clear_memories(self, chat_id: int) -> None:
        """Clear all strategic memories for a user."""
        r = await self._get_redis()
        await r.delete(f"{self.PREFIX}:{chat_id}:memories")
        await r.delete(f"{self.PREFIX}:{chat_id}:msg_count")

    async def _is_duplicate(self, chat_id: int, new_memory: str) -> bool:
        """Check if a similar memory already exists (simple substring check)."""
        r = await self._get_redis()
        existing = await r.lrange(f"{self.PREFIX}:{chat_id}:memories", 0, -1)
        new_lower = new_memory.lower().strip()
        for mem in existing:
            mem_lower = mem.lower().strip()
            # Exact or high substring overlap
            if new_lower == mem_lower:
                return True
            if len(new_lower) > 15 and new_lower in mem_lower:
                return True
            if len(mem_lower) > 15 and mem_lower in new_lower:
                return True
        return False

    @staticmethod
    def _format_history(history: List[dict]) -> str:
        lines = []
        for msg in history:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")[:300]
            prefix = "Utilisateur" if role == "user" else "NovaPress"
            lines.append(f"{prefix}: {content}")
        return "\n".join(lines)

    @staticmethod
    def _parse_memories(response: str) -> List[str]:
        """Parse LLM response into a list of memory strings."""
        # Try JSON parse first
        try:
            # Strip markdown code fences if present
            text = response.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(m).strip() for m in parsed if m and len(str(m).strip()) > 5]
        except (json.JSONDecodeError, ValueError):
            pass

        # Fallback: line-by-line extraction
        memories = []
        for line in response.strip().split("\n"):
            line = line.strip().strip("-•*").strip()
            if len(line) > 10 and not line.startswith("[") and not line.startswith("{"):
                memories.append(line)
        return memories[:3]


# Global instance
_memory_manager: Optional[StrategicMemoryManager] = None


def get_memory_manager() -> StrategicMemoryManager:
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = StrategicMemoryManager()
    return _memory_manager
