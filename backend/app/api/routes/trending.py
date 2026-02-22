"""
Trending Topics API Routes
Provides category statistics and trending topics for navigation
"""
from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Dict, Any
from loguru import logger
from datetime import datetime, timedelta
from collections import Counter
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.qdrant_client import get_qdrant_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# Valid categories for NovaPress
VALID_CATEGORIES = ["MONDE", "TECH", "ECONOMIE", "POLITIQUE", "CULTURE", "SPORT", "SCIENCES"]


@router.get("/")
@limiter.limit("60/minute")
async def get_trending_topics(
    request: Request,
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(10, ge=1, le=50)
):
    """
    Get trending topics from recent syntheses.

    Returns topics extracted from key_points of recent syntheses,
    ranked by frequency.
    """
    try:
        qdrant = get_qdrant_service()
        raw_syntheses = qdrant.get_live_syntheses(hours=hours, limit=100)

        # Extract trending topics from key points and titles
        topic_counter = Counter()
        topic_details = {}

        for synthesis in raw_syntheses:
            # Get key points
            key_points = synthesis.get("keyPoints", [])
            if not key_points:
                key_points_str = synthesis.get("key_points", "")
                if key_points_str:
                    key_points = [k.strip() for k in key_points_str.split("|") if k.strip()]

            # Count topics
            for point in key_points[:3]:  # Top 3 key points per synthesis
                topic_counter[point] += 1
                if point not in topic_details:
                    topic_details[point] = {
                        "synthesis_ids": [],
                        "category": synthesis.get("category", "MONDE"),
                        "first_seen": synthesis.get("created_at", 0)
                    }
                topic_details[point]["synthesis_ids"].append(str(synthesis.get("id", "")))

        # Format trending topics
        trending = []
        for topic, count in topic_counter.most_common(limit):
            details = topic_details.get(topic, {})
            trending.append({
                "topic": topic,
                "count": count,
                "category": details.get("category", "MONDE"),
                "synthesisCount": len(details.get("synthesis_ids", [])),
                "synthesisIds": details.get("synthesis_ids", [])[:5]  # Limit to 5 IDs
            })

        return {
            "data": trending,
            "total": len(trending),
            "hours": hours,
            "type": "trending"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch trending topics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/entities")
@limiter.limit("60/minute")
async def get_trending_entities(
    request: Request,
    hours: int = Query(168, ge=1, le=720),
    limit: int = Query(15, ge=5, le=50)
):
    """
    Get trending named entities (people, orgs, places) from recent syntheses.

    Aggregates key_entities from Qdrant synthesis payloads (NER-extracted,
    no LLM call). Returns the most mentioned entities as clickable topic pills.
    """
    try:
        qdrant = get_qdrant_service()
        raw_syntheses = qdrant.get_live_syntheses(hours=hours, limit=200)

        entity_counter = Counter()

        for synthesis in raw_syntheses:
            key_entities_raw = synthesis.get("key_entities", "")
            if not key_entities_raw:
                continue
            # key_entities is stored as "Trump, Ukraine, Macron, OTAN"
            if isinstance(key_entities_raw, list):
                entities = [str(e).strip() for e in key_entities_raw if str(e).strip()]
            else:
                entities = [e.strip() for e in str(key_entities_raw).split(",") if e.strip()]

            for entity in entities:
                # Skip very short or numeric-only entities
                if len(entity) >= 3 and not entity.isdigit():
                    entity_counter[entity] += 1

        # Return top entities appearing at least twice
        result = [
            {"entity": entity, "count": count}
            for entity, count in entity_counter.most_common(limit)
            if count >= 2
        ]

        return {
            "data": result,
            "total": len(result),
            "hours": hours,
            "type": "entities"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch trending entities: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/categories")
@limiter.limit("60/minute")
async def get_categories_stats(
    request: Request,
    hours: int = Query(24, ge=1, le=168)
):
    """
    Get all categories with their synthesis counts.

    Returns statistics for each category including:
    - Number of syntheses in the time period
    - Most recent synthesis timestamp
    - Whether the category is "hot" (many recent articles)
    """
    try:
        qdrant = get_qdrant_service()
        raw_syntheses = qdrant.get_live_syntheses(hours=hours, limit=200)

        # Count syntheses per category
        category_stats = {cat: {"count": 0, "latest": 0, "titles": []} for cat in VALID_CATEGORIES}

        for synthesis in raw_syntheses:
            category = synthesis.get("category", "MONDE").upper()
            if category not in category_stats:
                category = "MONDE"  # Fallback

            category_stats[category]["count"] += 1

            created_at = synthesis.get("created_at", 0)
            if created_at > category_stats[category]["latest"]:
                category_stats[category]["latest"] = created_at

            # Keep latest 3 titles
            title = synthesis.get("title", "")
            if title and len(category_stats[category]["titles"]) < 3:
                category_stats[category]["titles"].append(title)

        # Format response
        categories = []
        total_syntheses = sum(s["count"] for s in category_stats.values())

        for cat in VALID_CATEGORIES:
            stats = category_stats[cat]
            latest_iso = ""
            if stats["latest"] > 0:
                try:
                    latest_iso = datetime.fromtimestamp(stats["latest"]).isoformat()
                except (ValueError, TypeError, OSError):
                    latest_iso = ""

            # A category is "hot" if it has >20% of total or >10 syntheses
            is_hot = stats["count"] > 10 or (total_syntheses > 0 and stats["count"] / total_syntheses > 0.2)

            categories.append({
                "name": cat,
                "displayName": get_category_display_name(cat),
                "count": stats["count"],
                "latestAt": latest_iso,
                "isHot": is_hot,
                "recentTitles": stats["titles"]
            })

        # Sort by count descending
        categories.sort(key=lambda x: x["count"], reverse=True)

        return {
            "data": categories,
            "total": total_syntheses,
            "hours": hours,
            "type": "categories"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch categories stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/live-count")
@limiter.limit("120/minute")
async def get_live_count(
    request: Request,
    hours: int = Query(24, ge=1, le=168)
):
    """
    Get the count of syntheses in the last X hours.

    Used by the "EN DIRECT" button to show a badge with the count.
    """
    try:
        qdrant = get_qdrant_service()
        raw_syntheses = qdrant.get_live_syntheses(hours=hours, limit=1000)

        return {
            "count": len(raw_syntheses),
            "hours": hours,
            "type": "live-count"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch live count: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{topic_id}/synthesis")
async def get_topic_synthesis(topic_id: str):
    """Get AI synthesis for a trending topic"""
    try:
        qdrant = get_qdrant_service()
        synthesis = qdrant.get_synthesis_by_id(topic_id)

        if not synthesis:
            raise HTTPException(status_code=404, detail="Synthesis not found")

        return synthesis
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch synthesis: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


def get_category_display_name(category: str) -> str:
    """Get French display name for a category"""
    display_names = {
        "MONDE": "Monde",
        "TECH": "Tech",
        "ECONOMIE": "Économie",
        "POLITIQUE": "Politique",
        "CULTURE": "Culture",
        "SPORT": "Sport",
        "SCIENCES": "Sciences"
    }
    return display_names.get(category.upper(), category)


# ==========================================
# Phase 7: Recurring Topics Endpoints
# ==========================================

@router.get("/recurring-topics")
@limiter.limit("30/minute")
async def get_recurring_topics(
    request: Request,
    days: int = Query(30, ge=7, le=90),
    limit: int = Query(20, ge=1, le=50)
):
    """
    Get topics that recur across multiple syntheses (3+).

    A topic is considered "recurring" when it appears in at least 3 syntheses.
    Returns topics with synthesis counts, key entities, and narrative arc.
    """
    try:
        from app.ml.topic_tracker import get_topic_tracker

        tracker = get_topic_tracker()
        topics = await tracker.detect_recurring_topics(days=days, limit=limit)

        return {
            "data": topics,
            "total": len(topics),
            "days": days,
            "type": "recurring-topics"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch recurring topics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/topics/{topic_name}/dashboard")
@limiter.limit("30/minute")
async def get_topic_dashboard(
    request: Request,
    topic_name: str
):
    """
    Get full dashboard data for a recurring topic.

    Returns:
    - Aggregated causal graph from all related syntheses
    - Sentiment evolution over time
    - Key entities with counts
    - Predictions summary
    - Geographic focus
    """
    try:
        from app.ml.topic_tracker import get_topic_tracker

        tracker = get_topic_tracker()
        dashboard = await tracker.get_topic_dashboard(topic_name)

        if not dashboard:
            raise HTTPException(
                status_code=404,
                detail=f"Topic '{topic_name}' not found or not recurring (needs 3+ syntheses)"
            )

        return dashboard
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch topic dashboard: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/syntheses/{synthesis_id}/topic-info")
@limiter.limit("60/minute")
async def get_synthesis_topic_info(
    request: Request,
    synthesis_id: str
):
    """
    Check if a synthesis belongs to a recurring topic.

    Returns topic info if the synthesis is part of a recurring topic,
    including topic name, total synthesis count, and related IDs.
    """
    try:
        from app.ml.topic_tracker import get_topic_tracker

        tracker = get_topic_tracker()
        topic_info = await tracker.check_topic_recurrence(synthesis_id)

        if not topic_info:
            return {
                "synthesis_id": synthesis_id,
                "is_recurring": False,
                "topic_name": None
            }

        return {
            "synthesis_id": synthesis_id,
            **topic_info
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check topic recurrence: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
