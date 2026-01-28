"""
Pydantic schemas for Intelligence Hub API responses
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


# =========================================================================
# ENTITY SCHEMAS
# =========================================================================

class EntityResponse(BaseModel):
    """Basic entity response"""
    id: str
    canonical_name: str
    entity_type: str
    mention_count: int
    synthesis_count: int = 0
    as_cause_count: int = 0
    as_effect_count: int = 0
    topics: List[str] = []

    class Config:
        from_attributes = True


class EntityDetailResponse(EntityResponse):
    """Detailed entity response with additional info"""
    description: str = ""
    aliases: List[str] = []
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    related_entities: List[str] = []
    synthesis_ids: List[str] = []


class EntitySearchResult(BaseModel):
    """Entity search result with similarity score"""
    entity: EntityResponse
    similarity_score: float


class EntityCausalProfile(BaseModel):
    """Entity's causal profile across syntheses"""
    entity_name: str
    entity_type: str = "UNKNOWN"
    as_cause: List[Dict[str, Any]] = []
    as_effect: List[Dict[str, Any]] = []
    total_causal_mentions: int = 0
    cause_ratio: float = 0.5


# =========================================================================
# TOPIC SCHEMAS
# =========================================================================

class TopicResponse(BaseModel):
    """Basic topic response"""
    id: str
    name: str
    description: str = ""
    category: str
    synthesis_count: int = 0
    entity_count: int = 0
    narrative_arc: str = "emerging"
    days_tracked: int = 0
    is_active: bool = True
    last_updated: Optional[datetime] = None
    preview_entities: List[str] = []

    class Config:
        from_attributes = True


class TopicDetailResponse(TopicResponse):
    """Detailed topic response"""
    keywords: List[str] = []
    synthesis_ids: List[str] = []
    entity_ids: List[str] = []
    first_seen: Optional[datetime] = None
    hot_score: float = 0.0


class TimelineLayer(BaseModel):
    """A layer in the timeline visualization"""
    period: str
    start_time: float
    end_time: float
    node_ids: List[str] = []
    edge_ids: List[str] = []


class CausalNode(BaseModel):
    """A node in the causal graph"""
    id: str
    label: str
    node_type: str = "event"
    fact_density: float = 0.5
    mention_count: int = 1
    source_syntheses: List[str] = []


class CausalEdge(BaseModel):
    """An edge in the causal graph"""
    id: str
    cause_text: str
    effect_text: str
    relation_type: str = "causes"
    confidence: float = 0.5
    mention_count: int = 1
    source_syntheses: List[str] = []


class TopicCausalGraphResponse(BaseModel):
    """Aggregated causal graph for a topic"""
    topic_id: str
    topic_name: str
    nodes: List[CausalNode] = []
    edges: List[CausalEdge] = []
    timeline_layers: List[TimelineLayer] = []
    central_entities: List[str] = []
    narrative_arc: str = "emerging"
    total_syntheses: int = 0


class TopicTimelineResponse(BaseModel):
    """Timeline of syntheses in a topic"""
    topic_id: str
    topic_name: str
    syntheses: List[Dict[str, Any]] = []
    timeline_layers: List[TimelineLayer] = []


# =========================================================================
# GLOBAL GRAPH SCHEMAS
# =========================================================================

class GlobalGraphNode(BaseModel):
    """A node in the global graph (topic or entity)"""
    id: str
    label: str
    node_type: str  # "topic" or "entity"
    weight: int = 1
    category: str = ""


class GlobalGraphEdge(BaseModel):
    """An edge in the global graph"""
    source: str
    target: str
    weight: float = 1.0
    edge_type: str = "related"


class GlobalGraphResponse(BaseModel):
    """Global overview graph of all topics/entities"""
    nodes: List[GlobalGraphNode] = []
    edges: List[GlobalGraphEdge] = []
    stats: Dict[str, Any] = {}


# =========================================================================
# LIST RESPONSES
# =========================================================================

class TopicsListResponse(BaseModel):
    """List of topics response"""
    topics: List[TopicResponse]
    total: int
    page: int = 1
    limit: int = 20


class EntitiesListResponse(BaseModel):
    """List of entities response"""
    entities: List[EntityResponse]
    total: int
    page: int = 1
    limit: int = 50


# =========================================================================
# STATS SCHEMAS
# =========================================================================

class IntelligenceStats(BaseModel):
    """Overall Intelligence Hub statistics"""
    total_topics: int = 0
    active_topics: int = 0
    total_entities: int = 0
    entities_by_type: Dict[str, int] = {}
    topics_by_category: Dict[str, int] = {}
    topics_by_arc: Dict[str, int] = {}
