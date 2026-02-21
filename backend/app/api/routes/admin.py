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
from app.core.config import settings

router = APIRouter()

# Simple API key authentication (loaded from pydantic-settings)
ADMIN_API_KEY = settings.ADMIN_API_KEY
if not ADMIN_API_KEY:
    logger.warning("⚠️ ADMIN_API_KEY not set! Admin endpoints will be disabled.")
    ADMIN_API_KEY = None
else:
    logger.info("✅ ADMIN_API_KEY configured")


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


def verify_admin_key(x_admin_key: str = Header(None, alias="x-admin-key")):
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
    x_admin_key: str = Header(None, alias="x-admin-key")
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
    x_admin_key: str = Header(None, alias="x-admin-key")
):
    """Alias for /pipeline/start (backward compatibility)"""
    return await start_pipeline(request, x_admin_key)


@router.post("/pipeline/stop")
async def stop_pipeline(x_admin_key: str = Header(None, alias="x-admin-key")):
    """
    Stop the running pipeline
    Requires admin API key
    """
    verify_admin_key(x_admin_key)

    manager = get_pipeline_manager()
    result = await manager.stop()

    return result


@router.post("/pipeline/reset-lock")
async def reset_pipeline_lock(x_admin_key: str = Header(None, alias="x-admin-key")):
    """
    Force reset the pipeline lock (use if pipeline is stuck)
    Requires admin API key
    """
    verify_admin_key(x_admin_key)

    from app.services.pipeline_manager import (
        get_redis_client,
        PIPELINE_LOCK_KEY,
        PipelineStatus
    )

    manager = get_pipeline_manager()
    results = {
        "local_status_before": manager.status,
        "redis_lock_existed": False,
        "actions": []
    }

    # Reset local state
    if manager._status != PipelineStatus.IDLE:
        manager._status = PipelineStatus.IDLE
        manager._cancel_requested = False
        manager._progress = 0
        manager._current_step = None
        results["actions"].append("Reset local pipeline state to IDLE")

    # Clear Redis lock
    redis_client = get_redis_client()
    if redis_client:
        try:
            lock_value = redis_client.get(PIPELINE_LOCK_KEY)
            if lock_value:
                results["redis_lock_existed"] = True
                results["redis_lock_value"] = lock_value
                redis_client.delete(PIPELINE_LOCK_KEY)
                results["actions"].append(f"Deleted Redis lock: {lock_value}")
            else:
                results["actions"].append("No Redis lock found")
        except Exception as e:
            results["redis_error"] = str(e)
    else:
        results["actions"].append("Redis not available (local-only mode)")

    results["local_status_after"] = manager.status
    results["message"] = "Pipeline lock reset complete"

    return results


@router.get("/pipeline/debug")
async def debug_pipeline_state():
    """
    Debug endpoint to check pipeline state (no auth for diagnostics)
    """
    from app.services.pipeline_manager import (
        get_redis_client,
        PIPELINE_LOCK_KEY
    )

    manager = get_pipeline_manager()

    # Check Redis
    redis_info = {"available": False}
    redis_client = get_redis_client()
    if redis_client:
        try:
            redis_client.ping()
            redis_info["available"] = True
            lock_value = redis_client.get(PIPELINE_LOCK_KEY)
            redis_info["lock_exists"] = lock_value is not None
            redis_info["lock_value"] = lock_value
            redis_info["lock_ttl"] = redis_client.ttl(PIPELINE_LOCK_KEY) if lock_value else None
        except Exception as e:
            redis_info["error"] = str(e)

    return {
        "local_state": {
            "status": manager.status,
            "is_running": manager.is_running,
            "progress": manager._progress,
            "current_step": manager._current_step,
            "cancel_requested": manager._cancel_requested,
        },
        "redis": redis_info,
        "can_start": not manager.is_running and (not redis_info.get("lock_exists", False) or not redis_info["available"])
    }


