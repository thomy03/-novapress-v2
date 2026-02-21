"""
NovaPress Telegram Bot — "L'IA qui vous briefe."
Advanced conversational AI with Smart RAG, User Profiles, Strategic Memory,
Proactive Alerts, Podcast Generation, and Intent Detection.

Commands:
  /start          — Welcome + onboarding
  /briefing       — Personalized AI briefing
  /search <query> — Semantic search in syntheses
  /perspectives   — Same news from different persona perspectives
  /follow <topic> — Subscribe to a topic (Redis-persisted)
  /unfollow <t>   — Unsubscribe from a topic
  /topics         — Show followed topics + interest scores
  /preferences    — View and edit your profile
  /alerts <on|off> — Toggle proactive alerts
  /frequency <daily|realtime> — Set alert frequency
  /podcast        — Generate a 3-minute audio briefing
  /pipeline       — Trigger the news pipeline
  /reset          — Reset conversation (keeps strategic memories)
  /help           — Command reference
"""
import asyncio
import json
import re
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timezone
from loguru import logger

from app.core.config import settings


# ─── Intent Detection Patterns ───

INTENT_PATTERNS = {
    "chart": re.compile(
        r"\b(graphique|graphe|courbe|visualise|stats?|statistiques?|"
        r"montre.moi les|distribution|répartition.*catégor|"
        r"évolution graphe|tendance graphique)\b",
        re.IGNORECASE,
    ),
    "persona": re.compile(
        r"(comme|en mode|style|parle.moi comme)\s+(le\s+)?"
        r"(cynique|optimiste|conteur|satiriste|historien|philosophe|scientifique)",
        re.IGNORECASE,
    ),
    "compare": re.compile(
        r"\b(compare[zr]?|versus|vs\.?|différence entre|comparer)\b", re.IGNORECASE
    ),
    "weekly": re.compile(
        r"\b(résumé?|bilan)\s+(de la |cette )?(semaine|week)\b", re.IGNORECASE
    ),
    "entity": re.compile(
        r"\b(que se passe(-t-il)?|quoi de neuf|news?)\s+(avec|sur|pour|à propos de)\s+(.+)",
        re.IGNORECASE,
    ),
    "transparency": re.compile(
        r"\b(fiable|fiabilité|confiance|transparence|vérifi|source)\b", re.IGNORECASE
    ),
    "trend": re.compile(
        r"\b(tendance|trend|évolution|arc narratif|émergent|déclinant)\b", re.IGNORECASE
    ),
    "causal": re.compile(
        r"\b(cause[sz]?|pourquoi|conséquence|impact|graphe causal)\b", re.IGNORECASE
    ),
}

PERSONA_MAP = {
    "cynique": "le_cynique",
    "optimiste": "l_optimiste",
    "conteur": "le_conteur",
    "satiriste": "le_satiriste",
    "historien": "l_historien",
    "philosophe": "le_philosophe",
    "scientifique": "le_scientifique",
}


