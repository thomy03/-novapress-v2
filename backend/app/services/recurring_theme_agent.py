"""
Recurring Theme Agent — auto-triggered deep enrichment for topics
that already have existing syntheses.

When the pipeline generates a new synthesis for a recurring topic
(i.e., the topic has prior syntheses), this agent is spawned as an
async background task to:

1. Fetch Reddit + Grok discussions focused specifically on the
   evolution of the story (not just the latest headline)
2. Cross-reference new social reactions with the historical arc
3. Attach the enriched context to the synthesis metadata

This runs AFTER the main pipeline synthesis is stored, so it
enriches asynchronously without slowing down the pipeline.
"""
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional
from loguru import logger


class RecurringThemeAgent:
    """
    Agent that auto-triggers deeper enrichment on recurring themes.
    Activated when a synthesis is assigned to a topic with 2+ prior syntheses.
    """

    # Only trigger for topics with at least this many prior syntheses
    MIN_PRIOR_SYNTHESES = 2

    def __init__(self):
        self._running_tasks: Dict[str, asyncio.Task] = {}

    async def maybe_enrich(
        self,
        synthesis: Dict[str, Any],
        topic_id: Optional[str],
        related_count: int,
    ) -> None:
        """
        Check if this synthesis qualifies for deeper enrichment
        and spawn a background task if so.

        Args:
            synthesis: The newly generated synthesis dict
            topic_id: The topic this synthesis was assigned to (or None)
            related_count: Number of related prior syntheses
        """
        if related_count < self.MIN_PRIOR_SYNTHESES:
            return

        synthesis_id = synthesis.get("id", "")
        if not synthesis_id:
            return

        # Don't run if we already have an enrichment task for this synthesis
        if synthesis_id in self._running_tasks:
            return

        topic_name = synthesis.get("title", "")[:100]
        logger.info(
            f"🔄 RecurringThemeAgent triggered for '{topic_name}' "
            f"({related_count} prior syntheses)"
        )

        task = asyncio.create_task(
            self._deep_enrich(synthesis, related_count)
        )
        self._running_tasks[synthesis_id] = task

        # Cleanup task reference when done
        task.add_done_callback(
            lambda t, sid=synthesis_id: self._running_tasks.pop(sid, None)
        )

    async def _deep_enrich(
        self,
        synthesis: Dict[str, Any],
        related_count: int,
    ) -> None:
        """
        Perform deeper social enrichment for a recurring theme.
        Runs as a background task.
        """
        synthesis_id = synthesis.get("id", "")
        title = synthesis.get("title", "")
        category = synthesis.get("category", "")
        key_entities = synthesis.get("key_entities", [])

        try:
            from app.ml.search_enrichment import get_search_enrichment_engine

            engine = get_search_enrichment_engine()

            # Build an evolution-focused query
            entity_str = ", ".join(
                e if isinstance(e, str) else e.get("name", "")
                for e in key_entities[:3]
            )
            evolution_query = f"{title} evolution développements récents {entity_str}".strip()

            # Deep Reddit search (broader time window for recurring themes)
            reddit_data = await engine.reddit.search_discussions(
                topic=evolution_query[:150],
                category=category,
                limit=8,
                time_filter="month",  # Wider window for recurring topics
            )

            # Deep Grok analysis if available
            grok_data: Dict[str, Any] = {}
            if engine.grok.api_key:
                try:
                    grok_data = await engine.grok.get_detailed_social_context(
                        f"Évolution et derniers développements: {title[:120]}"
                    )
                except Exception as e:
                    logger.warning(f"Deep Grok enrichment failed: {e}")

            # Build enrichment update
            enrichment_update: Dict[str, Any] = {
                "deep_enrichment": True,
                "deep_enrichment_timestamp": datetime.now().isoformat(),
                "deep_reddit_discussions": reddit_data.get("discussions", [])[:5],
                "deep_reddit_sentiment": reddit_data.get("sentiment_summary", ""),
                "deep_social_evolution": grok_data.get("narrative_threads", []),
                "deep_social_tweets": grok_data.get("tweets", [])[:5],
                "recurring_theme_count": related_count,
            }

            # Store the enrichment in Qdrant
            await self._store_enrichment(synthesis_id, enrichment_update)

            logger.success(
                f"✅ Deep enrichment complete for '{title[:50]}': "
                f"Reddit={len(enrichment_update['deep_reddit_discussions'])}, "
                f"Grok={bool(grok_data)}"
            )

        except Exception as e:
            logger.error(f"❌ RecurringThemeAgent failed for {synthesis_id[:8]}: {e}")

    async def _store_enrichment(
        self,
        synthesis_id: str,
        enrichment_data: Dict[str, Any],
    ) -> None:
        """Store deep enrichment data back into the synthesis in Qdrant."""
        try:
            from app.db.qdrant_client import get_qdrant_service

            qdrant = get_qdrant_service()
            if not qdrant or not qdrant.client:
                logger.warning("Qdrant not available for deep enrichment storage")
                return

            from qdrant_client.models import models

            # Update the synthesis payload with deep enrichment fields
            qdrant.client.set_payload(
                collection_name=qdrant.synthesis_collection,
                payload=enrichment_data,
                points=[synthesis_id],
            )

            logger.debug(f"Deep enrichment stored for {synthesis_id[:8]}")

        except Exception as e:
            logger.warning(f"Failed to store deep enrichment: {e}")


# Singleton
_agent: Optional[RecurringThemeAgent] = None


def get_recurring_theme_agent() -> RecurringThemeAgent:
    """Get or create the recurring theme agent singleton."""
    global _agent
    if _agent is None:
        _agent = RecurringThemeAgent()
    return _agent