@router.get("/pipeline/blacklist")
async def get_blacklisted_sources():
    """
    Get list of blacklisted sources (no auth for monitoring)
    Sources are auto-blacklisted when they timeout or fail repeatedly.
    """
    manager = get_pipeline_manager()
    return {
        "blacklisted_sources": manager.get_blacklist(),
        "count": len(manager.get_blacklist()),
        "timestamp": datetime.now().isoformat()
    }


@router.post("/pipeline/blacklist/clear")
async def clear_source_blacklist(
    domain: Optional[str] = None,
    x_admin_key: str = Header(None, alias="x-admin-key")
):
    """
    Clear blacklisted sources (all or specific domain)
    Requires admin API key

    Query params:
        domain: Optional - clear only this domain, or all if not specified
    """
    verify_admin_key(x_admin_key)

    manager = get_pipeline_manager()
    before_count = len(manager.get_blacklist())
    manager.clear_blacklist(domain)
    after_count = len(manager.get_blacklist())

    return {
        "status": "cleared",
        "domain_cleared": domain or "all",
        "before_count": before_count,
        "after_count": after_count
    }


@router.get("/stats")
async def get_admin_stats(x_admin_key: str = Header(None, alias="x-admin-key")):
    """
    Get overall system statistics
    Requires admin API key
    """
    logger.info(f"Stats request received, key present: {bool(x_admin_key)}, key value: {x_admin_key[:4] if x_admin_key else 'None'}...")
    verify_admin_key(x_admin_key)

    # Get pipeline state first
    manager = get_pipeline_manager()
    pipeline_state = manager.get_state()

    try:
        from app.db.qdrant_client import get_qdrant_service

        qdrant = get_qdrant_service()

        # Get collection stats (not async - no await needed)
        articles_info = qdrant.get_collection_stats("articles")
        syntheses_info = qdrant.get_collection_stats("syntheses")

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