class TelegramBot:
    """NovaPress Telegram Bot — Advanced conversational AI."""

    API_BASE = "https://api.telegram.org/bot{token}"
    MAX_CHAT_HISTORY = 10

    def __init__(self):
        self.token = settings.TELEGRAM_BOT_TOKEN
        self.base_url = self.API_BASE.format(token=self.token)
        self._http_client = None
        self._conversation_history: Dict[str, list] = {}
        self._initialized = False
        # Active persona per chat (resets when explicitly changed)
        self._active_persona: Dict[str, str] = {}

    async def _get_client(self):
        if self._http_client is None:
            import httpx
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def initialize(self) -> bool:
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
                # Wire alert service
                from app.services.messaging.alert_service import get_alert_service
                get_alert_service().set_bot(self)
                return True
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
        parse_mode: Optional[str] = "MarkdownV2",
        reply_markup: Optional[Dict] = None,
    ) -> bool:
        if not self._initialized:
            return False
        try:
            client = await self._get_client()
            payload: Dict[str, Any] = {"chat_id": chat_id, "text": text}
            if parse_mode:
                payload["parse_mode"] = parse_mode
            if reply_markup:
                payload["reply_markup"] = json.dumps(reply_markup)
            resp = await client.post(f"{self.base_url}/sendMessage", json=payload)
            data = resp.json()
            if not data.get("ok"):
                logger.warning(f"Telegram send failed: {data.get('description')}")
                if "parse" in data.get("description", "").lower():
                    payload["parse_mode"] = None
                    payload["text"] = self._strip_markdown(text)
                    resp2 = await client.post(f"{self.base_url}/sendMessage", json=payload)
                    return resp2.json().get("ok", False)
                return False
            return True
        except Exception as e:
            logger.error(f"Failed to send Telegram message: {e}")
            return False

    async def send_voice(
        self,
        chat_id: Union[str, int],
        audio_bytes: bytes,
        caption: Optional[str] = None,
    ) -> bool:
        """Send a voice message (OGG/MP3) to a Telegram chat."""
        if not self._initialized:
            return False
        try:
            import io
            client = await self._get_client()
            files = {"voice": ("briefing.ogg", io.BytesIO(audio_bytes), "audio/ogg")}
            data: Dict[str, Any] = {"chat_id": str(chat_id)}
            if caption:
                data["caption"] = caption[:1024]
            resp = await client.post(
                f"{self.base_url}/sendVoice", data=data, files=files
            )
            result = resp.json()
            if not result.get("ok"):
                logger.warning(f"Telegram sendVoice failed: {result.get('description')}")
            return result.get("ok", False)
        except Exception as e:
            logger.error(f"Failed to send voice message: {e}")
            return False

    async def send_photo(
        self,
        chat_id: Union[str, int],
        photo_bytes: bytes,
        caption: str = "",
    ) -> bool:
        """Send a PNG chart image to a Telegram chat."""
        if not self._initialized:
            return False
        try:
            import io as _io

            client = await self._get_client()
            files = {"photo": ("chart.png", _io.BytesIO(photo_bytes), "image/png")}
            data: Dict[str, Any] = {"chat_id": str(chat_id)}
            if caption:
                data["caption"] = caption[:1024]
            resp = await client.post(f"{self.base_url}/sendPhoto", data=data, files=files)
            result = resp.json()
            if not result.get("ok"):
                logger.warning(f"Telegram sendPhoto failed: {result.get('description')}")
            return result.get("ok", False)
        except Exception as e:
            logger.error(f"Failed to send photo: {e}")
            return False

    # ─── Routing ───

    async def handle_update(self, update: Dict[str, Any]) -> None:
        """Process an incoming Telegram update."""
        # Callback queries (inline keyboard)
        callback = update.get("callback_query")
        if callback:
            chat_id = callback.get("message", {}).get("chat", {}).get("id")
            data = callback.get("data", "")
            if chat_id:
                if data == "briefing":
                    await self._handle_briefing(chat_id, "")
                elif data == "search_help":
                    await self._handle_search(chat_id, "")
                try:
                    client = await self._get_client()
                    await client.post(
                        f"{self.base_url}/answerCallbackQuery",
                        json={"callback_query_id": callback["id"]},
                    )
                except Exception:
                    pass
            return

        message = update.get("message", {})
        text = message.get("text", "")
        chat_id = message.get("chat", {}).get("id")
        if not chat_id or not text:
            return

        if text.startswith("/"):
            parts = text.split(maxsplit=1)
            command = parts[0].lower().split("@")[0]
            args = parts[1] if len(parts) > 1 else ""

            handlers = {
                "/start": self._handle_start,
                "/briefing": self._handle_briefing,
                "/search": self._handle_search,
                "/perspectives": self._handle_perspectives,
                "/follow": self._handle_follow,
                "/unfollow": self._handle_unfollow,
                "/topics": self._handle_topics,
                "/preferences": self._handle_preferences,
                "/alerts": self._handle_alerts,
                "/frequency": self._handle_frequency,
                "/podcast": self._handle_podcast,
                "/help": self._handle_help,
                "/pipeline": self._handle_pipeline,
                "/reset": self._handle_reset,
            }
            handler = handlers.get(command, self._handle_unknown)
            await handler(chat_id, args)
        else:
            await self._handle_chat(chat_id, text)

    # ─── Command Handlers ───

    async def _handle_start(self, chat_id: int, args: str) -> None:
        """Welcome message and onboarding."""
        # Init user profile
        from app.services.messaging.user_profile import get_profile_manager
        await get_profile_manager().get_profile(chat_id)

        text = (
            "🗞️ *Bienvenue sur NovaPress\\!*\n\n"
            "Je suis votre *journaliste IA personnel*\\. "
            "Chaque jour, j'analyse des centaines d'articles "
            "pour vous livrer l'essentiel de l'actualité\\.\n\n"
            "🧠 *L'IA qui vous briefe\\.*\n\n"
            "💬 *Posez\\-moi directement vos questions en texte libre \\!*\n"
            "_\"Que se passe\\-t\\-il en Ukraine ?\", \"Analyse la situation économique\"_\n\n"
            "📋 *Commandes :*\n"
            "• /briefing — Votre briefing IA quotidien\n"
            "• /search `sujet` — Recherche sémantique\n"
            "• /follow `sujet` — Alertes sur un thème\n"
            "• /topics — Vos sujets suivis\n"
            "• /preferences — Votre profil\n"
            "• /podcast — Briefing audio 3 minutes\n"
            "• /pipeline — Lancer le pipeline\n\n"
            "💡 _Commencez par_ /briefing _ou posez une question\\!_"
        )
        keyboard = {
            "inline_keyboard": [[
                {"text": "📰 Mon Briefing", "callback_data": "briefing"},
                {"text": "🔍 Rechercher", "callback_data": "search_help"},
            ]]
        }
        await self.send_message(chat_id, text, reply_markup=keyboard)

    async def _handle_briefing(self, chat_id: int, args: str) -> None:
        """Send a personalized AI briefing."""
        await self._send_typing(chat_id)
        try:
            from app.services.briefing_service import get_briefing_service
            from app.services.messaging.user_profile import get_profile_manager

            service = get_briefing_service()
            # Use personalized hours lookback if user is active
            briefing = await service.get_latest_briefing()

            # Personalise: filter by top interests
            profile_mgr = get_profile_manager()
            filters = await profile_mgr.get_personalized_filters(chat_id)
            top_cats = filters.get("categories", [])

            if top_cats and briefing.get("items"):
                # Re-rank: boost items matching user's top categories
                for item in briefing["items"]:
                    if item.get("category") in top_cats:
                        item["_personal_boost"] = 2.0
                briefing["items"].sort(
                    key=lambda x: x.get("_personal_boost", 1.0), reverse=True
                )

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
        """Semantic search in Qdrant syntheses."""
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
            results, has_results = await self._smart_search(query, chat_id)

            if not has_results:
                escaped_query = self._escape_md_static(query)
                await self.send_message(
                    chat_id,
                    f"🔍 Aucun résultat pour *{escaped_query}*\\.\n\n"
                    "Le pipeline n'a peut\\-être pas encore indexé de synthèses\\.",
                )
                return

            lines = [f"🔍 *Résultats pour :* _{self._escape_md_static(query)}_\n"]
            # results is a list of synthesis dicts with 'score'
            for i, synth in enumerate(results[:settings.TELEGRAM_MAX_SEARCH_RESULTS], 1):
                title = self._escape_md_static(synth.get("title", "Sans titre"))
                passage = self._escape_md_static(
                    self._extract_relevant_passage(synth, query)[:200]
                )
                score = synth.get("score", 0.0)
                sources = synth.get("source_count", synth.get("num_sources", "?"))
                lines.append(f"*{i}\\. {title}*")
                lines.append(f"_{passage}_")
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
            summary = item["summary"][:250]

            # Generate real persona snippets from the summary text
            personas = {
                "Le Cynique 😏": self._cynique_transform(summary),
                "L'Optimiste 🌟": self._optimiste_transform(summary),
                "Le Conteur 📖": self._conteur_transform(summary),
                "Le Satiriste 🃏": self._satiriste_transform(summary),
            }

            lines = [f"🎭 *PERSPECTIVES — {title}*\n"]
            for persona_name, snippet in personas.items():
                esc_name = self._escape_md_static(persona_name)
                esc_snippet = self._escape_md_static(snippet)
                lines.append(f"*{esc_name}*")
                lines.append(f"\"_{esc_snippet}_\"\n")

            lines.append(
                "💡 Tapez _\"Parle\\-moi comme le cynique\"_ pour changer de perspective\\!"
            )
            await self.send_message(chat_id, "\n".join(lines))

        except Exception as e:
            logger.error(f"Perspectives failed: {e}")
            await self.send_message(chat_id, "⚠️ Perspectives indisponibles pour le moment\\.")

    async def _handle_follow(self, chat_id: int, args: str) -> None:
        """Subscribe to a topic — persisted in Redis."""
        topic = args.strip()
        if not topic:
            await self.send_message(
                chat_id,
                "📡 *Suivre un sujet*\n\n"
                "Utilisez : `/follow sujet`\n\n"
                "Exemples :\n"
                "• `/follow intelligence artificielle`\n"
                "• `/follow Ukraine`\n"
                "• `/follow crypto`",
            )
            return

        from app.services.messaging.user_profile import get_profile_manager
        from app.services.messaging.alert_service import get_alert_service

        await get_profile_manager().follow_topic(chat_id, topic)
        await get_alert_service().register_user(chat_id)

        escaped = self._escape_md_static(topic)
        follows = await get_profile_manager().get_followed_topics(chat_id)
        current = ", ".join(self._escape_md_static(t) for t in follows[:10])

        await self.send_message(
            chat_id,
            f"✅ Vous suivez maintenant : *{escaped}*\n\n"
            f"📋 Vos sujets : _{current}_\n\n"
            "🔔 Vous recevrez des alertes sur ce sujet\\. "
            "Configurez la fréquence avec /frequency\\.",
        )

    async def _handle_unfollow(self, chat_id: int, args: str) -> None:
        """Unsubscribe from a topic."""
        topic = args.strip()
        if not topic:
            await self.send_message(chat_id, "📡 Utilisez : `/unfollow sujet`")
            return

        from app.services.messaging.user_profile import get_profile_manager
        await get_profile_manager().unfollow_topic(chat_id, topic)
        escaped = self._escape_md_static(topic)
        await self.send_message(chat_id, f"❌ Vous ne suivez plus : *{escaped}*")

    async def _handle_topics(self, chat_id: int, args: str) -> None:
        """Show followed topics and interest scores."""
        from app.services.messaging.user_profile import get_profile_manager
        pm = get_profile_manager()

        follows = await pm.get_followed_topics(chat_id)
        interests = await pm.get_top_interests(chat_id, limit=7)

        lines = ["📡 *Vos sujets et intérêts*\n"]

        if follows:
            lines.append("*Sujets suivis :*")
            for t in follows:
                lines.append(f"• {self._escape_md_static(t)}")
            lines.append("")

        if interests:
            lines.append("*Catégories d'intérêt \\(score\\) :*")
            bars = ["▓▓▓▓▓", "▓▓▓▓░", "▓▓▓░░", "▓▓░░░", "▓░░░░", "░░░░░"]
            for name, score in interests:
                bar_idx = min(5, max(0, 5 - int(score / 2)))
                bar = bars[bar_idx]
                lines.append(
                    f"• {self._escape_md_static(name)} {bar} {score:.1f}"
                )
        elif not follows:
            lines.append(
                "_Aucun intérêt détecté\\. Posez des questions "
                "ou utilisez /follow pour suivre des sujets\\._"
            )

        lines.append("")
        lines.append("_Utilisez /follow `sujet` pour en ajouter un\\._")
        await self.send_message(chat_id, "\n".join(lines))

    async def _handle_preferences(self, chat_id: int, args: str) -> None:
        """Show and edit user preferences."""
        from app.services.messaging.user_profile import get_profile_manager
        pm = get_profile_manager()
        profile = await pm.get_profile(chat_id)

        # Handle sub-commands: /preferences persona neutral
        if args.strip():
            parts = args.strip().split(maxsplit=1)
            key = parts[0].lower()
            val = parts[1] if len(parts) > 1 else ""
            if key in ("persona", "frequence", "frequency", "langue", "language"):
                await pm.set_preference(chat_id, key, val)
                await self.send_message(
                    chat_id,
                    f"✅ Préférence mise à jour : *{self._escape_md_static(key)}* → `{self._escape_md_static(val)}`",
                )
                return

        persona = self._escape_md_static(profile.get("preferred_persona", "neutral"))
        freq = self._escape_md_static(profile.get("alert_frequency", "off"))
        lang = self._escape_md_static(profile.get("language", "fr"))
        registered = profile.get("registered_at", "")

        from app.services.messaging.memory_manager import get_memory_manager
        memories = await get_memory_manager().get_all_memories(chat_id)
        mem_count = len(memories)

        lines = [
            "⚙️ *Votre profil NovaPress*\n",
            f"🎭 Persona : `{persona}`",
            f"🔔 Alertes : `{freq}`",
            f"🌍 Langue : `{lang}`",
            f"🧠 Mémoires stratégiques : `{mem_count}`\n",
            "*Pour modifier :*",
            "• `/preferences persona le\\_cynique`",
            "• `/frequency daily` ou `/frequency realtime`",
            "• `/alerts on` ou `/alerts off`",
        ]
        await self.send_message(chat_id, "\n".join(lines))

    async def _handle_alerts(self, chat_id: int, args: str) -> None:
        """Toggle proactive alerts on/off."""
        from app.services.messaging.user_profile import get_profile_manager
        from app.services.messaging.alert_service import get_alert_service
        pm = get_profile_manager()
        alert_svc = get_alert_service()

        arg = args.strip().lower()
        if arg in ("on", "true", "1", "activer", "yes", "oui"):
            await pm.set_preference(chat_id, "alert_frequency", "daily")
            await alert_svc.register_user(chat_id)
            await self.send_message(
                chat_id,
                "🔔 *Alertes activées\\!*\n\n"
                "Vous recevrez un digest quotidien des synthèses "
                "correspondant à vos sujets suivis\\.\n\n"
                "Changez la fréquence avec /frequency daily\\|realtime",
            )
        elif arg in ("off", "false", "0", "désactiver", "no", "non"):
            await pm.set_preference(chat_id, "alert_frequency", "off")
            await alert_svc.unregister_user(chat_id)
            await self.send_message(chat_id, "🔕 *Alertes désactivées\\.*")
        else:
            freq = await pm.get_preference(chat_id, "alert_frequency", "off")
            esc_freq = self._escape_md_static(freq)
            await self.send_message(
                chat_id,
                f"🔔 *Alertes* — Statut actuel : `{esc_freq}`\n\n"
                "• `/alerts on` — Activer\n"
                "• `/alerts off` — Désactiver",
            )

    async def _handle_frequency(self, chat_id: int, args: str) -> None:
        """Set alert frequency."""
        from app.services.messaging.user_profile import get_profile_manager
        from app.services.messaging.alert_service import get_alert_service
        pm = get_profile_manager()

        arg = args.strip().lower()
        valid = {"daily": "quotidien", "realtime": "temps réel"}
        if arg in valid:
            await pm.set_preference(chat_id, "alert_frequency", arg)
            await get_alert_service().register_user(chat_id)
            label = self._escape_md_static(valid[arg])
            await self.send_message(
                chat_id,
                f"✅ Fréquence d'alertes : *{label}*\n\n"
                "Assurez\\-vous d'avoir suivi des sujets avec /follow\\.",
            )
        else:
            await self.send_message(
                chat_id,
                "⏱ *Fréquence des alertes*\n\n"
                "• `/frequency daily` — Un digest quotidien\n"
                "• `/frequency realtime` — Alerte immédiate à chaque synthèse",
            )

    async def _handle_podcast(self, chat_id: int, args: str) -> None:
        """Generate and send a 3-minute audio briefing."""
        await self._send_typing(chat_id)
        await self.send_message(
            chat_id,
            "🎙️ *Génération du podcast en cours…*\n"
            "_Henri et Denise préparent votre briefing audio\\._\n"
            "_Cela peut prendre 30 à 60 secondes\\._",
        )

        try:
            from app.services.briefing_service import get_briefing_service
            from app.services.podcast_generator import get_podcast_generator

            # Get top syntheses
            service = get_briefing_service()
            briefing = await service.get_latest_briefing(limit=4)

            if not briefing.get("items"):
                await self.send_message(
                    chat_id,
                    "⚠️ Aucune synthèse disponible pour le podcast\\.\n"
                    "Lancez /pipeline d'abord\\.",
                )
                return

            syntheses = briefing["items"]
            gen = get_podcast_generator()

            audio_bytes = await gen.generate_podcast(
                syntheses=syntheses,
                duration_target=180,
                llm_call=self._call_llm_with_max_tokens,
            )

            if audio_bytes:
                caption = "🗞️ NovaPress Podcast — Votre briefing du jour avec Henri et Denise"
                ok = await self.send_voice(chat_id, audio_bytes, caption=caption)
                if not ok:
                    # Fallback: text briefing
                    raise RuntimeError("sendVoice failed")
            else:
                raise RuntimeError("Podcast generation returned None")

        except Exception as e:
            logger.error(f"Podcast generation failed: {e}")
            await self.send_message(
                chat_id,
                "⚠️ Podcast indisponible pour le moment\\.\n"
                "Voici le briefing texte à la place :",
            )
            await self._handle_briefing(chat_id, "")

    async def _handle_help(self, chat_id: int, args: str) -> None:
        text = (
            "🗞️ *NovaPress — Aide*\n\n"
            "💬 *Mode conversation :*\n"
            "_Tapez n'importe quelle question en texte libre\\!_\n\n"
            "📋 *Commandes :*\n\n"
            "🗞️ /briefing — Briefing IA quotidien\n"
            "🔍 /search `sujet` — Recherche sémantique\n"
            "🎭 /perspectives — Différents points de vue\n"
            "🎙️ /podcast — Briefing audio 3 minutes\n"
            "📡 /follow `sujet` — Suivre un thème\n"
            "📡 /unfollow `sujet` — Ne plus suivre\n"
            "📊 /topics — Vos sujets et intérêts\n"
            "⚙️ /preferences — Votre profil\n"
            "🔔 /alerts on\\|off — Activer/désactiver les alertes\n"
            "⏱ /frequency daily\\|realtime — Fréquence alertes\n"
            "🚀 /pipeline — Lancer le pipeline\n"
            "🔄 /reset — Réinitialiser la conversation\n\n"
            "─────────────────────────\n"
            "🌐 [NovaPress Web](https://novapressai\\.duckdns\\.org)\n"
            "💡 NovaPress — _L'IA qui vous briefe\\._"
        )
        await self.send_message(chat_id, text)

    async def _handle_pipeline(self, chat_id: int, args: str) -> None:
        await self._send_typing(chat_id)
        try:
            client = await self._get_client()
            resp = await client.post(
                "http://localhost:5000/api/admin/pipeline/start",
                headers={"x-admin-key": settings.ADMIN_API_KEY},
                json={"mode": "SCRAPE", "max_articles_per_source": 15},
                timeout=15.0,
            )
            data = resp.json()
            if data.get("status") == "started" or "already" in str(data).lower():
                await self.send_message(
                    chat_id,
                    "🚀 *Pipeline NovaPress lancé\\!*\n\n"
                    "⏱ Les synthèses seront prêtes dans 10\\-15 minutes\\.\n"
                    "Tapez /briefing ensuite pour les recevoir\\.",
                )
            else:
                await self.send_message(chat_id, f"ℹ️ Pipeline : `{str(data)[:100]}`")
        except Exception as e:
            logger.error(f"Pipeline trigger from Telegram failed: {e}")
            await self.send_message(chat_id, "⚠️ Impossible de lancer le pipeline pour le moment\\.")

    async def _handle_reset(self, chat_id: int, args: str) -> None:
        """Reset conversation history (keeps strategic memories and profile)."""
        self._conversation_history.pop(str(chat_id), None)
        self._active_persona.pop(str(chat_id), None)
        await self._redis_del_history(chat_id)
        await self.send_message(
            chat_id,
            "🔄 *Conversation réinitialisée\\.*\n\n"
            "📝 _Note : votre profil et vos mémoires stratégiques sont conservés\\._\n"
            "Comment puis\\-je vous aider \\?",
        )

    async def _handle_unknown(self, chat_id: int, args: str) -> None:
        await self.send_message(
            chat_id,
            "❓ Commande inconnue\\.\n"
            "Tapez /help pour la liste des commandes\\.\n"
            "💬 Ou écrivez simplement votre question en texte libre\\!",
        )

    # ─── Main Chat Handler ───

    async def _handle_chat(self, chat_id: int, text: str) -> None:
        """Free-text chat with Smart RAG, persona, memory, intent detection."""
        await self._send_typing(chat_id)

        try:
            today = datetime.now(timezone.utc).strftime("%A %d %B %Y")
            history = await self._redis_load_history(chat_id)

            # 1. Detect intent
            intent = self._detect_intent(text)

            # 2. Handle chart intent early — sends images, not text
            if intent == "chart":
                await self._handle_chart_request(chat_id, text)
                return

            # 3. Handle specific intents
            if intent == "persona":
                persona_id = self._extract_persona(text)
                if persona_id:
                    self._active_persona[str(chat_id)] = persona_id
                    await self.send_message(
                        chat_id,
                        f"🎭 Mode *{self._escape_md_static(persona_id.replace('_', ' '))}* activé\\!\n"
                        "Je vais répondre avec ce style\\.",
                        parse_mode="MarkdownV2",
                    )
                    return

            # 3. Smart RAG: semantic search for relevant news
            news_context, has_real_news = await self._smart_search(text, chat_id)

            # 4. Update user interests from detected categories
            from app.services.messaging.user_profile import get_profile_manager
            pm = get_profile_manager()
            detected_cats = pm.detect_categories(text)
            if detected_cats:
                await pm.update_from_interaction(chat_id, detected_cats)

            # 5. Get strategic memories
            from app.services.messaging.memory_manager import get_memory_manager
            memory_mgr = get_memory_manager()
            memory_context = await memory_mgr.get_context(chat_id)

            # 6. Build system prompt
            active_persona = self._active_persona.get(str(chat_id), "neutral")
            persona_instructions = self._get_persona_instructions(active_persona)

            if has_real_news:
                context_block = (
                    "SYNTHÈSES NOVAPRESS DISPONIBLES (sources réelles) :\n"
                    f"{news_context}\n\n"
                    "→ Appuie-toi sur ces synthèses pour répondre. "
                    "Quand tu mentionnes une synthèse, donne son lien (champ 'Lien' ci-dessus) "
                    "pour que l'utilisateur puisse la lire en entier sur le site."
                )
            else:
                context_block = (
                    "AUCUNE SYNTHÈSE PERTINENTE TROUVÉE sur ce sujet.\n"
                    "Le pipeline n'a pas encore analysé ça. "
                    "Dis-le honnêtement, sans inventer, et suggère /pipeline ou /briefing."
                )

            # Add intent-specific instructions
            intent_instruction = self._get_intent_instruction(intent, text)

            system_prompt = (
                f"Tu es Alex, le pote journaliste de NovaPress — celui qui sait tout sur l'actu.\n"
                f"On est le {today}.\n\n"
                f"TON STYLE :\n"
                f"- Tu tutoies, tu es passionné et direct — comme un ami qui t'explique l'actu\n"
                f"- Pour une question simple → réponse courte (2-4 lignes)\n"
                f"- Pour une analyse → structure comme un vrai article avec sections et listes\n"
                f"- Ton naturel, sans jargon, tu peux être légèrement ironique sur des sujets légers\n\n"
                f"FORMATAGE MARKDOWN (Telegram le supporte, utilise-le !) :\n"
                f"- **Titre de section** pour les parties importantes\n"
                f"- • ou - pour les listes à puces\n"
                f"- `stat ou chiffre clé` pour les données numériques\n"
                f"- [Lire la synthèse complète](URL) pour les liens — TOUJOURS utiliser ce format\n"
                f"- Pour des comparaisons, structure en deux parties claires\n\n"
                f"EXEMPLE de bonne réponse structurée :\n"
                f"**🔍 Situation en Ukraine**\n"
                f"Voici ce que j'ai sur le sujet :\n\n"
                f"**Points clés**\n"
                f"- La situation évolue sur le front Est...\n"
                f"- `12 sources` croisées, score de fiabilité `78/100`\n\n"
                f"**Analyse**\n"
                f"Les dernières synthèses montrent une tendance...\n\n"
                f"[Lire la synthèse complète](https://novapressai.duckdns.org/synthesis/xxx)\n\n"
                f"{persona_instructions}\n\n"
                f"{memory_context}\n\n"
                f"{context_block}\n\n"
                f"{intent_instruction}"
                f"RÈGLES :\n"
                f"- TOUJOURS en français\n"
                f"- Ne jamais inventer des faits\n"
                f"- Quand tu as un lien vers une synthèse, donne-le avec [texte](url)\n"
                f"- Utilise le markdown pour structurer, mais reste naturel — pas de template rigide\n"
            )

            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(history[-self.MAX_CHAT_HISTORY:])
            messages.append({"role": "user", "content": text})

            response_text = await self._call_llm(messages, max_tokens=600)

            # Save history
            history.append({"role": "user", "content": text})
            history.append({"role": "assistant", "content": response_text})
            if len(history) > self.MAX_CHAT_HISTORY * 2:
                history = history[-self.MAX_CHAT_HISTORY * 2:]
            self._conversation_history[str(chat_id)] = history
            await self._redis_save_history(chat_id, history)

            # Trigger memory extraction (non-blocking, every 5 interactions)
            asyncio.create_task(
                memory_mgr.maybe_extract(chat_id, history, self._call_llm)
            )

            # Convert markdown to Telegram HTML and send
            html_text = self._md_to_html(response_text)
            await self.send_message(chat_id, html_text, parse_mode="HTML")

        except Exception as e:
            logger.error(f"Chat LLM error: {e}")
            await self.send_message(
                chat_id,
                "⚠️ Je ne peux pas répondre pour le moment\\.\n"
                "Essayez /briefing pour les dernières nouvelles\\.",
            )

    # ─── Chart Generation ───

    async def _handle_chart_request(self, chat_id: int, text: str) -> None:
        """Generate and send chart(s) based on user query intent."""
        await self._send_typing(chat_id)
        try:
            from app.db.qdrant_client import get_qdrant_service
            from app.services.messaging.chart_generator import (
                generate_category_chart,
                generate_timeline_chart,
                generate_transparency_chart,
            )

            qdrant = get_qdrant_service()
            syntheses = await asyncio.to_thread(qdrant.get_latest_syntheses, 50)

            if not syntheses:
                await self.send_message(
                    chat_id,
                    "Pas encore de synthèses — lance /pipeline d'abord !",
                    parse_mode=None,
                )
                return

            text_lower = text.lower()
            sent = 0

            # Map keywords to specific charts
            if any(w in text_lower for w in ["catégor", "categor", "thème", "sujet", "répartition"]):
                img = generate_category_chart(syntheses)
                if img:
                    await self.send_photo(chat_id, img, "📊 Répartition par catégorie")
                    sent += 1

            if any(w in text_lower for w in ["fiabilité", "fiabilite", "transparence", "score", "confiance"]):
                img = generate_transparency_chart(syntheses)
                if img:
                    await self.send_photo(chat_id, img, "🔍 Score de transparence par catégorie")
                    sent += 1

            if any(w in text_lower for w in ["évolution", "evolution", "timeline", "jours", "semaine", "volume"]):
                img = generate_timeline_chart(syntheses)
                if img:
                    await self.send_photo(chat_id, img, "📈 Volume sur 7 jours")
                    sent += 1

            # Default: send all 3 charts
            if sent == 0:
                for gen_fn, caption in [
                    (generate_timeline_chart, "📈 Volume sur 7 jours"),
                    (generate_category_chart, "📊 Répartition par catégorie"),
                    (generate_transparency_chart, "🔍 Score de transparence moyen"),
                ]:
                    img = gen_fn(syntheses)
                    if img:
                        await self.send_photo(chat_id, img, caption)

            # Text summary
            cat_count: Dict[str, int] = {}
            for s in syntheses[:30]:
                cat = (s.get("category") or "AUTRE").upper()
                cat_count[cat] = cat_count.get(cat, 0) + 1
            top = sorted(cat_count.items(), key=lambda x: x[1], reverse=True)[:3]
            top_str = ", ".join(f"{c} ({n})" for c, n in top)
            avg_score = (
                sum(float(s.get("transparency_score") or 0) for s in syntheses[:30])
                / max(len(syntheses[:30]), 1)
            )
            await self.send_message(
                chat_id,
                f"Sur les {len(syntheses)} dernières synthèses 📊\n"
                f"Top catégories : {top_str}\n"
                f"Score de transparence moyen : {avg_score:.0f}/100",
                parse_mode=None,
            )

        except ImportError:
            await self.send_message(
                chat_id,
                "Graphiques non disponibles (matplotlib manquant). "
                "Utilise /briefing pour les stats en texte.",
                parse_mode=None,
            )
        except Exception as e:
            logger.error(f"Chart request failed: {e}")
            await self.send_message(
                chat_id,
                "Oops, impossible de générer les graphiques pour le moment.",
                parse_mode=None,
            )

    # ─── Smart RAG ───

    async def _smart_search(self, query: str, chat_id: int) -> tuple:
        """
        Semantic search in Qdrant syntheses using BGE-M3 embeddings.
        Returns (context_str, has_real_news: bool).
        """
        try:
            from app.db.qdrant_client import get_qdrant_service
            from app.ml.embeddings import embedding_service

            qdrant = get_qdrant_service()

            # Encode query using BGE-M3 in a thread (sync call)
            if embedding_service.model:
                query_vector = await asyncio.to_thread(
                    embedding_service.encode_single, query
                )
                # Search Qdrant by similarity
                results = await asyncio.to_thread(
                    qdrant.search_syntheses_by_embedding,
                    query_vector.tolist(),
                    5,  # limit
                    0.55,  # score_threshold
                )
            else:
                results = []

            # Fallback: if no semantic matches, get latest syntheses
            if not results:
                results = await asyncio.to_thread(
                    qdrant.get_latest_syntheses, 3
                )
                if not results:
                    return "Aucune synthèse disponible.", False
                # Mark as fallback (no score)
                for r in results:
                    r.setdefault("score", 0.0)
                has_real_news = True
                is_semantic = False
            else:
                has_real_news = True
                is_semantic = True

            # Build context from relevant passages
            FRONTEND_URL = "https://novapressai.duckdns.org"
            parts = []
            for synth in results:
                cat = synth.get("category", "")
                title = synth.get("title", "Sans titre")
                synth_id = synth.get("id", "")
                synthesis_url = f"{FRONTEND_URL}/synthesis/{synth_id}" if synth_id else ""
                passage = self._extract_relevant_passage(synth, query)
                sources = synth.get("source_count", synth.get("num_sources", 0))
                ts_score = synth.get("transparency_score", 0)
                created = synth.get("created_at", "")

                url_line = f"  Lien: {synthesis_url}\n" if synthesis_url else ""
                parts.append(
                    f"[{cat}] {title}\n"
                    f"{url_line}"
                    f"  Sources: {sources} | Score transparence: {ts_score}/100\n"
                    f"  {passage}\n"
                    f"  (publié: {created})"
                )

            context = "\n\n---\n\n".join(parts)
            return context, has_real_news

        except RuntimeError:
            # Qdrant or embedding not initialized
            return "Services de recherche non disponibles.", False
        except Exception as e:
            logger.warning(f"Smart search failed: {e}")
            return "Synthèses temporairement indisponibles.", False

    @staticmethod
    def _extract_relevant_passage(synth: Dict, query: str) -> str:
        """
        Extract the most relevant ~300-char passage from a synthesis.
        Simple keyword matching — no LLM needed.
        """
        # Fields to search in order of priority
        fields = [
            synth.get("body", ""),
            synth.get("introduction", synth.get("summary", "")),
            synth.get("analysis", ""),
        ]

        query_words = set(query.lower().split())
        best_passage = ""
        best_score = -1

        for field in fields:
            if not field or not isinstance(field, str):
                continue
            # Slide a 300-char window and score by keyword overlap
            for i in range(0, max(1, len(field) - 300), 100):
                window = field[i : i + 300]
                window_words = set(window.lower().split())
                score = len(query_words & window_words)
                if score > best_score:
                    best_score = score
                    best_passage = window

        if best_passage:
            return best_passage.strip()

        # Fallback: first 300 chars of introduction
        intro = synth.get("introduction", synth.get("summary", ""))
        return str(intro)[:300].strip() if intro else "Pas de contenu disponible."

    # ─── Intent Detection ───

    @staticmethod
    def _detect_intent(text: str) -> Optional[str]:
        """Detect special intent from user message."""
        for intent_name, pattern in INTENT_PATTERNS.items():
            if pattern.search(text):
                return intent_name
        return None

    @staticmethod
    def _extract_persona(text: str) -> Optional[str]:
        """Extract persona ID from intent match."""
        text_lower = text.lower()
        for keyword, persona_id in PERSONA_MAP.items():
            if keyword in text_lower:
                return persona_id
        return None

    @staticmethod
    def _get_persona_instructions(persona_id: str) -> str:
        """Return style instructions for the active persona."""
        instructions = {
            "neutral": "",
            "le_cynique": (
                "PERSONA ACTIF — Le Cynique (Edouard Vaillant) :\n"
                "Ton sardonique, sceptique, désabusé. Cherche la contradiction. "
                "Formules: 'Quelle surprise...', 'Encore une fois...', 'Comme d'habitude...'"
            ),
            "l_optimiste": (
                "PERSONA ACTIF — L'Optimiste (Claire Horizon) :\n"
                "Ton enthousiaste, constructif, solutions-focused. "
                "Valorise les avancées, les opportunités, l'espoir."
            ),
            "le_conteur": (
                "PERSONA ACTIF — Le Conteur (Alexandre Duval) :\n"
                "Style narratif, dramatique. Commence par 'Il était une fois...' "
                "ou une mise en scène dramatique. Raconte l'actu comme un feuilleton."
            ),
            "le_satiriste": (
                "PERSONA ACTIF — Le Satiriste (Le Bouffon) :\n"
                "Ton absurdiste, parodique. Traite l'actualité avec ironie légère. "
                "Style Le Gorafi mais subtil."
            ),
            "l_historien": (
                "PERSONA ACTIF — L'Historien :\n"
                "Replace les événements dans leur contexte historique. "
                "Références aux précédents historiques. Ton académique mais accessible."
            ),
            "le_philosophe": (
                "PERSONA ACTIF — Le Philosophe :\n"
                "Questionne les présupposés. Explore les implications éthiques et sociétales. "
                "Ton réflexif, cite des courants de pensée."
            ),
            "le_scientifique": (
                "PERSONA ACTIF — Le Scientifique :\n"
                "Données, chiffres, consensus scientifique. "
                "Méfiance envers les assertions sans preuves. Ton factuel et rigoureux."
            ),
        }
        return instructions.get(persona_id, "")

    @staticmethod
    def _get_intent_instruction(intent: Optional[str], text: str) -> str:
        """Return additional LLM instructions based on detected intent."""
        if not intent:
            return ""
        instructions = {
            "compare": (
                "L'utilisateur veut comparer deux sujets. "
                "Structure ta réponse en deux parties claires avec les similitudes et différences.\n"
            ),
            "weekly": (
                "L'utilisateur veut un résumé de la semaine. "
                "Synthétise les grandes tendances des synthèses disponibles.\n"
            ),
            "transparency": (
                "L'utilisateur s'interroge sur la fiabilité de l'info. "
                "Mentionne le score de transparence des synthèses pertinentes et le nombre de sources.\n"
            ),
            "trend": (
                "L'utilisateur veut connaître les tendances. "
                "Mentionne le narrative_arc (émergent, en développement, au pic, en déclin) si disponible.\n"
            ),
            "causal": (
                "L'utilisateur cherche les causes et conséquences. "
                "Explique les liens causaux identifiés dans les synthèses.\n"
            ),
        }
        return instructions.get(intent, "")

    # ─── Persona Transforms (lightweight, no LLM) ───

    @staticmethod
    def _cynique_transform(text: str) -> str:
        prefix = "Quelle surprise... "
        return (prefix + text[:180]).strip()

    @staticmethod
    def _optimiste_transform(text: str) -> str:
        prefix = "Une avancée prometteuse : "
        return (prefix + text[:180]).strip()

    @staticmethod
    def _conteur_transform(text: str) -> str:
        prefix = "Il était une fois... "
        return (prefix + text[:180]).strip()

    @staticmethod
    def _satiriste_transform(text: str) -> str:
        prefix = "Breaking : les experts s'accordent à dire... "
        return (prefix + text[:160]).strip()

    # ─── Notifications ───

    async def notify_subscribers(self, synthesis: Dict[str, Any]) -> int:
        """
        Notify subscribers about a new synthesis.
        Called by the pipeline after synthesis storage.
        Returns number of notifications sent.
        """
        if not self._initialized:
            return 0
        try:
            from app.services.messaging.alert_service import get_alert_service
            return await get_alert_service().check_new_synthesis(synthesis)
        except Exception as e:
            logger.warning(f"notify_subscribers failed: {e}")
            return 0

    # ─── Redis Persistent Memory ───

    async def _redis_load_history(self, chat_id: int) -> list:
        if str(chat_id) in self._conversation_history:
            return list(self._conversation_history[str(chat_id)])
        try:
            import redis.asyncio as aioredis
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            raw = await r.get(f"novapress:chat:{chat_id}")
            await r.aclose()
            if raw:
                history = json.loads(raw)
                self._conversation_history[str(chat_id)] = history
                return list(history)
        except Exception as e:
            logger.debug(f"Redis load history failed: {e}")
        return []

    async def _redis_save_history(self, chat_id: int, history: list) -> None:
        try:
            import redis.asyncio as aioredis
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            await r.setex(
                f"novapress:chat:{chat_id}",
                60 * 60 * 24 * 30,
                json.dumps(history, ensure_ascii=False),
            )
            await r.aclose()
        except Exception as e:
            logger.debug(f"Redis save history failed: {e}")

    async def _redis_del_history(self, chat_id: int) -> None:
        try:
            import redis.asyncio as aioredis
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            await r.delete(f"novapress:chat:{chat_id}")
            await r.aclose()
        except Exception as e:
            logger.debug(f"Redis del history failed: {e}")

    # ─── LLM Calls ───

    async def _call_llm(self, messages: list, max_tokens: int = 400) -> str:
        """Call DeepSeek V3.2 via OpenRouter."""
        client = await self._get_client()
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://novapressai.duckdns.org",
                "X-Title": "NovaPress AI Bot",
            },
            json={
                "model": settings.OPENROUTER_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.7,
            },
            timeout=30.0,
        )
        data = resp.json()
        if data.get("choices"):
            return data["choices"][0]["message"]["content"].strip()
        logger.error(f"OpenRouter error: {data}")
        raise RuntimeError("LLM returned no response")

    async def _call_llm_with_max_tokens(
        self, messages: list, max_tokens: int = 1200
    ) -> str:
        """LLM call with higher token limit for podcast/memory extraction."""
        return await self._call_llm(messages, max_tokens=max_tokens)

    # ─── Utilities ───

    async def _send_typing(self, chat_id: int) -> None:
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
        text = re.sub(r"[\\*_~`\[\]()]", "", text)
        return text

    @staticmethod
    def _md_to_html(text: str) -> str:
        """
        Convert simple markdown from LLM output to Telegram HTML format.
        Supports: **bold**, *italic*, `code`, [text](url).
        Escapes HTML special chars in plain text.
        """
        import html as _html

        # 1. Protect [text](url) links before escaping
        links: list = []

        def _save_link(m: re.Match) -> str:
            links.append((m.group(1), m.group(2)))
            return f"\x00LINK{len(links) - 1}\x00"

        text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", _save_link, text)

        # 2. Escape HTML special chars in body text
        text = _html.escape(text, quote=False)

        # 3. Convert markdown to HTML tags
        text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text, flags=re.DOTALL)
        text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text, flags=re.DOTALL)
        text = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", text)

        # 4. Restore links as HTML <a> tags
        for i, (link_text, url) in enumerate(links):
            escaped_text = _html.escape(link_text, quote=False)
            text = text.replace(f"\x00LINK{i}\x00", f'<a href="{url}">{escaped_text}</a>')

        return text

    async def shutdown(self):
        """Cleanup resources."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
        from app.services.messaging.user_profile import get_profile_manager
        from app.services.messaging.memory_manager import get_memory_manager
        from app.services.messaging.alert_service import get_alert_service
        try:
            await get_profile_manager().close()
            await get_memory_manager().close()
            await get_alert_service().close()
        except Exception:
            pass


# Global instance
telegram_bot = TelegramBot()


async def init_telegram_bot() -> bool:
    """Initialize the global Telegram bot."""
    return await telegram_bot.initialize()


def get_telegram_bot() -> TelegramBot:
    """Dependency injection for FastAPI."""
    return telegram_bot
