"""
Admin API Routes - Pipeline Management
Protected by simple API key authentication
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from loguru import logger
import os

from app.services.pipeline_manager import get_pipeline_manager
from app.core.circuit_breaker import get_all_circuit_statuses

router = APIRouter()

# Simple API key authentication (configurable via environment)
# SECURITY: No default fallback - must be set in .env
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")
if not ADMIN_API_KEY:
    logger.warning("⚠️ ADMIN_API_KEY not set! Admin endpoints will be disabled.")
    ADMIN_API_KEY = None


class PipelineRequest(BaseModel):
    mode: str = "SCRAPE"  # SCRAPE, TOPIC, SIMULATION
    sources: Optional[List[str]] = None
    topics: Optional[List[str]] = None
    max_articles_per_source: int = 20


class PipelineResponse(BaseModel):
    status: str
    message: str
    pipeline_id: Optional[str] = None
    started_at: Optional[str] = None


def verify_admin_key(x_admin_key: str = Header(None)):
    """Simple API key verification"""
    # Reject if ADMIN_API_KEY not configured
    if not ADMIN_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Admin API not configured. Set ADMIN_API_KEY in .env"
        )
    if not x_admin_key or x_admin_key != ADMIN_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing admin API key"
        )
    return True


@router.get("/status")
async def get_pipeline_status():
    """
    Get current pipeline status
    No authentication required for status check
    """
    manager = get_pipeline_manager()
    return manager.get_state()


@router.get("/logs")
async def get_pipeline_logs(limit: int = 100, offset: int = 0):
    """
    Get pipeline logs
    No authentication required
    """
    manager = get_pipeline_manager()
    return {
        "logs": manager.get_logs(limit=limit, offset=offset),
        "total": len(manager._logs)
    }


@router.post("/pipeline/start", response_model=PipelineResponse)
async def start_pipeline(
    request: PipelineRequest,
    x_admin_key: str = Header(None)
):
    """
    Start the news pipeline
    Requires admin API key in x-admin-key header
    """
    verify_admin_key(x_admin_key)

    manager = get_pipeline_manager()

    if manager.is_running:
        raise HTTPException(
            status_code=409,
            detail="Pipeline is already running"
        )

    result = await manager.start(
        mode=request.mode,
        sources=request.sources,
        topics=request.topics,
        max_articles_per_source=request.max_articles_per_source
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return PipelineResponse(
        status="started",
        message=f"Pipeline started in {request.mode} mode",
        pipeline_id=result.get("pipeline_id"),
        started_at=result.get("started_at")
    )


# Keep old endpoint for backward compatibility
@router.post("/pipeline/run", response_model=PipelineResponse)
async def run_pipeline(
    request: PipelineRequest,
    x_admin_key: str = Header(None)
):
    """Alias for /pipeline/start (backward compatibility)"""
    return await start_pipeline(request, x_admin_key)


@router.post("/pipeline/stop")
async def stop_pipeline(x_admin_key: str = Header(None)):
    """
    Stop the running pipeline
    Requires admin API key
    """
    verify_admin_key(x_admin_key)

    manager = get_pipeline_manager()
    result = await manager.stop()

    return result


@router.get("/stats")
async def get_admin_stats(x_admin_key: str = Header(None)):
    """
    Get overall system statistics
    Requires admin API key
    """
    verify_admin_key(x_admin_key)

    # Get pipeline state first
    manager = get_pipeline_manager()
    pipeline_state = manager.get_state()

    try:
        from app.db.qdrant_client import get_qdrant_service

        qdrant = get_qdrant_service()

        # Get collection info
        articles_info = await qdrant.get_collection_info("novapress_articles")
        syntheses_info = await qdrant.get_collection_info("novapress_syntheses")

        return {
            "articles": {
                "total": articles_info.get("points_count", 0) if articles_info else 0
            },
            "syntheses": {
                "total": syntheses_info.get("points_count", 0) if syntheses_info else 0
            },
            "pipeline": {
                "last_run": pipeline_state.get("last_run"),
                "last_result": pipeline_state.get("last_result")
            }
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return {
            "articles": {"total": 0, "error": str(e)},
            "syntheses": {"total": 0},
            "pipeline": {
                "last_run": pipeline_state.get("last_run"),
                "last_result": pipeline_state.get("last_result")
            }
        }


@router.get("/sources")
async def get_available_sources():
    """
    Get list of available news sources (dynamically from scraper config)
    No authentication required
    """
    from app.services.advanced_scraper import AdvancedNewsScraper

    sources = AdvancedNewsScraper.WORLD_NEWS_SOURCES
    news_sources = [
        {
            "domain": domain,
            "name": config.get("name", domain),
            "url": config.get("url", ""),
            "rate_limit": config.get("rate_limit", 1.0),
            "status": "active"
        }
        for domain, config in sources.items()
    ]

    return {
        "news_sources": news_sources,
        "alternative_sources": [
            {"name": "Reddit", "type": "social", "status": "active"},
            {"name": "Hacker News", "type": "tech", "status": "active"},
            {"name": "ArXiv", "type": "academic", "status": "active"},
            {"name": "Wikipedia", "type": "reference", "status": "active"},
        ],
        "total_sources": len(news_sources) + 4
    }


@router.get("/circuit-breakers")
async def get_circuit_breaker_status():
    """
    Get status of all circuit breakers for external APIs.
    Useful for monitoring API health and debugging connectivity issues.

    Returns:
        Dict with circuit breaker states for:
        - openrouter: Main LLM API
        - perplexity: Web search enrichment
        - xai: Social sentiment analysis
    """
    return {
        "circuit_breakers": get_all_circuit_statuses(),
        "timestamp": datetime.now().isoformat()
    }
