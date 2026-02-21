"""
Artifacts API Routes
Phase 7: Data endpoints for charts and visualizations
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Union
from datetime import datetime
from loguru import logger
import json

from app.db.qdrant_client import get_qdrant_service


def _safe_date_str(created_at: Union[str, float, int, None]) -> str:
    """
    Safely convert created_at (float timestamp or string) to date string YYYY-MM-DD.
    """
    if not created_at:
        return ''
    if isinstance(created_at, (int, float)):
        try:
            return datetime.fromtimestamp(created_at).strftime('%Y-%m-%d')
        except (ValueError, OSError):
            return ''
    return str(created_at)[:10]

router = APIRouter()


# ==========================================
# Schemas
# ==========================================

class EntityFrequencyItem(BaseModel):
    """Single entity with count"""
    name: str
    count: int
    type: str  # PERSON, ORG, GPE, LOC, EVENT, PRODUCT


class EntityFrequencyResponse(BaseModel):
    """Response for entity frequency endpoint"""
    synthesis_id: str
    entities: List[EntityFrequencyItem]
    total_entities: int


class SentimentDataPoint(BaseModel):
    """Single sentiment data point"""
    date: str
    sentiment: float  # -1 to 1
    label: Optional[str] = None


class SentimentHistoryResponse(BaseModel):
    """Response for sentiment history endpoint"""
    synthesis_id: str
    history: List[SentimentDataPoint]
    current_sentiment: float
    sentiment_label: str


class SourceDiversityItem(BaseModel):
    """Source type with count"""
    source_type: str
    count: int
    sources: List[str]


class SourceDiversityResponse(BaseModel):
    """Response for source diversity endpoint"""
    synthesis_id: str
    diversity: List[SourceDiversityItem]
    total_sources: int
    credibility_score: float


class GeoMentionItem(BaseModel):
    """Geographic entity mention"""
    country: str
    country_code: str
    count: int
    context: Optional[str] = None


class GeoMentionsResponse(BaseModel):
    """Response for geo mentions endpoint"""
    synthesis_id: str
    mentions: List[GeoMentionItem]
    total_countries: int
    primary_region: Optional[str] = None


# ==========================================
# Helper Functions
# ==========================================

def get_sentiment_label(value: float) -> str:
    """Convert sentiment value to label"""
    if value >= 0.6:
        return "Très positif"
    elif value >= 0.3:
        return "Positif"
    elif value >= -0.3:
        return "Neutre"
    elif value >= -0.6:
        return "Négatif"
    else:
        return "Très négatif"


# Country code mapping for common countries
COUNTRY_CODES = {
    "France": "FR", "États-Unis": "US", "United States": "US", "USA": "US",
    "Royaume-Uni": "GB", "United Kingdom": "GB", "UK": "GB",
    "Allemagne": "DE", "Germany": "DE",
    "Chine": "CN", "China": "CN",
    "Russie": "RU", "Russia": "RU",
    "Japon": "JP", "Japan": "JP",
    "Italie": "IT", "Italy": "IT",
    "Espagne": "ES", "Spain": "ES",
    "Canada": "CA",
    "Australie": "AU", "Australia": "AU",
    "Brésil": "BR", "Brazil": "BR",
    "Inde": "IN", "India": "IN",
    "Mexique": "MX", "Mexico": "MX",
    "Ukraine": "UA",
    "Venezuela": "VE",
    "Iran": "IR",
    "Corée du Nord": "KP", "North Korea": "KP",
    "Corée du Sud": "KR", "South Korea": "KR",
    "Israël": "IL", "Israel": "IL",
    "Palestine": "PS",
    "Suisse": "CH", "Switzerland": "CH",
    "Belgique": "BE", "Belgium": "BE",
    "Pays-Bas": "NL", "Netherlands": "NL",
    "Pologne": "PL", "Poland": "PL",
    "Suède": "SE", "Sweden": "SE",
    "Norvège": "NO", "Norway": "NO",
    "Danemark": "DK", "Denmark": "DK",
    "Finlande": "FI", "Finland": "FI",
    "Autriche": "AT", "Austria": "AT",
    "Grèce": "GR", "Greece": "GR",
    "Turquie": "TR", "Turkey": "TR", "Türkiye": "TR",
    "Égypte": "EG", "Egypt": "EG",
    "Arabie Saoudite": "SA", "Saudi Arabia": "SA",
    "Émirats arabes unis": "AE", "UAE": "AE",
    "Qatar": "QA",
    "Argentine": "AR", "Argentina": "AR",
    "Chili": "CL", "Chile": "CL",
    "Colombie": "CO", "Colombia": "CO",
    "Pérou": "PE", "Peru": "PE",
    "Afrique du Sud": "ZA", "South Africa": "ZA",
    "Nigeria": "NG",
    "Maroc": "MA", "Morocco": "MA",
    "Algérie": "DZ", "Algeria": "DZ",
    "Tunisie": "TN", "Tunisia": "TN"
}


def get_country_code(country_name: str) -> str:
    """Get ISO country code from name"""
    return COUNTRY_CODES.get(country_name, "")


# ==========================================
# Endpoints
# ==========================================

@router.get("/syntheses/{synthesis_id}/entity-frequency", response_model=EntityFrequencyResponse)
async def get_entity_frequency(synthesis_id: str, limit: int = 20):
    """
    Get entity frequency for a synthesis.
    Extracts key_entities from the synthesis and counts mentions.
    """
    qdrant = get_qdrant_service()
    if not qdrant:
        raise HTTPException(status_code=503, detail="Qdrant service unavailable")

    synthesis = qdrant.get_synthesis_by_id(synthesis_id)
    if not synthesis:
        raise HTTPException(status_code=404, detail="Synthesis not found")

    # Extract entities from synthesis
    key_entities = synthesis.get("key_entities", [])

    # Fix: Parse string to list if stored as comma-separated string
    # Filter out short entities like "le", "de", "un" (noise from NLP)
    if isinstance(key_entities, str):
        key_entities = [e.strip() for e in key_entities.split(",") if e.strip() and len(e.strip()) > 2]

    entity_counts = {}

    for entity in key_entities:
        if isinstance(entity, dict):
            name = entity.get("name", "")
            ent_type = entity.get("type", "default")
        elif isinstance(entity, (list, tuple)) and len(entity) >= 2:
            name = entity[0]
            ent_type = entity[1]
        else:
            name = str(entity)
            ent_type = "default"

        if name:
            key = (name, ent_type)
            entity_counts[key] = entity_counts.get(key, 0) + 1

    # Also check enrichment data for entities
    enrichment = synthesis.get("enrichment", {})
    if isinstance(enrichment, str):
        try:
            enrichment = json.loads(enrichment)
        except (json.JSONDecodeError, ValueError, TypeError):
            enrichment = {}

    # Add entities from RAG if available
    rag_data = enrichment.get("advanced_rag", {})
    if rag_data:
        rag_entities = rag_data.get("entity_mentions", {})
        for name, mentions in rag_entities.items():
            if isinstance(mentions, list):
                count = len(mentions)
            else:
                count = 1
            key = (name, "ENTITY")
            entity_counts[key] = entity_counts.get(key, 0) + count

    # Convert to response format
    entities = [
        EntityFrequencyItem(name=name, count=count, type=ent_type)
        for (name, ent_type), count in entity_counts.items()
    ]

    # Sort by count and limit
    entities.sort(key=lambda x: x.count, reverse=True)
    entities = entities[:limit]

    return EntityFrequencyResponse(
        synthesis_id=synthesis_id,
        entities=entities,
        total_entities=len(entity_counts)
    )


@router.get("/syntheses/{synthesis_id}/sentiment-history", response_model=SentimentHistoryResponse)
async def get_sentiment_history(synthesis_id: str, days: int = 30):
    """
    Get sentiment history for a synthesis topic.
    Uses Grok data if available, or derives from related syntheses.
    """
    qdrant = get_qdrant_service()
    if not qdrant:
        raise HTTPException(status_code=503, detail="Qdrant service unavailable")

    synthesis = qdrant.get_synthesis_by_id(synthesis_id)
    if not synthesis:
        raise HTTPException(status_code=404, detail="Synthesis not found")

    history = []

    # Try to get sentiment from enrichment (Grok data)
    enrichment = synthesis.get("enrichment", {})
    if isinstance(enrichment, str):
        try:
            enrichment = json.loads(enrichment)
        except (json.JSONDecodeError, ValueError, TypeError):
            enrichment = {}

    grok_data = enrichment.get("grok", {})
    current_sentiment = 0.0

    if grok_data:
        sentiment = grok_data.get("sentiment", "neutral")
        # Map sentiment string to numeric value
        sentiment_map = {
            "very_positive": 0.8,
            "positive": 0.4,
            "neutral": 0.0,
            "negative": -0.4,
            "very_negative": -0.8
        }
        current_sentiment = sentiment_map.get(sentiment, 0.0)

    # Get related syntheses for historical data
    related = synthesis.get("related_syntheses", [])
    if isinstance(related, str):
        try:
            related = json.loads(related)
        except (json.JSONDecodeError, ValueError, TypeError):
            related = []

    # Build history from related syntheses
    for rel in related:
        if isinstance(rel, dict):
            date = rel.get("date", "")
            # Try to get sentiment from the related synthesis
            rel_sentiment = rel.get("sentiment", 0.0)
            if date:
                history.append(SentimentDataPoint(
                    date=date[:10] if len(date) > 10 else date,
                    sentiment=float(rel_sentiment) if rel_sentiment else 0.0,
                    label=rel.get("title", "")[:50]
                ))

    # Add current synthesis
    created_at = synthesis.get("created_at")
    date_str = _safe_date_str(created_at)
    if date_str:
        history.append(SentimentDataPoint(
            date=date_str,
            sentiment=current_sentiment,
            label=synthesis.get("title", "")[:50]
        ))

    # Sort by date
    history.sort(key=lambda x: x.date)

    return SentimentHistoryResponse(
        synthesis_id=synthesis_id,
        history=history,
        current_sentiment=current_sentiment,
        sentiment_label=get_sentiment_label(current_sentiment)
    )


@router.get("/syntheses/{synthesis_id}/source-diversity", response_model=SourceDiversityResponse)
async def get_source_diversity(synthesis_id: str):
    """
    Get source diversity analysis for a synthesis.
    Shows breakdown of source types and credibility score.
    """
    qdrant = get_qdrant_service()
    if not qdrant:
        raise HTTPException(status_code=503, detail="Qdrant service unavailable")

    synthesis = qdrant.get_synthesis_by_id(synthesis_id)
    if not synthesis:
        raise HTTPException(status_code=404, detail="Synthesis not found")

    source_articles = synthesis.get("source_articles", [])
    if isinstance(source_articles, str):
        try:
            source_articles = json.loads(source_articles)
        except (json.JSONDecodeError, ValueError, TypeError):
            source_articles = []

    # Categorize sources
    source_types = {
        "National": [],
        "International": [],
        "Tech": [],
        "Spécialisé": [],
        "Social": [],
        "Autre": []
    }

    national_sources = ["Le Monde", "Le Figaro", "Libération", "France Info", "Le Parisien"]
    international_sources = ["Reuters", "AP", "AFP", "BBC", "CNN", "NYT", "Guardian"]
    tech_sources = ["TechCrunch", "The Verge", "Wired", "Frandroid"]
    social_sources = ["Reddit", "Hacker News", "Twitter", "Bluesky"]

    for source in source_articles:
        if isinstance(source, dict):
            name = source.get("name", "")
        else:
            name = str(source)

        if any(n in name for n in national_sources):
            source_types["National"].append(name)
        elif any(n in name for n in international_sources):
            source_types["International"].append(name)
        elif any(n in name for n in tech_sources):
            source_types["Tech"].append(name)
        elif any(n in name for n in social_sources):
            source_types["Social"].append(name)
        else:
            source_types["Autre"].append(name)

    # Calculate credibility score (simple heuristic)
    total_sources = len(source_articles)
    diversity_score = len([k for k, v in source_types.items() if len(v) > 0]) / 6
    credibility_score = min(1.0, (total_sources / 5) * 0.5 + diversity_score * 0.5)

    diversity = [
        SourceDiversityItem(
            source_type=stype,
            count=len(sources),
            sources=sources[:5]  # Limit to 5 per type
        )
        for stype, sources in source_types.items()
        if len(sources) > 0
    ]

    return SourceDiversityResponse(
        synthesis_id=synthesis_id,
        diversity=diversity,
        total_sources=total_sources,
        credibility_score=round(credibility_score, 2)
    )


@router.get("/syntheses/{synthesis_id}/geo-mentions", response_model=GeoMentionsResponse)
async def get_geo_mentions(synthesis_id: str):
    """
    Get geographic mentions for a synthesis.
    Extracts GPE (Geo-Political Entity) and LOC entities.
    """
    qdrant = get_qdrant_service()
    if not qdrant:
        raise HTTPException(status_code=503, detail="Qdrant service unavailable")

    synthesis = qdrant.get_synthesis_by_id(synthesis_id)
    if not synthesis:
        raise HTTPException(status_code=404, detail="Synthesis not found")

    # Extract geo entities from key_entities
    key_entities = synthesis.get("key_entities", [])

    # Fix: Parse string to list if stored as comma-separated string
    if isinstance(key_entities, str):
        key_entities = [e.strip() for e in key_entities.split(",") if e.strip() and len(e.strip()) > 2]

    geo_counts = {}

    for entity in key_entities:
        if isinstance(entity, dict):
            name = entity.get("name", "")
            ent_type = entity.get("type", "")
        elif isinstance(entity, (list, tuple)) and len(entity) >= 2:
            name = entity[0]
            ent_type = entity[1]
        else:
            continue

        # Only GPE and LOC are geographic
        if ent_type in ("GPE", "LOC"):
            geo_counts[name] = geo_counts.get(name, 0) + 1

    # Also scan title and summary for known country names
    text = f"{synthesis.get('title', '')} {synthesis.get('summary', '')}"
    for country_name in COUNTRY_CODES.keys():
        if country_name.lower() in text.lower():
            if country_name not in geo_counts:
                geo_counts[country_name] = 1

    # Convert to response format
    mentions = []
    for name, count in geo_counts.items():
        code = get_country_code(name)
        if code:  # Only include if we have a country code
            mentions.append(GeoMentionItem(
                country=name,
                country_code=code,
                count=count
            ))

    # Sort by count
    mentions.sort(key=lambda x: x.count, reverse=True)

    # Determine primary region
    primary_region = None
    if mentions:
        # Simple region mapping
        top_country = mentions[0].country_code
        region_map = {
            "FR": "Europe", "DE": "Europe", "GB": "Europe", "IT": "Europe", "ES": "Europe",
            "US": "Amérique du Nord", "CA": "Amérique du Nord", "MX": "Amérique du Nord",
            "BR": "Amérique du Sud", "AR": "Amérique du Sud",
            "CN": "Asie", "JP": "Asie", "KR": "Asie", "IN": "Asie",
            "RU": "Eurasie",
            "AU": "Océanie",
            "EG": "Moyen-Orient", "SA": "Moyen-Orient", "IR": "Moyen-Orient", "IL": "Moyen-Orient",
            "ZA": "Afrique", "NG": "Afrique", "MA": "Afrique"
        }
        primary_region = region_map.get(top_country, "International")

    return GeoMentionsResponse(
        synthesis_id=synthesis_id,
        mentions=mentions,
        total_countries=len(mentions),
        primary_region=primary_region
    )