@router.get("/enrichment-stats")
async def get_enrichment_stats():
    """
    Get enrichment success/failure statistics.
    Useful for monitoring API health and costs.

    No authentication required for monitoring.

    Returns:
        Dict with enrichment statistics:
        - total: Total syntheses in period
        - enriched: Successfully enriched count
        - not_enriched: Failed or skipped count
        - enrichment_rate: Success percentage
        - sentiments: Breakdown by sentiment type
        - failure_reasons: Breakdown of failure causes
    """
    from app.db.qdrant_client import get_qdrant_service

    try:
        qdrant = get_qdrant_service()

        # Get recent syntheses (last 24 hours)
        all_syntheses = qdrant.get_live_syntheses(hours=24, limit=500)

        stats = {
            "total": len(all_syntheses),
            "enriched": 0,
            "not_enriched": 0,
            "perplexity_enabled": 0,
            "grok_enabled": 0,
            "fact_checks_total": 0,
            "sentiments": {
                "positive": 0,
                "negative": 0,
                "neutral": 0,
                "mixed": 0,
                "unknown": 0
            },
            "failure_reasons": {}
        }

        for s in all_syntheses:
            if s.get("search_enriched"):
                stats["enriched"] += 1
                if s.get("has_perplexity"):
                    stats["perplexity_enabled"] += 1
                if s.get("has_grok"):
                    stats["grok_enabled"] += 1

                sentiment = s.get("social_sentiment", "unknown") or "unknown"
                if sentiment in stats["sentiments"]:
                    stats["sentiments"][sentiment] += 1
                else:
                    stats["sentiments"]["unknown"] += 1

                fact_notes = s.get("fact_check_notes", [])
                stats["fact_checks_total"] += len(fact_notes) if isinstance(fact_notes, list) else 0
            else:
                stats["not_enriched"] += 1
                status = s.get("enrichment_status", "unknown")
                stats["failure_reasons"][status] = stats["failure_reasons"].get(status, 0) + 1

        stats["enrichment_rate"] = round((stats["enriched"] / stats["total"] * 100), 1) if stats["total"] > 0 else 0

        return {
            "stats": stats,
            "period_hours": 24,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting enrichment stats: {e}")
        return {
            "stats": {"error": str(e)},
            "period_hours": 24,
            "timestamp": datetime.now().isoformat()
        }


@router.get("/pipeline/discovered-sources")
async def get_discovered_sources():
    """
    Get list of auto-discovered replacement sources.
    These are sources found by the LLM when original sources were blocked.
    No authentication required.
    """
    manager = get_pipeline_manager()
    discovered = manager.get_discovered_sources()

    return {
        "discovered_sources": [
            {
                "name": config.get("name", domain),
                "domain": domain,
                "url": config.get("url", ""),
                "replaced": config.get("replaced", "unknown"),
                "discovered_at": config.get("discovered_at", ""),
                "auto_discovered": True
            }
            for domain, config in discovered.items()
        ],
        "count": len(discovered),
        "max_allowed": getattr(settings, 'AUTO_DISCOVERY_MAX_SOURCES', 10),
        "auto_discovery_enabled": getattr(settings, 'ENABLE_AUTO_DISCOVERY', False)
    }


@router.post("/pipeline/discovered-sources/clear")
async def clear_discovered_sources(x_admin_key: str = Header(None, alias="x-admin-key")):
    """
    Clear all auto-discovered sources.
    Requires admin API key.
    """
    verify_admin_key(x_admin_key)

    manager = get_pipeline_manager()
    before_count = len(manager.get_discovered_sources())
    manager.clear_discovered_sources()

    # Also clear from scraper's active sources
    from app.services.advanced_scraper import AdvancedNewsScraper
    for domain, config in list(AdvancedNewsScraper.WORLD_NEWS_SOURCES.items()):
        if config.get("auto_discovered"):
            del AdvancedNewsScraper.WORLD_NEWS_SOURCES[domain]

    return {
        "status": "cleared",
        "sources_removed": before_count
    }


@router.post("/pipeline/discover-source")
async def manually_discover_source(
    blocked_domain: str,
    reason: str = "manual_request",
    x_admin_key: str = Header(None, alias="x-admin-key")
):
    """
    Manually trigger source discovery for a specific domain.
    Useful for testing or manually replacing a problematic source.
    Requires admin API key.
    """
    verify_admin_key(x_admin_key)

    from app.services.source_discovery import get_discovery_service

    if not getattr(settings, 'ENABLE_AUTO_DISCOVERY', False):
        return {
            "status": "error",
            "message": "Auto-discovery is disabled. Set ENABLE_AUTO_DISCOVERY=True in config."
        }

    discovery = get_discovery_service()

    try:
        replacement = await discovery.find_replacement(
            blocked_domain=blocked_domain,
            blocked_reason=reason,
            max_suggestions=3
        )

        if replacement:
            # Add to scraper's sources
            from app.services.advanced_scraper import AdvancedNewsScraper
            new_domain = replacement.get("url", "").replace("https://", "").replace("http://", "").split("/")[0].replace("www.", "")
            if new_domain:
                AdvancedNewsScraper.WORLD_NEWS_SOURCES[new_domain] = replacement

            # Store in manager
            manager = get_pipeline_manager()
            manager._discovered_sources[replacement.get("name", blocked_domain)] = replacement

            return {
                "status": "success",
                "replacement": {
                    "name": replacement.get("name"),
                    "domain": new_domain,
                    "url": replacement.get("url"),
                    "selectors": replacement.get("selectors")
                }
            }
        else:
            return {
                "status": "not_found",
                "message": f"Could not find a valid replacement for {blocked_domain}"
            }

    except Exception as e:
        logger.error(f"Manual discovery failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


# ═══════════════════════════════════════════════════════════════
# KEYWORD LEARNING ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get("/keywords/learned")
async def get_learned_keywords():
    """
    Get all dynamically learned keyword→persona associations.
    No auth required for monitoring.
    """
    try:
        from app.ml.keyword_learner import get_keyword_learner

        learner = await get_keyword_learner()
        learned = await learner.get_all_learned_details()

        return {
            "status": "success",
            "count": len(learned),
            "keywords": [
                {
                    "keyword": k.keyword,
                    "persona_id": k.persona_id,
                    "confidence": k.confidence,
                    "occurrence_count": k.occurrence_count,
                    "categories": k.category_associations,
                    "source": k.source,
                    "first_seen": k.first_seen,
                    "last_seen": k.last_seen,
                }
                for k in learned
            ],
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get learned keywords: {e}")
        return {
            "status": "error",
            "message": str(e),
            "keywords": []
        }


@router.get("/keywords/pending")
async def get_pending_keywords():
    """
    Get keywords that are approaching the learning threshold.
    No auth required for monitoring.
    """
    try:
        from app.ml.keyword_learner import get_keyword_learner

        learner = await get_keyword_learner()
        candidates = await learner.get_keywords_above_threshold()

        return {
            "status": "success",
            "count": len(candidates),
            "pending": [
                {
                    "keyword": c.keyword,
                    "count": c.count,
                    "categories": c.categories,
                    "sample_titles": c.sample_titles,
                }
                for c in candidates
            ],
            "threshold": 10,  # RECURRENCE_THRESHOLD
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get pending keywords: {e}")
        return {
            "status": "error",
            "message": str(e),
            "pending": []
        }


@router.post("/keywords/process")
async def process_pending_keywords(
    x_admin_key: str = Header(None, alias="x-admin-key")
):
    """
    Manually trigger processing of all pending keywords.
    Requires admin key.
    """
    verify_admin_key(x_admin_key)

    try:
        from app.ml.keyword_learner import get_keyword_learner

        learner = await get_keyword_learner()
        learned_count = await learner.process_pending_keywords()

        return {
            "status": "success",
            "message": f"Processed pending keywords, learned {learned_count} new associations",
            "new_keywords_learned": learned_count,
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process keywords: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/keywords/refresh-cache")
async def refresh_keyword_cache():
    """
    Refresh the in-memory cache of dynamic keywords.
    No auth required (read-only operation).
    """
    try:
        from app.ml.persona import load_dynamic_keywords

        keywords = await load_dynamic_keywords()

        return {
            "status": "success",
            "message": f"Refreshed keyword cache with {len(keywords)} keywords",
            "count": len(keywords),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to refresh keyword cache: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


# ═══════════════════════════════════════════════════════════════
# KILL SWITCH & MODERATION ENDPOINTS (Phase 2.5)
# ═══════════════════════════════════════════════════════════════

@router.post("/synthesis/{synthesis_id}/toggle-publish")
async def toggle_synthesis_publish(
    synthesis_id: str,
    x_admin_key: str = Header(None, alias="x-admin-key")
):
    """
    Toggle publish status of a synthesis (Kill Switch).
    Immediately hides/shows a synthesis without deleting it.
    Requires admin API key.

    Phase 2.5 - Plan Backend: Sécurité opérationnelle
    """
    verify_admin_key(x_admin_key)

    from app.db.qdrant_client import get_qdrant_service

    try:
        qdrant = get_qdrant_service()

        # Get current synthesis
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)
        if not synthesis:
            raise HTTPException(status_code=404, detail=f"Synthesis {synthesis_id} not found")

        # Toggle is_published
        current_status = synthesis.get("is_published", True)
        new_status = not current_status

        # Update in Qdrant
        qdrant.client.set_payload(
            collection_name=qdrant.syntheses_collection,
            payload={"is_published": new_status},
            points=[synthesis_id]
        )

        action = "published" if new_status else "unpublished"
        logger.info(f"🔴 Kill Switch: Synthesis {synthesis_id} {action} by admin")

        return {
            "status": "success",
            "synthesis_id": synthesis_id,
            "is_published": new_status,
            "action": action,
            "timestamp": datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to toggle publish: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/synthesis/{synthesis_id}/moderation")
async def set_moderation_flag(
    synthesis_id: str,
    flag: str = "safe",
    x_admin_key: str = Header(None, alias="x-admin-key")
):
    """
    Set moderation flag for a synthesis.
    Flags: "safe", "warning", "blocked"
    Requires admin API key.

    Phase 2.5 - Plan Backend: Sécurité opérationnelle
    """
    verify_admin_key(x_admin_key)

    if flag not in ["safe", "warning", "blocked"]:
        raise HTTPException(status_code=400, detail=f"Invalid flag: {flag}. Must be safe/warning/blocked")

    from app.db.qdrant_client import get_qdrant_service

    try:
        qdrant = get_qdrant_service()

        # Verify synthesis exists
        synthesis = qdrant.get_synthesis_by_id(synthesis_id)
        if not synthesis:
            raise HTTPException(status_code=404, detail=f"Synthesis {synthesis_id} not found")

        # Update moderation flag
        qdrant.client.set_payload(
            collection_name=qdrant.syntheses_collection,
            payload={"moderation_flag": flag},
            points=[synthesis_id]
        )

        # If blocked, also unpublish
        if flag == "blocked":
            qdrant.client.set_payload(
                collection_name=qdrant.syntheses_collection,
                payload={"is_published": False},
                points=[synthesis_id]
            )

        logger.info(f"🚩 Moderation: Synthesis {synthesis_id} flagged as '{flag}'")

        return {
            "status": "success",
            "synthesis_id": synthesis_id,
            "moderation_flag": flag,
            "is_published": synthesis.get("is_published", True) if flag != "blocked" else False,
            "timestamp": datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set moderation flag: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/syntheses/moderation-report")
async def get_moderation_report():
    """
    Get moderation status report for all syntheses (last 7 days).
    No auth required for monitoring.

    Phase 2.5 - Plan Backend: Sécurité opérationnelle
    """
    from app.db.qdrant_client import get_qdrant_service

    try:
        qdrant = get_qdrant_service()

        # Get all syntheses from last 7 days
        all_syntheses = qdrant.get_live_syntheses(hours=168, limit=1000)

        report = {
            "total": len(all_syntheses),
            "published": 0,
            "unpublished": 0,
            "flags": {
                "safe": 0,
                "warning": 0,
                "blocked": 0,
                "unknown": 0
            },
            "recent_unpublished": []
        }

        for s in all_syntheses:
            if s.get("is_published", True):
                report["published"] += 1
            else:
                report["unpublished"] += 1
                # Track recently unpublished
                if len(report["recent_unpublished"]) < 10:
                    report["recent_unpublished"].append({
                        "id": s.get("id"),
                        "title": s.get("title", "")[:50],
                        "flag": s.get("moderation_flag", "unknown")
                    })

            flag = s.get("moderation_flag", "unknown")
            if flag in report["flags"]:
                report["flags"][flag] += 1
            else:
                report["flags"]["unknown"] += 1

        return {
            "report": report,
            "period_days": 7,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get moderation report: {e}")
        return {
            "report": {"error": str(e)},
            "period_days": 7,
            "timestamp": datetime.now().isoformat()
        }


# ═══════════════════════════════════════════════════════════════
# SOURCE HEALTH MONITORING ENDPOINTS (Phase 5 - Scraping Improvement Plan)
# ═══════════════════════════════════════════════════════════════

@router.get("/sources/health")
async def get_source_health():
    """
    Get health metrics for all tracked sources.
    Shows success rates, failure counts, and status for each source.
    No authentication required for monitoring.

    Returns:
        - total_sources: Number of tracked sources
        - active_count: Sources with >50% success rate
        - degraded_count: Sources with issues
        - blocked_count: Sources failing consistently
        - sources: Detailed breakdown by status
    """
    from app.services.source_persistence import get_source_persistence

    try:
        persistence = await get_source_persistence()
        health_report = await persistence.get_health_report()

        return {
            "health": health_report,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get source health: {e}")
        return {
            "health": {"error": str(e)},
            "timestamp": datetime.now().isoformat()
        }


@router.get("/sources/rss")
async def get_rss_sources():
    """
    Get all configured RSS feed sources.
    Shows the RSS database with feed URLs and categories.
    No authentication required.
    """
    from app.services.rss_sources import RSS_FEEDS_DATABASE, get_stats

    sources = []
    for domain, config in RSS_FEEDS_DATABASE.items():
        sources.append({
            "domain": domain,
            "name": config.get("name", domain),
            "tier": config.get("tier", 2),
            "language": config.get("language", "unknown"),
            "feeds_count": len(config.get("feeds", [])),
            "feeds": [
                {"url": f["url"], "category": f.get("category", "MONDE")}
                for f in config.get("feeds", [])
            ]
        })

    stats = get_stats()

    return {
        "rss_sources": sources,
        "stats": stats,
        "timestamp": datetime.now().isoformat()
    }


@router.get("/sources/rss/health")
async def get_rss_health():
    """
    Get health metrics for RSS feeds specifically.
    Shows which feeds are working vs failing.
    No authentication required.
    """
    from app.services.rss_scraper import get_rss_scraper

    try:
        scraper = get_rss_scraper()
        health_report = scraper.get_health_report()

        return {
            "rss_health": health_report,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get RSS health: {e}")
        return {
            "rss_health": {"error": str(e)},
            "timestamp": datetime.now().isoformat()
        }


@router.post("/sources/discover")
async def trigger_source_discovery(
    blocked_domain: str,
    reason: str = "manual",
    x_admin_key: str = Header(None, alias="x-admin-key")
):
    """
    Manually trigger source discovery for a blocked domain.
    Will search for RSS feeds first, then use LLM for alternatives.
    Requires admin API key.

    Args:
        blocked_domain: Domain that is blocked/failing
        reason: Why discovery is needed
    """
    verify_admin_key(x_admin_key)

    from app.services.source_discovery import get_discovery_service

    discovery = get_discovery_service()

    try:
        replacement = await discovery.find_replacement(
            blocked_domain=blocked_domain,
            blocked_reason=reason,
            max_suggestions=3
        )

        if replacement:
            return {
                "status": "found",
                "replacement": replacement,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "status": "not_found",
                "message": f"No replacement found for {blocked_domain}",
                "timestamp": datetime.now().isoformat()
            }

    except Exception as e:
        logger.error(f"Source discovery failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@router.post("/sources/blacklist/add")
async def add_to_source_blacklist(
    domain: str,
    reason: str = "",
    x_admin_key: str = Header(None, alias="x-admin-key")
):
    """
    Add a source to the permanent blacklist.
    Requires admin API key.
    """
    verify_admin_key(x_admin_key)

    from app.services.source_persistence import get_source_persistence

    try:
        persistence = await get_source_persistence()
        await persistence.add_to_blacklist(domain, reason)

        return {
            "status": "blacklisted",
            "domain": domain,
            "reason": reason,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to blacklist {domain}: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


@router.post("/sources/blacklist/remove")
async def remove_from_source_blacklist(
    domain: str,
    x_admin_key: str = Header(None, alias="x-admin-key")
):
    """
    Remove a source from the blacklist.
    Requires admin API key.
    """
    verify_admin_key(x_admin_key)

    from app.services.source_persistence import get_source_persistence

    try:
        persistence = await get_source_persistence()
        await persistence.remove_from_blacklist(domain)

        return {
            "status": "removed",
            "domain": domain,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to remove {domain} from blacklist: {e}")
        return {
            "status": "error",
            "error": str(e)
        }
