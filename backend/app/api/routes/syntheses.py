"""
Syntheses API Routes
AI-generated synthesis from clustered news articles

IMPORTANT: Route order matters in FastAPI!
Static routes (/breaking, /live) MUST be defined BEFORE dynamic routes (/{synthesis_id})
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from loguru import logger
from datetime import datetime
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.qdrant_client import get_qdrant_service
from app.core.feature_gates import Feature, require_feature
import re
import json

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# ============================================================
# REF-002: Pre-compiled regex patterns (module-level)
# Compiling once at import instead of at each function call
# ============================================================

# French transition words for paragraph breaking
_TRANSITION_WORDS = (
    r'Cependant|Toutefois|Néanmoins|En revanche|Par ailleurs|En effet|'
    r'De plus|En outre|Ainsi|Par conséquent|Dès lors|Or|Pourtant|'
    r"D'autre part|D'un autre côté|En ce qui concerne|Quant à|"
    r'Face à|Suite à|Selon|Pour sa part|De son côté|'
    r'Dans ce contexte|À noter que|Il convient de|Force est de constater'
)

# Compiled patterns for _reformat_monolithic_text
PATTERN_TRANSITION = re.compile(rf'\. ({_TRANSITION_WORDS})', re.IGNORECASE)
PATTERN_QUOTE_ATTRIBUTION = re.compile(
    r'[»"] (affirme|déclare|explique|précise|indique|souligne|ajoute|confie|assure)',
    re.IGNORECASE
)
PATTERN_SENTENCE_SPLIT = re.compile(r'(?<=[.!?])\s+(?=[A-ZÀ-ÿ«"])')

# Compiled patterns for _clean_technical_markers
PATTERNS_TECHNICAL_MARKERS = [
    re.compile(r'\[CHUNK\s*\d*[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[CONTEXTE[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[FAIT\s*\d*[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[SOURCE[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[INFO[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[DONNÉES[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[NOTE[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[REF[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[ENRICHISSEMENT[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[PERPLEXITY[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[GROK[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[WEB[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[SOCIAL[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[HISTORIQUE[^\]]*\]', re.IGNORECASE),
    re.compile(r'\[RAG[^\]]*\]', re.IGNORECASE),
]
PATTERN_MULTIPLE_NEWLINES = re.compile(r'\n{3,}')


def _reformat_monolithic_text(text: str, min_paragraph_sentences: int = 3) -> str:
    """
    Reformat monolithic text into proper paragraphs.

    If text lacks paragraph breaks (\n\n), attempt to split it intelligently:
    - After sentences ending with period followed by transition words
    - After every N sentences minimum
    - Preserve existing paragraph breaks
    """
    if not text:
        return text

    # If already has paragraph breaks, just clean up
    if '\n\n' in text:
        paragraphs = text.split('\n\n')
        cleaned = [p.strip() for p in paragraphs if p.strip()]
        return '\n\n'.join(cleaned)

    # Text is monolithic - need to split
    # REF-002: Use pre-compiled patterns instead of inline re.sub

    # Insert paragraph breaks before transition words after periods
    marked_text = PATTERN_TRANSITION.sub(r'.\n\n\1', text)

    # Also break after quotes followed by attribution verbs
    marked_text = PATTERN_QUOTE_ATTRIBUTION.sub(r'»\n\n\1', marked_text)

    # If we found break points, return
    if '\n\n' in marked_text:
        paragraphs = marked_text.split('\n\n')
        cleaned = [p.strip() for p in paragraphs if p.strip()]
        return '\n\n'.join(cleaned)

    # Fallback: split by sentence count (REF-002: use compiled pattern)
    sentences = PATTERN_SENTENCE_SPLIT.split(text)

    if len(sentences) <= min_paragraph_sentences:
        return text

    # Group sentences into paragraphs of ~4 sentences each
    paragraphs = []
    current_paragraph = []

    for i, sentence in enumerate(sentences):
        current_paragraph.append(sentence)

        # Create paragraph every N sentences
        if len(current_paragraph) >= 4:
            paragraphs.append(' '.join(current_paragraph))
            current_paragraph = []

    if current_paragraph:
        paragraphs.append(' '.join(current_paragraph))

    return '\n\n'.join(paragraphs)


def _clean_technical_markers(text: str) -> str:
    """
    Remove technical markers from synthesis text.
    These markers come from RAG processing and should not be visible to users.

    Removes:
    - [CHUNK X] or [CHUNK X - ...]
    - [CONTEXTE SOCIAL] or [CONTEXTE ...]
    - [FAIT X] or similar factual markers
    - [SOURCE: ...] annotations
    - Empty lines created by removals

    REF-002: Uses pre-compiled patterns (PATTERNS_TECHNICAL_MARKERS) for performance.
    """
    if not text:
        return text

    cleaned = text

    # Use pre-compiled patterns (REF-002)
    for pattern in PATTERNS_TECHNICAL_MARKERS:
        cleaned = pattern.sub('', cleaned)

    # Clean up multiple consecutive newlines (REF-002: use compiled pattern)
    cleaned = PATTERN_MULTIPLE_NEWLINES.sub('\n\n', cleaned)

    # Clean up leading/trailing whitespace on lines
    lines = [line.strip() for line in cleaned.split('\n')]
    cleaned = '\n'.join(lines)

    # Remove leading/trailing empty lines
    cleaned = cleaned.strip()

    return cleaned


def _get_author_display(synthesis: Dict[str, Any]) -> Dict[str, str]:
    """
    Build author display info from stored author_display or persona fields.
    Returns: {"name": "Edouard Vaillant", "persona_type": "Le Cynique", "display": "par Edouard Vaillant › Le Cynique"}
    """
    # Check if author_display was stored by pipeline
    stored_author = synthesis.get("author_display", {})
    if stored_author and isinstance(stored_author, dict) and stored_author.get("display"):
        return stored_author

    # Fallback: build from persona fields
    persona_name = synthesis.get("persona_name", "NovaPress")
    persona_id = synthesis.get("persona_id", "neutral")

    # Extract persona type from known mappings (ALL 18 personas)
    PERSONA_TYPE_MAP = {
        # Originaux (5)
        "neutral": "",
        "le_cynique": "Le Cynique",
        "l_optimiste": "L'Optimiste",
        "le_conteur": "Le Conteur",
        "le_satiriste": "Le Satiriste",
        # Politiques/Ideologiques (5)
        "le_souverainiste": "Le Souverainiste",
        "l_ecologiste": "L'Ecologiste",
        "le_techno_sceptique": "Le Techno-Sceptique",
        "l_economiste": "L'Economiste",
        "le_populiste": "Le Populiste",
        # Philosophiques/Intellectuels (3)
        "l_historien": "L'Historien",
        "le_philosophe": "Le Philosophe",
        "le_scientifique": "Le Scientifique",
        # Generationnels (3)
        "le_boomer": "Le Boomer",
        "le_millennial": "Le Millennial",
        "le_gen_z": "Le Gen-Z",
        # Controverses (2)
        "le_complotiste": "Le Complotiste",
        "le_provocateur": "Le Provocateur",
    }
    persona_type = PERSONA_TYPE_MAP.get(persona_id, "")

    if persona_type:
        display = f"par {persona_name} › {persona_type}"
    else:
        display = f"par {persona_name}"

    return {
        "name": persona_name,
        "persona_id": persona_id,
        "persona_type": persona_type,
        "display": display,
        "signature": synthesis.get("persona_signature", ""),
    }


def _enrich_source_articles_from_article_ids(synthesis: Dict[str, Any], qdrant_service) -> List[Dict[str, Any]]:
    """
    Fallback: Fetch article URLs from article_ids if source_articles is empty.

    This helps older syntheses that were created before source_articles was properly populated.

    OPTIMIZED: Uses batch retrieval (1 Qdrant call) instead of N+1 queries.
    """
    article_ids_str = synthesis.get("article_ids", "")
    if not article_ids_str:
        return []

    # Parse article IDs (comma-separated string)
    if isinstance(article_ids_str, str):
        article_ids = [aid.strip() for aid in article_ids_str.split(",") if aid.strip()]
    elif isinstance(article_ids_str, list):
        article_ids = [str(aid) for aid in article_ids_str if aid]
    else:
        return []

    if not article_ids:
        return []

    # Limit to 20 articles max
    article_ids = article_ids[:20]

    try:
        # BATCH RETRIEVAL: 1 Qdrant call instead of N calls (REF-001 fix)
        articles = qdrant_service.get_articles_by_ids(article_ids)
    except Exception as e:
        logger.warning(f"Batch retrieval failed, falling back to empty: {e}")
        return []

    # Deduplicate by source name
    enriched_sources = []
    seen_sources = set()

    for article in articles:
        source_name = article.get("source_name", "") or article.get("source_domain", "")
        source_url = article.get("url", "")
        article_title = article.get("raw_title", article.get("title", ""))

        if source_name and source_name not in seen_sources:
            seen_sources.add(source_name)
            enriched_sources.append({
                "name": source_name,
                "url": source_url,
                "title": article_title
            })

    if enriched_sources:
        logger.info(f"Enriched source_articles from article_ids: {len(enriched_sources)} sources (batch retrieval)")

    return enriched_sources


def format_synthesis_for_frontend(synthesis: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform synthesis from Qdrant format to Frontend expected format
    """
    # Convert timestamp to ISO string
    created_at = synthesis.get("created_at", 0)
    if isinstance(created_at, (int, float)) and created_at > 0:
        try:
            created_at_iso = datetime.fromtimestamp(created_at).isoformat()
        except (ValueError, TypeError, OSError):
            created_at_iso = datetime.now().isoformat()
    else:
        created_at_iso = datetime.now().isoformat()

    # Parse sources list
    sources_list = synthesis.get("sourcesList", [])
    if not sources_list:
        sources_str = synthesis.get("sources", "")
        if sources_str:
            sources_list = [s.strip() for s in sources_str.split(",") if s.strip()]

    # Parse key points
    key_points = synthesis.get("keyPoints", [])
    if not key_points:
        key_points_str = synthesis.get("key_points", "")
        if key_points_str:
            key_points = [k.strip() for k in key_points_str.split("|") if k.strip()]

    # Parse source_articles (with URLs)
    source_articles = synthesis.get("source_articles", [])

    # Check if source_articles has any URLs
    has_urls = any(
        isinstance(sa, dict) and sa.get("url")
        for sa in (source_articles or [])
    )

    # Log what's in source_articles
    logger.info(f"📋 Synthesis {synthesis.get('id', 'unknown')[:8]}...: source_articles len={len(source_articles) if source_articles else 0}, has_urls={has_urls}")

    # Fallback 1: Try to enrich from article_ids if source_articles is empty or has no URLs
    if not source_articles or not has_urls:
        article_ids = synthesis.get("article_ids", "")
        logger.info(f"   Trying to enrich from article_ids: '{str(article_ids)[:50]}...'")
        try:
            qdrant = get_qdrant_service()
            enriched_sources = _enrich_source_articles_from_article_ids(synthesis, qdrant)
            if enriched_sources:
                source_articles = enriched_sources
                has_urls = True
                logger.info(f"   ✅ Enriched {len(enriched_sources)} sources from article_ids")
            else:
                logger.warning(f"   ⚠️ Could not enrich - no articles found from article_ids")
        except Exception as e:
            logger.warning(f"   ❌ Could not enrich source_articles from article_ids: {e}")

    # Fallback 2: Use sources_list without URLs (last resort)
    if not source_articles and sources_list:
        logger.info(f"   📝 Fallback to sources_list: {len(sources_list)} sources (no URLs)")
        source_articles = [{"name": s, "url": "", "title": ""} for s in sources_list]

    # Final check - log what we're returning
    if source_articles:
        logger.info(f"   ✅ Returning {len(source_articles)} source articles")
    else:
        logger.warning(f"   ❌ No source articles to return (sources_list was also empty)")

    # Get introduction, body, analysis fields and clean technical markers
    # Also reformat monolithic text into proper paragraphs
    introduction = _clean_technical_markers(synthesis.get("introduction", ""))
    body = _reformat_monolithic_text(_clean_technical_markers(synthesis.get("body", "")))
    analysis = _clean_technical_markers(synthesis.get("analysis", ""))
    summary = _reformat_monolithic_text(_clean_technical_markers(synthesis.get("summary", "")))

    # Parse enrichment data
    web_sources_full = synthesis.get("web_sources_full", [])
    if not web_sources_full:
        web_sources = synthesis.get("web_sources", [])
        web_sources_full = [{"url": url, "title": url} for url in web_sources if url]

    fact_check_notes = synthesis.get("fact_check_notes", [])
    if isinstance(fact_check_notes, str):
        fact_check_notes = [fact_check_notes] if fact_check_notes else []

    trending_reactions = synthesis.get("trending_reactions", [])
    if isinstance(trending_reactions, str):
        trending_reactions = [trending_reactions] if trending_reactions else []

    # ========== PREDICTIONS (from causal_graph) ==========
    predictions = []
    causal_graph_str = synthesis.get("causal_graph", "")
    if causal_graph_str and isinstance(causal_graph_str, str):
        try:
            causal_graph_data = json.loads(causal_graph_str)
            predictions = causal_graph_data.get("predictions", [])
        except json.JSONDecodeError:
            logger.warning(f"Could not parse causal_graph JSON for synthesis {synthesis.get('id', 'unknown')}")
    elif isinstance(causal_graph_str, dict):
        predictions = causal_graph_str.get("predictions", [])

    # ========== HISTORICAL CONTEXT ==========
    # Get related syntheses IDs if stored
    related_synthesis_ids_str = synthesis.get("related_synthesis_ids", "")
    related_synthesis_ids = []
    if related_synthesis_ids_str:
        if isinstance(related_synthesis_ids_str, str):
            related_synthesis_ids = [s.strip() for s in related_synthesis_ids_str.split(",") if s.strip()]
        elif isinstance(related_synthesis_ids_str, list):
            related_synthesis_ids = related_synthesis_ids_str

    # Fetch related syntheses details (limit to 3 for performance)
    related_syntheses_details = []
    if related_synthesis_ids:
        try:
            qdrant = get_qdrant_service()
            for sid in related_synthesis_ids[:3]:
                related = qdrant.get_synthesis_by_id(sid)
                if related:
                    # Format date
                    rel_created_at = related.get("created_at", 0)
                    if isinstance(rel_created_at, (int, float)) and rel_created_at > 0:
                        try:
                            rel_created_at_iso = datetime.fromtimestamp(rel_created_at).isoformat()
                        except (ValueError, TypeError, OSError):
                            rel_created_at_iso = ""
                    else:
                        rel_created_at_iso = ""

                    related_syntheses_details.append({
                        "id": str(related.get("id", sid)),
                        "title": str(related.get("title", ""))[:80],
                        "createdAt": rel_created_at_iso
                    })
        except Exception as e:
            logger.warning(f"Could not fetch related syntheses: {e}")

    historical_context = {
        "daysTracked": int(synthesis.get("days_tracked", 0)),
        "narrativeArc": synthesis.get("narrative_arc", "emerging"),
        "relatedSyntheses": related_syntheses_details,
        "hasContradictions": bool(synthesis.get("has_contradictions", False)),
        "contradictionsCount": int(synthesis.get("contradictions_count", 0))
    }

    return {
        "id": str(synthesis.get("id", "")),
        "title": synthesis.get("title", ""),
        "summary": summary,  # Already cleaned with _clean_technical_markers
        "introduction": introduction,
        "body": body,
        "analysis": analysis,
        "keyPoints": key_points,
        "sources": sources_list,
        "sourceArticles": source_articles,
        "numSources": int(synthesis.get("num_sources", len(sources_list))),
        "clusterId": int(synthesis.get("cluster_id", 0)),
        "complianceScore": float(synthesis.get("compliance_score", 90)),
        "readingTime": int(synthesis.get("reading_time", 3)),
        "createdAt": created_at_iso,
        "category": synthesis.get("category", "MONDE"),
        "categoryConfidence": float(synthesis.get("category_confidence", 0.5)),
        # Persona rotation fields
        "personaId": synthesis.get("persona_id", "neutral"),
        "personaName": synthesis.get("persona_name", "NovaPress"),
        "personaSignature": synthesis.get("persona_signature", ""),
        "isPersonaVersion": bool(synthesis.get("is_persona_version", False)),
        # Author display info (par X › Y)
        "author": _get_author_display(synthesis),
        # ========== ENRICHMENT DATA (NEW) ==========
        "enrichment": {
            "status": synthesis.get("enrichment_status", "unknown"),
            "isEnriched": bool(synthesis.get("search_enriched", False)),
            "timestamp": synthesis.get("enrichment_timestamp", ""),
            # Perplexity (Web Context)
            "perplexity": {
                "enabled": bool(synthesis.get("has_perplexity", False)),
                "context": synthesis.get("perplexity_context", ""),
                "sources": web_sources_full,
            },
            # Grok (Social Context)
            "grok": {
                "enabled": bool(synthesis.get("has_grok", False)),
                "context": synthesis.get("grok_context", ""),
                "sentiment": synthesis.get("social_sentiment", ""),
                "trendingReactions": trending_reactions,
            },
            # Fact Checking
            "factCheck": {
                "notes": fact_check_notes,
                "count": len(fact_check_notes),
            }
        },
        # Legacy fields for backward compatibility
        "searchEnriched": bool(synthesis.get("search_enriched", False)),
        "socialSentiment": synthesis.get("social_sentiment", ""),
        "type": "synthesis",
        # Phase 10: Topics/Tags for recurring themes
        "topics": _extract_topics_for_synthesis(synthesis),
        # ========== NEW: Predictions & Historical Context ==========
        "predictions": predictions,
        "historicalContext": historical_context,
        # Transparency Score
        "transparencyScore": int(synthesis.get("transparency_score", 0)),
        "transparencyLabel": synthesis.get("transparency_label", "N/A"),
        "transparencyBreakdown": synthesis.get("transparency_breakdown", {}),
    }


