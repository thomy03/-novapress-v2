"""
Talkshow API Routes
Generates multi-panelist talkshow/interview episodes.
Includes podcast RSS feed for Spotify, Apple Podcasts, etc.
"""
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse, Response
from loguru import logger
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import List, Optional
import io

from app.services.talkshow_generator import get_talkshow_generator

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class GenerateRequest(BaseModel):
    """Request body for talkshow generation."""
    mode: str = "talkshow"  # "talkshow" | "interview"
    panelists: Optional[List[str]] = None  # Force persona IDs (legacy path)
    dynamic_experts: bool = True  # LLM invents contextual experts
    duration: int = 780
    category: str = ""


async def _get_topic_data(topic_name: str):
    """Fetch topic dashboard data via topic_tracker."""
    from app.ml.topic_tracker import get_topic_tracker

    tracker = get_topic_tracker()
    dashboard = await tracker.get_topic_dashboard(topic_name)

    if not dashboard or dashboard.get("synthesis_count", 0) < 1:
        raise HTTPException(
            status_code=404,
            detail="Pas assez de syntheses pour generer un talkshow",
        )

    return dashboard


@router.get("/topics/{topic_name}/script")
@limiter.limit("10/minute")
async def get_talkshow_script(
    request: Request,
    topic_name: str,
    duration: int = Query(780, ge=120, le=1200),
    mode: str = Query("talkshow", regex="^(talkshow|interview|debate)$"),
    dynamic_experts: bool = Query(True),
):
    """Generate a script for a topic (text only, fast)."""
    try:
        dashboard = await _get_topic_data(topic_name)

        generator = get_talkshow_generator()
        result = await generator.generate_script_only(
            topic=dashboard["topic"],
            syntheses=dashboard.get("syntheses", []),
            causal_graph=dashboard.get("aggregated_causal_graph"),
            predictions=dashboard.get("predictions_summary", []),
            duration_target=duration,
            mode=mode,
            dynamic_experts=dynamic_experts,
        )

        if not result:
            raise HTTPException(
                status_code=500,
                detail="Echec de la generation du script",
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Talkshow script error for {topic_name}: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne")


@router.get("/topics/{topic_name}/full")
@limiter.limit("5/minute")
async def get_talkshow_full(
    request: Request,
    topic_name: str,
    duration: int = Query(780, ge=120, le=1200),
    mode: str = Query("talkshow", regex="^(talkshow|interview|debate)$"),
    dynamic_experts: bool = Query(True),
):
    """Generate a full talkshow with script + audio."""
    try:
        dashboard = await _get_topic_data(topic_name)

        generator = get_talkshow_generator()
        result = await generator.generate_talkshow(
            topic=dashboard["topic"],
            syntheses=dashboard.get("syntheses", []),
            causal_graph=dashboard.get("aggregated_causal_graph"),
            predictions=dashboard.get("predictions_summary", []),
            duration_target=duration,
            mode=mode,
            dynamic_experts=dynamic_experts,
        )

        if not result:
            raise HTTPException(
                status_code=500,
                detail="Echec de la generation du talkshow",
            )

        # Auto-publish to podcast feed
        if result.get("has_audio") and result.get("audio_cache_key"):
            try:
                from app.services.podcast_feed import get_podcast_feed
                feed = get_podcast_feed()
                feed.publish_episode(
                    topic=result["topic"],
                    cache_key=result["audio_cache_key"],
                    script=result.get("script", []),
                    duration_seconds=result.get("duration_target", 300),
                    panelists=result.get("panelists", []),
                )
            except Exception as e:
                logger.warning(f"Failed to publish episode to feed: {e}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Talkshow full error for {topic_name}: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne")


@router.get("/audio/{cache_key}")
async def get_talkshow_audio(cache_key: str):
    """Stream cached talkshow audio."""
    generator = get_talkshow_generator()
    audio = await generator.get_cached_audio(cache_key)

    if not audio:
        raise HTTPException(status_code=404, detail="Audio non disponible")

    content_type = generator.get_audio_format(cache_key)
    ext = "mp3" if "mpeg" in content_type else "ogg"

    return StreamingResponse(
        io.BytesIO(audio),
        media_type=content_type,
        headers={
            "Content-Disposition": f'inline; filename="novapress-talkshow-{cache_key[:8]}.{ext}"',
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.get("/feed.xml")
async def get_podcast_rss(request: Request):
    """Podcast RSS feed."""
    from app.services.podcast_feed import get_podcast_feed
    from app.core.config import settings

    feed = get_podcast_feed()
    base_url = settings.SITE_URL.rstrip("/")
    xml = feed.generate_rss(base_url)

    return Response(
        content=xml,
        media_type="application/rss+xml; charset=utf-8",
        headers={
            "Cache-Control": "public, max-age=900",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/feed/episodes")
async def get_feed_episodes(limit: int = Query(20, ge=1, le=100)):
    """Get published podcast episodes as JSON."""
    from app.services.podcast_feed import get_podcast_feed

    feed = get_podcast_feed()
    episodes = feed.get_episodes(limit=limit)

    return {
        "total": feed.get_episode_count(),
        "episodes": episodes,
    }


@router.get("/panelists")
async def get_panelists():
    """Get all available talkshow panelists with their talkshow attributes."""
    from app.ml.persona import PERSONAS

    return {
        "panelists": [
            {
                "id": p.id,
                "name": p.name,
                "display_name": p.display_name,
                "voice_gender": p.voice_gender,
                "debate_style": p.debate_style,
                "catchphrase": p.talkshow_catchphrase,
                "tone": p.tone,
                "focus_categories": p.focus_categories,
            }
            for p in PERSONAS.values()
        ]
    }


@router.get("/panel-preview/{topic_name}")
async def get_panel_preview(topic_name: str, category: str = Query("")):
    """Preview the auto-selected panel for a topic (no generation)."""
    from app.services.panel_selector import get_panel_preview

    panel = get_panel_preview(topic_name, category)
    return {"topic": topic_name, "panel": panel}


@router.post("/generate/{topic_name}")
@limiter.limit("3/minute")
async def generate_episode_now(
    request: Request,
    topic_name: str,
    body: Optional[GenerateRequest] = None,
):
    """Generate a talkshow episode on demand with mode and panelist selection."""
    mode = "talkshow"
    panelists = None
    category = ""

    dynamic_experts = True

    if body:
        mode = body.mode
        panelists = body.panelists
        dynamic_experts = body.dynamic_experts
        category = body.category

    try:
        dashboard = await _get_topic_data(topic_name)

        generator = get_talkshow_generator()
        result = await generator.generate_talkshow(
            topic=dashboard["topic"],
            syntheses=dashboard.get("syntheses", []),
            causal_graph=dashboard.get("aggregated_causal_graph"),
            predictions=dashboard.get("predictions_summary", []),
            duration_target=body.duration if body else 780,
            mode=mode,
            panelists=panelists,
            category=category,
            dynamic_experts=dynamic_experts,
        )

        if not result:
            raise HTTPException(
                status_code=500,
                detail="Echec de la generation de l'episode",
            )

        # Auto-publish
        if result.get("has_audio") and result.get("audio_cache_key"):
            try:
                from app.services.podcast_feed import get_podcast_feed
                feed = get_podcast_feed()
                feed.publish_episode(
                    topic=result["topic"],
                    cache_key=result["audio_cache_key"],
                    script=result.get("script", []),
                    duration_seconds=result.get("duration_target", 300),
                    panelists=result.get("panelists", []),
                )
            except Exception as e:
                logger.warning(f"Failed to publish episode to feed: {e}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Talkshow generation error for {topic_name}: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne")


@router.post("/scheduler/run")
@limiter.limit("1/minute")
async def run_scheduler(request: Request):
    """Run the talkshow scheduler."""
    from app.services.talkshow_scheduler import run_talkshow_scheduler

    result = await run_talkshow_scheduler()
    return result
