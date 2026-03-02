"""
ChatEngine — reusable conversational AI logic for NovaPress.
Shared between Telegram bot and web chat WebSocket.

Core features:
- Smart RAG search via BGE-M3 embeddings
- Intent detection (persona, chart, compare, weekly, entity, transparency, trend, causal)
- Memory-aware context building
- LLM conversation with OpenRouter
"""
import asyncio
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from loguru import logger

from openai import AsyncOpenAI

from app.core.config import settings


# Intent detection patterns (shared with Telegram bot)
INTENT_PATTERNS: Dict[str, re.Pattern] = {
    "persona": re.compile(
        r"(comme|en mode|style)\s+(le\s+)?(cynique|optimiste|conteur|satiriste|historien|philosophe|scientifique)",
        re.IGNORECASE,
    ),
    "compare": re.compile(r"(compare|diff[ée]rences?|versus|vs\.?)\b", re.IGNORECASE),
    "weekly": re.compile(r"(semaine|hebdo|r[ée]sum[ée]\s+semaine)", re.IGNORECASE),
    "entity": re.compile(r"(qui est|c'est qui|profil de|biographie)\s+", re.IGNORECASE),
    "transparency": re.compile(r"(transparence|fiabilit[ée]|score|confiance|biais)", re.IGNORECASE),
    "trend": re.compile(r"(tendance|trending|populaire|buzz|viral)", re.IGNORECASE),
    "causal": re.compile(r"(cause|cons[ée]quence|pourquoi|impact|effet|r[ée]sultat)", re.IGNORECASE),
}


