"""
Topic Tracker
Phase 7: Detects and manages recurring topics across syntheses.
A topic is considered "recurring" when it appears in 3+ syntheses.
"""
from typing import List, Dict, Optional, Union
from datetime import datetime, timedelta
from collections import defaultdict
import json
import re
from loguru import logger

from app.db.qdrant_client import get_qdrant_service
from app.ml.stop_words import is_valid_entity, normalize_entity


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


def _safe_timestamp(created_at) -> float:
    """Convert created_at to a float timestamp, regardless of format."""
    if not created_at:
        return 0.0
    if isinstance(created_at, (int, float)):
        return float(created_at)
    # Try ISO string
    try:
        dt = datetime.fromisoformat(str(created_at).replace('Z', '+00:00'))
        return dt.timestamp()
    except (ValueError, TypeError):
        return 0.0


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
            # Get ALL recent syntheses (no limit) via full scroll
            syntheses = self._get_all_syntheses(days=days)

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
                logger.warning(
                    f"Topic dashboard '{topic_name}': found {len(syntheses) if syntheses else 0} syntheses "
                    f"(need {self.RECURRENCE_THRESHOLD}+)"
                )
                return None

            # Sort by date
            syntheses.sort(
                key=lambda x: x.get('created_at', ''),
                reverse=True
            )

            # Compute extra KPIs
            # Duration in days since first synthesis
            timestamps = []
            for s in syntheses:
                ts = s.get('created_at')
                if isinstance(ts, (int, float)) and ts > 0:
                    timestamps.append(ts)
            duration_days = 0
            first_date_iso = ""
            if timestamps:
                from datetime import datetime as dt
                earliest = min(timestamps)
                latest = max(timestamps)
                duration_days = max(1, int((latest - earliest) / 86400))
                try:
                    first_date_iso = dt.fromtimestamp(earliest).isoformat()
                except (ValueError, TypeError, OSError):
                    first_date_iso = ""

            # Average transparency score
            transparency_scores = [
                s.get('transparency_score', 0) for s in syntheses
                if s.get('transparency_score') is not None and s.get('transparency_score', 0) > 0
            ]
            transparency_avg = round(sum(transparency_scores) / len(transparency_scores), 1) if transparency_scores else 0

            # Total unique sources across all syntheses
            all_source_names = set()
            for s in syntheses:
                src_articles = s.get('source_articles', [])
                if isinstance(src_articles, list):
                    for src in src_articles:
                        if isinstance(src, dict) and src.get('name'):
                            all_source_names.add(src['name'])
                # Also count from num_sources field
                sources_list = s.get('sources', [])
                if isinstance(sources_list, list):
                    for sn in sources_list:
                        if isinstance(sn, str) and sn:
                            all_source_names.add(sn)
            sources_total = len(all_source_names)

            # Sentiment evolution for enriched KPIs
            sentiment_evolution = self._build_sentiment_evolution(syntheses)

            # Aggregate data
            dashboard = {
                "topic": topic_name,
                "synthesis_count": len(syntheses),
                "duration_days": duration_days,
                "first_date": first_date_iso,
                "transparency_avg": transparency_avg,
                "sources_total": sources_total,
                "syntheses": [
                    {
                        "id": s.get('id', s.get('synthesis_id', '')),
                        "title": s.get('title', ''),
                        "date": _safe_date_str(s.get('created_at')),
                        "category": s.get('category', 'MONDE'),
                        "summary": s.get('summary', '')[:200] + '...' if len(s.get('summary', '')) > 200 else s.get('summary', ''),
                        "sentiment": s.get('sentiment', 'neutral'),
                        "num_sources": s.get('num_sources', 0),
                        "transparency_score": s.get('transparency_score', 0),
                    }
                    for s in syntheses
                ],
                "aggregated_causal_graph": self._aggregate_causal_graphs(syntheses),
                "sentiment_evolution": sentiment_evolution,
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

        Priority:
        1. Look up the LLM-generated topic name in novapress_topics (best quality)
        2. Fall back to keyword-based matching + optional LLM naming

        Returns topic info if synthesis is part of a recurring topic.
        """
        if not self.qdrant:
            return None

        try:
            # 1. Check stored topics first (LLM-generated names from topic_detection.py)
            stored_topic = self.qdrant.find_topic_for_synthesis(synthesis_id)
            if stored_topic and stored_topic.get("name"):
                topic_name = stored_topic["name"]
                mention_count = stored_topic.get("mention_count", 0)
                syn_ids = stored_topic.get("synthesis_ids", [])
                return {
                    "topic_name": topic_name,
                    "synthesis_count": mention_count or len(syn_ids),
                    "is_recurring": True,
                    "related_ids": [
                        sid for sid in syn_ids
                        if sid != synthesis_id
                    ][:5]
                }

            # 2. Fallback: keyword-based search
            synthesis = self.qdrant.get_synthesis_by_id(synthesis_id)
            if not synthesis:
                return None

            central = self._get_central_topic(synthesis)
            if not central:
                return None

            # Search for related syntheses
            related = await self._search_syntheses_by_topic(central)

            if len(related) >= self.RECURRENCE_THRESHOLD:
                # Try to generate a smarter topic name via LLM
                topic_name = await self._generate_smart_topic_name(
                    related, synthesis
                )
                return {
                    "topic_name": topic_name or central,
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

    async def _generate_smart_topic_name(
        self,
        related_syntheses: List[Dict],
        current_synthesis: Dict
    ) -> Optional[str]:
        """
        Generate an editorial-quality topic name using LLM.
        Falls back to the central entity if LLM is unavailable.
        """
        try:
            from app.ml.llm import llm_service
            if not llm_service or not hasattr(llm_service, 'generate_raw'):
                return None

            titles = [s.get('title', '') for s in related_syntheses[:8] if s.get('title')]
            if not titles:
                return None

            category = current_synthesis.get('category', 'MONDE')
            titles_text = "\n".join(f"- {t}" for t in titles)

            prompt = f"""Tu es editeur en chef d'un grand journal. A partir de ces titres de syntheses liees, genere UN nom de dossier/theme journalistique.

Categorie : {category}
Date : mars 2026

Titres :
{titles_text}

REGLES :
- 3 a 7 mots maximum
- Style Le Monde / New York Times (ex: "Midterms Texas 2026", "Crise du Logement en France", "Course a l'IA Generative")
- Utilise des noms propres, lieux, evenements concrets
- JAMAIS de mots generiques seuls (pas "Politique", "Democratic", "Retour", "International")
- Pas de guillemets dans la reponse

Reponds UNIQUEMENT avec le nom du theme, rien d'autre."""

            response = await llm_service.generate_raw(prompt, max_tokens=50)
            if response:
                # Clean the response
                name = response.strip().strip('"').strip("'").strip()
                # Validate: reject if too short or looks like a single generic word
                if len(name) > 3 and ' ' in name:
                    return name
                # Also accept proper nouns (capitalized single words longer than 5 chars)
                if len(name) > 5 and name[0].isupper():
                    return name

        except Exception as e:
            logger.debug(f"Smart topic name generation failed: {e}")

        return None

    # ==========================================
    # Private Helper Methods
    # ==========================================

    def _get_central_topic(self, synthesis: Dict) -> Optional[str]:
        """Extract central topic from synthesis."""
        import re as _re

        # 1. Try causal graph's central entity (validate it)
        causal_graph = synthesis.get('causal_graph', {})
        if isinstance(causal_graph, str):
            try:
                causal_graph = json.loads(causal_graph)
            except (json.JSONDecodeError, ValueError, TypeError):
                causal_graph = {}

        central = causal_graph.get('central_entity')
        if central and is_valid_entity(central):
            return normalize_entity(central)

        # 2. First valid key entity
        key_entities = self._extract_key_entities(synthesis)
        if key_entities:
            return key_entities[0]

        # 3. Extract proper noun phrases from title (multi-word capitalized sequences)
        title = synthesis.get('title', '')
        proper_phrases = _re.findall(
            r'[A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)+', title
        )
        if proper_phrases:
            # Pick the longest proper phrase
            best = max(proper_phrases, key=len)
            if is_valid_entity(best):
                return normalize_entity(best)

        # 4. Return None rather than garbage words
        return None

    def _extract_key_entities(self, synthesis: Dict) -> List[str]:
        """Extract key entity names from synthesis, filtered through stop words."""
        key_entities = synthesis.get('key_entities', [])

        # Parse string to list if stored as comma-separated string
        if isinstance(key_entities, str):
            key_entities = [e.strip() for e in key_entities.split(",") if e.strip()]

        raw_names = []

        for entity in key_entities:
            if isinstance(entity, dict):
                name = entity.get('name', '')
                if entity.get('type') in ('PERSON', 'ORG', 'GPE'):
                    raw_names.append(name)
            elif isinstance(entity, (list, tuple)) and len(entity) >= 2:
                name, ent_type = entity[0], entity[1]
                if ent_type in ('PERSON', 'ORG', 'GPE'):
                    raw_names.append(name)
            elif isinstance(entity, str):
                raw_names.append(entity)

        # Filter and normalize through stop_words module
        entities = [
            normalize_entity(e) for e in raw_names
            if is_valid_entity(e)
        ]

        return entities[:10]

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
            "is_active": self._is_topic_active(syntheses),
            "is_hot": self._is_topic_active(syntheses),
            "last_update": syntheses[0].get('created_at', '') if syntheses else ''
        }

    def _get_all_syntheses(self, days: int = 90) -> List[Dict]:
        """
        Get ALL syntheses from the last N days using Qdrant scroll pagination.
        Unlike get_live_syntheses (limited to ~200), this fetches everything.
        """
        if not self.qdrant or not self.qdrant.client:
            return []

        try:
            from qdrant_client.models import Filter, FieldCondition, Range

            cutoff_time = (datetime.now() - timedelta(days=days)).timestamp()
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="created_at",
                        range=Range(gte=cutoff_time)
                    )
                ]
            )

            all_points = []
            offset = None
            batch_size = 256

            while True:
                points, next_offset = self.qdrant.client.scroll(
                    collection_name=self.qdrant.syntheses_collection,
                    scroll_filter=query_filter,
                    limit=batch_size,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False
                )

                for point in points:
                    synthesis = dict(point.payload or {})
                    synthesis["id"] = str(point.id)
                    # Parse key_points
                    kp_str = synthesis.get("key_points", "")
                    if kp_str and isinstance(kp_str, str):
                        synthesis["keyPoints"] = [k.strip() for k in kp_str.split("|") if k.strip()]
                    else:
                        synthesis["keyPoints"] = []
                    all_points.append(synthesis)

                if next_offset is None or len(points) < batch_size:
                    break
                offset = next_offset

            logger.info(f"TopicTracker: fetched {len(all_points)} syntheses from last {days} days")
            return all_points

        except Exception as e:
            logger.error(f"TopicTracker: failed to fetch all syntheses: {e}")
            return []

    def _topic_matches(self, topic_lower: str, text: str) -> bool:
        """
        Check if topic matches text using word-boundary aware matching.
        Handles both substring and word-level matching.
        """
        text_lower = text.lower()

        # Direct substring match (handles "iran" in "l'iran", "iranien", etc.)
        if topic_lower in text_lower:
            return True

        # For multi-word topics, check if ALL words appear in the text
        topic_words = topic_lower.split()
        if len(topic_words) > 1:
            return all(w in text_lower for w in topic_words)

        return False

    async def _search_syntheses_by_topic(
        self,
        topic_name: str
    ) -> List[Dict]:
        """
        Search for syntheses related to a topic.
        Uses full Qdrant scroll (no limit) + multi-field matching.
        """
        if not self.qdrant:
            return []

        topic_lower = topic_name.lower().strip()
        if not topic_lower:
            return []

        # Get ALL syntheses from last 90 days (no 200 limit)
        recent = self._get_all_syntheses(days=90)
        logger.info(f"TopicTracker: searching '{topic_name}' across {len(recent)} syntheses")

        seen_ids = set()
        matched = []

        for s in recent:
            sid = s.get('id', s.get('synthesis_id', ''))
            if not sid or sid in seen_ids:
                continue

            # Check title
            title = s.get('title', '')
            if self._topic_matches(topic_lower, title):
                seen_ids.add(sid)
                matched.append(s)
                continue

            # Check summary (first 500 chars)
            summary = s.get('summary', '')[:500]
            if self._topic_matches(topic_lower, summary):
                seen_ids.add(sid)
                matched.append(s)
                continue

            # Check central entity
            central = self._get_central_topic(s)
            if central and self._topic_matches(topic_lower, central):
                seen_ids.add(sid)
                matched.append(s)
                continue

            # Check key entities
            key_entities = self._extract_key_entities(s)
            for entity in key_entities:
                if self._topic_matches(topic_lower, entity):
                    seen_ids.add(sid)
                    matched.append(s)
                    break

        logger.info(f"TopicTracker: found {len(matched)} syntheses matching '{topic_name}'")
        return matched

    def _normalize_label(self, text: str) -> str:
        """Normalize label for deduplication — ignores articles, case, minor diffs."""
        t = text.lower().strip()
        for article in ['le ', 'la ', 'les ', "l'", 'un ', 'une ', 'des ', 'du ', 'de ',
                         'the ', 'a ', 'an ']:
            if t.startswith(article):
                t = t[len(article):]
        t = re.sub(r'[^\w\s]', '', t)
        t = ' '.join(t.split())
        return t[:50]

    def _aggregate_causal_graphs(self, syntheses: List[Dict]) -> Dict:
        """Aggregate causal graphs from multiple syntheses with deduplication."""
        # Collect all raw edges with synthesis tracking
        raw_edges = []
        for s in syntheses:
            sid = s.get('id', '')
            causal_graph = s.get('causal_graph', {})
            if isinstance(causal_graph, str):
                try:
                    causal_graph = json.loads(causal_graph)
                except (json.JSONDecodeError, ValueError, TypeError):
                    continue

            for edge in causal_graph.get('edges', []):
                cause = edge.get('cause_text', '')
                effect = edge.get('effect_text', '')
                if cause and effect:
                    raw_edges.append({**edge, '_synthesis_id': sid})

        # Build canonical label mapping via normalization
        norm_to_canonical: Dict[str, str] = {}  # normalized → shortest raw label
        for edge in raw_edges:
            for text in [edge.get('cause_text', ''), edge.get('effect_text', '')]:
                if not text:
                    continue
                norm = self._normalize_label(text)
                if norm not in norm_to_canonical or len(text) < len(norm_to_canonical[norm]):
                    norm_to_canonical[norm] = text

        def canonicalize(text: str) -> str:
            return norm_to_canonical.get(self._normalize_label(text), text)

        # Remap edges to canonical labels and deduplicate
        edge_map: Dict[str, Dict] = {}  # "cause_effect" → merged edge
        for edge in raw_edges:
            cause = canonicalize(edge.get('cause_text', ''))
            effect = canonicalize(edge.get('effect_text', ''))
            if cause == effect:
                continue
            edge_key = f"{cause}_{effect}"
            sid = edge.get('_synthesis_id', '')
            if edge_key in edge_map:
                existing = edge_map[edge_key]
                existing['mention_count'] = existing.get('mention_count', 1) + 1
                if sid and sid not in existing.get('source_syntheses', []):
                    existing.setdefault('source_syntheses', []).append(sid)
                # Keep highest confidence
                existing['confidence'] = max(
                    existing.get('confidence', 0.5),
                    edge.get('confidence', 0.5)
                )
            else:
                edge_map[edge_key] = {
                    'cause_text': cause,
                    'effect_text': effect,
                    'relation_type': edge.get('relation_type', 'causes'),
                    'confidence': edge.get('confidence', 0.5),
                    'mention_count': 1,
                    'source_syntheses': [sid] if sid else [],
                }

        all_edges = list(edge_map.values())

        # Build unique nodes from edges with mention_count
        node_mentions: Dict[str, int] = {}  # label → count
        node_syntheses: Dict[str, set] = {}  # label → synthesis ids
        for edge in all_edges:
            for text in [edge['cause_text'], edge['effect_text']]:
                node_mentions[text] = node_mentions.get(text, 0) + edge.get('mention_count', 1)
                for sid in edge.get('source_syntheses', []):
                    node_syntheses.setdefault(text, set()).add(sid)

        # Remove isolated nodes (0 edges) — impossible here since built from edges
        all_nodes = []
        for idx, label in enumerate(node_mentions.keys()):
            all_nodes.append({
                "id": f"agg_node_{idx}",
                "label": label,
                "node_type": "event",
                "fact_density": 0.6,
                "mention_count": node_mentions[label],
                "source_syntheses": list(node_syntheses.get(label, set())),
            })

        # Sort nodes by mention_count (most referenced first) and cap
        all_nodes.sort(key=lambda n: n.get('mention_count', 0), reverse=True)
        capped_nodes = all_nodes[:25]
        kept_labels = {n['label'] for n in capped_nodes}
        all_edges = [e for e in all_edges if e['cause_text'] in kept_labels and e['effect_text'] in kept_labels]

        return {
            "nodes": capped_nodes,
            "edges": all_edges[:50],
            "total_nodes": len(capped_nodes),
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

    def _is_recent(self, created_at, days: int = 7) -> bool:
        """Check if date is within N days. Handles Unix timestamps and ISO strings."""
        if not created_at:
            return False
        try:
            ts = _safe_timestamp(created_at)
            if ts <= 0:
                return False
            cutoff = (datetime.now() - timedelta(days=days)).timestamp()
            return ts > cutoff
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
