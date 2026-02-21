"""
Search API Routes
Semantic search using BGE-M3 embeddings
"""
from fastapi import APIRouter, HTTPException, Query, Request
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.ml.embeddings import get_embedding_service
from app.db.qdrant_client import get_qdrant_service
from app.api.routes.articles import format_article_for_frontend

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.get("/")
@limiter.limit("30/minute")
async def search_articles(
    request: Request,
    q: str = Query(..., min_length=2, max_length=200),
    category: str = None,
    limit: int = Query(20, ge=1, le=100)
):
    """
    Semantic search for articles

    Args:
        q: Search query
        category: Optional category filter
        limit: Maximum results

    Returns:
        Paginated response with matching articles
    """
    try:
        embeddings = get_embedding_service()
        qdrant = get_qdrant_service()

        # Generate query embedding
        logger.info(f"Searching for: {q}")
        query_embedding = embeddings.encode_single(q)

        # Search in Qdrant
        raw_results = qdrant.search_similar(
            query_embedding=query_embedding.tolist(),
            limit=limit,
            category=category
        )

        # Format articles for frontend
        results = [format_article_for_frontend(a) for a in raw_results]

        return {
            "data": results,
            "total": len(results),
            "page": 1,
            "limit": limit,
            "hasNext": False,
            "hasPrev": False,
            "query": q
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/suggestions")
@limiter.limit("60/minute")
async def get_search_suggestions(
    request: Request,
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(8, ge=1, le=20)
):
    """
    Get search suggestions for autocomplete.

    Returns titles and categories that match the query prefix.

    Args:
        q: Search query prefix
        limit: Maximum suggestions

    Returns:
        List of suggestions with type (title/category/topic)
    """
    try:
        qdrant = get_qdrant_service()
        suggestions = []
        query_lower = q.lower().strip()

        # Get recent syntheses
        syntheses = qdrant.get_latest_syntheses(limit=100)

        # Find matching titles
        seen_titles = set()
        for s in syntheses:
            title = s.get("title", "")
            if title and query_lower in title.lower():
                # Truncate long titles
                display_title = title[:60] + "..." if len(title) > 60 else title
                if display_title not in seen_titles:
                    seen_titles.add(display_title)
                    suggestions.append({
                        "type": "title",
                        "text": display_title,
                        "synthesisId": s.get("id"),
                        "category": s.get("category")
                    })

        # Find matching categories
        categories = ["MONDE", "TECH", "ECONOMIE", "POLITIQUE", "CULTURE", "SPORT", "SCIENCES"]
        category_labels = {
            "MONDE": "Actualités mondiales",
            "TECH": "Technologies",
            "ECONOMIE": "Économie & Finance",
            "POLITIQUE": "Politique",
            "CULTURE": "Culture & Société",
            "SPORT": "Sport",
            "SCIENCES": "Sciences"
        }

        for cat in categories:
            label = category_labels.get(cat, cat)
            if query_lower in cat.lower() or query_lower in label.lower():
                suggestions.append({
                    "type": "category",
                    "text": label,
                    "category": cat
                })

        # Find matching key topics from syntheses
        seen_topics = set()
        for s in syntheses:
            key_points = s.get("key_points", s.get("keyPoints", []))
            if isinstance(key_points, list):
                for point in key_points[:3]:  # First 3 key points
                    if isinstance(point, str) and query_lower in point.lower():
                        short_point = point[:50] + "..." if len(point) > 50 else point
                        if short_point not in seen_topics:
                            seen_topics.add(short_point)
                            suggestions.append({
                                "type": "topic",
                                "text": short_point,
                                "synthesisId": s.get("id")
                            })

        # Sort by relevance (exact prefix matches first)
        def sort_key(item):
            text = item.get("text", "").lower()
            # Exact prefix match = highest priority
            if text.startswith(query_lower):
                return (0, len(text))
            # Contains match = lower priority
            return (1, text.index(query_lower) if query_lower in text else 999)

        suggestions.sort(key=sort_key)

        return {
            "suggestions": suggestions[:limit],
            "query": q,
            "total": len(suggestions)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Suggestions failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
