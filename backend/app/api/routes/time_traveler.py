"""
Time-Traveler API Routes
Historical context and timeline for AI syntheses
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
from loguru import logger

from app.db.qdrant_client import get_qdrant_service
from app.ml.temporal_narrative import get_temporal_narrative_engine
from app.ml.advanced_rag import get_advanced_rag
from app.ml.embeddings import get_embedding_service


# ==========================================
# Pydantic Schemas
# ==========================================

class TimelineEvent(BaseModel):
    date: str
    title: str
    summary: str
    narrative_phase: str  # emerging, developing, peak, declining, resolved
    fact_density: float
    sources: List[str]
    synthesis_id: str
    similarity: float


class EntityEvolutionItem(BaseModel):
    entity_name: str
    entity_type: str  # person, org, location
    first_appearance: str
    mentions: List[str]
    trend: str  # new, constant, declining


class ContradictionItem(BaseModel):
    date: str
    type: str  # factual, temporal, sentiment
    claim_a: str
    claim_b: str
    source_a: str
    source_b: str


class TimelineResponse(BaseModel):
    synthesis_id: str
    current_title: str
    timeline: List[TimelineEvent]
    narrative_arc: str
    days_tracked: int
    entity_evolution: List[EntityEvolutionItem]
    contradictions: List[ContradictionItem]
    status: str  # evolving, resolved
    previous_key_points: List[str]


class RelatedSynthesisItem(BaseModel):
    """Related synthesis summary for sidebar display"""
    id: str
    title: str
    date: str
    category: str
    similarity: float = 0.0


class TimelinePreviewResponse(BaseModel):
    synthesis_id: str
    narrative_arc: str
    days_tracked: int
    recent_events: List[TimelineEvent]
    status: str
    has_contradictions: bool
    related_syntheses: List[RelatedSynthesisItem] = []


# ==========================================
# Router
# ==========================================

router = APIRouter()


@router.get("/syntheses/{synthesis_id}/timeline", response_model=TimelineResponse)
async def get_synthesis_timeline(synthesis_id: str):
    """
    Get complete historical timeline for a synthesis.

    Returns:
    - Full timeline of related syntheses
    - Narrative arc phase (emerging, developing, peak, declining, resolved)
    - Entity evolution across time
    - Detected contradictions
    - Previous key points for context
    """
    try:
        qdrant = get_qdrant_service()
        tna = get_temporal_narrative_engine()
        rag = get_advanced_rag()
        embedding_service = get_embedding_service()

        # Initialize TNA with services if needed
        tna.set_services(embedding_service, qdrant)

        # 1. Get current synthesis
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)
        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        current_title = synthesis.get("title", "")

        # 2. Get cluster articles (simulate from synthesis data)
        # In production, we'd store cluster_id and retrieve actual articles
        cluster_articles = _build_cluster_articles_from_synthesis(synthesis)

        # 3. Build historical context using TNA
        historical_context = tna.build_historical_context(
            cluster_articles=cluster_articles,
            current_entities=_extract_entities_from_synthesis(synthesis)
        )

        # 4. Format timeline events
        timeline_events = []
        for event in historical_context.timeline_events:
            # Calculate fact density for each synthesis
            event_text = f"{event.get('title', '')} {event.get('summary', '')}"
            fact_density = rag.score_fact_density(event_text)

            timeline_events.append(TimelineEvent(
                date=event.get('date', ''),
                title=event.get('title', ''),
                summary=event.get('summary', ''),
                narrative_phase=_get_phase_for_event(event, historical_context.timeline_events),
                fact_density=round(fact_density, 2),
                sources=event.get('key_points', [])[:3],
                synthesis_id=event.get('synthesis_id', ''),
                similarity=round(event.get('similarity', 0), 2)
            ))

        # 5. Format entity evolution
        entity_items = []
        for entity, mentions in historical_context.entity_evolution.items():
            entity_items.append(EntityEvolutionItem(
                entity_name=entity,
                entity_type=_guess_entity_type(entity),
                first_appearance=mentions[0] if mentions else "",
                mentions=mentions[:5],
                trend=_calculate_entity_trend(mentions)
            ))

        # 6. Format contradictions from history
        contradiction_items = []
        for c in historical_context.contradiction_history:
            contradiction_items.append(ContradictionItem(
                date=_format_timestamp(c.get('date', 0)),
                type="factual",
                claim_a=c.get('title', '')[:100],
                claim_b="",
                source_a="",
                source_b=""
            ))

        # 7. Determine status
        status = "resolved" if historical_context.narrative_arc == "resolved" else "evolving"

        return TimelineResponse(
            synthesis_id=synthesis_id,
            current_title=current_title,
            timeline=timeline_events,
            narrative_arc=historical_context.narrative_arc,
            days_tracked=historical_context.days_tracked,
            entity_evolution=entity_items[:10],
            contradictions=contradiction_items,
            status=status,
            previous_key_points=historical_context.previous_key_points[:10]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get timeline for synthesis {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/syntheses/{synthesis_id}/preview", response_model=TimelinePreviewResponse)
async def get_timeline_preview(synthesis_id: str):
    """
    Get compact timeline preview for sidebar display.

    Returns only the 3 most recent events and essential metadata.
    """
    # Default empty response for graceful degradation
    empty_response = TimelinePreviewResponse(
        synthesis_id=synthesis_id,
        narrative_arc="emerging",
        days_tracked=0,
        recent_events=[],
        status="evolving",
        has_contradictions=False
    )

    try:
        qdrant = get_qdrant_service()
        tna = get_temporal_narrative_engine()
        embedding_service = get_embedding_service()

        # If services not available, return empty response
        if not embedding_service or not qdrant:
            logger.warning(f"Services not available for timeline preview {synthesis_id}")
            return empty_response

        tna.set_services(embedding_service, qdrant)

        synthesis = qdrant.get_synthesis_by_id(synthesis_id)
        if not synthesis:
            # Return empty response instead of 404
            return empty_response

        cluster_articles = _build_cluster_articles_from_synthesis(synthesis)
        historical_context = tna.build_historical_context(
            cluster_articles=cluster_articles,
            current_entities=_extract_entities_from_synthesis(synthesis)
        )

        # Only take last 3 events for preview
        recent_events = []
        for event in historical_context.timeline_events[-3:]:
            recent_events.append(TimelineEvent(
                date=event.get('date', ''),
                title=event.get('title', ''),
                summary=event.get('summary', '')[:100],
                narrative_phase=historical_context.narrative_arc,
                fact_density=0.0,
                sources=[],
                synthesis_id=event.get('synthesis_id', ''),
                similarity=round(event.get('similarity', 0), 2)
            ))

        # Build related_syntheses list for sidebar display
        related_syntheses_items = []
        for rel in historical_context.related_syntheses[:5]:
            created_at = rel.get('created_at', 0)
            if isinstance(created_at, (int, float)) and created_at > 0:
                try:
                    date_str = datetime.fromtimestamp(created_at).strftime('%d/%m/%Y')
                except (ValueError, TypeError, OSError):
                    date_str = ''
            else:
                date_str = str(created_at)[:10] if created_at else ''

            related_syntheses_items.append(RelatedSynthesisItem(
                id=str(rel.get('id', '')),
                title=rel.get('title', '')[:100],
                date=date_str,
                category=rel.get('category', 'MONDE'),
                similarity=round(rel.get('similarity', 0), 2)
            ))

        return TimelinePreviewResponse(
            synthesis_id=synthesis_id,
            narrative_arc=historical_context.narrative_arc,
            days_tracked=historical_context.days_tracked,
            recent_events=recent_events,
            status="resolved" if historical_context.narrative_arc == "resolved" else "evolving",
            has_contradictions=len(historical_context.contradiction_history) > 0,
            related_syntheses=related_syntheses_items
        )

    except Exception as e:
        logger.error(f"Failed to get timeline preview for {synthesis_id}: {e}")
        # Return empty response instead of 500 error
        return empty_response


@router.get("/syntheses/{synthesis_id}/entities")
async def get_entity_evolution(synthesis_id: str):
    """
    Get detailed entity evolution for a synthesis.

    Tracks how key actors/organizations/locations have been mentioned over time.
    """
    try:
        qdrant = get_qdrant_service()
        tna = get_temporal_narrative_engine()
        rag = get_advanced_rag()
        embedding_service = get_embedding_service()

        tna.set_services(embedding_service, qdrant)

        synthesis = qdrant.get_synthesis_by_id(synthesis_id)
        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        # Extract entities from current synthesis
        full_text = f"{synthesis.get('title', '')} {synthesis.get('summary', '')}"
        entities = rag.extract_entities(full_text)

        cluster_articles = _build_cluster_articles_from_synthesis(synthesis)

        # Get all entity names for tracking
        all_entity_names = []
        for entity_type, entity_list in entities.items():
            all_entity_names.extend(entity_list)

        historical_context = tna.build_historical_context(
            cluster_articles=cluster_articles,
            current_entities=all_entity_names
        )

        return {
            "synthesis_id": synthesis_id,
            "entities": entities,
            "evolution": historical_context.entity_evolution,
            "timeline_count": len(historical_context.timeline_events)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get entity evolution for {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ==========================================
# Helper Functions
# ==========================================

def _build_cluster_articles_from_synthesis(synthesis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Build pseudo-articles from synthesis data for TNA processing.
    In production, we'd retrieve actual cluster articles from storage.
    """
    articles = []

    # Create a pseudo-article from the synthesis itself
    articles.append({
        "raw_title": synthesis.get("title", ""),
        "raw_text": synthesis.get("summary", "")[:500],
        "source_name": "NovaPress AI",
        "url": ""
    })

    # If we have source_articles, add them
    source_articles = synthesis.get("source_articles", [])
    for sa in source_articles[:5]:
        if isinstance(sa, dict):
            articles.append({
                "raw_title": sa.get("title", sa.get("name", "")),
                "raw_text": "",
                "source_name": sa.get("name", "Unknown"),
                "url": sa.get("url", "")
            })

    return articles


