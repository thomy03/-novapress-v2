"""
NovaPress Telegram Bot — "L'IA qui vous briefe."
Delivers AI-powered news intelligence directly in Telegram.

Commands:
  /start          — Welcome message + onboarding
  /briefing       — Latest AI briefing (top syntheses)
  /search <query> — Semantic search in Qdrant
  /perspectives   — Same news from different persona perspectives
  /follow <topic> — Subscribe to a topic for alerts
  /unfollow <topic> — Unsubscribe from a topic
  /help           — Command reference
"""
import asyncio
import json
from typing import Optional, Dict, Any, Union
from datetime import datetime, timezone
from loguru import logger

from app.core.config import settings


class TelegramBot:
    """NovaPress Telegram Bot using raw HTTP (no heavy dependency)."""

    API_BASE = "https://api.telegram.org/bot{token}"

    def __init__(self):
        self.token = settings.TELEGRAM_BOT_TOKEN
        self.base_url = self.API_BASE.format(token=self.token)
        self._http_client = None
        self._subscribers: Dict[str, set] = {}  # chat_id -> set of topics
        self._initialized = False

    async def _get_client(self):
        """Lazy-init httpx client."""
        if self._http_client is None:
            import httpx
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def initialize(self):
        """Initialize the bot and verify token."""
        if not self.token:
            logger.warning("⚠️ TELEGRAM_BOT_TOKEN not set — Telegram bot disabled")
            return False

        try:
            client = await self._get_client()
            resp = await client.get(f"{self.base_url}/getMe")
            data = resp.json()

            if data.get("ok"):
                bot_info = data["result"]
                logger.success(
                    f"✅ Telegram bot initialized: @{bot_info.get('username')} "
                    f"({bot_info.get('first_name')})"
                )
                self._initialized = True
                return True
            else:
                logger.error(f"Telegram bot init failed: {data}")
                return False

        except Exception as e:
            logger.error(f"Failed to initialize Telegram bot: {e}")
            return False

    # ─── Message Sending ───

    async def send_message(
        self,
        chat_id: Union[str, int],
        text: str,
        parse_mode: str = "MarkdownV2",
        reply_markup: Optional[Dict] = None,
    ) -> bool:
        """Send a message to a Telegram chat."""
        if not self._initialized:
            return False

        try:
            client = await self._get_client()
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": parse_mode,
            }
            if reply_markup:
                payload["reply_markup"] = json.dumps(reply_markup)

            resp = await client.post(f"{self.base_url}/sendMessage", json=payload)
            data = resp.json()

            if not data.get("ok"):
                logger.warning(f"Telegram send failed: {data.get('description')}")
                # Retry without parse_mode if markdown fails
                if "parse" in data.get("description", "").lower():
                    payload["parse_mode"] = None
                    payload["text"] = self._strip_markdown(text)
                    resp = await client.post(
                        f"{self.base_url}/sendMessage", json=payload
                    )
                    return resp.json().get("ok", False)
                return False

            return True

        except Exception as e:
            logger.error(f"Failed to send Telegram message: {e}")
            return False

    # ─── Command Handlers ───

    async def handle_update(self, update: Dict[str, Any]) -> None:
        """Process an incoming Telegram update (webhook or polling)."""
        # Handle callback queries (inline keyboard button taps)
        callback = update.get("callback_query")
        if callback:
            chat_id = callback.get("message", {}).get("chat", {}).get("id")
            data = callback.get("data", "")
            if chat_id:
                if data == "briefing":
                    await self._handle_briefing(chat_id, "")
                elif data == "search_help":
                    await self._handle_search(chat_id, "")
                # Answer callback to remove loading spinner
                try:
                    client = await self._get_client()
                    await client.post(
                        f"{self.base_url}/answerCallbackQuery",
                        json={"callback_query_id": callback["id"]},
                    )
                except Exception:
                    pass
            return

        # Handle regular messages
        message = update.get("message", {})
        text = message.get("text", "")
        chat_id = message.get("chat", {}).get("id")

        if not chat_id or not text:
            return

        # Parse command
        if text.startswith("/"):
            parts = text.split(maxsplit=1)
            command = parts[0].lower().split("@")[0]  # Remove @botname suffix
            args = parts[1] if len(parts) > 1 else ""

            handlers = {
                "/start": self._handle_start,
                "/briefing": self._handle_briefing,
                "/search": self._handle_search,
                "/perspectives": self._handle_perspectives,
                "/follow": self._handle_follow,
                "/unfollow": self._handle_unfollow,
                "/help": self._handle_help,
            }

            handler = handlers.get(command, self._handle_unknown)
            await handler(chat_id, args)

    async def _handle_start(self, chat_id: int, args: str) -> None:
        """Welcome message and onboarding."""
        text = (
            "🗞️ *Bienvenue sur NovaPress\\!*\n\n"
            "Je suis votre *journaliste IA personnel*\\. "
            "Chaque jour, j'analyse des centaines d'articles "
            "pour vous livrer l'essentiel de l'actualité\\.\n\n"
            "🧠 *L'IA qui vous briefe\\.*\n\n"
            "📋 *Commandes disponibles :*\n"
            "• /briefing — Recevoir votre briefing IA\n"
            "• /search `sujet` — Chercher un sujet\n"
            "• /perspectives — Voir d'autres points de vue\n"
            "• /follow `sujet` — Suivre un thème\n"
            "• /help — Aide complète\n\n"
            "💡 _Tapez_ /briefing _pour commencer\\!_"
        )

        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "📰 Mon Briefing", "callback_data": "briefing"},
                    {"text": "🔍 Rechercher", "callback_data": "search_help"},
                ],
            ]
        }

        await self.send_message(chat_id, text, reply_markup=keyboard)

    async def _handle_briefing(self, chat_id: int, args: str) -> None:
        """Send the latest AI briefing."""
        # Send typing indicator
        await self._send_typing(chat_id)

        try:
            from app.services.briefing_service import get_briefing_service
            service = get_briefing_service()
            briefing = await service.get_latest_briefing()
            formatted = service.format_telegram_briefing(briefing)
            await self.send_message(chat_id, formatted)
        except Exception as e:
            logger.error(f"Briefing generation failed: {e}")
            await self.send_message(
                chat_id,
                "⚠️ Impossible de générer le briefing pour le moment\\.\n"
                "Le pipeline n'a peut\\-être pas encore tourné\\.\n\n"
                "💡 Réessayez dans quelques minutes\\.",
            )

    async def _handle_search(self, chat_id: int, args: str) -> None:
        """Semantic search in Qdrant."""
        if not args.strip():
            await self.send_message(
                chat_id,
                "🔍 *Recherche sémantique*\n\n"
                "Utilisez : `/search votre requête`\n\n"
                "Exemples :\n"
                "• `/search intelligence artificielle`\n"
                "• `/search climat COP`\n"
                "• `/search élections France`",
            )
            return

        await self._send_typing(chat_id)
        query = args.strip()

        try:
            from app.db.qdrant_client import get_qdrant_service
            from app.ml.embeddings import get_embedding_service

            embeddings = get_embedding_service()
            qdrant = get_qdrant_service()

            if not embeddings or not embeddings.model or not qdrant or not qdrant.client:
                raise RuntimeError("Search services not available")

            # Encode query
            query_embedding = await embeddings.encode_async([query])

            # Search in syntheses collection
            from qdrant_client.models import SearchParams
            results = await qdrant.client.search(
                collection_name=f"{settings.QDRANT_COLLECTION}_syntheses",
                query_vector=query_embedding[0],
                limit=settings.TELEGRAM_MAX_SEARCH_RESULTS,
                with_payload=True,
            )

            if not results:
                escaped_query = self._escape_md_static(query)
                await self.send_message(
                    chat_id,
                    f"🔍 Aucun résultat pour *{escaped_query}*\\.\n\n"
                    "Le pipeline n'a peut\\-être pas encore indexé de synthèses\\.",
                )
                return

            # Format results
            lines = [f"🔍 *Résultats pour :* _{self._escape_md_static(query)}_\n"]

            for i, result in enumerate(results, 1):
                payload = result.payload or {}
                title = self._escape_md_static(payload.get("title", "Sans titre"))
                summary = self._escape_md_static(
                    payload.get("introduction", payload.get("summary", ""))[:150]
                )
                score = result.score
                sources = payload.get("source_count", "?")

                lines.append(f"*{i}\\. {title}*")
                lines.append(f"_{summary}_")
                lines.append(f"📊 Pertinence: {score:.0%} · 📰 {sources} sources\n")

            await self.send_message(chat_id, "\n".join(lines))

        except Exception as e:
            logger.error(f"Search failed: {e}")
            await self.send_message(
                chat_id,
                "⚠️ Recherche indisponible pour le moment\\.\n"
                "Les services ML ne sont peut\\-être pas initialisés\\.",
            )

    async def _handle_perspectives(self, chat_id: int, args: str) -> None:
        """Show the latest synthesis from different persona perspectives."""
        await self._send_typing(chat_id)

        try:
            from app.services.briefing_service import get_briefing_service
            service = get_briefing_service()
            briefing = await service.get_latest_briefing(limit=1)

            if not briefing["items"]:
                await self.send_message(
                    chat_id,
                    "⚠️ Aucune synthèse disponible\\.\n"
                    "Lancez d'abord /briefing pour vérifier\\.",
                )
                return

            item = briefing["items"][0]
            title = self._escape_md_static(item["title"])
            summary = self._escape_md_static(item["summary"][:200])

            cynique_text = self._escape_md_static("Encore une annonce qui ne changera rien...")
            optimiste_text = self._escape_md_static("Voila une avancee prometteuse pour l'avenir !")
            conteur_text = self._escape_md_static("Il etait une fois, dans un monde en mutation...")
            satiriste_text = self._escape_md_static("Et pendant ce temps, les experts sont tous d'accord... sur leur desaccord.")

            text = (
                f"\U0001f3ad *PERSPECTIVES \u2014 {title}*\n\n"
                f"_{summary}_\n\n"
                "Les personas NovaPress :\n\n"
                f"\U0001f60f *Le Cynique* : \"_{cynique_text}_\"\n\n"
                f"\U0001f31f *L'Optimiste* : \"_{optimiste_text}_\"\n\n"
                f"\U0001f4d6 *Le Conteur* : \"_{conteur_text}_\"\n\n"
                f"\U0001faa9 *Le Satiriste* : \"_{satiriste_text}_\"\n\n"
                "\U0001f4a1 _Les vraies perspectives personnalisees arrivent avec NovaPress Pro\\!_"
            )

            await self.send_message(chat_id, text)

        except Exception as e:
            logger.error(f"Perspectives failed: {e}")
            await self.send_message(
                chat_id, "⚠️ Perspectives indisponibles pour le moment\\."
            )

    async def _handle_follow(self, chat_id: int, args: str) -> None:
        """Subscribe to a topic."""
        topic = args.strip().lower()

        if not topic:
            await self.send_message(
                chat_id,
                "📡 *Suivre un sujet*\n\n"
                "Utilisez : `/follow sujet`\n\n"
                "Exemples :\n"
                "• `/follow intelligence artificielle`\n"
                "• `/follow géopolitique`\n"
                "• `/follow crypto`",
            )
            return

        chat_key = str(chat_id)
        if chat_key not in self._subscribers:
            self._subscribers[chat_key] = set()

        self._subscribers[chat_key].add(topic)

        escaped = self._escape_md_static(topic)
        current = ", ".join(
            self._escape_md_static(t) for t in sorted(self._subscribers[chat_key])
        )

        await self.send_message(
            chat_id,
            f"✅ Vous suivez maintenant : *{escaped}*\n\n"
            f"📋 Vos sujets suivis : _{current}_\n\n"
            "🔔 Vous recevrez une alerte quand une nouvelle synthèse "
            "sur ce sujet sera publiée\\.",
        )

    async def _handle_unfollow(self, chat_id: int, args: str) -> None:
        """Unsubscribe from a topic."""
        topic = args.strip().lower()
        chat_key = str(chat_id)

        if not topic or chat_key not in self._subscribers:
            await self.send_message(
                chat_id,
                "📡 Utilisez : `/unfollow sujet`",
            )
            return

        self._subscribers[chat_key].discard(topic)

        escaped = self._escape_md_static(topic)
        await self.send_message(
            chat_id,
            f"❌ Vous ne suivez plus : *{escaped}*",
        )

    async def _handle_help(self, chat_id: int, args: str) -> None:
        """Show help message."""
        text = (
            "🗞️ *NovaPress — Aide*\n\n"
            "📋 *Commandes :*\n\n"
            "🗞️ /briefing\n"
            "  _Votre briefing IA quotidien_\n\n"
            "🔍 /search `sujet`\n"
            "  _Recherche sémantique dans les synthèses_\n\n"
            "🎭 /perspectives\n"
            "  _La même actu vue par différentes personas_\n\n"
            "📡 /follow `sujet`\n"
            "  _Suivre un thème et recevoir des alertes_\n\n"
            "🚫 /unfollow `sujet`\n"
            "  _Arrêter de suivre un thème_\n\n"
            "─" * 20 + "\n"
            "🌐 [NovaPress Web](https://novapressai.duckdns.org)\n"
            "💡 NovaPress — _L'IA qui vous briefe\\._"
        )

        await self.send_message(chat_id, text)

    async def _handle_unknown(self, chat_id: int, args: str) -> None:
        """Handle unknown commands."""
        await self.send_message(
            chat_id,
            "❓ Commande inconnue\\.\n"
            "Tapez /help pour la liste des commandes\\.",
        )

    # ─── Notification Sending ───

    async def notify_subscribers(self, synthesis: Dict[str, Any]) -> int:
        """
        Notify subscribers about a new synthesis matching their topics.

        Returns:
            Number of notifications sent
        """
        if not self._initialized:
            return 0

        title = synthesis.get("title", "").lower()
        category = synthesis.get("category", "").lower()
        key_points = " ".join(synthesis.get("key_points", [])).lower()
        searchable = f"{title} {category} {key_points}"

        sent = 0
        for chat_id, topics in self._subscribers.items():
            for topic in topics:
                if topic in searchable:
                    try:
                        escaped_title = self._escape_md_static(synthesis.get("title", ""))
                        escaped_topic = self._escape_md_static(topic)
                        await self.send_message(
                            int(chat_id),
                            f"🔔 *Nouvelle synthèse sur {escaped_topic} \\!*\n\n"
                            f"*{escaped_title}*\n\n"
                            "Tapez /briefing pour lire le briefing complet\\.",
                        )
                        sent += 1
                    except Exception as e:
                        logger.warning(f"Failed to notify {chat_id}: {e}")
                    break  # Only notify once per subscriber

        return sent

    # ─── Utilities ───

    async def _send_typing(self, chat_id: int) -> None:
        """Send typing indicator."""
        try:
            client = await self._get_client()
            await client.post(
                f"{self.base_url}/sendChatAction",
                json={"chat_id": chat_id, "action": "typing"},
            )
        except Exception:
            pass

    @staticmethod
    def _escape_md_static(text: str) -> str:
        """Escape special characters for Telegram MarkdownV2."""
        special = r"_*[]()~`>#+-=|{}.!"
        result = []
        for ch in str(text):
            if ch in special:
                result.append(f"\\{ch}")
            else:
                result.append(ch)
        return "".join(result)

    @staticmethod
    def _strip_markdown(text: str) -> str:
        """Remove markdown formatting for plain text fallback."""
        import re
        text = re.sub(r"[\\*_~`\[\]()]", "", text)
        return text

    async def shutdown(self):
        """Cleanup resources."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None


# Global instance
telegram_bot = TelegramBot()


async def init_telegram_bot() -> bool:
    """Initialize the global Telegram bot."""
    return await telegram_bot.initialize()


def get_telegram_bot() -> TelegramBot:
    """Dependency injection for FastAPI."""
    return telegram_bot
