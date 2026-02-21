"""
Articles API Routes
"""
from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional, Dict, Any
from loguru import logger
from datetime import datetime
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.ml.embeddings import get_embedding_service
from app.db.qdrant_client import get_qdrant_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def format_article_for_frontend(article: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform article from Qdrant format to Frontend expected format

    Backend (Qdrant):
        - source: string
        - category: string
        - published_at: float (timestamp)
        - image_url: string

    Frontend expects:
        - source: { id, name, domain, credibilityScore }
        - category: { id, name, slug }
        - publishedAt: ISO string
        - imageUrl: string (camelCase)
    """
    # Convert timestamp to ISO string
    published_at = article.get("published_at", 0)
    if isinstance(published_at, (int, float)) and published_at > 0:
        try:
            published_at_iso = datetime.fromtimestamp(published_at).isoformat()
        except (ValueError, TypeError, OSError):
            published_at_iso = datetime.now().isoformat()
    else:
        published_at_iso = datetime.now().isoformat()

    # Build source object
    source_name = article.get("source", "Unknown")
    source_domain = article.get("source_domain", "")
    source = {
        "id": source_domain or source_name.lower().replace(" ", "-"),
        "name": source_name,
        "domain": source_domain,
        "url": f"https://{source_domain}" if source_domain else None,
        "credibilityScore": 85
    }

    # Build category object
    category_name = article.get("category", "general")
    category = {
        "id": category_name.lower().replace(" ", "-"),
        "name": category_name.capitalize(),
        "slug": category_name.lower().replace(" ", "-")
    }

    # Parse keywords/tags
    keywords = article.get("keywords", "")
    if isinstance(keywords, str):
        tags = [k.strip() for k in keywords.split(",") if k.strip()]
    elif isinstance(keywords, list):
        tags = keywords
    else:
        tags = []

    return {
        "id": str(article.get("id", "")),
        "title": article.get("title", ""),
        "subtitle": "",
        "content": article.get("content", ""),
        "summary": article.get("summary", article.get("content", "")[:200] if article.get("content") else ""),
        "author": article.get("authors", "NovaPress AI"),
        "source": source,
        "category": category,
        "publishedAt": published_at_iso,
        "updatedAt": published_at_iso,
        "imageUrl": article.get("image_url", ""),
        "tags": tags[:5],  # Limit to 5 tags
        "readTime": max(1, len(article.get("content", "")) // 1000),  # ~1min per 1000 chars
        "viewCount": 0,
        "isBreaking": False,
        "isFeatured": False,
        "url": article.get("url", "")
    }


@router.get("/")
@limiter.limit("100/minute")
async def get_articles(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    featured: bool = False
):
    """Get paginated list of articles"""
    try:
        qdrant = get_qdrant_service()

        result = qdrant.get_latest_articles(
            limit=limit,
            category=category
        )

        raw_articles = result["articles"]
        next_offset = result["next_offset"]

        # Transform articles for frontend
        articles = [format_article_for_frontend(a) for a in raw_articles]

        return {
            "data": articles,
            "total": len(articles),
            "page": page,
            "limit": limit,
            "hasNext": next_offset is not None,
            "hasPrev": page > 1
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch articles: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{article_id}")
@limiter.limit("200/minute")
async def get_article(request: Request, article_id: str):
    """Get single article by ID"""
    try:
        qdrant = get_qdrant_service()
        article = qdrant.get_article_by_id(article_id)

        if not article:
            raise HTTPException(status_code=404, detail="Article not found")

        article["id"] = article_id
        return format_article_for_frontend(article)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch article {article_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{article_id}/related")
@limiter.limit("60/minute")
async def get_related_articles(
    request: Request,
    article_id: str,
    limit: int = Query(5, ge=1, le=20)
):
    """Get articles related to a specific article"""
    try:
        qdrant = get_qdrant_service()
        embeddings = get_embedding_service()

        # Get original article
        article = qdrant.get_article_by_id(article_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")

        # Compute embedding for article text
        article_text = f"{article['title']} {article.get('summary', '')}"
        query_embedding = embeddings.encode_single(article_text)

        # Search for similar articles
        similar = qdrant.search_similar(
            query_embedding=query_embedding.tolist(),
            limit=limit + 1  # +1 to exclude the original article
        )

        # Filter out the original article and format for frontend
        related = [format_article_for_frontend(a) for a in similar if str(a.get("id")) != article_id][:limit]

        return related

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch related articles: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/breaking")
async def get_breaking_news():
    """Get breaking news articles"""
    # TODO: Implement breaking news logic
    return []


@router.post("/{article_id}/view")
async def increment_view_count(article_id: str):
    """Increment view count for an article"""
    # TODO: Implement view tracking
    return {"status": "ok"}
