"""
NovaPress Briefing Service
Generates daily AI briefings from the latest syntheses.
"L'IA qui vous briefe." — NovaPress
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from loguru import logger

from app.core.config import settings
from app.db.qdrant_client import get_qdrant_service


class BriefingService:
    """Generates personalized news briefings from stored syntheses."""

    def __init__(self):
        self.top_n = settings.BRIEFING_TOP_SYNTHESES
        self.min_score = settings.BRIEFING_MIN_COMPLIANCE_SCORE

    async def get_latest_briefing(
        self,
        limit: Optional[int] = None,
        hours_lookback: int = 24
    ) -> Dict[str, Any]:
        """
        Generate a briefing from the most recent top syntheses.

        Args:
            limit: Override for number of syntheses to include
            hours_lookback: How far back to look for syntheses

        Returns:
            Formatted briefing dict with syntheses, metadata, and stats
        """
        count = limit or self.top_n
        qdrant = get_qdrant_service()

        if not qdrant or not qdrant.client:
            logger.warning("Qdrant not available — returning empty briefing")
            return self._empty_briefing()

        try:
            # Fetch recent syntheses from Qdrant
            syntheses = await self._fetch_recent_syntheses(qdrant, count, hours_lookback)

            if not syntheses:
                logger.info("No recent syntheses found for briefing")
                return self._empty_briefing()

            # Rank by relevance score
            ranked = self._rank_syntheses(syntheses)

            # Format the briefing
            return self._format_briefing(ranked[:count])

        except Exception as e:
            logger.error(f"Error generating briefing: {e}")
            return self._empty_briefing()

    async def _fetch_recent_syntheses(
        self,
        qdrant,
        limit: int,
        hours_lookback: int
    ) -> List[Dict[str, Any]]:
        """Fetch recent syntheses from Qdrant vector DB."""
        try:
            # Use Qdrant scroll to get recent syntheses
            from qdrant_client.models import Filter, FieldCondition, Range

            cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_lookback)
            cutoff_ts = cutoff.timestamp()

            results = await qdrant.client.scroll(
                collection_name=f"{settings.QDRANT_COLLECTION}_syntheses",
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="created_at_ts",
                            range=Range(gte=cutoff_ts)
                        )
                    ]
                ),
                limit=limit * 3,  # Fetch more to allow ranking
                with_payload=True,
                with_vectors=False,
            )

            points = results[0] if results else []
            return [
                {**point.payload, "id": str(point.id)}
                for point in points
                if point.payload
            ]

        except Exception as e:
            logger.warning(f"Failed to fetch syntheses from Qdrant: {e}")
            # Fallback: try to get any syntheses without time filter
            try:
                results = await qdrant.client.scroll(
                    collection_name=f"{settings.QDRANT_COLLECTION}_syntheses",
                    limit=limit * 2,
                    with_payload=True,
                    with_vectors=False,
                )
                points = results[0] if results else []
                return [
                    {**point.payload, "id": str(point.id)}
                    for point in points
                    if point.payload
                ]
            except Exception as e2:
                logger.error(f"Fallback fetch also failed: {e2}")
                return []

    def _rank_syntheses(self, syntheses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Rank syntheses by relevance score = freshness × sources × compliance."""
        now = datetime.now(timezone.utc).timestamp()

        for s in syntheses:
            # Freshness: newer = higher (exponential decay over 24h)
            created_ts = s.get("created_at_ts", now)
            age_hours = max(0, (now - created_ts) / 3600)
            freshness = max(0.1, 1.0 - (age_hours / 48))

            # Source count: more sources = more credible
            source_count = s.get("source_count", len(s.get("source_urls", [])))
            source_score = min(1.0, source_count / 7)

            # Compliance score
            compliance = s.get("compliance_score", 80) / 100

            # Topic intensity bonus
            intensity_bonus = {
                "breaking": 2.0,
                "hot": 1.5,
                "developing": 1.2,
                "standard": 1.0,
            }.get(s.get("topic_intensity", "standard"), 1.0)

            s["_relevance_score"] = freshness * source_score * compliance * intensity_bonus

        syntheses.sort(key=lambda x: x.get("_relevance_score", 0), reverse=True)
        return syntheses

    def _format_briefing(self, syntheses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Format syntheses into a structured briefing."""
        now = datetime.now(timezone.utc)

        items = []
        for s in syntheses:
            items.append({
                "id": s.get("id", ""),
                "title": s.get("title", "Sans titre"),
                "summary": s.get("introduction", s.get("summary", ""))[:300],
                "key_points": s.get("key_points", s.get("keyPoints", []))[:4],
                "source_count": s.get("source_count", len(s.get("source_urls", []))),
                "compliance_score": s.get("compliance_score", 80),
                "sentiment": s.get("sentiment", "neutral"),
                "topic_intensity": s.get("topic_intensity", "standard"),
                "reading_time": s.get("reading_time", 5),
                "category": s.get("category", "Actualité"),
            })

        return {
            "date": now.strftime("%d %B %Y"),
            "timestamp": now.isoformat(),
            "count": len(items),
            "items": items,
            "stats": {
                "total_sources": sum(i["source_count"] for i in items),
                "avg_compliance": (
                    sum(i["compliance_score"] for i in items) / len(items)
                    if items else 0
                ),
            },
        }

    def _empty_briefing(self) -> Dict[str, Any]:
        """Return an empty briefing structure."""
        now = datetime.now(timezone.utc)
        return {
            "date": now.strftime("%d %B %Y"),
            "timestamp": now.isoformat(),
            "count": 0,
            "items": [],
            "stats": {"total_sources": 0, "avg_compliance": 0},
        }

    def format_telegram_briefing(self, briefing: Dict[str, Any]) -> str:
        """Format a briefing as a Telegram-friendly markdown message."""
        if not briefing["items"]:
            return (
                "🗞️ *NOVAPRESS BRIEFING*\n\n"
                "Aucune synthèse disponible pour le moment\\.\n"
                "Le pipeline n'a peut\\-être pas encore tourné\\.\n\n"
                "💡 Lancez le pipeline : `/pipeline`"
            )

        # Build header
        lines = [
            f"🗞️ *NOVAPRESS BRIEFING — {self._escape_md(briefing['date'])}*\n",
        ]

        # Add each synthesis
        for i, item in enumerate(briefing["items"], 1):
            intensity_emoji = {
                "breaking": "🔴",
                "hot": "🟠",
                "developing": "🔵",
                "standard": "⚪",
            }.get(item["topic_intensity"], "⚪")

            sentiment_emoji = {
                "positive": "📈",
                "negative": "📉",
                "mixed": "↔️",
                "neutral": "➡️",
            }.get(item["sentiment"], "➡️")

            title = self._escape_md(item["title"])
            summary = self._escape_md(item["summary"][:200])

            lines.append(f"{intensity_emoji} *{title}*")
            lines.append(f"_{summary}_\n")

            # Key points (max 3)
            for kp in item["key_points"][:3]:
                lines.append(f"• {self._escape_md(kp)}")

            lines.append(
                f"\n{sentiment_emoji} {item['source_count']} sources "
                f"· ⏱ {item['reading_time']} min "
                f"· 📊 {item['compliance_score']}%\n"
            )
            lines.append("─" * 30 + "\n")

        # Footer
        stats = briefing["stats"]
        lines.append(
            f"📰 {briefing['count']} synthèses "
            f"· {stats['total_sources']} sources analysées\n"
        )
        lines.append("🤖 /perspectives pour d'autres points de vue")
        lines.append("📡 /follow \\<sujet\\> pour suivre un thème")

        return "\n".join(lines)

    @staticmethod
    def _escape_md(text: str) -> str:
        """Escape special characters for Telegram MarkdownV2."""
        special = r"_*[]()~`>#+-=|{}.!"
        result = []
        for ch in text:
            if ch in special:
                result.append(f"\\{ch}")
            else:
                result.append(ch)
        return "".join(result)


# Global instance
briefing_service = BriefingService()


def get_briefing_service() -> BriefingService:
    """Dependency injection for FastAPI."""
    return briefing_service
