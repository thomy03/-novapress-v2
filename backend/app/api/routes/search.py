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

    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
