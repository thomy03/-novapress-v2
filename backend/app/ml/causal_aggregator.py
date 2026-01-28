"""
Causal Aggregator Service for Intelligence Hub
Aggregates causal graphs across syntheses in a topic.
Handles node deduplication, edge merging, and timeline ordering.
"""
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import defaultdict
from datetime import datetime
import json
from loguru import logger


class CausalAggregator:
    """
    Aggregates causal graphs across multiple syntheses.
    Handles node deduplication, edge merging, and timeline ordering.
    """

    def __init__(self):
        self.entity_resolution = None
        self.qdrant_service = None

        # Matching thresholds
        self.node_similarity_threshold = 0.75  # For fuzzy node matching
        self.edge_merge_threshold = 0.80  # For merging similar edges

    async def initialize(self):
        """Initialize services"""
        try:
            from app.ml.entity_resolution import entity_resolution_service
            from app.db.qdrant_client import qdrant_service

            self.entity_resolution = entity_resolution_service
            self.qdrant_service = qdrant_service

            logger.success("✅ Causal Aggregator initialized")

        except Exception as e:
            logger.error(f"Failed to initialize Causal Aggregator: {e}")
            raise

    def aggregate_causal_graphs(
        self,
        synthesis_ids: List[str],
        include_timeline: bool = True
    ) -> Dict[str, Any]:
        """
        Merge causal graphs from multiple syntheses.

        Args:
            synthesis_ids: List of synthesis IDs to aggregate
            include_timeline: Whether to organize nodes into timeline layers

        Returns:
            Aggregated causal graph with:
            - nodes: Deduplicated nodes
            - edges: Merged edges with combined confidence
            - timeline_layers: Nodes grouped by time period
            - central_entities: Most connected entities
            - narrative_arc: Overall topic narrative
        """
        if not synthesis_ids:
            return self._empty_graph()

        # Collect all causal graphs
        all_nodes = []
        all_edges = []
        synthesis_timestamps = []

        for syn_id in synthesis_ids:
            synthesis = self.qdrant_service.get_synthesis_by_id(syn_id)
            if not synthesis:
                continue

            causal_graph = synthesis.get("causal_graph", {})
            if isinstance(causal_graph, str):
                try:
                    causal_graph = json.loads(causal_graph)
                except json.JSONDecodeError:
                    causal_graph = {}

            nodes = causal_graph.get("nodes", [])
            edges = causal_graph.get("edges", [])

            # Tag with synthesis info
            timestamp = synthesis.get("created_at", 0)
            synthesis_timestamps.append(timestamp)

            for node in nodes:
                node["source_synthesis_id"] = syn_id
                node["source_timestamp"] = timestamp
                all_nodes.append(node)

            for edge in edges:
                edge["source_synthesis_id"] = syn_id
                edge["source_timestamp"] = timestamp
                all_edges.append(edge)

        if not all_nodes and not all_edges:
            return self._empty_graph()

        # Deduplicate nodes
        merged_nodes, node_mapping = self._deduplicate_nodes(all_nodes)

        # Merge edges
        merged_edges = self._merge_edges(all_edges, node_mapping)

        # Identify central entities
        central_entities = self._identify_central_entities(merged_nodes, merged_edges)

        # Create timeline layers if requested
        timeline_layers = []
        if include_timeline and synthesis_timestamps:
            timeline_layers = self._create_timeline_layers(
                merged_nodes,
                merged_edges,
                synthesis_timestamps
            )

        # Determine overall narrative arc
        narrative_arc = self._determine_narrative_arc(synthesis_timestamps, merged_nodes)

        return {
            "nodes": merged_nodes,
            "edges": merged_edges,
            "timeline_layers": timeline_layers,
            "central_entities": central_entities,
            "narrative_arc": narrative_arc,
            "total_syntheses": len(synthesis_ids),
            "total_original_nodes": len(all_nodes),
            "total_original_edges": len(all_edges)
        }

    def _empty_graph(self) -> Dict[str, Any]:
        """Return empty graph structure."""
        return {
            "nodes": [],
            "edges": [],
            "timeline_layers": [],
            "central_entities": [],
            "narrative_arc": "emerging",
            "total_syntheses": 0,
            "total_original_nodes": 0,
            "total_original_edges": 0
        }

    def _deduplicate_nodes(
        self,
        all_nodes: List[Dict]
    ) -> Tuple[List[Dict], Dict[str, str]]:
        """
        Deduplicate nodes using label similarity.

        Returns:
            (merged_nodes, node_mapping) where node_mapping maps original_id -> merged_id
        """
        if not all_nodes:
            return [], {}

        merged_nodes = []
        node_mapping = {}  # original_id -> merged_id
        merged_node_labels = []  # For similarity comparison

        for node in all_nodes:
            original_id = node.get("id", "")
            label = node.get("label", "")
            normalized_label = self._normalize_label(label)

            # Check for similar existing node
            found_match = False
            for i, existing in enumerate(merged_nodes):
                existing_label = self._normalize_label(existing.get("label", ""))
                similarity = self._label_similarity(normalized_label, existing_label)

                if similarity >= self.node_similarity_threshold:
                    # Map to existing node
                    node_mapping[original_id] = existing["id"]

                    # Update existing node with additional info
                    existing["mention_count"] = existing.get("mention_count", 1) + 1
                    if "source_syntheses" not in existing:
                        existing["source_syntheses"] = []
                    existing["source_syntheses"].append(node.get("source_synthesis_id"))

                    # Keep the more descriptive label
                    if len(label) > len(existing["label"]):
                        existing["label"] = label

                    found_match = True
                    break

            if not found_match:
                # Create new merged node
                merged_id = f"merged_{len(merged_nodes)}"
                merged_node = {
                    "id": merged_id,
                    "label": label,
                    "node_type": node.get("node_type", "event"),
                    "fact_density": node.get("fact_density", 0.5),
                    "mention_count": 1,
                    "source_syntheses": [node.get("source_synthesis_id")],
                    "first_seen": node.get("source_timestamp", 0),
                    "last_seen": node.get("source_timestamp", 0)
                }

                merged_nodes.append(merged_node)
                merged_node_labels.append(normalized_label)
                node_mapping[original_id] = merged_id

        # Update fact_density based on mention count (more mentions = higher density)
        for node in merged_nodes:
            count = node.get("mention_count", 1)
            if count > 1:
                node["fact_density"] = min(1.0, node.get("fact_density", 0.5) + (count * 0.05))

        logger.debug(f"Node deduplication: {len(all_nodes)} -> {len(merged_nodes)}")
        return merged_nodes, node_mapping

    def _normalize_label(self, label: str) -> str:
        """Normalize a label for comparison."""
        import unicodedata
        import re

        # Lowercase
        label = label.lower().strip()

        # Remove accents
        label = unicodedata.normalize('NFD', label)
        label = ''.join(c for c in label if unicodedata.category(c) != 'Mn')

        # Remove extra whitespace
        label = ' '.join(label.split())

        # Remove common articles
        articles = ['le ', 'la ', 'les ', 'l\'', 'un ', 'une ', 'des ', 'de ', 'du ',
                    'the ', 'a ', 'an ']
        for article in articles:
            if label.startswith(article):
                label = label[len(article):]

        return label

    def _label_similarity(self, label1: str, label2: str) -> float:
        """Calculate similarity between two labels (0.0 to 1.0)."""
        if label1 == label2:
            return 1.0

        # Check for substring match
        if label1 in label2 or label2 in label1:
            return 0.9

        # Jaccard similarity on words
        words1 = set(label1.split())
        words2 = set(label2.split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        union = len(words1 | words2)

        return intersection / union if union > 0 else 0.0

    def _merge_edges(
        self,
        all_edges: List[Dict],
        node_mapping: Dict[str, str]
    ) -> List[Dict]:
        """
        Merge duplicate edges and combine confidence scores.
        """
        if not all_edges:
            return []

        # Group edges by (source, target, type)
        edge_groups = defaultdict(list)

        for edge in all_edges:
            # Get source and target (try different field names)
            source_text = edge.get("cause_text", edge.get("source", ""))
            target_text = edge.get("effect_text", edge.get("target", ""))
            rel_type = edge.get("relation_type", edge.get("type", "causes"))

            # Normalize for grouping
            source_normalized = self._normalize_label(source_text)
            target_normalized = self._normalize_label(target_text)

            key = (source_normalized[:50], target_normalized[:50], rel_type)
            edge_groups[key].append(edge)

        # Merge each group
        merged_edges = []

        for (source_norm, target_norm, rel_type), edges in edge_groups.items():
            # Use the most descriptive texts
            source_texts = [e.get("cause_text", e.get("source", "")) for e in edges]
            target_texts = [e.get("effect_text", e.get("target", "")) for e in edges]

            best_source = max(source_texts, key=len) if source_texts else ""
            best_target = max(target_texts, key=len) if target_texts else ""

            # Combine confidence (average + boost for multiple occurrences)
            confidences = [e.get("confidence", 0.5) for e in edges]
            avg_confidence = sum(confidences) / len(confidences)
            occurrence_boost = min(0.2, len(edges) * 0.05)
            combined_confidence = min(1.0, avg_confidence + occurrence_boost)

            # Collect evidence and sources
            all_evidence = []
            all_sources = []
            for e in edges:
                all_evidence.extend(e.get("evidence", []))
                all_sources.extend(e.get("source_articles", []))

            merged_edge = {
                "id": f"edge_{len(merged_edges)}",
                "cause_text": best_source,
                "effect_text": best_target,
                "relation_type": rel_type,
                "confidence": combined_confidence,
                "mention_count": len(edges),
                "evidence": list(set(all_evidence))[:5],  # Dedupe and limit
                "source_articles": list(set(all_sources))[:10],
                "source_syntheses": list(set(e.get("source_synthesis_id", "") for e in edges))
            }

            merged_edges.append(merged_edge)

        logger.debug(f"Edge merging: {len(all_edges)} -> {len(merged_edges)}")
        return merged_edges

    def _identify_central_entities(
        self,
        nodes: List[Dict],
        edges: List[Dict]
    ) -> List[str]:
        """
        Identify the most central entities based on connectivity.
        """
        if not nodes or not edges:
            return []

        # Count connections per node label
        connection_counts = defaultdict(int)

        for edge in edges:
            cause = edge.get("cause_text", "")
            effect = edge.get("effect_text", "")

            if cause:
                connection_counts[cause[:50]] += 1
            if effect:
                connection_counts[effect[:50]] += 1

        # Also consider mention count from nodes
        for node in nodes:
            label = node.get("label", "")[:50]
            mention_count = node.get("mention_count", 1)
            connection_counts[label] += mention_count

        # Sort by count and return top entities
        sorted_entities = sorted(connection_counts.items(), key=lambda x: x[1], reverse=True)

        # Return full labels (find matching node labels)
        central = []
        for short_label, count in sorted_entities[:10]:
            for node in nodes:
                if node.get("label", "")[:50] == short_label:
                    central.append(node.get("label", ""))
                    break

        return central

    def _create_timeline_layers(
        self,
        nodes: List[Dict],
        edges: List[Dict],
        timestamps: List[float]
    ) -> List[Dict]:
        """
        Organize nodes and edges into timeline layers.
        """
        if not timestamps or not nodes:
            return []

        timestamps.sort()
        min_ts = min(timestamps)
        max_ts = max(timestamps)
        time_range = max_ts - min_ts

        if time_range <= 0:
            # All same timestamp - single layer
            return [{
                "period": "current",
                "start_time": min_ts,
                "end_time": max_ts,
                "node_ids": [n["id"] for n in nodes],
                "edge_ids": [e["id"] for e in edges]
            }]

        # Create 3 layers: past, present, recent
        third = time_range / 3

        layers = [
            {"period": "past", "start": min_ts, "end": min_ts + third, "node_ids": [], "edge_ids": []},
            {"period": "developing", "start": min_ts + third, "end": min_ts + 2*third, "node_ids": [], "edge_ids": []},
            {"period": "recent", "start": min_ts + 2*third, "end": max_ts + 1, "node_ids": [], "edge_ids": []}
        ]

        # Assign nodes to layers based on first_seen
        for node in nodes:
            first_seen = node.get("first_seen", min_ts)
            for layer in layers:
                if layer["start"] <= first_seen < layer["end"]:
                    layer["node_ids"].append(node["id"])
                    break

        # Assign edges to layers based on latest source timestamp
        for edge in edges:
            source_syntheses = edge.get("source_syntheses", [])
            if source_syntheses:
                # Find latest timestamp from source syntheses
                edge_ts = max_ts  # Default to recent
                for syn_id in source_syntheses:
                    syn = self.qdrant_service.get_synthesis_by_id(syn_id) if self.qdrant_service else None
                    if syn:
                        ts = syn.get("created_at", 0)
                        if ts and ts < edge_ts:
                            edge_ts = ts

                for layer in layers:
                    if layer["start"] <= edge_ts < layer["end"]:
                        layer["edge_ids"].append(edge["id"])
                        break

        # Clean up layers and return
        return [
            {
                "period": l["period"],
                "start_time": l["start"],
                "end_time": l["end"],
                "node_ids": l["node_ids"],
                "edge_ids": l["edge_ids"]
            }
            for l in layers if l["node_ids"] or l["edge_ids"]
        ]

    def _determine_narrative_arc(
        self,
        timestamps: List[float],
        nodes: List[Dict]
    ) -> str:
        """Determine overall narrative arc from aggregated data."""
        if not timestamps:
            return "emerging"

        now = datetime.now().timestamp()
        oldest = min(timestamps)
        newest = max(timestamps)
        node_count = len(nodes)

        age_days = (now - oldest) / 86400
        recency_hours = (now - newest) / 3600

        if node_count <= 3:
            return "emerging"
        elif recency_hours > 72:
            return "resolved"
        elif age_days < 2 and node_count >= 5:
            return "developing"
        elif node_count >= 10 and recency_hours < 24:
            return "peak"
        elif age_days > 7 and recency_hours > 48:
            return "declining"
        else:
            return "developing"

    async def aggregate_for_topic(
        self,
        topic_id: str
    ) -> Dict[str, Any]:
        """
        Aggregate causal graphs for all syntheses in a topic and update the topic.

        Args:
            topic_id: The topic ID

        Returns:
            The aggregated causal graph
        """
        if not self.qdrant_service:
            return self._empty_graph()

        topic = self.qdrant_service.get_topic_by_id(topic_id)
        if not topic:
            logger.warning(f"Topic {topic_id} not found")
            return self._empty_graph()

        synthesis_ids = topic.get("synthesis_ids", [])
        if not synthesis_ids:
            logger.warning(f"Topic {topic_id} has no syntheses")
            return self._empty_graph()

        logger.info(f"📊 Aggregating causal graphs for topic '{topic['name']}' ({len(synthesis_ids)} syntheses)")

        # Aggregate
        aggregated = self.aggregate_causal_graphs(synthesis_ids, include_timeline=True)

        # Update topic with aggregated graph
        self.qdrant_service.update_topic_causal_graph(topic_id, aggregated)

        logger.info(f"✅ Topic '{topic['name']}' causal graph updated: "
                   f"{len(aggregated['nodes'])} nodes, {len(aggregated['edges'])} edges")

        return aggregated

    async def get_entity_causal_profile(
        self,
        entity_name: str
    ) -> Dict[str, Any]:
        """
        Get causal profile for an entity across all syntheses.

        Args:
            entity_name: The entity name to search for

        Returns:
            Causal profile with:
            - as_cause: Relations where entity is cause
            - as_effect: Relations where entity is effect
            - timeline: Evolution of entity's causal role
        """
        # Search for entity in entities collection
        entities = self.qdrant_service.search_entities_by_name(
            name=entity_name,
            limit=5
        )

        if not entities:
            return {
                "entity_name": entity_name,
                "as_cause": [],
                "as_effect": [],
                "timeline": [],
                "total_causal_mentions": 0
            }

        entity = entities[0]  # Best match
        synthesis_ids = entity.get("synthesis_ids", [])

        as_cause = []
        as_effect = []
        timeline_events = []

        entity_normalized = self._normalize_label(entity_name)

        for syn_id in synthesis_ids[:50]:  # Limit to avoid performance issues
            synthesis = self.qdrant_service.get_synthesis_by_id(syn_id)
            if not synthesis:
                continue

            causal_graph = synthesis.get("causal_graph", {})
            if isinstance(causal_graph, str):
                try:
                    causal_graph = json.loads(causal_graph)
                except json.JSONDecodeError:
                    continue

            timestamp = synthesis.get("created_at", 0)

            for edge in causal_graph.get("edges", []):
                cause = edge.get("cause_text", "")
                effect = edge.get("effect_text", "")

                cause_normalized = self._normalize_label(cause)
                effect_normalized = self._normalize_label(effect)

                if entity_normalized in cause_normalized or cause_normalized in entity_normalized:
                    as_cause.append({
                        "effect": effect,
                        "type": edge.get("relation_type", "causes"),
                        "confidence": edge.get("confidence", 0.5),
                        "synthesis_id": syn_id,
                        "timestamp": timestamp
                    })

                if entity_normalized in effect_normalized or effect_normalized in entity_normalized:
                    as_effect.append({
                        "cause": cause,
                        "type": edge.get("relation_type", "causes"),
                        "confidence": edge.get("confidence", 0.5),
                        "synthesis_id": syn_id,
                        "timestamp": timestamp
                    })

        # Sort by timestamp
        as_cause.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        as_effect.sort(key=lambda x: x.get("timestamp", 0), reverse=True)

        return {
            "entity_name": entity.get("canonical_name", entity_name),
            "entity_type": entity.get("entity_type", "UNKNOWN"),
            "as_cause": as_cause[:20],
            "as_effect": as_effect[:20],
            "total_causal_mentions": len(as_cause) + len(as_effect),
            "cause_ratio": len(as_cause) / max(1, len(as_cause) + len(as_effect))
        }


# Global instance
causal_aggregator = CausalAggregator()


async def init_causal_aggregator():
    """Initialize causal aggregator"""
    await causal_aggregator.initialize()


def get_causal_aggregator() -> CausalAggregator:
    """Dependency injection for FastAPI"""
    return causal_aggregator