class ChatEngine:
    """
    Stateless conversational engine for NovaPress AI.

    Usage:
        engine = ChatEngine()
        await engine.initialize()
        response = await engine.generate_response(
            user_message="Quoi de neuf sur l'IA ?",
            session_id="web-user-123",
            history=[...],
        )
    """

    MAX_CHAT_HISTORY = 10

    def __init__(self):
        self.llm_client: Optional[AsyncOpenAI] = None
        self.embedding_service = None
        self.qdrant_service = None
        self._initialized = False

    async def initialize(self):
        """Initialize LLM client and services."""
        if self._initialized:
            return

        try:
            self.llm_client = AsyncOpenAI(
                api_key=settings.OPENROUTER_API_KEY,
                base_url=settings.OPENROUTER_BASE_URL,
                timeout=60.0,
            )

            # Import services lazily to avoid circular imports
            from app.ml.embeddings import get_embedding_service
            from app.db.qdrant_client import get_qdrant_service

            self.embedding_service = get_embedding_service()
            self.qdrant_service = get_qdrant_service()
            self._initialized = True
            logger.info("ChatEngine initialized")
        except Exception as e:
            logger.error(f"ChatEngine initialization failed: {e}")

    def detect_intent(self, text: str) -> Optional[str]:
        """Detect user intent from message text."""
        for intent_name, pattern in INTENT_PATTERNS.items():
            if pattern.search(text):
                return intent_name
        return None

    async def smart_search(self, query: str, limit: int = 3) -> Tuple[str, bool]:
        """
        Search for relevant syntheses using BGE-M3 semantic search.

        Returns:
            Tuple of (context_string, has_real_news)
        """
        if not self.embedding_service or not self.qdrant_service:
            return "", False

        try:
            embedding = await asyncio.to_thread(
                self.embedding_service.encode, [query]
            )
            vector = embedding[0].tolist()

            results = self.qdrant_service.search_syntheses_by_embedding(
                vector, limit=limit, score_threshold=0.55
            )

            if not results:
                # Fallback: get 3 most recent
                recent = self.qdrant_service.get_live_syntheses(hours=24, limit=3)
                if recent:
                    context_parts = []
                    for s in recent:
                        title = s.get("title", "Sans titre")
                        summary = (s.get("summary", "") or "")[:300]
                        sid = s.get("id", "")
                        link = f"https://novapressai.duckdns.org/synthesis/{sid}" if sid else ""
                        context_parts.append(
                            f"Titre: {title}\nResume: {summary}\nLien: {link}"
                        )
                    return "\n---\n".join(context_parts), True
                return "", False

            context_parts = []
            for r in results:
                payload = r.payload if hasattr(r, "payload") else r
                title = payload.get("title", "Sans titre")
                summary = (payload.get("summary", "") or "")[:300]
                category = payload.get("category", "")
                sid = payload.get("id", str(r.id) if hasattr(r, "id") else "")
                score = payload.get("transparency_score", 0)
                num_src = payload.get("num_sources", 0)
                link = f"https://novapressai.duckdns.org/synthesis/{sid}" if sid else ""

                context_parts.append(
                    f"Titre: {title}\n"
                    f"Categorie: {category}\n"
                    f"Resume: {summary}\n"
                    f"Sources: {num_src} | Transparence: {score}/100\n"
                    f"Lien: {link}"
                )

            return "\n---\n".join(context_parts), True

        except Exception as e:
            logger.error(f"Smart search failed: {e}")
            return "", False

    async def generate_response(
        self,
        user_message: str,
        session_id: str = "",
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Generate a chat response using RAG + LLM.

        Args:
            user_message: The user's message text
            session_id: Session identifier for context
            history: Previous conversation messages [{"role": "...", "content": "..."}]

        Returns:
            AI response string
        """
        if not self._initialized:
            await self.initialize()

        if not self.llm_client:
            return "Service temporairement indisponible. Veuillez reessayer."

        history = history or []

        # Time context
        now_utc = datetime.now(timezone.utc)
        today = now_utc.strftime("%A %d %B %Y")

        # Detect intent
        intent = self.detect_intent(user_message)

        # Smart RAG search
        news_context, has_real_news = await self.smart_search(user_message)

        if has_real_news:
            context_block = (
                "SYNTHESES NOVAPRESS DISPONIBLES (sources reelles) :\n"
                f"{news_context}\n\n"
                "Appuie-toi sur ces syntheses pour repondre. "
                "Quand tu mentionnes une synthese, donne son lien."
            )
        else:
            context_block = (
                "AUCUNE SYNTHESE PERTINENTE TROUVEE sur ce sujet.\n"
                "Le pipeline n'a pas encore analyse ca. Dis-le honnetement."
            )

        # Intent-specific instructions
        intent_instruction = ""
        if intent == "compare":
            intent_instruction = "L'utilisateur veut COMPARER. Structure ta reponse avec les differences clairement separees.\n"
        elif intent == "causal":
            intent_instruction = "L'utilisateur cherche des CAUSES/CONSEQUENCES. Explique les relations causales.\n"
        elif intent == "trend":
            intent_instruction = "L'utilisateur veut connaitre les TENDANCES. Focus sur ce qui est populaire.\n"
        elif intent == "transparency":
            intent_instruction = "L'utilisateur questionne la FIABILITE. Donne les scores de transparence et explique.\n"

        system_prompt = (
            f"Tu es Alex, l'assistant journaliste de NovaPress AI.\n"
            f"On est le {today}.\n\n"
            f"TON STYLE :\n"
            f"- Tu tutoies, tu es passionne et direct\n"
            f"- Pour une question simple: reponse courte (2-4 lignes)\n"
            f"- Pour une analyse: structure avec **sections** et listes\n"
            f"- Ton naturel, sans jargon\n\n"
            f"FORMATAGE MARKDOWN :\n"
            f"- **Titre de section** pour les parties importantes\n"
            f"- - ou * pour les listes a puces\n"
            f"- `chiffre cle` pour les donnees\n"
            f"- [texte](url) pour les liens vers les syntheses\n\n"
            f"{context_block}\n\n"
            f"{intent_instruction}"
            f"REGLES :\n"
            f"- TOUJOURS en francais\n"
            f"- Ne jamais inventer des faits\n"
            f"- Quand tu as un lien vers une synthese, donne-le\n"
        )

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history[-self.MAX_CHAT_HISTORY:])
        messages.append({"role": "user", "content": user_message})

        try:
            response = await self.llm_client.chat.completions.create(
                model=settings.OPENROUTER_MODEL,
                messages=messages,
                max_tokens=600,
                temperature=0.7,
            )
            return response.choices[0].message.content or "Pas de reponse generee."
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return "Desole, une erreur est survenue. Reessaie dans quelques instants."


# Singleton
_engine: Optional[ChatEngine] = None


def get_chat_engine() -> ChatEngine:
    """Get or create the chat engine singleton."""
    global _engine
    if _engine is None:
        _engine = ChatEngine()
    return _engine
