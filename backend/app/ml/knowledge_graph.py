"""
Knowledge Graph Extraction
Using spaCy NER + NetworkX - NO GEMINI
"""
from typing import List, Dict, Any, Set, Tuple
import spacy
from spacy.tokens import Doc
import networkx as nx
from collections import Counter, defaultdict
from loguru import logger

from app.core.config import settings


class KnowledgeGraphExtractor:
    """Extract Knowledge Graph from articles using spaCy"""

    def __init__(self):
        self.nlp = None
        self.entity_types = {"ORG", "PERSON", "GPE", "LOC", "EVENT", "PRODUCT"}

    async def initialize(self):
        """Load spaCy model"""
        try:
            logger.info(f"Loading spaCy model: {settings.SPACY_MODEL}")
            self.nlp = spacy.load(settings.SPACY_MODEL)
            logger.success("✅ spaCy model loaded")
        except OSError:
            logger.error(f"spaCy model '{settings.SPACY_MODEL}' not found")
            logger.info("Download it: python -m spacy download fr_core_news_lg")
            raise

    def extract_entities(self, texts: List[str]) -> List[Dict[str, Any]]:
        """
        Extract named entities from texts

        Args:
            texts: List of article texts

        Returns:
            List of entity dictionaries
        """
        if not self.nlp:
            raise RuntimeError("spaCy not initialized")

        all_entities = []
        entity_counts = Counter()

        for doc in self.nlp.pipe(texts, batch_size=50):
            for ent in doc.ents:
                if ent.label_ in self.entity_types:
                    entity_key = (ent.text, ent.label_)
                    entity_counts[entity_key] += 1

                    all_entities.append({
                        "text": ent.text,
                        "type": ent.label_,
                        "start": ent.start_char,
                        "end": ent.end_char
                    })

        return all_entities

    def build_knowledge_graph(
        self,
        articles: List[Dict[str, Any]],
        max_nodes: int = None,
        max_edges: int = None
    ) -> Dict[str, Any]:
        """
        Build knowledge graph from articles

        Args:
            articles: List of article dictionaries
            max_nodes: Maximum nodes (default from settings)
            max_edges: Maximum edges (default from settings)

        Returns:
            Knowledge graph data with nodes and edges
        """
        if not self.nlp:
            raise RuntimeError("spaCy not initialized")

        max_nodes = max_nodes or settings.MAX_GRAPH_NODES
        max_edges = max_edges or settings.MAX_GRAPH_EDGES

        # Extract entities from all articles
        texts = [f"{a.get('title', '')} {a.get('summary', '')}" for a in articles]
        entity_counts = Counter()
        entity_cooccurrences = defaultdict(int)
        entity_types = {}

        # Process texts
        for doc in self.nlp.pipe(texts, batch_size=50):
            doc_entities = []

            for ent in doc.ents:
                if ent.label_ in self.entity_types:
                    normalized = self._normalize_entity(ent.text)
                    entity_counts[normalized] += 1
                    entity_types[normalized] = ent.label_
                    doc_entities.append(normalized)

            # Track co-occurrences (entities appearing in same article)
            for i, ent1 in enumerate(doc_entities):
                for ent2 in doc_entities[i+1:]:
                    if ent1 != ent2:
                        edge = tuple(sorted([ent1, ent2]))
                        entity_cooccurrences[edge] += 1

        # Select top entities as nodes
        top_entities = entity_counts.most_common(max_nodes)
        nodes = []
        node_ids = set()

        for i, (entity, count) in enumerate(top_entities):
            node_id = f"node_{i}"
            node_ids.add(entity)
            nodes.append({
                "id": node_id,
                "label": entity,
                "type": entity_types.get(entity, "OTHER"),
                "val": min(count, 10)  # Importance score (1-10)
            })

        # Build edges from co-occurrences
        edges = []
        edge_count = 0

        for (ent1, ent2), weight in sorted(
            entity_cooccurrences.items(),
            key=lambda x: x[1],
            reverse=True
        ):
            if edge_count >= max_edges:
                break

            if ent1 in node_ids and ent2 in node_ids:
                # Find node IDs
                source_id = next((n["id"] for n in nodes if n["label"] == ent1), None)
                target_id = next((n["id"] for n in nodes if n["label"] == ent2), None)

                if source_id and target_id:
                    edges.append({
                        "source": source_id,
                        "target": target_id,
                        "label": "CO_OCCURS",
                        "weight": weight
                    })
                    edge_count += 1

        logger.info(f"✅ Knowledge graph: {len(nodes)} nodes, {len(edges)} edges")

        return {
            "nodes": nodes,
            "edges": edges
        }

    def _normalize_entity(self, text: str) -> str:
        """Normalize entity text (lowercase, strip)"""
        return text.strip().lower()

    def analyze_graph_structure(self, graph_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze graph structure using NetworkX

        Args:
            graph_data: Graph with nodes and edges

        Returns:
            Graph statistics
        """
        G = nx.Graph()

        # Add nodes
        for node in graph_data["nodes"]:
            G.add_node(node["id"], **node)

        # Add edges
        for edge in graph_data["edges"]:
            G.add_edge(edge["source"], edge["target"], weight=edge.get("weight", 1))

        # Compute metrics
        stats = {
            "num_nodes": G.number_of_nodes(),
            "num_edges": G.number_of_edges(),
            "density": nx.density(G),
            "avg_clustering": nx.average_clustering(G) if G.number_of_nodes() > 0 else 0,
            "num_components": nx.number_connected_components(G)
        }

        # Find central nodes
        if G.number_of_nodes() > 0:
            centrality = nx.degree_centrality(G)
            top_central = sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:5]
            stats["top_central_nodes"] = [
                {"id": node_id, "centrality": score}
                for node_id, score in top_central
            ]

        return stats


# Global instance
kg_extractor = KnowledgeGraphExtractor()


async def init_knowledge_graph():
    """Initialize the knowledge graph extractor"""
    await kg_extractor.initialize()


def get_kg_extractor() -> KnowledgeGraphExtractor:
    """Dependency injection for FastAPI"""
    if not kg_extractor.nlp:
        raise RuntimeError("Knowledge graph extractor not initialized")
    return kg_extractor
