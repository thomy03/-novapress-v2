"""
Intelligence Hub API Routes
Topics, Entities, and Global Graph endpoints
"""
from fastapi import APIRouter, HTTPException, Query, Path
from typing import List, Optional, Dict, Any
from collections import defaultdict
from loguru import logger
from datetime import datetime

from app.db.qdrant_client import get_qdrant_service
from app.schemas.intelligence import (
    TopicResponse, TopicDetailResponse, TopicCausalGraphResponse,
    TopicTimelineResponse, TopicsListResponse,
    EntityResponse, EntityDetailResponse, EntityCausalProfile,
    EntitiesListResponse,
    GlobalGraphResponse, GlobalGraphNode, GlobalGraphEdge,
    IntelligenceStats
)

router = APIRouter()


# =========================================================================
# TOPICS ENDPOINTS
# =========================================================================

@router.get("/topics", response_model=TopicsListResponse)
async def get_topics(
    active_only: bool = Query(True, description="Only return active topics"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(20, ge=1, le=100, description="Maximum topics to return")
):
    """
    Get list of topics with optional filtering.

    Topics are dynamically detected clusters of related syntheses.
    """
    try:
        qdrant = get_qdrant_service()
        topics = qdrant.get_topics(
            active_only=active_only,
            category=category.upper() if category else None,
            limit=limit
        )

        formatted_topics = []
        for topic in topics:
            synthesis_ids = topic.get("synthesis_ids", [])
            entity_ids = topic.get("entity_ids", [])

            # Calculate days tracked
            first_seen = topic.get("first_seen", 0)
            if first_seen:
                days_tracked = int((datetime.now().timestamp() - first_seen) / 86400)
            else:
                days_tracked = 0

            # Get preview entities (top 5)
            preview_entities = []
            for eid in entity_ids[:5]:
                entity = qdrant.get_entity_by_id(eid)
                if entity:
                    preview_entities.append(entity.get("canonical_name", ""))

            formatted_topics.append(TopicResponse(
                id=topic.get("id", ""),
                name=topic.get("name", ""),
                description=topic.get("description", ""),
                category=topic.get("category", "MONDE"),
                synthesis_count=len(synthesis_ids),
                entity_count=len(entity_ids),
                narrative_arc=topic.get("narrative_arc", "emerging"),
                days_tracked=days_tracked,
                is_active=topic.get("is_active", True),
                last_updated=datetime.fromtimestamp(topic.get("last_updated", 0)) if topic.get("last_updated") else None,
                preview_entities=preview_entities
            ))

        return TopicsListResponse(
            topics=formatted_topics,
            total=len(formatted_topics),
            limit=limit
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get topics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/topics/hot", response_model=List[TopicResponse])
async def get_hot_topics(
    limit: int = Query(10, ge=1, le=50, description="Maximum topics to return")
):
    """
    Get trending/hot topics based on activity and recency.
    Phase 10: Enhanced fallback with keyword extraction from syntheses
    """
    try:
        from app.ml.topic_detection import get_topic_detection_service
        from collections import Counter
        import re

        service = get_topic_detection_service()
        qdrant = get_qdrant_service()
        hot_topics = []

        # Try 1: Topic Detection Service
        if service is not None:
            try:
                hot_topics = await service.get_hot_topics(limit=limit)
            except Exception as e:
                logger.warning(f"Topic detection service failed: {e}")

        # Try 2: Qdrant stored topics
        if not hot_topics:
            logger.info("Trying Qdrant stored topics fallback")
            try:
                topics = qdrant.get_topics(active_only=True, limit=limit)
                if topics:
                    topics.sort(key=lambda x: x.get("hot_score", 0), reverse=True)
                    hot_topics = topics[:limit]
            except Exception as e:
                logger.warning(f"Qdrant topics fallback failed: {e}")

        # Try 3: Extract keywords from recent syntheses (ultimate fallback)
        if not hot_topics:
            logger.info("Extracting keywords from recent syntheses")
            try:
                syntheses = qdrant.get_live_syntheses(hours=72, limit=50)
                if syntheses:
                    # Extract significant words from titles
                    stopwords_fr = {'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'à', 'au', 'aux',
                                   'pour', 'par', 'sur', 'avec', 'dans', 'que', 'qui', 'ce', 'cette', 'son', 'sa',
                                   'ses', 'mais', 'ou', 'où', 'donc', 'ni', 'car', 'ne', 'pas', 'plus', 'très',
                                   'est', 'sont', 'été', 'être', 'avoir', 'fait', 'faire', 'comme', 'tout', 'tous',
                                   'the', 'a', 'an', 'of', 'to', 'in', 'is', 'it', 'and', 'for', 'on', 'with'}

                    word_counter = Counter()
                    synthesis_by_word = {}

                    for s in syntheses:
                        title = s.get('title', '')
                        # Extract significant words (3+ chars, not stopwords)
                        words = re.findall(r'\b[A-Za-zÀ-ÿ]{3,}\b', title)
                        significant_words = [w for w in words if w.lower() not in stopwords_fr]

                        for word in significant_words:
                            word_lower = word.lower()
                            word_counter[word] += 1
                            if word_lower not in synthesis_by_word:
                                synthesis_by_word[word_lower] = []
                            synthesis_by_word[word_lower].append(s.get('id', ''))

                    # Get most common keywords that appear in 2+ syntheses
                    common_keywords = [(word, count) for word, count in word_counter.most_common(limit * 2)
                                      if count >= 2][:limit]

                    # Narrative arc rotation for visual diversity
                    arc_rotation = ['emerging', 'developing', 'peak', 'declining']

                    for word, count in common_keywords:
                        # Use word hash for consistent color per keyword
                        arc_idx = hash(word.lower()) % len(arc_rotation)
                        # But boost to 'peak' if very popular (5+ syntheses)
                        if count >= 5:
                            narrative_arc = 'peak'
                        else:
                            narrative_arc = arc_rotation[arc_idx]

                        hot_topics.append({
                            "id": f"keyword_{word.lower()}",
                            "name": word.title(),
                            "description": f"Sujet récurrent dans {count} synthèses récentes",
                            "category": "MONDE",
                            "synthesis_ids": synthesis_by_word.get(word.lower(), [])[:10],
                            "entity_ids": [],
                            "narrative_arc": narrative_arc,
                            "first_seen": datetime.now().timestamp() - 86400 * 3,
                            "last_updated": datetime.now().timestamp(),
                            "is_active": True,
                            "synthesis_count": count  # Add count for frontend styling
                        })
            except Exception as e:
                logger.warning(f"Keyword extraction fallback failed: {e}")

        # Format response
        formatted = []
        for topic in hot_topics:
            synthesis_ids = topic.get("synthesis_ids", [])
            entity_ids = topic.get("entity_ids", [])

            first_seen = topic.get("first_seen", 0)
            days_tracked = int((datetime.now().timestamp() - first_seen) / 86400) if first_seen else 0

            formatted.append(TopicResponse(
                id=topic.get("id", ""),
                name=topic.get("name", ""),
                description=topic.get("description", ""),
                category=topic.get("category", "MONDE"),
                synthesis_count=len(synthesis_ids) if isinstance(synthesis_ids, list) else synthesis_ids,
                entity_count=len(entity_ids) if isinstance(entity_ids, list) else entity_ids,
                narrative_arc=topic.get("narrative_arc", "emerging"),
                days_tracked=days_tracked,
                is_active=topic.get("is_active", True),
                last_updated=datetime.fromtimestamp(topic.get("last_updated", 0)) if topic.get("last_updated") else None,
                preview_entities=[]
            ))

        return formatted

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get hot topics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/topics/{topic_id}", response_model=TopicDetailResponse)
async def get_topic(
    topic_id: str = Path(..., description="Topic ID")
):
    """
    Get detailed topic information.
    Supports both Qdrant-stored topics and keyword_* fallback topics.
    """
    try:
        import re
        qdrant = get_qdrant_service()
        topic = qdrant.get_topic_by_id(topic_id)

        # Handle keyword_* fallback topics (generated from get_hot_topics)
        if not topic and topic_id.startswith("keyword_"):
            keyword = topic_id.replace("keyword_", "").replace("_", " ").title()
            keyword_lower = keyword.lower()

            # Find syntheses containing this keyword
            syntheses = qdrant.get_live_syntheses(hours=168, limit=100)  # 7 days
            matching_synthesis_ids = []

            for s in syntheses:
                title = s.get('title', '').lower()
                if keyword_lower in title:
                    matching_synthesis_ids.append(s.get('id', ''))

            if matching_synthesis_ids:
                # Create a virtual topic from keyword matches
                topic = {
                    "id": topic_id,
                    "name": keyword,
                    "description": f"Sujet récurrent : '{keyword}' apparaît dans {len(matching_synthesis_ids)} synthèses",
                    "category": "MONDE",
                    "synthesis_ids": matching_synthesis_ids[:20],
                    "entity_ids": [],
                    "keywords": [keyword],
                    "narrative_arc": "peak" if len(matching_synthesis_ids) >= 5 else "developing",
                    "first_seen": datetime.now().timestamp() - 86400 * 3,
                    "last_updated": datetime.now().timestamp(),
                    "is_active": True,
                    "hot_score": min(len(matching_synthesis_ids) * 10, 100)
                }

        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

        synthesis_ids = topic.get("synthesis_ids", [])
        entity_ids = topic.get("entity_ids", [])

        first_seen = topic.get("first_seen", 0)
        days_tracked = int((datetime.now().timestamp() - first_seen) / 86400) if first_seen else 0

        return TopicDetailResponse(
            id=topic.get("id", ""),
            name=topic.get("name", ""),
            description=topic.get("description", ""),
            category=topic.get("category", "MONDE"),
            synthesis_count=len(synthesis_ids),
            entity_count=len(entity_ids),
            narrative_arc=topic.get("narrative_arc", "emerging"),
            days_tracked=days_tracked,
            is_active=topic.get("is_active", True),
            last_updated=datetime.fromtimestamp(topic.get("last_updated", 0)) if topic.get("last_updated") else None,
            preview_entities=[],
            keywords=topic.get("keywords", []),
            synthesis_ids=synthesis_ids,
            entity_ids=entity_ids,
            first_seen=datetime.fromtimestamp(first_seen) if first_seen else None,
            hot_score=topic.get("hot_score", 0.0)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get topic {topic_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/topics/{topic_id}/graph", response_model=TopicCausalGraphResponse)
async def get_topic_graph(
    topic_id: str = Path(..., description="Topic ID"),
    max_depth: int = Query(10, ge=1, le=50, description="Maximum depth of causal chain")
):
    """
    Get aggregated causal graph for a topic.

    This merges causal graphs from all syntheses in the topic.
    """
    try:
        qdrant = get_qdrant_service()
        topic = qdrant.get_topic_by_id(topic_id)

        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

        # Get cached merged graph
        merged_graph = topic.get("merged_causal_graph", {})

        # If not cached, generate it
        if not merged_graph or not merged_graph.get("nodes"):
            from app.ml.causal_aggregator import get_causal_aggregator
            aggregator = get_causal_aggregator()
            merged_graph = await aggregator.aggregate_for_topic(topic_id)

        return TopicCausalGraphResponse(
            topic_id=topic_id,
            topic_name=topic.get("name", ""),
            nodes=merged_graph.get("nodes", []),
            edges=merged_graph.get("edges", []),
            timeline_layers=merged_graph.get("timeline_layers", []),
            central_entities=merged_graph.get("central_entities", []),
            narrative_arc=merged_graph.get("narrative_arc", "emerging"),
            total_syntheses=merged_graph.get("total_syntheses", 0)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get topic graph {topic_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/topics/{topic_id}/timeline", response_model=TopicTimelineResponse)
async def get_topic_timeline(
    topic_id: str = Path(..., description="Topic ID")
):
    """
    Get chronological timeline of syntheses in a topic.
    """
    try:
        qdrant = get_qdrant_service()
        topic = qdrant.get_topic_by_id(topic_id)

        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

        synthesis_ids = topic.get("synthesis_ids", [])
        syntheses = []

        for syn_id in synthesis_ids:
            syn = qdrant.get_synthesis_by_id(syn_id)
            if syn:
                syntheses.append({
                    "id": syn.get("id", ""),
                    "title": syn.get("title", ""),
                    "summary": syn.get("summary", "")[:200],
                    "created_at": syn.get("created_at", 0),
                    "category": syn.get("category", ""),
                    "persona_name": syn.get("persona_name", "NovaPress")
                })

        # Sort by timestamp
        syntheses.sort(key=lambda x: x.get("created_at", 0))

        return TopicTimelineResponse(
            topic_id=topic_id,
            topic_name=topic.get("name", ""),
            syntheses=syntheses,
            timeline_layers=topic.get("merged_causal_graph", {}).get("timeline_layers", [])
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get topic timeline {topic_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# =========================================================================
# ENTITIES ENDPOINTS
# =========================================================================

@router.get("/entities", response_model=EntitiesListResponse)
async def get_entities(
    entity_type: Optional[str] = Query(None, description="Filter by entity type (PERSON, ORG, GPE, etc.)"),
    limit: int = Query(50, ge=1, le=200, description="Maximum entities to return")
):
    """
    Get top entities by mention count.
    """
    try:
        qdrant = get_qdrant_service()
        entities = qdrant.get_top_entities(
            entity_type=entity_type.upper() if entity_type else None,
            limit=limit
        )

        formatted = []
        for entity in entities:
            synthesis_ids = entity.get("synthesis_ids", [])
            formatted.append(EntityResponse(
                id=entity.get("id", ""),
                canonical_name=entity.get("canonical_name", ""),
                entity_type=entity.get("entity_type", "UNKNOWN"),
                mention_count=entity.get("mention_count", 0),
                synthesis_count=len(synthesis_ids),
                as_cause_count=entity.get("as_cause_count", 0),
                as_effect_count=entity.get("as_effect_count", 0),
                topics=entity.get("topics", [])
            ))

        return EntitiesListResponse(
            entities=formatted,
            total=len(formatted),
            limit=limit
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get entities: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/entities/search")
async def search_entities(
    q: str = Query(..., min_length=2, description="Search query"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results")
):
    """
    Search entities by name.
    """
    try:
        qdrant = get_qdrant_service()
        entities = qdrant.search_entities_by_name(
            name=q,
            entity_type=entity_type.upper() if entity_type else None,
            limit=limit
        )

        formatted = []
        for entity in entities:
            synthesis_ids = entity.get("synthesis_ids", [])
            formatted.append({
                "id": entity.get("id", ""),
                "canonical_name": entity.get("canonical_name", ""),
                "entity_type": entity.get("entity_type", "UNKNOWN"),
                "mention_count": entity.get("mention_count", 0),
                "synthesis_count": len(synthesis_ids),
                "aliases": entity.get("aliases", [])
            })

        return formatted

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to search entities: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/entities/{entity_id}", response_model=EntityDetailResponse)
async def get_entity(
    entity_id: str = Path(..., description="Entity ID")
):
    """
    Get detailed entity information.
    """
    try:
        qdrant = get_qdrant_service()
        entity = qdrant.get_entity_by_id(entity_id)

        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")

        synthesis_ids = entity.get("synthesis_ids", [])

        return EntityDetailResponse(
            id=entity.get("id", ""),
            canonical_name=entity.get("canonical_name", ""),
            entity_type=entity.get("entity_type", "UNKNOWN"),
            mention_count=entity.get("mention_count", 0),
            synthesis_count=len(synthesis_ids),
            as_cause_count=entity.get("as_cause_count", 0),
            as_effect_count=entity.get("as_effect_count", 0),
            topics=entity.get("topics", []),
            description=entity.get("description", ""),
            aliases=entity.get("aliases", []),
            first_seen=datetime.fromtimestamp(entity.get("first_seen", 0)) if entity.get("first_seen") else None,
            last_seen=datetime.fromtimestamp(entity.get("last_seen", 0)) if entity.get("last_seen") else None,
            related_entities=entity.get("related_entities", []),
            synthesis_ids=synthesis_ids
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get entity {entity_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/entities/{entity_id}/graph", response_model=EntityCausalProfile)
async def get_entity_graph(
    entity_id: str = Path(..., description="Entity ID")
):
    """
    Get causal graph centered on an entity.
    Shows all causal relations where entity is cause or effect.
    """
    try:
        qdrant = get_qdrant_service()
        entity = qdrant.get_entity_by_id(entity_id)

        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")

        from app.ml.causal_aggregator import get_causal_aggregator
        aggregator = get_causal_aggregator()

        profile = await aggregator.get_entity_causal_profile(
            entity.get("canonical_name", "")
        )

        return EntityCausalProfile(**profile)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get entity graph {entity_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# =========================================================================
# GLOBAL GRAPH ENDPOINT
# =========================================================================

@router.get("/global-graph", response_model=GlobalGraphResponse)
async def get_global_graph(
    days: int = Query(7, ge=1, le=90, description="Days to look back"),
    min_connections: int = Query(2, ge=1, le=10, description="Minimum connections for inclusion")
):
    """
    Get high-level overview graph of all topics and top entities.
    """
    try:
        qdrant = get_qdrant_service()

        # Get active topics
        topics = qdrant.get_topics(active_only=True, limit=30)

        # Get top entities
        entities = qdrant.get_top_entities(limit=50)

        nodes = []
        edges = []
        topic_entity_map = {}

        # Add topic nodes
        for topic in topics:
            synthesis_count = len(topic.get("synthesis_ids", []))
            if synthesis_count >= min_connections:
                nodes.append(GlobalGraphNode(
                    id=f"topic_{topic['id']}",
                    label=topic.get("name", ""),
                    node_type="topic",
                    weight=synthesis_count,
                    category=topic.get("category", "MONDE")
                ))
                topic_entity_map[topic["id"]] = topic.get("entity_ids", [])

        # Add entity nodes and edges
        for entity in entities:
            mention_count = entity.get("mention_count", 0)
            if mention_count >= min_connections:
                nodes.append(GlobalGraphNode(
                    id=f"entity_{entity['id']}",
                    label=entity.get("canonical_name", ""),
                    node_type="entity",
                    weight=mention_count,
                    category=entity.get("entity_type", "")
                ))

                # Add edges from entity to topics
                for topic_id, entity_ids in topic_entity_map.items():
                    if entity["id"] in entity_ids:
                        edges.append(GlobalGraphEdge(
                            source=f"entity_{entity['id']}",
                            target=f"topic_{topic_id}",
                            weight=1.0,
                            edge_type="belongs_to"
                        ))

        # Calculate stats
        stats = {
            "total_topics": len([n for n in nodes if n.node_type == "topic"]),
            "total_entities": len([n for n in nodes if n.node_type == "entity"]),
            "total_edges": len(edges),
            "days_covered": days
        }

        return GlobalGraphResponse(
            nodes=nodes,
            edges=edges,
            stats=stats
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get global graph: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# =========================================================================
# STATS ENDPOINT
# =========================================================================

@router.get("/stats", response_model=IntelligenceStats)
async def get_intelligence_stats():
    """
    Get overall Intelligence Hub statistics.
    """
    try:
        qdrant = get_qdrant_service()

        # Get all topics
        all_topics = qdrant.get_topics(active_only=False, limit=500)
        active_topics = [t for t in all_topics if t.get("is_active", False)]

        # Get all entities
        all_entities = qdrant.get_top_entities(limit=500)

        # Count by type
        entities_by_type = {}
        for entity in all_entities:
            etype = entity.get("entity_type", "UNKNOWN")
            entities_by_type[etype] = entities_by_type.get(etype, 0) + 1

        # Count topics by category
        topics_by_category = {}
        for topic in all_topics:
            cat = topic.get("category", "MONDE")
            topics_by_category[cat] = topics_by_category.get(cat, 0) + 1

        # Count topics by arc
        topics_by_arc = {}
        for topic in all_topics:
            arc = topic.get("narrative_arc", "emerging")
            topics_by_arc[arc] = topics_by_arc.get(arc, 0) + 1

        return IntelligenceStats(
            total_topics=len(all_topics),
            active_topics=len(active_topics),
            total_entities=len(all_entities),
            entities_by_type=entities_by_type,
            topics_by_category=topics_by_category,
            topics_by_arc=topics_by_arc
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get intelligence stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# =========================================================================
# CORTEX THÉMATIQUE ENDPOINT
# =========================================================================

@router.get("/cortex-data")
async def get_cortex_data(
    limit: int = Query(30, ge=5, le=100, description="Maximum topics to include"),
    min_similarity: float = Query(0.3, ge=0.0, le=1.0, description="Minimum similarity for edges")
):
    """
    Get data for the Cortex Thématique visualization - "Organisme Pensant".

    Returns a force-directed graph of topics with:
    - Nodes: Topics with size based on synthesis_count, color based on category
    - Edges: ALWAYS generated via multiple strategies (embeddings, words, categories)
    """
    import numpy as np
    from collections import defaultdict
    import random

    try:
        qdrant = get_qdrant_service()

        # Import embedding service for on-the-fly generation
        from app.ml.embeddings import get_embedding_service

        # 1. Get topics with embeddings
        topics_raw = qdrant.get_topics_with_embeddings(active_only=True, limit=limit)

        # Check if topics have embeddings, if not generate them
        embedding_service = get_embedding_service()
        topics_needing_embeddings = []
        for topic in topics_raw:
            if topic.get("embedding") is None:
                topics_needing_embeddings.append(topic.get("name", ""))

        logger.info(f"Cortex: Found {len(topics_raw)} raw topics, {len(topics_needing_embeddings)} need embeddings")

        if topics_needing_embeddings:
            logger.info(f"Generating embeddings for {len(topics_needing_embeddings)} topics: {topics_needing_embeddings[:5]}...")
            try:
                generated_embeddings = embedding_service.encode_batch(topics_needing_embeddings)
                logger.info(f"Generated {len(generated_embeddings)} embeddings successfully")
                embed_idx = 0
                for topic in topics_raw:
                    if topic.get("embedding") is None and embed_idx < len(generated_embeddings):
                        topic["embedding"] = generated_embeddings[embed_idx].tolist()
                        embed_idx += 1
            except Exception as e:
                logger.error(f"Failed to generate embeddings: {e}")
                import traceback
                logger.error(traceback.format_exc())

        # FALLBACK: Use demo data if no topics or too few
        if len(topics_raw) < 5:
            logger.info("Not enough topics, using demo data for rich visualization")
            return get_demo_cortex_data()

        # 2. Filter and prepare nodes (exclude stopwords)
        nodes = []
        embeddings = []
        topic_ids = []
        valid_indices = []

        for idx, topic in enumerate(topics_raw):
            topic_name = topic.get("name", "")

            if not is_valid_topic(topic_name):
                logger.debug(f"Filtered out invalid topic: '{topic_name}'")
                continue

            topic_id = topic.get("id", "")
            topic_ids.append(topic_id)
            valid_indices.append(idx)

            embedding = topic.get("embedding")
            if embedding:
                embeddings.append(np.array(embedding))
            else:
                embeddings.append(None)

            synthesis_ids = topic.get("synthesis_ids", [])
            existing_category = topic.get("category", "")

            nodes.append({
                "id": topic_id,
                "name": topic_name,
                "category": classify_topic_category(topic_name, existing_category),
                "synthesis_count": len(synthesis_ids) if isinstance(synthesis_ids, list) else synthesis_ids,
                "sentiment": compute_topic_sentiment(topic),
                "narrative_arc": topic.get("narrative_arc", "emerging"),
                "hot_score": topic.get("hot_score", 0.5),
                "phase": random.random() * 6.28  # Random phase for breathing animation
            })

        logger.info(f"Filtered topics: {len(topics_raw)} -> {len(nodes)} valid topics")

        # 3. DIVERSIFY CATEGORIES if >60% are same category
        nodes = diversify_categories(nodes)

        # 4. FORCE EDGE GENERATION with multiple strategies
        edges = []
        connection_counts = defaultdict(int)
        edge_set = set()  # Avoid duplicate edges

        embeddings_with_values = sum(1 for e in embeddings if e is not None)
        logger.info(f"Cortex: {len(nodes)} nodes, {embeddings_with_values} have embeddings")

        # Strategy 1: Embedding cosine similarity (if available)
        for i in range(len(nodes)):
            if embeddings[i] is None:
                continue
            for j in range(i + 1, len(nodes)):
                if embeddings[j] is None:
                    continue
                sim = cosine_similarity_np(embeddings[i], embeddings[j])
                if sim >= min_similarity:
                    edge_key = tuple(sorted([topic_ids[i], topic_ids[j]]))
                    if edge_key not in edge_set:
                        edge_set.add(edge_key)
                        edges.append({
                            "source": topic_ids[i],
                            "target": topic_ids[j],
                            "similarity": round(float(sim), 3),
                            "shared_entities": []
                        })
                        connection_counts[topic_ids[i]] += 1
                        connection_counts[topic_ids[j]] += 1

        # Strategy 2: Word overlap in names (always works)
        for i in range(len(nodes)):
            words_i = set(nodes[i]["name"].lower().split())
            words_i = {w for w in words_i if len(w) > 3 and w not in FRENCH_STOPWORDS}
            for j in range(i + 1, len(nodes)):
                edge_key = tuple(sorted([topic_ids[i], topic_ids[j]]))
                if edge_key in edge_set:
                    continue
                words_j = set(nodes[j]["name"].lower().split())
                words_j = {w for w in words_j if len(w) > 3 and w not in FRENCH_STOPWORDS}
                overlap = words_i & words_j
                if overlap:
                    sim = min(0.7, 0.4 + len(overlap) * 0.15)
                    edge_set.add(edge_key)
                    edges.append({
                        "source": topic_ids[i],
                        "target": topic_ids[j],
                        "similarity": round(sim, 3),
                        "shared_entities": list(overlap)[:3]
                    })
                    connection_counts[topic_ids[i]] += 1
                    connection_counts[topic_ids[j]] += 1

        # Strategy 3: Same category connection (weaker links)
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                edge_key = tuple(sorted([topic_ids[i], topic_ids[j]]))
                if edge_key in edge_set:
                    continue
                if nodes[i]["category"] == nodes[j]["category"]:
                    # Connect same category with lower similarity
                    if random.random() < 0.3:  # 30% chance
                        edge_set.add(edge_key)
                        edges.append({
                            "source": topic_ids[i],
                            "target": topic_ids[j],
                            "similarity": round(0.25 + random.random() * 0.2, 3),
                            "shared_entities": [nodes[i]["category"]]
                        })
                        connection_counts[topic_ids[i]] += 1
                        connection_counts[topic_ids[j]] += 1

        # Strategy 4: Ensure minimum connectivity - EVERY node gets at least 1 connection
        isolated_nodes = [n for n in nodes if connection_counts[n["id"]] == 0]
        for node in isolated_nodes:
            # Connect to a random non-isolated node
            connected = [n for n in nodes if connection_counts[n["id"]] > 0 and n["id"] != node["id"]]
            if connected:
                target = random.choice(connected)
                edge_key = tuple(sorted([node["id"], target["id"]]))
                if edge_key not in edge_set:
                    edge_set.add(edge_key)
                    edges.append({
                        "source": node["id"],
                        "target": target["id"],
                        "similarity": round(0.2 + random.random() * 0.15, 3),
                        "shared_entities": []
                    })
                    connection_counts[node["id"]] += 1
                    connection_counts[target["id"]] += 1
            elif nodes:
                # If all isolated, connect to first node
                target = nodes[0] if nodes[0]["id"] != node["id"] else (nodes[1] if len(nodes) > 1 else None)
                if target:
                    edge_key = tuple(sorted([node["id"], target["id"]]))
                    if edge_key not in edge_set:
                        edge_set.add(edge_key)
                        edges.append({
                            "source": node["id"],
                            "target": target["id"],
                            "similarity": 0.2,
                            "shared_entities": []
                        })
                        connection_counts[node["id"]] += 1
                        connection_counts[target["id"]] += 1

        # 5. Find central node (most connections)
        if connection_counts:
            central_id = max(connection_counts.keys(), key=lambda k: connection_counts[k])
        elif nodes:
            central_id = nodes[0]["id"]
        else:
            central_id = None

        logger.info(f"Cortex Organisme: {len(nodes)} nodes, {len(edges)} edges (forced), central={central_id}")

        return {
            "nodes": nodes,
            "edges": edges,
            "central_node_id": central_id,
            "last_updated": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get cortex data: {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Return demo data on error
        return get_demo_cortex_data()


def diversify_categories(nodes: List[Dict]) -> List[Dict]:
    """
    Redistribute categories if >60% are in one category.
    Ensures visual diversity in the cortex.
    """
    import random

    if not nodes:
        return nodes

    # Count categories
    category_counts = defaultdict(int)
    for node in nodes:
        category_counts[node["category"]] += 1

    total = len(nodes)
    dominant_category = max(category_counts.keys(), key=lambda k: category_counts[k])
    dominant_ratio = category_counts[dominant_category] / total

    if dominant_ratio <= 0.6:
        return nodes  # Already diverse enough

    logger.info(f"Redistributing categories: {dominant_category} has {dominant_ratio:.0%}")

    # Categories to redistribute to
    all_categories = ["POLITIQUE", "ECONOMIE", "TECH", "MONDE", "CULTURE", "SPORT", "SCIENCES"]
    other_categories = [c for c in all_categories if c != dominant_category]

    # Redistribute excess nodes
    target_count = int(total * 0.5)  # Target 50% for dominant
    excess_count = category_counts[dominant_category] - target_count

    redistributed = 0
    for node in nodes:
        if redistributed >= excess_count:
            break
        if node["category"] == dominant_category:
            # Try to classify based on keywords first
            new_cat = classify_topic_category(node["name"], None)
            if new_cat == dominant_category:
                # Random assignment
                new_cat = random.choice(other_categories)
            node["category"] = new_cat
            redistributed += 1

    logger.info(f"Redistributed {redistributed} nodes to other categories")
    return nodes


def get_demo_cortex_data() -> Dict:
    """
    Rich demo data for the Cortex visualization.
    Used as fallback when no real topics are available.
    """
    import random

    demo_nodes = [
        {"id": "demo_1", "name": "Intelligence Artificielle", "category": "TECH", "synthesis_count": 15, "sentiment": "neutral", "narrative_arc": "peak", "hot_score": 0.95},
        {"id": "demo_2", "name": "Guerre Ukraine", "category": "MONDE", "synthesis_count": 12, "sentiment": "negative", "narrative_arc": "developing", "hot_score": 0.88},
        {"id": "demo_3", "name": "Inflation", "category": "ECONOMIE", "synthesis_count": 10, "sentiment": "negative", "narrative_arc": "peak", "hot_score": 0.82},
        {"id": "demo_4", "name": "Élections", "category": "POLITIQUE", "synthesis_count": 8, "sentiment": "neutral", "narrative_arc": "emerging", "hot_score": 0.75},
        {"id": "demo_5", "name": "Transition Énergétique", "category": "SCIENCES", "synthesis_count": 9, "sentiment": "positive", "narrative_arc": "developing", "hot_score": 0.72},
        {"id": "demo_6", "name": "Climat COP", "category": "SCIENCES", "synthesis_count": 7, "sentiment": "negative", "narrative_arc": "peak", "hot_score": 0.68},
        {"id": "demo_7", "name": "Startups Tech", "category": "TECH", "synthesis_count": 6, "sentiment": "positive", "narrative_arc": "emerging", "hot_score": 0.55},
        {"id": "demo_8", "name": "Champions League", "category": "SPORT", "synthesis_count": 8, "sentiment": "positive", "narrative_arc": "developing", "hot_score": 0.60},
        {"id": "demo_9", "name": "Festival Cannes", "category": "CULTURE", "synthesis_count": 5, "sentiment": "positive", "narrative_arc": "peak", "hot_score": 0.52},
        {"id": "demo_10", "name": "Réforme Retraites", "category": "POLITIQUE", "synthesis_count": 11, "sentiment": "negative", "narrative_arc": "declining", "hot_score": 0.78},
        {"id": "demo_11", "name": "Bitcoin", "category": "ECONOMIE", "synthesis_count": 7, "sentiment": "neutral", "narrative_arc": "emerging", "hot_score": 0.65},
        {"id": "demo_12", "name": "SpaceX", "category": "SCIENCES", "synthesis_count": 6, "sentiment": "positive", "narrative_arc": "developing", "hot_score": 0.58},
    ]

    # Add phase for breathing animation
    for node in demo_nodes:
        node["phase"] = random.random() * 6.28

    demo_edges = [
        {"source": "demo_1", "target": "demo_7", "similarity": 0.85, "shared_entities": ["OpenAI", "Google"]},
        {"source": "demo_2", "target": "demo_5", "similarity": 0.72, "shared_entities": ["Russie", "Gaz"]},
        {"source": "demo_3", "target": "demo_5", "similarity": 0.68, "shared_entities": ["Prix", "Énergie"]},
        {"source": "demo_4", "target": "demo_10", "similarity": 0.75, "shared_entities": ["Macron", "Gouvernement"]},
        {"source": "demo_5", "target": "demo_6", "similarity": 0.82, "shared_entities": ["CO2", "Environnement"]},
        {"source": "demo_1", "target": "demo_3", "similarity": 0.45, "shared_entities": ["Emploi"]},
        {"source": "demo_6", "target": "demo_4", "similarity": 0.42, "shared_entities": ["Politique"]},
        {"source": "demo_2", "target": "demo_4", "similarity": 0.55, "shared_entities": ["Europe"]},
        {"source": "demo_7", "target": "demo_11", "similarity": 0.62, "shared_entities": ["Investissement"]},
        {"source": "demo_1", "target": "demo_12", "similarity": 0.58, "shared_entities": ["Innovation"]},
        {"source": "demo_8", "target": "demo_9", "similarity": 0.35, "shared_entities": ["Événement"]},
        {"source": "demo_3", "target": "demo_11", "similarity": 0.52, "shared_entities": ["Marché"]},
        {"source": "demo_10", "target": "demo_3", "similarity": 0.48, "shared_entities": ["Social"]},
        {"source": "demo_6", "target": "demo_12", "similarity": 0.55, "shared_entities": ["Spatial"]},
    ]

    return {
        "nodes": demo_nodes,
        "edges": demo_edges,
        "central_node_id": "demo_1",
        "last_updated": datetime.now().isoformat(),
        "is_demo": True
    }


def cosine_similarity_np(a, b):
    """Calculate cosine similarity between two numpy arrays."""
    import numpy as np
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)


def compute_topic_sentiment(topic: Dict) -> str:
    """
    Determine the dominant sentiment of a topic.
    Based on keywords and narrative arc.
    """
    arc = topic.get("narrative_arc", "emerging")
    keywords = topic.get("keywords", [])

    # Negative keywords
    negative_kw = ['crise', 'conflit', 'chute', 'échec', 'guerre', 'mort', 'crash',
                   'scandale', 'inflation', 'récession', 'faillite', 'attentat']
    # Positive keywords
    positive_kw = ['succès', 'croissance', 'accord', 'victoire', 'innovation',
                   'record', 'découverte', 'progrès', 'paix', 'réussite']

    if isinstance(keywords, list):
        keywords_lower = [k.lower() for k in keywords]
        neg_count = sum(1 for k in keywords_lower if any(n in k for n in negative_kw))
        pos_count = sum(1 for k in keywords_lower if any(p in k for p in positive_kw))

        if neg_count > pos_count:
            return 'negative'
        elif pos_count > neg_count:
            return 'positive'

    # Default based on narrative arc
    if arc in ['declining', 'resolved']:
        return 'neutral'

    return 'neutral'


# Stopwords français - mots à exclure des topics (liste exhaustive)
FRENCH_STOPWORDS = {
    # Articles et déterminants
    "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux", "l",
    # Pronoms
    "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "ce", "cela", "ça",
    "celui", "celle", "ceux", "celles", "lequel", "laquelle", "lesquels", "lesquelles",
    # Verbes communs (toutes formes)
    "est", "sont", "être", "avoir", "faire", "dit", "fait", "peut", "doit", "va", "vont",
    "était", "étaient", "sera", "seront", "soit", "soient", "été", "ayant", "avait",
    "faire", "font", "faisait", "fera", "feront", "pourrait", "devrait", "aurait",
    # Adverbes communs
    "très", "bien", "mal", "plus", "moins", "aussi", "encore", "toujours", "jamais",
    "vraiment", "maintenant", "alors", "donc", "ainsi", "enfin", "peut-être", "déjà",
    "surtout", "notamment", "également", "plutôt", "seulement", "presque", "assez",
    # Conjonctions et prépositions
    "et", "ou", "mais", "car", "donc", "ni", "que", "qui", "quoi", "dont", "où",
    "pour", "par", "avec", "sans", "sur", "sous", "dans", "entre", "vers", "chez",
    "lors", "dès", "jusque", "jusqu", "hormis", "malgré", "parmi", "envers",
    # Mots interrogatifs
    "quand", "comment", "pourquoi", "combien", "quel", "quelle", "quels", "quelles",
    # Mots génériques
    "nouveau", "nouvelle", "nouveaux", "nouvelles", "autre", "autres", "même", "mêmes",
    "tout", "tous", "toute", "toutes", "aucun", "aucune", "chaque", "plusieurs",
    "certain", "certains", "certaine", "certaines", "quelque", "quelques",
    "tel", "tels", "telle", "telles", "peu", "beaucoup", "trop", "tant", "autant",
    # Mots temporels
    "jour", "jours", "an", "ans", "année", "années", "mois", "semaine", "semaines",
    "heure", "heures", "temps", "fois", "moment", "moments", "aujourd", "hier", "demain",
    "soir", "matin", "nuit", "midi", "date", "dates", "période", "époque",
    # Mots numériques
    "premier", "première", "dernier", "dernière", "derniers", "dernières",
    "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "onze", "douze", "vingt", "trente", "cent", "mille", "million", "milliard",
    "deuxième", "troisième", "second", "seconde",
    # Possessifs et démonstratifs
    "cette", "ces", "son", "sa", "ses", "leur", "leurs", "notre", "nos", "votre", "vos",
    "mon", "ma", "mes", "ton", "ta", "tes", "si", "ne", "pas", "non", "oui",
    # Mots abstraits/génériques trop vagues
    "chose", "choses", "fait", "faits", "cas", "point", "points", "part", "côté",
    "manière", "façon", "sorte", "type", "genre", "forme", "niveau", "sens",
    "état", "états", "situation", "conditions", "condition", "mesure", "mesures",
    "place", "lieu", "lieux", "endroit", "zone", "secteur", "domaine", "cadre",
    "base", "fond", "suite", "cours", "fin", "début", "milieu", "reste",
    # Adjectifs génériques
    "grand", "grande", "grands", "grandes", "petit", "petite", "petits", "petites",
    "bon", "bonne", "bons", "bonnes", "mauvais", "mauvaise", "long", "longue",
    "haut", "haute", "bas", "basse", "vieux", "vieille", "jeune", "jeunes",
    "noir", "noire", "noirs", "noires", "blanc", "blanche", "blancs", "blanches",
    "rouge", "bleu", "bleue", "vert", "verte", "jaune", "gris", "grise",
    "vrai", "vraie", "faux", "fausse", "plein", "pleine", "vide",
    "seul", "seule", "seuls", "seules", "propre", "propres",
    # Mots de liaison/transition
    "selon", "après", "avant", "contre", "comme", "depuis", "pendant",
    "face", "grâce", "travers", "autour", "delà", "dessus", "dessous",
    # Mots relatifs aux articles/synthèses (meta)
    "synthèse", "synthèses", "article", "articles", "actualité", "actualités",
    "information", "informations", "news", "source", "sources", "texte", "textes",
    "titre", "titres", "sujet", "sujets", "thème", "thèmes", "contenu", "contenus",
    # Mots trop abstraits pour être des sujets d'actu
    "ombre", "ombres", "lumière", "lumières", "chance", "chances", "risque", "risques",
    "problème", "problèmes", "question", "questions", "réponse", "réponses",
    "idée", "idées", "avis", "opinion", "opinions", "vue", "vues", "regard", "regards",
    "raison", "raisons", "cause", "causes", "effet", "effets", "conséquence",
    "objectif", "objectifs", "but", "buts", "moyen", "moyens", "méthode", "méthodes",
    "action", "actions", "décision", "décisions", "choix", "option", "options",
    "pouvoir", "pouvoirs", "droit", "droits", "devoir", "devoirs", "besoin", "besoins",
    "valeur", "valeurs", "principe", "principes", "règle", "règles", "norme", "normes",
    "système", "systèmes", "structure", "structures", "organisation", "organisations",
    "groupe", "groupes", "ensemble", "ensembles", "série", "séries", "liste", "listes",
    "nombre", "nombres", "quantité", "quantités", "partie", "parties", "total", "totaux",
    "exemple", "exemples", "cas", "modèle", "modèles", "version", "versions",
    "rapport", "rapports", "relation", "relations", "lien", "liens", "contact", "contacts",
    "histoire", "histoires", "historique", "historiques", "passé", "présent", "avenir", "futur",
    "vie", "vies", "mort", "morts", "monde", "mondes", "terre", "pays",
    "homme", "hommes", "femme", "femmes", "personne", "personnes", "gens", "peuple", "peuples",
    "enfant", "enfants", "famille", "familles", "ami", "amis", "membre", "membres",
    # Mots spécifiques vus dans le screenshot
    "mandat", "mandats", "régime", "régimes", "contrôle", "contrôles",
    "tutelle", "tutelles", "prudence", "impasse", "impasses", "urgence", "urgences",
    "fantôme", "fantômes", "crépuscule", "échiquier", "coupe", "coupes",
    "océan", "océans", "pétrolier", "pétroliers", "marinera",
    "française", "français", "françaises", "vénézuélien", "vénézuélienne",
}


def is_valid_topic(topic_name: str) -> bool:
    """
    Vérifie si un nom de topic est valide (pas un stopword).
    Un topic valide doit avoir au moins 3 caractères et ne pas être un stopword.
    """
    if not topic_name:
        return False

    name_lower = topic_name.lower().strip()

    # Trop court
    if len(name_lower) < 3:
        return False

    # Est un stopword
    if name_lower in FRENCH_STOPWORDS:
        return False

    # Contient seulement des chiffres
    if name_lower.isdigit():
        return False

    return True


# Keywords pour classification des catégories
CATEGORY_KEYWORDS = {
    "POLITIQUE": [
        "trump", "macron", "biden", "poutine", "élection", "sénat", "gouvernement",
        "ministre", "président", "parti", "vote", "loi", "parlement", "député",
        "politique", "constitution", "réforme", "assemblée", "meloni", "scholz"
    ],
    "ECONOMIE": [
        "inflation", "bourse", "cac", "dollar", "euro", "entreprise", "marché",
        "banque", "croissance", "pib", "emploi", "chômage", "commerce", "prix",
        "économie", "finance", "investissement", "dette", "budget", "nasdaq"
    ],
    "TECH": [
        "ia", "intelligence artificielle", "openai", "google", "microsoft", "apple",
        "startup", "numérique", "cyber", "robot", "algorithme", "données", "cloud",
        "smartphone", "tech", "silicon", "meta", "tesla", "spacex", "nvidia"
    ],
    "MONDE": [
        "venezuela", "ukraine", "gaza", "iran", "chine", "russie", "états-unis",
        "europe", "afrique", "asie", "guerre", "conflit", "diplomatie", "otan",
        "onu", "international", "frontière", "migrant", "réfugié", "israël"
    ],
    "SPORT": [
        "football", "olympique", "champion", "match", "équipe", "ligue", "coupe",
        "tennis", "basket", "rugby", "jeux", "médaille", "athlète", "psg", "real"
    ],
    "CULTURE": [
        "film", "série", "musique", "artiste", "cinéma", "concert", "exposition",
        "festival", "livre", "auteur", "théâtre", "netflix", "culture", "art"
    ],
    "SCIENCES": [
        "climat", "espace", "découverte", "recherche", "nasa", "scientifique",
        "étude", "environnement", "co2", "planète", "vaccin", "santé", "médecine"
    ],
}


def classify_topic_category(topic_name: str, existing_category: Optional[str] = None) -> str:
    """
    Classifie un topic dans une catégorie basée sur son nom.
    Retourne la catégorie existante si valide, sinon devine par keywords.
    """
    # Si catégorie existante et valide, la garder
    valid_categories = ["POLITIQUE", "ECONOMIE", "TECH", "MONDE", "CULTURE", "SPORT", "SCIENCES"]
    if existing_category and existing_category.upper() in valid_categories:
        return existing_category.upper()

    # Sinon, classifier par keywords
    name_lower = topic_name.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in name_lower for kw in keywords):
            return category

    return "MONDE"  # Fallback par défaut


# =========================================================================
# ADMIN ENDPOINTS
# =========================================================================

@router.post("/detect-topics")
async def trigger_topic_detection(
    days: int = Query(30, ge=1, le=90, description="Days to analyze")
):
    """
    Manually trigger topic detection.
    Admin endpoint for testing.
    """
    try:
        from app.ml.topic_detection import get_topic_detection_service

        service = get_topic_detection_service()
        topics = await service.detect_topics(time_window_days=days)

        return {
            "status": "success",
            "topics_detected": len(topics),
            "topic_names": [t.get("name", "") for t in topics]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger topic detection: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/aggregate-topic/{topic_id}")
async def trigger_causal_aggregation(
    topic_id: str = Path(..., description="Topic ID")
):
    """
    Manually trigger causal graph aggregation for a topic.
    Admin endpoint for testing.
    """
    try:
        from app.ml.causal_aggregator import get_causal_aggregator

        aggregator = get_causal_aggregator()
        result = await aggregator.aggregate_for_topic(topic_id)

        return {
            "status": "success",
            "topic_id": topic_id,
            "nodes_count": len(result.get("nodes", [])),
            "edges_count": len(result.get("edges", []))
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to aggregate topic {topic_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