def _extract_entities_from_synthesis(synthesis: Dict[str, Any]) -> List[str]:
    """Extract key entities from synthesis text"""
    # Simple extraction - in production use spaCy NER
    text = f"{synthesis.get('title', '')} {synthesis.get('summary', '')}"

    # Extract capitalized words as potential entities
    import re
    entities = re.findall(r'\b[A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)*\b', text)

    # Filter common words
    common = {'Le', 'La', 'Les', 'Un', 'Une', 'The', 'A', 'An', 'Ce', 'Cette', 'Il', 'Elle', 'Dans', 'Pour', 'Sur', 'Avec'}
    entities = [e for e in entities if e not in common and len(e) > 2]

    return list(set(entities))[:20]


def _get_phase_for_event(event: Dict, all_events: List[Dict]) -> str:
    """Determine narrative phase for a specific event in timeline"""
    if not all_events:
        return "emerging"

    idx = all_events.index(event) if event in all_events else 0
    total = len(all_events)

    if total <= 1:
        return "emerging"

    position = idx / total

    if position < 0.2:
        return "emerging"
    elif position < 0.5:
        return "developing"
    elif position < 0.7:
        return "peak"
    elif position < 0.9:
        return "declining"
    else:
        return "resolved"


def _guess_entity_type(entity: str) -> str:
    """Guess entity type based on patterns"""
    entity_lower = entity.lower()

    # Organization indicators
    org_keywords = ['gouvernement', 'ministry', 'company', 'parti', 'association', 'commission', 'council', 'union']
    if any(kw in entity_lower for kw in org_keywords):
        return "organization"

    # Location indicators (countries, cities)
    locations = ['france', 'paris', 'europe', 'usa', 'germany', 'uk', 'china', 'russia']
    if entity_lower in locations:
        return "location"

    # Default to person
    return "person"


def _calculate_entity_trend(mentions: List[str]) -> str:
    """Calculate if entity is trending up, stable, or declining"""
    if not mentions:
        return "constant"

    if len(mentions) == 1:
        return "new"

    # Simple heuristic: more recent mentions = constant/growing
    return "constant"


def _format_timestamp(ts: Any) -> str:
    """Format timestamp to ISO string"""
    if isinstance(ts, (int, float)) and ts > 0:
        try:
            return datetime.fromtimestamp(ts).isoformat()
        except (ValueError, TypeError, OSError):
            pass
    return datetime.now().isoformat()