def _extract_topics_for_synthesis(synthesis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract topic tags for a synthesis based on stored topic_ids or title keywords.
    Phase 10: Provides tags for SynthesisCard display with synthesis_count for styling.
    """
    import re

    topics = []

    # Try 1: Use stored topic_ids if available
    topic_ids = synthesis.get("topic_ids", [])
    if topic_ids:
        try:
            qdrant = get_qdrant_service()
            for topic_id in topic_ids[:5]:  # Limit to 5 topics
                topic = qdrant.get_topic_by_id(topic_id)
                if topic:
                    topics.append({
                        "id": topic.get("id", topic_id),
                        "name": topic.get("name", ""),
                        "narrative_arc": topic.get("narrative_arc", "emerging"),
                        "synthesis_count": topic.get("synthesis_count", 1)
                    })
        except Exception:
            pass

    # Try 2: Extract from title if no stored topics
    if not topics:
        title = synthesis.get("title", "")
        category = synthesis.get("category", "MONDE")

        # Extract significant words from title
        stopwords = {'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'à', 'au',
                    'pour', 'par', 'sur', 'avec', 'dans', 'que', 'qui', 'ce', 'cette', 'son',
                    'est', 'sont', 'être', 'avoir', 'fait', 'faire', 'comme', 'tout', 'tous',
                    'the', 'a', 'an', 'of', 'to', 'in', 'is', 'and', 'for', 'on', 'with'}

        words = re.findall(r'\b[A-Za-zÀ-ÿ]{4,}\b', title)
        significant = [w for w in words if w.lower() not in stopwords][:3]

        # Rotate narrative_arc colors for visual diversity
        arc_rotation = ['emerging', 'developing', 'peak', 'declining']

        # Get keyword counts from recent syntheses for popularity
        keyword_counts = _get_keyword_counts_cache()

        for word in significant:
            word_lower = word.lower()
            # Use word hash for consistent color per keyword
            arc_idx = hash(word_lower) % len(arc_rotation)
            # Get count from cache or default to 1
            count = keyword_counts.get(word_lower, 1)
            topics.append({
                "id": f"keyword_{word_lower}",
                "name": word.title(),
                "narrative_arc": arc_rotation[arc_idx],
                "synthesis_count": count
            })

        # Add category as a topic with category-based color
        category_arcs = {
            'TECH': 'emerging',      # Blue
            'ECONOMIE': 'developing', # Green
            'POLITIQUE': 'peak',      # Yellow/Orange
            'SPORT': 'declining',     # Pink
            'CULTURE': 'emerging',    # Blue
            'SCIENCES': 'developing'  # Green
        }
        if category and category != "MONDE":
            # Category count based on syntheses in that category
            cat_count = keyword_counts.get(f"cat_{category.lower()}", 1)
            topics.append({
                "id": f"category_{category.lower()}",
                "name": category.title(),
                "narrative_arc": category_arcs.get(category, 'developing'),
                "synthesis_count": cat_count
            })

    return topics[:5]  # Limit to 5 topics


# Cache for keyword counts (refreshed every 5 minutes)
_keyword_counts_cache: Dict[str, int] = {}
_keyword_counts_timestamp: float = 0


def _get_keyword_counts_cache() -> Dict[str, int]:
    """Get cached keyword counts from recent syntheses."""
    import time
    import re
    global _keyword_counts_cache, _keyword_counts_timestamp

    # Refresh cache every 5 minutes
    if time.time() - _keyword_counts_timestamp > 300:
        try:
            qdrant = get_qdrant_service()
            syntheses = qdrant.get_live_syntheses(hours=168, limit=200)  # Last 7 days

            counts: Dict[str, int] = {}
            stopwords = {'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'à', 'au',
                        'pour', 'par', 'sur', 'avec', 'dans', 'que', 'qui', 'ce', 'cette', 'son',
                        'est', 'sont', 'être', 'avoir', 'fait', 'faire', 'comme', 'tout', 'tous',
                        'the', 'a', 'an', 'of', 'to', 'in', 'is', 'and', 'for', 'on', 'with'}

            for s in syntheses:
                title = s.get("title", "")
                category = s.get("category", "")

                # Count keywords
                words = re.findall(r'\b[A-Za-zÀ-ÿ]{4,}\b', title)
                for w in words:
                    w_lower = w.lower()
                    if w_lower not in stopwords:
                        counts[w_lower] = counts.get(w_lower, 0) + 1

                # Count categories
                if category:
                    counts[f"cat_{category.lower()}"] = counts.get(f"cat_{category.lower()}", 0) + 1

            _keyword_counts_cache = counts
            _keyword_counts_timestamp = time.time()
        except Exception:
            pass

    return _keyword_counts_cache


@router.get("/")
@limiter.limit("100/minute")
async def get_syntheses(
    request: Request,
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0, description="Number of items to skip for pagination")
):
    """
    Get latest AI-generated syntheses with pagination support.

    Args:
        limit: Maximum number of syntheses to return (default 10, max 50)
        offset: Number of items to skip (for pagination, default 0)

    Returns:
        Paginated list of syntheses with total count and pagination info
    """
    try:
        qdrant = get_qdrant_service()
        # Get more than needed to calculate hasMore
        raw_syntheses = qdrant.get_latest_syntheses(limit=limit + 1, offset=offset)

        # Check if there are more items
        has_more = len(raw_syntheses) > limit
        if has_more:
            raw_syntheses = raw_syntheses[:limit]  # Trim to requested limit

        # Transform for frontend
        syntheses = [format_synthesis_for_frontend(s) for s in raw_syntheses]

        # REF-003: Add Cache-Control headers for browser caching
        return JSONResponse(
            content={
                "data": syntheses,
                "total": len(syntheses),
                "offset": offset,
                "limit": limit,
                "hasMore": has_more,
                "nextOffset": offset + limit if has_more else None,
                "type": "syntheses"
            },
            headers={
                "Cache-Control": "public, max-age=30",  # 30 seconds cache for fresher data
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch syntheses: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/breaking")
@limiter.limit("120/minute")
async def get_breaking_syntheses(
    request: Request,
    limit: int = Query(5, ge=1, le=20)
):
    """
    Get the most recent syntheses for the news ticker (breaking news).

    Returns the 5 most recent syntheses by default.
    """
    try:
        qdrant = get_qdrant_service()
        raw_syntheses = qdrant.get_breaking_syntheses(limit=limit)
        syntheses = [format_synthesis_for_frontend(s) for s in raw_syntheses]

        # REF-003: Add Cache-Control headers (shorter TTL for breaking news)
        return JSONResponse(
            content={
                "data": syntheses,
                "total": len(syntheses),
                "type": "breaking"
            },
            headers={
                "Cache-Control": "public, max-age=30",  # 30 seconds for breaking news
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch breaking syntheses: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/brief")
@limiter.limit("60/minute")
async def get_morning_brief(
    request: Request,
    limit: int = Query(5, ge=1, le=10)
):
    """
    Get the Morning Brief: top syntheses from the last 24h sorted by
    (transparency_score * 0.6) + (recency_score * 0.4).
    """
    try:
        qdrant = get_qdrant_service()
        raw_syntheses = qdrant.get_latest_syntheses(limit=50)

        now = datetime.now().timestamp()
        scored = []
        for s in raw_syntheses:
            created = s.get("created_at", 0)
            if isinstance(created, (int, float)) and created > 0:
                age_hours = (now - created) / 3600
                if age_hours > 24:
                    continue
                recency = max(0, 1.0 - (age_hours / 24))
            else:
                recency = 0.5

            transparency = s.get("transparency_score", 0) / 100.0
            combined = transparency * 0.6 + recency * 0.4
            scored.append((combined, s))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = [format_synthesis_for_frontend(s) for _, s in scored[:limit]]

        return JSONResponse(
            content={
                "data": top,
                "total": len(top),
                "type": "brief"
            },
            headers={
                "Cache-Control": "public, max-age=300",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch morning brief: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/live")
@limiter.limit("60/minute")
async def get_live_syntheses(
    request: Request,
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0, description="Number of items to skip for pagination")
):
    """
    Get syntheses from the last X hours (for EN DIRECT page) with pagination.

    Args:
        hours: Number of hours to look back (default 24, max 168 = 1 week)
        limit: Maximum number of syntheses to return (default 50)
        offset: Number of items to skip (for pagination, default 0)
    """
    try:
        qdrant = get_qdrant_service()
        # Get more than needed to calculate hasMore
        raw_syntheses = qdrant.get_live_syntheses(hours=hours, limit=limit + 1, offset=offset)

        # Check if there are more items
        has_more = len(raw_syntheses) > limit
        if has_more:
            raw_syntheses = raw_syntheses[:limit]  # Trim to requested limit

        syntheses = [format_synthesis_for_frontend(s) for s in raw_syntheses]

        # REF-003: Add Cache-Control headers for live page
        return JSONResponse(
            content={
                "data": syntheses,
                "total": len(syntheses),
                "hours": hours,
                "offset": offset,
                "limit": limit,
                "hasMore": has_more,
                "nextOffset": offset + limit if has_more else None,
                "type": "live"
            },
            headers={
                "Cache-Control": "public, max-age=60",  # 1 minute cache
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch live syntheses: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/category/{category}")
@limiter.limit("60/minute")
async def get_syntheses_by_category(
    request: Request,
    category: str,
    limit: int = Query(20, ge=1, le=50)
):
    """
    Get syntheses filtered by category.

    Valid categories: MONDE, TECH, ECONOMIE, POLITIQUE, CULTURE, SPORT, SCIENCES
    """
    valid_categories = ["MONDE", "TECH", "ECONOMIE", "POLITIQUE", "CULTURE", "SPORT", "SCIENCES"]

    if category.upper() not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{category}'. Must be one of: {', '.join(valid_categories)}"
        )

    try:
        qdrant = get_qdrant_service()
        raw_syntheses = qdrant.get_syntheses_by_category(category.upper(), limit=limit)
        syntheses = [format_synthesis_for_frontend(s) for s in raw_syntheses]

        return {
            "data": syntheses,
            "total": len(syntheses),
            "category": category.upper(),
            "type": "category"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch syntheses by category {category}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/personas")
async def get_available_personas():
    """
    Get list of available AI journalist personas.

    Returns all personas with their characteristics (tone, style, focus categories).
    """
    from app.ml.persona import get_all_personas
    return {
        "data": get_all_personas(),
        "total": len(get_all_personas()),
        "type": "personas"
    }


@router.get("/rotation-schedule")
async def get_persona_rotation_schedule(
    mode: str = Query("weekly", description="Rotation mode: 'weekly' or 'daily'")
):
    """
    Get current persona rotation schedule.

    Shows which persona is assigned to each category for the current period.
    Personas rotate weekly (default) or daily to ensure article diversity.

    Example schedule (week 51):
    - POLITIQUE: Edouard Vaillant (Le Cynique)
    - ECONOMIE: Claire Horizon (L'Optimiste)
    - MONDE: Alexandre Duval (Le Conteur)
    - TECH: Le Bouffon (Le Satiriste)
    ...
    """
    from app.ml.persona import get_rotation_info, get_current_rotation_schedule

    if mode not in ["weekly", "daily"]:
        mode = "weekly"

    schedule = get_current_rotation_schedule(mode)
    info = get_rotation_info()

    return {
        "mode": mode,
        "currentPeriod": info["current_week"] if mode == "weekly" else info["current_day_of_year"],
        "schedule": schedule,
        "rotationCategories": info["rotation_categories"],
        "rotationPersonas": info["rotation_personas"],
        "type": "rotation_schedule"
    }


@router.get("/by-id/{synthesis_id}")
@limiter.limit("100/minute")
async def get_synthesis(
    request: Request,
    synthesis_id: str = Path(..., description="Synthesis UUID")
):
    """Get single synthesis by ID (UUID format)"""
    try:
        qdrant = get_qdrant_service()
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)

        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        return format_synthesis_for_frontend(synthesis)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch synthesis {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/by-id/{synthesis_id}/persona/{persona_id}", dependencies=[Depends(require_feature(Feature.PERSONA_SWITCH))])
@limiter.limit("10/minute")
async def get_synthesis_with_persona(
    request: Request,
    synthesis_id: str = Path(..., description="Synthesis UUID"),
    persona_id: str = Path(..., description="Persona ID (le_cynique, l_optimiste, le_conteur, le_satiriste)")
):
    """
    Get synthesis rewritten with a specific persona's voice and style.

    Available personas:
    - neutral: Factual journalism (default)
    - le_cynique: Edouard Vaillant - Sardonic, skeptical (Le Canard Enchaine style)
    - l_optimiste: Claire Horizon - Enthusiastic, solution-focused (Wired style)
    - le_conteur: Alexandre Duval - Dramatic storytelling (feuilleton style)
    - le_satiriste: Le Bouffon - Absurdist parody (Le Gorafi style)

    Note: Pre-generated versions are returned instantly.
    Fallback to on-demand generation only for old syntheses without pre-generated versions.
    """
    from app.ml.persona import get_persona, PersonaType
    from app.ml.llm import get_llm_service

    # Validate persona exists
    persona = get_persona(persona_id)
    if not persona:
        valid_personas = [p.value for p in PersonaType]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid persona '{persona_id}'. Must be one of: {', '.join(valid_personas)}"
        )

    try:
        qdrant = get_qdrant_service()

        # Get original synthesis
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)
        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        # If neutral, return original
        if persona_id == PersonaType.NEUTRAL.value or persona_id == "neutral":
            result = format_synthesis_for_frontend(synthesis)
            result["persona"] = {
                "id": persona.id,
                "name": persona.name,
                "displayName": persona.display_name,
            }
            return result

        # === STRATEGY 1: Try to find pre-generated persona version ===
        # Check if this synthesis has pre-generated persona versions
        # The synthesis_id could be either the base or a persona version

        base_id = synthesis.get("base_synthesis_id") or synthesis_id

        # If this synthesis IS a persona version, get the base ID
        if synthesis.get("is_persona_version") and synthesis.get("base_synthesis_id"):
            base_id = synthesis.get("base_synthesis_id")

        # Search for pre-generated version with this persona
        pregenerated_versions = qdrant.get_persona_versions_by_base_id(
            base_synthesis_id=base_id,
            persona_id=persona_id
        )

        if pregenerated_versions:
            # Found pre-generated version - return it instantly (no LLM cost!)
            logger.info(f"✅ Returning pre-generated {persona_id} version for {synthesis_id[:8]}...")
            persona_synthesis = format_synthesis_for_frontend(pregenerated_versions[0])
            persona_synthesis["persona"] = {
                "id": persona.id,
                "name": persona.name,
                "displayName": persona.display_name,
            }
            persona_synthesis["isPregenerated"] = True
            return persona_synthesis

        # === STRATEGY 2: Fallback - Generate on-demand for old syntheses ===
        logger.warning(f"⚠️ No pre-generated {persona_id} version found for {synthesis_id[:8]}, generating on-demand...")

        # Get source articles from cluster if available
        cluster_id = synthesis.get("cluster_id")
        articles = []
        if cluster_id:
            # Try to get original articles
            try:
                articles = qdrant.get_articles_by_cluster(cluster_id, limit=6)
            except Exception:
                pass

        # Format base synthesis
        base_synthesis = format_synthesis_for_frontend(synthesis)

        # Generate persona version on-demand (costs LLM tokens)
        llm = get_llm_service()
        persona_synthesis = await llm.synthesize_with_persona(
            base_synthesis=base_synthesis,
            articles=articles,
            persona_id=persona_id
        )

        # === QUALITY EVALUATION ===
        from app.ml.persona_quality import evaluate_persona_synthesis

        quality_result = evaluate_persona_synthesis(persona_synthesis, persona_id)
        quality_score = quality_result.get("overall_score", 0.0)
        quality_tier = quality_result.get("quality_tier", "unknown")

        logger.info(f"📊 On-demand persona quality: {persona_id} = {quality_score:.2f} ({quality_tier})")

        # If quality is too low, return neutral version with warning
        if quality_result.get("should_fallback", False):
            logger.warning(
                f"⚠️ Persona '{persona_id}' quality too low ({quality_score:.2f}), "
                f"returning neutral version. Issues: {quality_result.get('issues', [])}"
            )
            result = format_synthesis_for_frontend(synthesis)
            result["persona"] = {
                "id": persona.id,
                "name": persona.name,
                "displayName": persona.display_name,
            }
            result["qualityFallback"] = True
            result["qualityScore"] = quality_score
            result["qualityIssues"] = quality_result.get("issues", [])
            return result

        # Merge with original metadata
        persona_synthesis["id"] = base_synthesis["id"]
        persona_synthesis["clusterId"] = base_synthesis.get("clusterId")
        persona_synthesis["category"] = base_synthesis.get("category")
        persona_synthesis["createdAt"] = base_synthesis.get("createdAt")
        persona_synthesis["sources"] = base_synthesis.get("sources", [])
        persona_synthesis["sourceArticles"] = base_synthesis.get("sourceArticles", [])
        persona_synthesis["numSources"] = base_synthesis.get("numSources", 0)
        persona_synthesis["isPregenerated"] = False
        persona_synthesis["qualityScore"] = quality_score
        persona_synthesis["qualityTier"] = quality_tier

        return persona_synthesis

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate persona synthesis: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/by-id/{synthesis_id}/bias")
@limiter.limit("60/minute")
async def get_synthesis_bias(
    request: Request,
    synthesis_id: str = Path(..., description="Synthesis UUID")
):
    """
    Get political bias analysis for a synthesis's sources.

    Returns:
    - left_count, center_count, right_count: Number of sources in each category
    - balance_score: 0-100 score (higher = more balanced)
    - coverage_label: "Balanced", "Left-Leaning", "Right-Leaning", etc.
    - average_reliability: 1-5 score of source reliability
    - sources: Detailed bias info for each analyzed source
    - unknown_sources: Sources not found in bias database

    Inspired by Ground News and AllSides methodology.
    """
    from app.ml.bias_detection import analyze_synthesis_bias

    try:
        qdrant = get_qdrant_service()
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)

        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        # Analyze bias
        bias_analysis = analyze_synthesis_bias(synthesis)

        return bias_analysis

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to analyze bias for synthesis {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/by-id/{synthesis_id}/fact-check")
@limiter.limit("30/minute")
async def get_synthesis_fact_check(
    request: Request,
    synthesis_id: str = Path(..., description="Synthesis UUID")
):
    """
    Get fact-check analysis for a synthesis's claims.

    Extracts factual claims (statistics, quotes, events) and verifies them
    against the synthesis sources. Returns:
    - overall_score: 0-100 factual accuracy score
    - overall_label: "Haute fiabilité", "Fiabilité moyenne", etc.
    - claims: List of extracted claims with verification status
    - verified_count, disputed_count, unverified_count

    Inspired by Perplexity/Semafor fact-checking methodology.
    """
    from app.ml.fact_checker import fact_check_synthesis

    try:
        qdrant = get_qdrant_service()
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)

        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        # Run fact-checking
        fact_check_result = fact_check_synthesis(synthesis)

        return fact_check_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fact-check synthesis {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/by-id/{synthesis_id}/audio", dependencies=[Depends(require_feature(Feature.AUDIO_BRIEFING))])
@limiter.limit("10/minute")
async def get_synthesis_audio(
    request: Request,
    synthesis_id: str = Path(..., description="Synthesis UUID"),
    voice: str = Query("female", description="Voice gender: male or female"),
    language: str = Query("fr-FR", description="Language code: fr-FR or en-US")
):
    """
    Get audio version of a synthesis (Text-to-Speech).

    Generates an MP3 audio file with the synthesis content read by a natural voice.
    Uses Microsoft Edge TTS for high-quality neural voices.

    Args:
        voice: "male" or "female"
        language: "fr-FR" or "en-US"

    Returns:
        MP3 audio file
    """
    from fastapi.responses import Response
    from app.services.tts_service import get_tts_service

    try:
        qdrant = get_qdrant_service()
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)

        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        # Get TTS service
        tts = get_tts_service()

        if not tts.is_available():
            raise HTTPException(
                status_code=503,
                detail="Audio synthesis temporarily unavailable. Install edge-tts: pip install edge-tts"
            )

        # Generate audio
        audio_data = await tts.generate_synthesis_audio(
            synthesis=synthesis,
            voice_gender=voice,
            language=language
        )

        if not audio_data:
            raise HTTPException(status_code=500, detail="Failed to generate audio")

        return Response(
            content=audio_data,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f'inline; filename="synthesis-{synthesis_id[:8]}.mp3"',
                "Cache-Control": "public, max-age=86400"  # Cache for 24 hours
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate audio for synthesis {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/by-id/{synthesis_id}/audio/status")
@limiter.limit("60/minute")
async def get_synthesis_audio_status(
    request: Request,
    synthesis_id: str = Path(..., description="Synthesis UUID")
):
    """
    Check if audio is available for a synthesis.

    Returns availability status without generating audio.
    """
    from app.services.tts_service import get_tts_service

    try:
        qdrant = get_qdrant_service()
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)

        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        tts = get_tts_service()

        return {
            "available": tts.is_available(),
            "synthesisId": synthesis_id,
            "audioUrl": f"/api/syntheses/by-id/{synthesis_id}/audio" if tts.is_available() else None,
            "voices": ["male", "female"],
            "languages": ["fr-FR", "en-US"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check audio status for synthesis {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/by-id/{synthesis_id}/debate")
@limiter.limit("30/minute")
async def get_synthesis_debate(
    request: Request,
    synthesis_id: str = Path(..., description="Synthesis UUID")
):
    """
    Get debate analysis (PRO/CON arguments) for a synthesis.

    Extracts arguments from both sides for controversial topics.
    Returns:
    - is_controversial: Whether the topic is debatable
    - controversy_score: 0-1 score of how divisive the topic is
    - pro_arguments: Arguments in favor
    - con_arguments: Arguments against
    - neutral_points: Factual points without clear stance

    Inspired by AllSides methodology with AI extraction.
    """
    from app.ml.debate_extractor import extract_debate

    try:
        qdrant = get_qdrant_service()
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)

        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        # Extract debate arguments
        debate_result = extract_debate(synthesis)

        return debate_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to extract debate for synthesis {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/by-id/{synthesis_id}/whatif")
@limiter.limit("20/minute")
async def get_synthesis_whatif(
    request: Request,
    synthesis_id: str = Path(..., description="Synthesis UUID"),
    max_scenarios: int = Query(5, ge=1, le=10, description="Maximum scenarios to generate")
):
    """
    Get what-if counterfactual scenarios for a synthesis.

    Generates hypothetical scenarios based on causal graph analysis:
    - "What if X didn't happen?" questions
    - Affected downstream events
    - Probability estimates for alternatives

    Returns:
    - key_events: Important events identified in the synthesis
    - scenarios: List of counterfactual scenarios with outcomes
    - causal_dependencies: Cause-effect relationships used for analysis

    Unique feature: Uses the causal graph to simulate alternative outcomes.
    """
    from app.ml.whatif_engine import analyze_whatif

    try:
        qdrant = get_qdrant_service()
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)

        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        # Try to get causal graph if available
        causal_graph = None
        causal_graph_str = synthesis.get("causal_graph", "")
        if causal_graph_str:
            try:
                if isinstance(causal_graph_str, str):
                    causal_graph = json.loads(causal_graph_str)
                else:
                    causal_graph = causal_graph_str
            except json.JSONDecodeError:
                pass

        # Generate what-if scenarios
        whatif_result = analyze_whatif(synthesis, causal_graph)

        return whatif_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate what-if scenarios for synthesis {synthesis_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
