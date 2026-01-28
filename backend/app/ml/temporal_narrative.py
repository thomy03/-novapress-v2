"""
Temporal Narrative Arc (TNA) Module for NovaPress AI v2
Enables evolving syntheses that build upon historical context.

Features:
- Detects story continuity with existing syntheses
- Enriches syntheses with historical context
- Tracks narrative evolution over time
- Provides timeline-based analysis
"""
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import numpy as np
from loguru import logger


@dataclass
class StoryThread:
    """Represents a continuous story thread across time"""
    thread_id: str
    topic: str
    first_seen: datetime
    last_updated: datetime
    synthesis_ids: List[str] = field(default_factory=list)
    evolution_count: int = 1
    key_entities: List[str] = field(default_factory=list)
    sentiment_trajectory: List[float] = field(default_factory=list)


@dataclass
class HistoricalContext:
    """Context from previous syntheses for enrichment"""
    related_syntheses: List[Dict[str, Any]]
    timeline_events: List[Dict[str, Any]]
    entity_evolution: Dict[str, List[str]]
    previous_key_points: List[str]
    narrative_arc: str  # "emerging", "developing", "peak", "declining", "resolved"
    days_tracked: int
    contradiction_history: List[Dict[str, Any]]


class TemporalNarrativeEngine:
    """
    Engine for building evolving narrative syntheses.

    Key capabilities:
    1. Find related historical syntheses via semantic search
    2. Build timeline of story evolution
    3. Track entity mentions across time
    4. Detect narrative arc phase
    5. Generate enriched context for LLM
    """

    def __init__(self, embedding_service=None, qdrant_service=None):
        self.embedding_service = embedding_service
        self.qdrant_service = qdrant_service

        # Similarity threshold for story continuity (lowered from 0.75 to 0.60)
        self.continuity_threshold = 0.60

        # Minimum entity overlap for fallback matching (50%)
        self.entity_overlap_threshold = 0.50

        # Time window for historical context (days)
        self.history_window_days = 7

    def set_services(self, embedding_service, qdrant_service):
        """Set services after initialization"""
        self.embedding_service = embedding_service
        self.qdrant_service = qdrant_service

    def find_related_syntheses(
        self,
        cluster_articles: List[Dict[str, Any]],
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find existing syntheses that are semantically related to the current cluster.

        Args:
            cluster_articles: Articles in the current cluster
            limit: Max number of related syntheses to return

        Returns:
            List of related synthesis dictionaries with similarity scores
        """
        if not self.embedding_service or not self.qdrant_service:
            logger.warning("Services not initialized for TNA")
            return []

        # Create a combined representation of the cluster
        cluster_text = " ".join([
            f"{a.get('raw_title', '')} {a.get('raw_text', '')[:300]}"
            for a in cluster_articles[:5]
        ])

        # Generate embedding for the cluster
        cluster_embedding = self.embedding_service.encode([cluster_text])[0]

        # Search in syntheses collection using query_points (qdrant-client 1.6+)
        try:
            from qdrant_client.models import QueryRequest

            results = self.qdrant_service.client.query_points(
                collection_name=self.qdrant_service.syntheses_collection,
                query=cluster_embedding.tolist(),
                limit=limit,
                with_payload=True
            )

            related = []
            for point in results.points:
                if point.score >= self.continuity_threshold:
                    synthesis = point.payload
                    synthesis['id'] = point.id
                    synthesis['similarity_score'] = point.score
                    related.append(synthesis)

            logger.info(f"Found {len(related)} related syntheses (threshold: {self.continuity_threshold})")
            return related

        except Exception as e:
            logger.error(f"Failed to search related syntheses: {e}")
            return []

    def find_related_by_entities(
        self,
        current_entities: List[str],
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Fallback: Find related syntheses by entity overlap.
        Used when semantic search doesn't find enough related content.

        Args:
            current_entities: List of entity names from current cluster
            limit: Max number of related syntheses to return

        Returns:
            List of related synthesis dictionaries
        """
        if not self.qdrant_service or not current_entities:
            return []

        try:
            # Get recent syntheses to check entity overlap
            recent_syntheses = self.qdrant_service.get_live_syntheses(hours=168, limit=100)  # 7 days

            related = []
            for synthesis in recent_syntheses:
                # Get entities stored in synthesis
                stored_entities = synthesis.get("key_entities", [])
                if isinstance(stored_entities, str):
                    stored_entities = [e.strip() for e in stored_entities.split(",") if e.strip()]

                # Also extract entities from title/summary
                text_entities = set()
                full_text = f"{synthesis.get('title', '')} {synthesis.get('summary', '')}".lower()
                for entity in current_entities:
                    if entity.lower() in full_text:
                        text_entities.add(entity)

                # Combine stored and text-extracted entities
                all_stored = set(e.lower() for e in stored_entities) | text_entities

                # Calculate overlap
                current_set = set(e.lower() for e in current_entities)
                if not current_set:
                    continue

                overlap = len(current_set & all_stored) / len(current_set)

                if overlap >= self.entity_overlap_threshold:
                    synthesis["entity_overlap"] = overlap
                    synthesis["matching_entities"] = list(current_set & all_stored)
                    related.append(synthesis)

            # Sort by overlap score
            related.sort(key=lambda x: x.get("entity_overlap", 0), reverse=True)

            logger.info(f"Entity fallback found {len(related[:limit])} related syntheses (threshold: {self.entity_overlap_threshold})")
            return related[:limit]

        except Exception as e:
            logger.error(f"Entity fallback search failed: {e}")
            return []

    def find_related_by_keywords(
        self,
        cluster_articles: List[Dict[str, Any]],
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Fallback: Find related syntheses by title keywords.

        Args:
            cluster_articles: Articles in current cluster
            limit: Max number of related syntheses to return

        Returns:
            List of related synthesis dictionaries
        """
        if not self.qdrant_service:
            return []

        try:
            # Extract keywords from cluster titles
            titles = [a.get("raw_title", "") for a in cluster_articles]
            combined_title = " ".join(titles).lower()

            # Simple keyword extraction (nouns and proper nouns typically)
            # Skip common words
            stopwords = {"le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "a", "au", "aux",
                        "pour", "par", "sur", "dans", "avec", "ce", "cette", "ces", "son", "sa", "ses",
                        "the", "a", "an", "of", "to", "in", "for", "on", "with", "is", "are", "was", "were"}

            words = combined_title.split()
            keywords = [w for w in words if len(w) > 3 and w not in stopwords]

            if not keywords:
                return []

            # Get recent syntheses and check keyword matches
            recent_syntheses = self.qdrant_service.get_live_syntheses(hours=168, limit=100)

            related = []
            for synthesis in recent_syntheses:
                synthesis_text = f"{synthesis.get('title', '')} {synthesis.get('summary', '')}".lower()

                # Count keyword matches
                matches = sum(1 for kw in keywords if kw in synthesis_text)
                if matches >= 2:  # At least 2 keyword matches
                    synthesis["keyword_matches"] = matches
                    related.append(synthesis)

            # Sort by match count
            related.sort(key=lambda x: x.get("keyword_matches", 0), reverse=True)

            logger.info(f"Keyword fallback found {len(related[:limit])} related syntheses")
            return related[:limit]

        except Exception as e:
            logger.error(f"Keyword fallback search failed: {e}")
            return []

    def build_timeline(
        self,
        related_syntheses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Build a chronological timeline from related syntheses.

        Args:
            related_syntheses: List of related synthesis dictionaries

        Returns:
            Sorted timeline of events with dates and summaries
        """
        timeline = []

        for synthesis in related_syntheses:
            created_at = synthesis.get('created_at', 0)
            if isinstance(created_at, (int, float)) and created_at > 0:
                try:
                    date = datetime.fromtimestamp(created_at)
                except:
                    date = datetime.now()
            else:
                date = datetime.now()

            timeline.append({
                'date': date.isoformat(),
                'date_obj': date,
                'title': synthesis.get('title', ''),
                'summary': synthesis.get('introduction', synthesis.get('summary', ''))[:200],
                'key_points': synthesis.get('keyPoints', [])[:3],
                'synthesis_id': synthesis.get('id', ''),
                'similarity': synthesis.get('similarity_score', 0)
            })

        # Sort by date
        timeline.sort(key=lambda x: x['date_obj'])

        # Remove date_obj (not JSON serializable)
        for event in timeline:
            del event['date_obj']

        return timeline

    def track_entity_evolution(
        self,
        related_syntheses: List[Dict[str, Any]],
        current_entities: List[str]
    ) -> Dict[str, List[str]]:
        """
        Track how entities have been mentioned across syntheses.

        Args:
            related_syntheses: Historical syntheses
            current_entities: Entities from current cluster

        Returns:
            Dict mapping entities to their historical mentions
        """
        entity_history = {}

        for entity in current_entities:
            entity_lower = entity.lower()
            mentions = []

            for synthesis in related_syntheses:
                # Check if entity appears in synthesis text
                full_text = f"{synthesis.get('title', '')} {synthesis.get('summary', '')}".lower()
                if entity_lower in full_text:
                    created_at = synthesis.get('created_at', 0)
                    if isinstance(created_at, (int, float)) and created_at > 0:
                        try:
                            date = datetime.fromtimestamp(created_at).strftime('%d/%m')
                        except:
                            date = "?"
                    else:
                        date = "?"

                    # Extract context around entity mention
                    mentions.append(f"[{date}] {synthesis.get('title', '')[:50]}")

            if mentions:
                entity_history[entity] = mentions

        return entity_history

    def detect_narrative_arc(
        self,
        timeline: List[Dict[str, Any]],
        current_article_count: int
    ) -> str:
        """
        Detect the current phase of the story's narrative arc.

        Phases:
        - emerging: New story, first synthesis
        - developing: Story gaining traction, multiple updates
        - peak: Maximum coverage/interest
        - declining: Fewer updates, story winding down
        - resolved: Story concluded or stable

        Args:
            timeline: Historical timeline
            current_article_count: Number of articles in current cluster

        Returns:
            Narrative arc phase string
        """
        if len(timeline) == 0:
            return "emerging"

        if len(timeline) == 1:
            return "developing"

        # Analyze timeline patterns
        recent_count = len(timeline)

        # Check time gaps
        if len(timeline) >= 2:
            # Get last update time
            try:
                last_date = datetime.fromisoformat(timeline[-1]['date'])
                days_since_last = (datetime.now() - last_date).days

                if days_since_last > 3 and current_article_count < 3:
                    return "declining"

                if days_since_last > 7:
                    return "resolved"
            except:
                pass

        # If we have many updates recently, it's at peak
        if recent_count >= 4 and current_article_count >= 5:
            return "peak"

        # Default to developing
        return "developing"

    def extract_previous_key_points(
        self,
        related_syntheses: List[Dict[str, Any]],
        max_points: int = 10
    ) -> List[str]:
        """
        Extract key points from previous syntheses for context.

        Args:
            related_syntheses: Historical syntheses
            max_points: Maximum points to extract

        Returns:
            List of key points from history
        """
        all_points = []

        # Sort by date (most recent first)
        sorted_syntheses = sorted(
            related_syntheses,
            key=lambda x: x.get('created_at', 0),
            reverse=True
        )

        for synthesis in sorted_syntheses:
            key_points = synthesis.get('keyPoints', [])
            if isinstance(key_points, str):
                key_points = [k.strip() for k in key_points.split('|') if k.strip()]

            for point in key_points:
                if point not in all_points:
                    all_points.append(point)

                if len(all_points) >= max_points:
                    break

            if len(all_points) >= max_points:
                break

        return all_points

    def build_historical_context(
        self,
        cluster_articles: List[Dict[str, Any]],
        current_entities: List[str] = None
    ) -> HistoricalContext:
        """
        Build complete historical context for synthesis enrichment.

        Args:
            cluster_articles: Current cluster articles
            current_entities: Entities extracted from current cluster

        Returns:
            HistoricalContext object with all historical data
        """
        # Find related syntheses via semantic search
        related = self.find_related_syntheses(cluster_articles)

        # Fallback 1: Entity-based search if semantic search found few results
        entities = current_entities or []
        if len(related) < 2 and entities:
            logger.info(f"Semantic search found {len(related)} results, trying entity fallback...")
            entity_related = self.find_related_by_entities(entities, limit=5)
            # Merge, avoiding duplicates
            existing_ids = {str(r.get('id', '')) for r in related}
            for er in entity_related:
                if str(er.get('id', '')) not in existing_ids:
                    related.append(er)

        # Fallback 2: Keyword-based search if still not enough
        if len(related) < 2:
            logger.info(f"Still only {len(related)} results, trying keyword fallback...")
            keyword_related = self.find_related_by_keywords(cluster_articles, limit=5)
            existing_ids = {str(r.get('id', '')) for r in related}
            for kr in keyword_related:
                if str(kr.get('id', '')) not in existing_ids:
                    related.append(kr)

        if not related:
            # No history found even with fallbacks
            return HistoricalContext(
                related_syntheses=[],
                timeline_events=[],
                entity_evolution={},
                previous_key_points=[],
                narrative_arc="emerging",
                days_tracked=0,
                contradiction_history=[]
            )

        # Build timeline
        timeline = self.build_timeline(related)

        # Track entities
        entities = current_entities or []
        entity_evolution = self.track_entity_evolution(related, entities)

        # Detect arc
        narrative_arc = self.detect_narrative_arc(timeline, len(cluster_articles))

        # Extract previous key points
        previous_points = self.extract_previous_key_points(related)

        # Calculate days tracked
        days_tracked = 0
        if timeline:
            try:
                first_date = datetime.fromisoformat(timeline[0]['date'])
                days_tracked = (datetime.now() - first_date).days
            except:
                pass

        # Extract contradiction history (if stored)
        contradiction_history = []
        for synthesis in related:
            if synthesis.get('hasContradictions') or synthesis.get('contradictions_count', 0) > 0:
                contradiction_history.append({
                    'date': synthesis.get('created_at', 0),
                    'title': synthesis.get('title', ''),
                    'count': synthesis.get('contradictions_count', 0)
                })

        return HistoricalContext(
            related_syntheses=related,
            timeline_events=timeline,
            entity_evolution=entity_evolution,
            previous_key_points=previous_points,
            narrative_arc=narrative_arc,
            days_tracked=days_tracked,
            contradiction_history=contradiction_history
        )

    def format_context_for_llm(
        self,
        historical_context: HistoricalContext
    ) -> str:
        """
        Format historical context as text for LLM prompt.

        Args:
            historical_context: HistoricalContext object

        Returns:
            Formatted string for LLM prompt
        """
        if not historical_context.related_syntheses:
            return ""

        sections = []

        # Header
        sections.append(f"""
╔══════════════════════════════════════════════════════════════╗
║  📜 CONTEXTE HISTORIQUE - {historical_context.days_tracked} jour(s) de suivi
║  Phase narrative: {historical_context.narrative_arc.upper()}
╚══════════════════════════════════════════════════════════════╝
""")

        # Timeline
        if historical_context.timeline_events:
            sections.append("📅 CHRONOLOGIE DE L'AFFAIRE:")
            for event in historical_context.timeline_events[-5:]:  # Last 5 events
                sections.append(f"  • [{event['date'][:10]}] {event['title']}")
            sections.append("")

        # Previous key points
        if historical_context.previous_key_points:
            sections.append("📌 POINTS CLÉS ÉTABLIS PRÉCÉDEMMENT:")
            for point in historical_context.previous_key_points[:5]:
                sections.append(f"  • {point}")
            sections.append("")

        # Entity evolution
        if historical_context.entity_evolution:
            sections.append("👤 ÉVOLUTION DES ACTEURS CLÉS:")
            for entity, mentions in list(historical_context.entity_evolution.items())[:5]:
                sections.append(f"  • {entity}: {', '.join(mentions[:3])}")
            sections.append("")

        # Contradiction history
        if historical_context.contradiction_history:
            sections.append("⚠️ HISTORIQUE DES CONTRADICTIONS:")
            for c in historical_context.contradiction_history[-3:]:
                sections.append(f"  • {c['title'][:50]}... ({c['count']} contradiction(s))")
            sections.append("")

        # Narrative guidance based on arc
        arc_guidance = {
            "emerging": "C'est une NOUVELLE HISTOIRE. Présente les faits de base clairement.",
            "developing": "Histoire EN DÉVELOPPEMENT. Montre l'évolution depuis les premiers éléments.",
            "peak": "Histoire à son APOGÉE. Synthétise tous les aspects et enjeux.",
            "declining": "Histoire en DÉCLIN. Résume ce qui s'est passé et les conclusions.",
            "resolved": "Histoire RÉSOLUE. Récapitule le dénouement et les leçons."
        }

        sections.append(f"📝 CONSIGNE NARRATIVE: {arc_guidance.get(historical_context.narrative_arc, '')}")

        return "\n".join(sections)


# Global instance
temporal_narrative_engine = TemporalNarrativeEngine()


def get_temporal_narrative_engine() -> TemporalNarrativeEngine:
    """Dependency injection"""
    return temporal_narrative_engine
