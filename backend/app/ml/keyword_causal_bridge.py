"""
Keyword Causal Bridge
Phase 7: Links extracted keywords to the causal graph as special nodes.

Keywords from spaCy NER and keyword learning are connected to relevant
causal nodes, creating a richer visualization with keyword "satellite" nodes.
"""
from typing import List, Dict, Optional, Set, Tuple
import re
from loguru import logger


class KeywordCausalBridge:
    """
    Bridges keywords extracted from text to the causal graph.

    Adds 'keyword' type nodes that connect to existing causal nodes
    when there's a semantic or textual relationship.
    """

    # Minimum confidence for linking keywords to nodes
    MIN_LINK_CONFIDENCE = 0.5

    # Maximum keywords to add to avoid clutter
    MAX_KEYWORDS = 10

    def __init__(self):
        pass

    def enrich_causal_graph(
        self,
        causal_graph: Dict,
        key_entities: List,
        synthesis_text: str = ""
    ) -> Dict:
        """
        Enrich a causal graph with keyword nodes.

        Args:
            causal_graph: Existing causal graph with nodes and edges
            key_entities: Key entities from the synthesis (spaCy NER)
            synthesis_text: Full synthesis text for context

        Returns:
            Enhanced causal graph with keyword nodes
        """
        if not causal_graph or not key_entities:
            return causal_graph

        nodes = causal_graph.get('nodes', [])
        edges = causal_graph.get('edges', [])

        if not nodes:
            return causal_graph

        # Extract keywords from key_entities
        keywords = self._extract_keywords(key_entities)

        if not keywords:
            return causal_graph

        # Build text index of existing nodes
        node_texts = self._build_node_text_index(nodes, edges)

        # Find relationships between keywords and nodes
        keyword_nodes = []
        keyword_edges = []
        added_keywords: Set[str] = set()

        for keyword_name, keyword_type in keywords:
            if len(added_keywords) >= self.MAX_KEYWORDS:
                break

            if keyword_name.lower() in added_keywords:
                continue

            # Find linked nodes
            linked_nodes = self._find_linked_nodes(
                keyword_name,
                keyword_type,
                nodes,
                node_texts,
                synthesis_text
            )

            if linked_nodes:
                # Create keyword node
                keyword_id = f"kw_{self._sanitize_id(keyword_name)}"
                keyword_node = {
                    "id": keyword_id,
                    "label": keyword_name,
                    "node_type": "keyword",
                    "entity_type": keyword_type,
                    "fact_density": 0.5  # Neutral density for keywords
                }
                keyword_nodes.append(keyword_node)
                added_keywords.add(keyword_name.lower())

                # Create edges to linked nodes
                for node_id, confidence in linked_nodes:
                    keyword_edges.append({
                        "cause_text": keyword_name,
                        "effect_text": self._get_node_label(nodes, node_id),
                        "relation_type": "relates_to",
                        "confidence": confidence,
                        "evidence": [f"Keyword '{keyword_name}' appears in context"],
                        "source_articles": [],
                        "source_node": keyword_id,
                        "target_node": node_id
                    })

        # Merge into causal graph
        enhanced_graph = {
            **causal_graph,
            "nodes": nodes + keyword_nodes,
            "edges": edges + keyword_edges,
            "keyword_count": len(keyword_nodes)
        }

        logger.info(f"Added {len(keyword_nodes)} keyword nodes and {len(keyword_edges)} edges to causal graph")

        return enhanced_graph

    def _extract_keywords(self, key_entities: List) -> List[Tuple[str, str]]:
        """Extract keyword name and type from key_entities."""
        keywords = []

        for entity in key_entities:
            if isinstance(entity, dict):
                name = entity.get('name', '')
                ent_type = entity.get('type', 'ENTITY')
            elif isinstance(entity, (list, tuple)) and len(entity) >= 2:
                name = entity[0]
                ent_type = entity[1]
            elif isinstance(entity, str):
                name = entity
                ent_type = 'ENTITY'
            else:
                continue

            # Filter valid keywords
            if name and len(name) >= 2 and len(name) <= 50:
                # Prioritize certain entity types
                if ent_type in ('PERSON', 'ORG', 'GPE', 'EVENT', 'PRODUCT', 'LOC'):
                    keywords.append((name, ent_type))

        return keywords[:20]  # Limit input

    def _build_node_text_index(
        self,
        nodes: List[Dict],
        edges: List[Dict]
    ) -> Dict[str, Set[str]]:
        """
        Build an index of text associated with each node.

        Returns dict: node_id -> set of related text fragments
        """
        node_texts: Dict[str, Set[str]] = {}

        for node in nodes:
            node_id = node.get('id', '')
            if not node_id:
                continue

            texts = set()
            texts.add(node.get('label', '').lower())

            node_texts[node_id] = texts

        # Add edge texts to connected nodes
        for edge in edges:
            cause = edge.get('cause_text', '').lower()
            effect = edge.get('effect_text', '').lower()

            # Find nodes these texts belong to
            for node_id, texts in node_texts.items():
                if any(cause in t or t in cause for t in texts if t):
                    texts.add(cause)
                if any(effect in t or t in effect for t in texts if t):
                    texts.add(effect)

        return node_texts

    def _find_linked_nodes(
        self,
        keyword: str,
        keyword_type: str,
        nodes: List[Dict],
        node_texts: Dict[str, Set[str]],
        synthesis_text: str
    ) -> List[Tuple[str, float]]:
        """
        Find nodes that should be linked to this keyword.

        Returns list of (node_id, confidence) tuples.
        """
        linked = []
        keyword_lower = keyword.lower()
        keyword_words = set(keyword_lower.split())

        for node in nodes:
            node_id = node.get('id', '')
            node_label = node.get('label', '').lower()
            node_type = node.get('node_type', '')

            # Skip if already a keyword node
            if node_type == 'keyword':
                continue

            confidence = 0.0

            # Strategy 1: Direct substring match in label
            if keyword_lower in node_label or node_label in keyword_lower:
                confidence = max(confidence, 0.9)

            # Strategy 2: Word overlap
            node_words = set(node_label.split())
            overlap = keyword_words & node_words
            if overlap:
                overlap_ratio = len(overlap) / max(len(keyword_words), len(node_words))
                confidence = max(confidence, 0.6 + overlap_ratio * 0.3)

            # Strategy 3: Check in associated texts
            texts = node_texts.get(node_id, set())
            for text in texts:
                if keyword_lower in text:
                    confidence = max(confidence, 0.7)
                    break

            # Strategy 4: Context proximity in synthesis text
            if confidence < self.MIN_LINK_CONFIDENCE and synthesis_text:
                # Check if keyword and node label appear near each other
                if self._check_text_proximity(keyword, node_label, synthesis_text):
                    confidence = max(confidence, 0.6)

            if confidence >= self.MIN_LINK_CONFIDENCE:
                linked.append((node_id, confidence))

        # Sort by confidence and limit
        linked.sort(key=lambda x: x[1], reverse=True)
        return linked[:3]  # Max 3 connections per keyword

    def _check_text_proximity(
        self,
        keyword: str,
        node_label: str,
        text: str,
        window: int = 100
    ) -> bool:
        """Check if keyword and node_label appear within window chars of each other."""
        text_lower = text.lower()
        keyword_lower = keyword.lower()
        node_lower = node_label.lower()

        # Find keyword occurrences
        keyword_positions = [
            m.start()
            for m in re.finditer(re.escape(keyword_lower), text_lower)
        ]

        if not keyword_positions:
            return False

        # Find node label occurrences
        node_positions = [
            m.start()
            for m in re.finditer(re.escape(node_lower), text_lower)
        ]

        if not node_positions:
            return False

        # Check for proximity
        for kpos in keyword_positions:
            for npos in node_positions:
                if abs(kpos - npos) <= window:
                    return True

        return False

    def _sanitize_id(self, text: str) -> str:
        """Sanitize text for use as node ID."""
        # Remove special chars, keep alphanumeric and underscores
        sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', text)
        # Collapse multiple underscores
        sanitized = re.sub(r'_+', '_', sanitized)
        return sanitized[:30].strip('_').lower()

    def _get_node_label(self, nodes: List[Dict], node_id: str) -> str:
        """Get label for a node by ID."""
        for node in nodes:
            if node.get('id') == node_id:
                return node.get('label', node_id)
        return node_id


# Singleton instance
_bridge: Optional[KeywordCausalBridge] = None


def get_keyword_causal_bridge() -> KeywordCausalBridge:
    """Get keyword causal bridge singleton."""
    global _bridge
    if _bridge is None:
        _bridge = KeywordCausalBridge()
    return _bridge
