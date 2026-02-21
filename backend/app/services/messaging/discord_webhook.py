"""
Discord Webhook — NovaPress AI Notifications
Sends rich embeds to a Discord channel when new syntheses are created.
"""
import httpx
from typing import Optional, Dict, Any, List
from loguru import logger
from datetime import datetime

from app.core.config import settings


# Category → embed color mapping
CATEGORY_COLORS = {
    "politique": 0xE74C3C,       # Red
    "économie": 0xF39C12,        # Orange
    "technologie": 0x3498DB,     # Blue
    "science": 0x2ECC71,         # Green
    "culture": 0x9B59B6,         # Purple
    "sport": 0x1ABC9C,           # Teal
    "international": 0xE67E22,   # Dark Orange
    "environnement": 0x27AE60,   # Dark Green
    "santé": 0xE91E63,           # Pink
    "société": 0x607D8B,         # Blue Grey
}

DEFAULT_COLOR = 0x6C5CE7  # NovaPress Purple


class DiscordWebhook:
    """Sends notifications to Discord via webhook."""

    def __init__(self):
        self.webhook_url = settings.DISCORD_WEBHOOK_URL
        self.enabled = bool(self.webhook_url)
        self.notify_breaking_only = getattr(settings, "DISCORD_NOTIFY_BREAKING", False)

    async def send_synthesis(
        self,
        title: str,
        summary: str,
        category: str = "",
        tags: Optional[List[str]] = None,
        source_count: int = 0,
        compliance_score: Optional[int] = None,
        is_breaking: bool = False,
        synthesis_id: str = "",
    ) -> bool:
        """Send a synthesis notification as a rich Discord embed."""
        if not self.enabled:
            return False

        if self.notify_breaking_only and not is_breaking:
            return True  # Skip non-breaking, but not an error

        color = CATEGORY_COLORS.get(category.lower(), DEFAULT_COLOR)

        # Build embed
        embed: Dict[str, Any] = {
            "title": f"{'🔴 BREAKING — ' if is_breaking else '📰 '}{title}",
            "description": summary[:2000] if summary else "Pas de résumé disponible.",
            "color": color,
            "timestamp": datetime.utcnow().isoformat(),
            "footer": {
                "text": f"NovaPress AI • {source_count} source{'s' if source_count != 1 else ''}",
                "icon_url": "https://novapress.ai/icons/icon-192.png",
            },
        }

        # Fields
        fields = []
        if category:
            fields.append({"name": "📂 Catégorie", "value": category.capitalize(), "inline": True})
        if compliance_score is not None:
            emoji = "🟢" if compliance_score >= 80 else "🟡" if compliance_score >= 60 else "🔴"
            fields.append({"name": f"{emoji} Score", "value": f"{compliance_score}/100", "inline": True})
        if tags:
            fields.append({"name": "🏷️ Tags", "value": " ".join(f"`{t}`" for t in tags[:5]), "inline": False})

        if fields:
            embed["fields"] = fields

        # Send
        payload = {
            "username": "NovaPress AI",
            "avatar_url": "https://novapress.ai/icons/icon-192.png",
            "embeds": [embed],
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(self.webhook_url, json=payload)

                if resp.status_code == 204:
                    logger.info(f"✅ Discord notification sent: {title[:50]}")
                    return True
                elif resp.status_code == 429:
                    retry_after = resp.json().get("retry_after", 1)
                    logger.warning(f"⏳ Discord rate limited, retry after {retry_after}s")
                    return False
                else:
                    logger.warning(f"Discord webhook error {resp.status_code}: {resp.text[:200]}")
                    return False

        except Exception as e:
            logger.error(f"Discord webhook failed: {e}")
            return False

    async def send_pipeline_summary(
        self,
        total_syntheses: int,
        new_syntheses: int,
        sources_processed: int,
        duration_seconds: float,
    ) -> bool:
        """Send a pipeline run summary to Discord."""
        if not self.enabled:
            return False

        embed = {
            "title": "🔄 Pipeline terminé",
            "color": 0x2ECC71 if new_syntheses > 0 else 0x95A5A6,
            "fields": [
                {"name": "📊 Nouvelles synthèses", "value": str(new_syntheses), "inline": True},
                {"name": "📄 Total", "value": str(total_syntheses), "inline": True},
                {"name": "🔗 Sources traitées", "value": str(sources_processed), "inline": True},
                {"name": "⏱️ Durée", "value": f"{duration_seconds:.1f}s", "inline": True},
            ],
            "timestamp": datetime.utcnow().isoformat(),
            "footer": {"text": "NovaPress AI Pipeline"},
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    self.webhook_url,
                    json={"username": "NovaPress Pipeline", "embeds": [embed]},
                )
                return resp.status_code == 204
        except Exception as e:
            logger.error(f"Discord pipeline summary failed: {e}")
            return False


# Singleton
discord_webhook = DiscordWebhook()
