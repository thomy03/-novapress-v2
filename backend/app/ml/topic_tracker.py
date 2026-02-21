"""
Topic Tracker
Phase 7: Detects and manages recurring topics across syntheses.
A topic is considered "recurring" when it appears in 3+ syntheses.
"""
from typing import List, Dict, Optional, Tuple, Union
from datetime import datetime, timedelta
from collections import defaultdict
import json
from loguru import logger

from app.db.qdrant_client import get_qdrant_service


def _safe_date_str(created_at: Union[str, float, int, None]) -> str:
    """
    Safely convert created_at (float timestamp or string) to date string YYYY-MM-DD.
    Handles both Unix timestamps (float) and ISO strings.
    """
    if not created_at:
        return ''
    if isinstance(created_at, (int, float)):
        try:
            return datetime.fromtimestamp(created_at).strftime('%Y-%m-%d')
        except (ValueError, OSError):
            return ''
    # Assume it's a string
    return str(created_at)[:10]


class TopicTracker:
    """
    Tracks recurring topics across syntheses.
    Topics are identified by:
    - Central entity (most connected node in causal graph)
    - Key entities that appear frequently together
    - Similar titles (semantic similarity)
    """

    RECURRENCE_THRESHOLD = 3  # Minimum syntheses for a topic to be "recurring"
    SIMILARITY_THRESHOLD = 0.60  # Minimum similarity for related syntheses

    def __init__(self):
        self.qdrant = get_qdrant_service()

    async def detect_recurring_topics(
        self,
        days: int = 30,
        limit: int = 20
    ) -> List[Dict]:
        """
        Detect topics that recur across multiple syntheses.

        Returns list of topics with:
        - topic_name: Central theme/entity
        - synthesis_count: Number of syntheses
        - syntheses: List of synthesis summaries
        - key_entities: Common entities
        - narrative_arc: emerging/developing/peak/declining
        - is_hot: True if recent activity
        """
        if not self.qdrant:
            logger.warning("Qdrant service not available")
            return []

        try:
            # Get recent syntheses
            syntheses = self.qdrant.get_live_syntheses(
                hours=days * 24,
                limit=500  # Get many to find patterns
            )

            if not syntheses:
                return []

            # Group syntheses by central entity
            entity_groups = defaultdict(list)

            for s in syntheses:
                # Get central entity from causal graph or title
                central = self._get_central_topic(s)
                if central:
                    entity_groups[central.lower()].append(s)

            # Also group by shared key entities
            entity_cooccurrence = defaultdict(list)
            for s in syntheses:
                key_entities = self._extract_key_entities(s)
                for entity in key_entities:
                    entity_cooccurrence[entity.lower()].append(s)

            # Merge groups that share significant overlap
            merged_topics = self._merge_overlapping_groups(
                entity_groups, entity_cooccurrence
            )

            # Filter to recurring topics only
            recurring = []
            for topic_name, topic_syntheses in merged_topics.items():
                if len(topic_syntheses) >= self.RECURRENCE_THRESHOLD:
                    # Deduplicate syntheses by ID
                    unique_syntheses = {}
                    for s in topic_syntheses:
                        sid = s.get('id', s.get('synthesis_id', ''))
                        if sid and sid not in unique_syntheses:
                            unique_syntheses[sid] = s

                    if len(unique_syntheses) >= self.RECURRENCE_THRESHOLD:
                        topic_data = self._build_topic_data(
                            topic_name,
                            list(unique_syntheses.values())
                        )
                        recurring.append(topic_data)

            # Sort by synthesis count (most recurring first)
            recurring.sort(key=lambda x: x['synthesis_count'], reverse=True)

            return recurring[:limit]

        except Exception as e:
            logger.error(f"Error detecting recurring topics: {e}")
            return []

    async def get_topic_dashboard(self, topic_name: str) -> Optional[Dict]:
        """
        Get full dashboard data for a specific recurring topic.

        Returns:
        - topic: Topic name
        - synthesis_count: Number of syntheses
        - syntheses: Full list with details
        - aggregated_causal_graph: Merged causal graph from all syntheses
        - sentiment_evolution: Timeline of sentiment
        - key_entities: Entities with stats
        - predictions_summary: Aggregated predictions
        - geo_focus: Geographic mentions
        """
        if not self.qdrant:
            return None

        try:
            # Search for syntheses related to this topic
            syntheses = await self._search_syntheses_by_topic(topic_name)

            if not syntheses or len(syntheses) < self.RECURRENCE_THRESHOLD:
                return None

            # Sort by date
            syntheses.sort(
                key=lambda x: x.get('created_at', ''),
                reverse=True
            )

            # Aggregate data
            dashboard = {
                "topic": topic_name,
                "synthesis_count": len(syntheses),
                "syntheses": [
                    {
                        "id": s.get('id', s.get('synthesis_id', '')),
                        "title": s.get('title', ''),
                        "date": _safe_date_str(s.get('created_at')),
                        "category": s.get('category', 'MONDE'),
                        "summary": s.get('summary', '')[:200] + '...' if len(s.get('summary', '')) > 200 else s.get('summary', '')
                    }
                    for s in syntheses
                ],
                "aggregated_causal_graph": self._aggregate_causal_graphs(syntheses),
                "sentiment_evolution": self._build_sentiment_evolution(syntheses),
                "key_entities": self._aggregate_key_entities(syntheses),
                "predictions_summary": self._aggregate_predictions(syntheses),
                "geo_focus": self._aggregate_geo_mentions(syntheses),
                "narrative_arc": self._determine_narrative_arc(syntheses),
                "is_active": self._is_topic_active(syntheses)
            }

            return dashboard

        except Exception as e:
            logger.error(f"Error building topic dashboard: {e}")
            return None

    async def check_topic_recurrence(self, synthesis_id: str) -> Optional[Dict]:
        """
        Check if a synthesis belongs to a recurring topic.

        Returns topic info if synthesis is part of a recurring topic.
        """
        if not self.qdrant:
            return None

        try:
            synthesis = self.qdrant.get_synthesis_by_id(synthesis_id)
            if not synthesis:
                return None

            # Get central topic
            central = self._get_central_topic(synthesis)
            if not central:
                return None

            # Search for related syntheses
            related = await self._search_syntheses_by_topic(central)

            if len(related) >= self.RECURRENCE_THRESHOLD:
                return {
                    "topic_name": central,
                    "synthesis_count": len(related),
                    "is_recurring": True,
                    "related_ids": [
                        s.get('id', s.get('synthesis_id', ''))
                        for s in related
                        if s.get('id') != synthesis_id
                    ][:5]
                }

            return None

        except Exception as e:
            logger.error(f"Error checking topic recurrence: {e}")
            return None

    # ==========================================
    # Private Helper Methods
    # ==========================================

    def _get_central_topic(self, synthesis: Dict) -> Optional[str]:
        """Extract central topic from synthesis."""
        # Try causal graph's central entity
        causal_graph = synthesis.get('causal_graph', {})
        if isinstance(causal_graph, str):
            try:
                causal_graph = json.loads(causal_graph)
            except (json.JSONDecodeError, ValueError, TypeError):
                causal_graph = {}

        central = causal_graph.get('central_entity')
        if central and len(central) > 2:
            return central

        # Try first key entity
        key_entities = self._extract_key_entities(synthesis)
        if key_entities:
            return key_entities[0]

        # Extract from title (first significant noun phrase)
        title = synthesis.get('title', '')
        if ':' in title:
            # Take part before colon as topic
            return title.split(':')[0].strip()

        # Take first 4-5 words as topic
        words = title.split()[:5]
        if words:
            return ' '.join(words)

        return None

    def _extract_key_entities(self, synthesis: Dict) -> List[str]:
        """Extract key entity names from synthesis."""
        key_entities = synthesis.get('key_entities', [])

        # Fix: Parse string to list if stored as comma-separated string
        # Filter out short entities like "le", "de", "un" (noise from NLP)
        if isinstance(key_entities, str):
            key_entities = [e.strip() for e in key_entities.split(",") if e.strip() and len(e.strip()) > 2]

        entities = []

        for entity in key_entities:
            if isinstance(entity, dict):
                name = entity.get('name', '')
                if entity.get('type') in ('PERSON', 'ORG', 'GPE'):
                    entities.append(name)
            elif isinstance(entity, (list, tuple)) and len(entity) >= 2:
                name, ent_type = entity[0], entity[1]
                if ent_type in ('PERSON', 'ORG', 'GPE'):
                    entities.append(name)
            elif isinstance(entity, str):
                entities.append(entity)

        return entities[:10]  # Limit to top 10

    def _merge_overlapping_groups(
        self,
        entity_groups: Dict[str, List],
        entity_cooccurrence: Dict[str, List]
    ) -> Dict[str, List]:
        """Merge groups that share significant synthesis overlap."""
        # Combine both sources
        all_groups = {}

        for name, synths in entity_groups.items():
            if name not in all_groups:
                all_groups[name] = []
            all_groups[name].extend(synths)

        for name, synths in entity_cooccurrence.items():
            if name not in all_groups:
                all_groups[name] = []
            all_groups[name].extend(synths)

        # Could add more sophisticated merging here
        # For now, just return combined groups
        return all_groups

    def _build_topic_data(
        self,
        topic_name: str,
        syntheses: List[Dict]
    ) -> Dict:
        """Build topic data structure."""
        # Sort by date
        syntheses.sort(
            key=lambda x: x.get('created_at', ''),
            reverse=True
        )

        return {
            "topic_name": topic_name.title(),
            "synthesis_count": len(syntheses),
            "syntheses": [
                {
                    "id": s.get('id', s.get('synthesis_id', '')),
                    "title": s.get('title', ''),
                    "date": _safe_date_str(s.get('created_at'))
                }
                for s in syntheses[:10]  # Limit to 10 most recent
            ],
            "key_entities": self._aggregate_key_entities(syntheses)[:5],
            "narrative_arc": self._determine_narrative_arc(syntheses),
            "is_hot": self._is_topic_active(syntheses),
            "last_update": syntheses[0].get('created_at', '') if syntheses else ''
        }

    async def _search_syntheses_by_topic(
        self,
        topic_name: str
    ) -> List[Dict]:
        """Search for syntheses related to a topic."""
        if not self.qdrant:
            return []

        # Get recent syntheses and filter by topic name
        all_syntheses = []
        topic_lower = topic_name.lower()

        # Get syntheses from last 30 days
        recent = self.qdrant.get_live_syntheses(hours=30*24, limit=200)

        for s in recent:
            # Check if topic appears in title
            title = s.get('title', '').lower()
            if topic_lower in title:
                all_syntheses.append(s)
                continue

            # Check if topic matches central entity
            central = self._get_central_topic(s)
            if central and topic_lower in central.lower():
                all_syntheses.append(s)
                continue

            # Check if topic is in key entities
            key_entities = self._extract_key_entities(s)
            for entity in key_entities:
                if topic_lower in entity.lower():
                    all_syntheses.append(s)
                    break

        # Deduplicate by ID
        unique = {}
        for s in all_syntheses:
            sid = s.get('id', s.get('synthesis_id', ''))
            if sid and sid not in unique:
                unique[sid] = s

        return list(unique.values())

    def _aggregate_causal_graphs(self, syntheses: List[Dict]) -> Dict:
        """Aggregate causal graphs from multiple syntheses."""
        all_nodes = []
        all_edges = []
        node_ids = set()
        edge_keys = set()

        for s in syntheses:
            causal_graph = s.get('causal_graph', {})
            if isinstance(causal_graph, str):
                try:
                    causal_graph = json.loads(causal_graph)
                except (json.JSONDecodeError, ValueError, TypeError):
                    continue

            for node in causal_graph.get('nodes', []):
                node_id = node.get('id', '')
                if node_id and node_id not in node_ids:
                    node_ids.add(node_id)
                    all_nodes.append(node)

            for edge in causal_graph.get('edges', []):
                edge_key = f"{edge.get('cause_text', '')}_{edge.get('effect_text', '')}"
                if edge_key not in edge_keys:
                    edge_keys.add(edge_key)
                    all_edges.append(edge)

        return {
            "nodes": all_nodes[:30],  # Limit for performance
            "edges": all_edges[:50],
            "total_nodes": len(all_nodes),
            "total_edges": len(all_edges)
        }

    def _build_sentiment_evolution(self, syntheses: List[Dict]) -> List[Dict]:
        """Build sentiment evolution timeline."""
        evolution = []

        for s in syntheses:
            date = _safe_date_str(s.get('created_at'))
            if not date:
                continue

            # Try to get sentiment from enrichment
            enrichment = s.get('enrichment', {})
            if isinstance(enrichment, str):
                try:
                    enrichment = json.loads(enrichment)
                except (json.JSONDecodeError, ValueError, TypeError):
                    enrichment = {}

            grok = enrichment.get('grok', {})
            sentiment_str = grok.get('sentiment', 'neutral')

            # Map to numeric
            sentiment_map = {
                "very_positive": 0.8,
                "positive": 0.4,
                "neutral": 0.0,
                "negative": -0.4,
                "very_negative": -0.8
            }
            sentiment = sentiment_map.get(sentiment_str, 0.0)

            evolution.append({
                "date": date,
                "sentiment": sentiment,
                "title": s.get('title', '')[:50]
            })

        # Sort by date
        evolution.sort(key=lambda x: x['date'])
        return evolution

    def _aggregate_key_entities(self, syntheses: List[Dict]) -> List[Dict]:
        """Aggregate key entities with counts."""
        entity_counts = defaultdict(lambda: {"count": 0, "type": "ENTITY"})

        for s in syntheses:
            for entity in self._extract_key_entities(s):
                entity_counts[entity]["count"] += 1
                # Get type if available
                key_entities = s.get('key_entities', [])
                # Fix: Parse string to list if stored as comma-separated string
                if isinstance(key_entities, str):
                    key_entities = [e.strip() for e in key_entities.split(",") if e.strip() and len(e.strip()) > 2]
                for ke in key_entities:
                    if isinstance(ke, dict) and ke.get('name') == entity:
                        entity_counts[entity]["type"] = ke.get('type', 'ENTITY')
                    elif isinstance(ke, (list, tuple)) and len(ke) >= 2 and ke[0] == entity:
                        entity_counts[entity]["type"] = ke[1]

        # Convert to list and sort
        entities = [
            {"name": name, "count": data["count"], "type": data["type"]}
            for name, data in entity_counts.items()
        ]
        entities.sort(key=lambda x: x["count"], reverse=True)

        return entities[:15]

    def _aggregate_predictions(self, syntheses: List[Dict]) -> List[Dict]:
        """Aggregate predictions from all syntheses."""
        predictions = []

        for s in syntheses:
            causal_graph = s.get('causal_graph', {})
            if isinstance(causal_graph, str):
                try:
                    causal_graph = json.loads(causal_graph)
                except (json.JSONDecodeError, ValueError, TypeError):
                    continue

            for pred in causal_graph.get('predictions', []):
                predictions.append({
                    **pred,
                    "synthesis_id": s.get('id', s.get('synthesis_id', '')),
                    "synthesis_date": _safe_date_str(s.get('created_at'))
                })

        # Sort by probability
        predictions.sort(key=lambda x: x.get('probability', 0), reverse=True)
        return predictions[:10]

    def _aggregate_geo_mentions(self, syntheses: List[Dict]) -> List[Dict]:
        """Aggregate geographic mentions."""
        geo_counts = defaultdict(int)

        for s in syntheses:
            key_entities = s.get('key_entities', [])
            # Fix: Parse string to list if stored as comma-separated string
            if isinstance(key_entities, str):
                key_entities = [e.strip() for e in key_entities.split(",") if e.strip() and len(e.strip()) > 2]
            for entity in key_entities:
                if isinstance(entity, dict):
                    if entity.get('type') in ('GPE', 'LOC'):
                        geo_counts[entity.get('name', '')] += 1
                elif isinstance(entity, (list, tuple)) and len(entity) >= 2:
                    if entity[1] in ('GPE', 'LOC'):
                        geo_counts[entity[0]] += 1

        # Convert to list
        mentions = [
            {"country": name, "count": count}
            for name, count in geo_counts.items()
            if name
        ]
        mentions.sort(key=lambda x: x["count"], reverse=True)

        return mentions[:10]

    def _determine_narrative_arc(self, syntheses: List[Dict]) -> str:
        """Determine narrative arc phase."""
        if not syntheses:
            return "emerging"

        # Sort by date
        syntheses.sort(key=lambda x: x.get('created_at', ''))

        count = len(syntheses)
        now = datetime.now()

        # Check recency of syntheses
        recent = sum(
            1 for s in syntheses
            if self._is_recent(s.get('created_at', ''), days=7)
        )

        if count <= 3:
            return "emerging"
        elif recent >= count * 0.5:
            return "peak"  # Many recent syntheses
        elif recent >= count * 0.2:
            return "developing"
        elif recent > 0:
            return "declining"
        else:
            return "resolved"

    def _is_topic_active(self, syntheses: List[Dict]) -> bool:
        """Check if topic has recent activity."""
        for s in syntheses:
            if self._is_recent(s.get('created_at', ''), days=3):
                return True
        return False

    def _is_recent(self, date_str: str, days: int = 7) -> bool:
        """Check if date is within N days."""
        if not date_str:
            return False
        try:
            date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            cutoff = datetime.now(date.tzinfo) - timedelta(days=days)
            return date > cutoff
        except (ValueError, TypeError, OSError):
            return False


# Singleton instance
_topic_tracker: Optional[TopicTracker] = None


def get_topic_tracker() -> TopicTracker:
    """Get topic tracker singleton."""
    global _topic_tracker
    if _topic_tracker is None:
        _topic_tracker = TopicTracker()
    return _topic_tracker
