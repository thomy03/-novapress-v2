"""
Causal Graph API Routes
Nexus Causal - Pre-computed causal relationships (0 LLM calls at display)
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from loguru import logger
from datetime import datetime

from app.db.qdrant_client import get_qdrant_service
from app.ml.causal_extraction import CausalGraph, get_causal_extractor


# ==========================================
# Pydantic Schemas
# ==========================================

class CausalNodeResponse(BaseModel):
    id: str
    label: str
    node_type: str  # event, entity, decision
    date: Optional[str] = None
    fact_density: float = 0.5


class CausalEdgeResponse(BaseModel):
    cause_text: str
    effect_text: str
    relation_type: str  # causes, triggers, enables, prevents
    confidence: float
    evidence: List[str] = []
    source_articles: List[str] = []


class CausalGraphResponse(BaseModel):
    synthesis_id: str
    title: str
    nodes: List[CausalNodeResponse]
    edges: List[CausalEdgeResponse]
    central_entity: str
    narrative_flow: str  # linear, branching, circular
    total_relations: int


class CausalPreviewResponse(BaseModel):
    synthesis_id: str
    has_causal_data: bool
    total_relations: int
    top_relations: List[CausalEdgeResponse]
    central_entity: str
    narrative_flow: str


class EntityCausalProfileResponse(BaseModel):
    entity_name: str
    appearances_count: int
    as_cause_count: int
    as_effect_count: int
    syntheses: List[Dict[str, Any]]
    related_entities: List[str]


# Historical Graph Schemas (Multi-Layer DAG)
class HistoricalLayerResponse(BaseModel):
    """A single layer in the historical causal graph (one synthesis)"""
    synthesis_id: str
    title: str
    date: str
    nodes: List[CausalNodeResponse]
    edges: List[CausalEdgeResponse]
    is_current: bool = False


class InterLayerConnection(BaseModel):
    """Connection between two layers (leads_to relationship)"""
    from_layer: int
    to_layer: int
    from_node_id: str
    to_node_id: str
    from_effect: str
    to_cause: str
    similarity: float
    connection_type: str = "leads_to"


class HistoricalCausalGraphResponse(BaseModel):
    """Complete historical causal graph with multiple layers and inter-layer connections"""
    synthesis_id: str
    layers: List[HistoricalLayerResponse]
    inter_layer_connections: List[InterLayerConnection]
    total_nodes: int
    total_edges: int
    total_layers: int


# ==========================================
# Router
# ==========================================

router = APIRouter()


@router.get("/syntheses/{synthesis_id}/causal-graph", response_model=CausalGraphResponse)
async def get_causal_graph(synthesis_id: str):
    """
    Get pre-computed causal graph for a synthesis.

    This endpoint returns the causal relationships that were extracted
    during pipeline execution. No LLM calls are made at display time.

    Returns:
    - Nodes (events, entities, decisions)
    - Edges (cause-effect relationships with confidence scores)
    - Central entity (most connected)
    - Narrative flow type (linear, branching, circular)
    """
    try:
        qdrant = get_qdrant_service()

        # Get synthesis with causal data
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)
        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        title = synthesis.get("title", "")

        # Get pre-computed causal graph from storage
        causal_data = synthesis.get("causal_graph", {})

        # If no pre-computed data, try to extract on-the-fly (fallback)
        if not causal_data or not causal_data.get("edges"):
            causal_data = _extract_causal_fallback(synthesis)

        # Convert to response format
        nodes = [
            CausalNodeResponse(
                id=n.get("id", f"node_{i}"),
                label=n.get("label", ""),
                node_type=n.get("node_type", "event"),
                date=n.get("date"),
                fact_density=n.get("fact_density", 0.5)
            )
            for i, n in enumerate(causal_data.get("nodes", []))
        ]

        edges = [
            CausalEdgeResponse(
                cause_text=e.get("cause_text", ""),
                effect_text=e.get("effect_text", ""),
                relation_type=e.get("relation_type", "causes"),
                confidence=e.get("confidence", 0.5),
                evidence=e.get("evidence", []),
                source_articles=e.get("source_articles", [])
            )
            for e in causal_data.get("edges", [])
        ]

        return CausalGraphResponse(
            synthesis_id=synthesis_id,
            title=title,
            nodes=nodes,
            edges=edges,
            central_entity=causal_data.get("central_entity", ""),
            narrative_flow=causal_data.get("narrative_flow", "linear"),
            total_relations=len(edges)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get causal graph for synthesis {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/syntheses/{synthesis_id}/historical-graph", response_model=HistoricalCausalGraphResponse)
async def get_historical_causal_graph(
    synthesis_id: str,
    max_depth: int = Query(default=5, le=10, description="Maximum number of related syntheses to include")
):
    """
    Get historical causal graph showing how past events led to the current synthesis.

    This endpoint:
    1. Retrieves the current synthesis
    2. Finds related syntheses via semantic search (TNA-like)
    3. Extracts causal_graph from each related synthesis
    4. Detects inter-layer connections (effect_text -> cause_text matching)
    5. Returns a multi-layer DAG with branches and convergences

    Returns:
    - layers: Ordered list of syntheses (oldest first, current last)
    - inter_layer_connections: "leads_to" edges between layers
    - total_nodes/edges: Graph statistics
    """
    try:
        qdrant = get_qdrant_service()

        # 1. Get current synthesis
        current_synthesis = qdrant.get_synthesis_by_id(synthesis_id)
        if not current_synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        # 2. Find related syntheses (semantic search or recent syntheses)
        # In production, use TNA.find_related_syntheses with embedding search
        # For now, get recent syntheses and filter by topic similarity
        all_syntheses = qdrant.get_recent_syntheses(limit=50)

        # Filter: exclude current, sort by date (oldest first)
        related_syntheses = [
            s for s in all_syntheses
            if s.get("id") != synthesis_id
        ]

        # Sort by created_at (oldest first) and limit
        related_syntheses = sorted(
            related_syntheses,
            key=lambda s: s.get("created_at", ""),
            reverse=False  # Oldest first
        )[:max_depth]

        # 3. Build layers from each synthesis's causal_graph
        layers = []

        for synth in related_syntheses:
            causal_data = synth.get("causal_graph", {})

            # Skip if no causal data
            if not causal_data.get("edges"):
                causal_data = _extract_causal_fallback(synth)

            nodes = [
                CausalNodeResponse(
                    id=n.get("id", f"node_{i}"),
                    label=n.get("label", ""),
                    node_type=n.get("node_type", "event"),
                    date=n.get("date"),
                    fact_density=n.get("fact_density", 0.5)
                )
                for i, n in enumerate(causal_data.get("nodes", []))
            ]

            edges = [
                CausalEdgeResponse(
                    cause_text=e.get("cause_text", ""),
                    effect_text=e.get("effect_text", ""),
                    relation_type=e.get("relation_type", "causes"),
                    confidence=e.get("confidence", 0.5),
                    evidence=e.get("evidence", []),
                    source_articles=e.get("source_articles", [])
                )
                for e in causal_data.get("edges", [])
            ]

            if nodes or edges:  # Only add layers with data
                layers.append(HistoricalLayerResponse(
                    synthesis_id=synth.get("id", ""),
                    title=synth.get("title", ""),
                    date=_format_date(synth.get("created_at", "")),
                    nodes=nodes,
                    edges=edges,
                    is_current=False
                ))

        # 4. Add current synthesis as the last layer
        current_causal = current_synthesis.get("causal_graph", {})
        if not current_causal.get("edges"):
            current_causal = _extract_causal_fallback(current_synthesis)

        current_nodes = [
            CausalNodeResponse(
                id=n.get("id", f"node_{i}"),
                label=n.get("label", ""),
                node_type=n.get("node_type", "event"),
                date=n.get("date"),
                fact_density=n.get("fact_density", 0.5)
            )
            for i, n in enumerate(current_causal.get("nodes", []))
        ]

        current_edges = [
            CausalEdgeResponse(
                cause_text=e.get("cause_text", ""),
                effect_text=e.get("effect_text", ""),
                relation_type=e.get("relation_type", "causes"),
                confidence=e.get("confidence", 0.5),
                evidence=e.get("evidence", []),
                source_articles=e.get("source_articles", [])
            )
            for e in current_causal.get("edges", [])
        ]

        layers.append(HistoricalLayerResponse(
            synthesis_id=synthesis_id,
            title=current_synthesis.get("title", ""),
            date=_format_date(current_synthesis.get("created_at", "")),
            nodes=current_nodes,
            edges=current_edges,
            is_current=True
        ))

        # 5. Detect inter-layer connections
        inter_connections = _detect_inter_layer_connections(layers)

        # Calculate totals
        total_nodes = sum(len(layer.nodes) for layer in layers)
        total_edges = sum(len(layer.edges) for layer in layers) + len(inter_connections)

        return HistoricalCausalGraphResponse(
            synthesis_id=synthesis_id,
            layers=layers,
            inter_layer_connections=inter_connections,
            total_nodes=total_nodes,
            total_edges=total_edges,
            total_layers=len(layers)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get historical causal graph for {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/syntheses/{synthesis_id}/causal-preview", response_model=CausalPreviewResponse)
async def get_causal_preview(synthesis_id: str, max_relations: int = 3):
    """
    Get compact causal preview for sidebar/card display.

    Returns only essential data for quick display:
    - Whether causal data exists
    - Top N relations by confidence
    - Central entity
    """
    try:
        qdrant = get_qdrant_service()

        synthesis = qdrant.get_synthesis_by_id(synthesis_id)
        if not synthesis:
            # Return empty response instead of 404 for missing synthesis
            return CausalPreviewResponse(
                synthesis_id=synthesis_id,
                has_causal_data=False,
                total_relations=0,
                top_relations=[],
                central_entity="",
                narrative_flow="linear"
            )

        causal_data = synthesis.get("causal_graph", {})

        if not causal_data:
            causal_data = _extract_causal_fallback(synthesis)

        edges = causal_data.get("edges", [])

        # Sort by confidence and take top N
        sorted_edges = sorted(edges, key=lambda e: e.get("confidence", 0), reverse=True)
        top_edges = sorted_edges[:max_relations]

        top_relations = [
            CausalEdgeResponse(
                cause_text=e.get("cause_text", ""),
                effect_text=e.get("effect_text", ""),
                relation_type=e.get("relation_type", "causes"),
                confidence=e.get("confidence", 0.5),
                evidence=e.get("evidence", [])[:1],  # Only first evidence
                source_articles=[]
            )
            for e in top_edges
        ]

        return CausalPreviewResponse(
            synthesis_id=synthesis_id,
            has_causal_data=len(edges) > 0,
            total_relations=len(edges),
            top_relations=top_relations,
            central_entity=causal_data.get("central_entity", ""),
            narrative_flow=causal_data.get("narrative_flow", "linear")
        )

    except Exception as e:
        logger.error(f"Failed to get causal preview for {synthesis_id}: {e}")
        # Return empty response instead of 500 error
        return CausalPreviewResponse(
            synthesis_id=synthesis_id,
            has_causal_data=False,
            total_relations=0,
            top_relations=[],
            central_entity="",
            narrative_flow="linear"
        )


@router.get("/entities/{entity_name}/causal-profile", response_model=EntityCausalProfileResponse)
async def get_entity_causal_profile(
    entity_name: str,
    limit: int = Query(default=10, le=50)
):
    """
    Get causal profile for an entity across all syntheses.

    Shows:
    - How many times the entity appears
    - When it's a CAUSE vs when it's an EFFECT
    - Related syntheses
    - Connected entities
    """
    try:
        qdrant = get_qdrant_service()

        # Search syntheses mentioning this entity
        # In production, use semantic search
        all_syntheses = qdrant.get_recent_syntheses(limit=100)

        appearances = []
        as_cause = 0
        as_effect = 0
        related_entities = set()

        entity_lower = entity_name.lower()

        for synthesis in all_syntheses:
            causal_data = synthesis.get("causal_graph", {})
            edges = causal_data.get("edges", [])

            found = False
            for edge in edges:
                cause = edge.get("cause_text", "").lower()
                effect = edge.get("effect_text", "").lower()

                if entity_lower in cause:
                    as_cause += 1
                    found = True
                    # Extract related entity from effect
                    related_entities.add(edge.get("effect_text", "")[:50])

                if entity_lower in effect:
                    as_effect += 1
                    found = True
                    # Extract related entity from cause
                    related_entities.add(edge.get("cause_text", "")[:50])

            if found:
                appearances.append({
                    "synthesis_id": synthesis.get("id", ""),
                    "title": synthesis.get("title", ""),
                    "date": synthesis.get("created_at", "")
                })

        # Remove the entity itself from related
        related_entities.discard(entity_name)

        return EntityCausalProfileResponse(
            entity_name=entity_name,
            appearances_count=len(appearances),
            as_cause_count=as_cause,
            as_effect_count=as_effect,
            syntheses=appearances[:limit],
            related_entities=list(related_entities)[:20]
        )

    except Exception as e:
        logger.error(f"Failed to get causal profile for entity {entity_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_causal_stats():
    """
    Get overall causal graph statistics.

    Useful for dashboard displays and monitoring.
    """
    try:
        qdrant = get_qdrant_service()

        all_syntheses = qdrant.get_recent_syntheses(limit=100)

        total_relations = 0
        syntheses_with_causal = 0
        relation_types = {"causes": 0, "triggers": 0, "enables": 0, "prevents": 0}
        narrative_flows = {"linear": 0, "branching": 0, "circular": 0}

        for synthesis in all_syntheses:
            causal_data = synthesis.get("causal_graph", {})
            edges = causal_data.get("edges", [])

            if edges:
                syntheses_with_causal += 1
                total_relations += len(edges)

                for edge in edges:
                    rel_type = edge.get("relation_type", "causes")
                    if rel_type in relation_types:
                        relation_types[rel_type] += 1

                flow = causal_data.get("narrative_flow", "linear")
                if flow in narrative_flows:
                    narrative_flows[flow] += 1

        return {
            "total_syntheses": len(all_syntheses),
            "syntheses_with_causal_data": syntheses_with_causal,
            "total_causal_relations": total_relations,
            "avg_relations_per_synthesis": round(total_relations / max(syntheses_with_causal, 1), 2),
            "relation_types": relation_types,
            "narrative_flows": narrative_flows
        }

    except Exception as e:
        logger.error(f"Failed to get causal stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# Helper Functions
# ==========================================

def _format_date(value) -> str:
    """Convert timestamp or date to ISO string format."""
    if value is None or value == "":
        return ""
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value).isoformat()
        except Exception:
            return ""
    if isinstance(value, str):
        return value
    return str(value)


def _extract_causal_fallback(synthesis: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fallback: extract causal relations from synthesis text if not pre-computed.
    Uses regex patterns (no LLM call).
    """
    try:
        extractor = get_causal_extractor()

        # Get synthesis text
        text = synthesis.get("summary", "") or synthesis.get("body", "")

        if not text:
            return {"nodes": [], "edges": [], "central_entity": "", "narrative_flow": "linear"}

        # Extract from text using regex patterns
        graph = extractor.extract_from_synthesis(
            synthesis_text=text,
            entities=[],  # No entities available
            fact_density=0.5,
            llm_causal_output=None
        )

        return graph.to_dict()

    except Exception as e:
        logger.warning(f"Causal fallback extraction failed: {e}")
        return {"nodes": [], "edges": [], "central_entity": "", "narrative_flow": "linear"}


def _detect_inter_layer_connections(layers: List[HistoricalLayerResponse]) -> List[InterLayerConnection]:
    """
    Detect semantic connections between layers.

    For each pair of consecutive layers, checks if any effect_text in layer N
    matches semantically with any cause_text in layer N+1.

    This creates "leads_to" edges that show how events in one synthesis
    led to events in the next synthesis.
    """
    connections = []

    for layer_idx in range(len(layers) - 1):
        current_layer = layers[layer_idx]
        next_layer = layers[layer_idx + 1]

        # Get all effect texts from current layer
        for edge_idx, edge in enumerate(current_layer.edges):
            effect_text = edge.effect_text.lower()
            effect_words = set(effect_text.split())

            # Compare with all cause texts in next layer
            for next_edge_idx, next_edge in enumerate(next_layer.edges):
                cause_text = next_edge.cause_text.lower()
                cause_words = set(cause_text.split())

                # Calculate word overlap (simple semantic similarity)
                if effect_words and cause_words:
                    # Remove common stop words for better matching
                    stop_words = {'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'a', 'à', 'en',
                                  'the', 'a', 'an', 'of', 'to', 'and', 'in', 'is', 'are', 'was', 'were'}
                    effect_filtered = effect_words - stop_words
                    cause_filtered = cause_words - stop_words

                    if effect_filtered and cause_filtered:
                        overlap = len(effect_filtered & cause_filtered)
                        max_len = max(len(effect_filtered), len(cause_filtered))
                        similarity = overlap / max_len if max_len > 0 else 0

                        # Threshold for connection (40% word overlap)
                        if similarity >= 0.35:
                            # Find node IDs for source and target
                            from_node_id = f"layer{layer_idx}_edge{edge_idx}_effect"
                            to_node_id = f"layer{layer_idx + 1}_edge{next_edge_idx}_cause"

                            connections.append(InterLayerConnection(
                                from_layer=layer_idx,
                                to_layer=layer_idx + 1,
                                from_node_id=from_node_id,
                                to_node_id=to_node_id,
                                from_effect=edge.effect_text,
                                to_cause=next_edge.cause_text,
                                similarity=round(similarity, 2),
                                connection_type="leads_to"
                            ))

    # Remove duplicate connections (keep highest similarity)
    unique_connections = {}
    for conn in connections:
        key = (conn.from_layer, conn.to_layer)
        if key not in unique_connections or conn.similarity > unique_connections[key].similarity:
            unique_connections[key] = conn

    return list(unique_connections.values())
