"""
Syntheses API Routes
AI-generated synthesis from clustered news articles

IMPORTANT: Route order matters in FastAPI!
Static routes (/breaking, /live) MUST be defined BEFORE dynamic routes (/{synthesis_id})
"""
from fastapi import APIRouter, HTTPException, Query, Path, Request
from typing import List, Optional, Dict, Any
from loguru import logger
from datetime import datetime
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.qdrant_client import get_qdrant_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def format_synthesis_for_frontend(synthesis: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform synthesis from Qdrant format to Frontend expected format
    """
    # Convert timestamp to ISO string
    created_at = synthesis.get("created_at", 0)
    if isinstance(created_at, (int, float)) and created_at > 0:
        try:
            created_at_iso = datetime.fromtimestamp(created_at).isoformat()
        except:
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
    if not source_articles and sources_list:
        # Fallback: create from sources list without URLs
        source_articles = [{"name": s, "url": "", "title": ""} for s in sources_list]

    # Get introduction, body, analysis fields
    introduction = synthesis.get("introduction", "")
    body = synthesis.get("body", "")
    analysis = synthesis.get("analysis", "")

    return {
        "id": str(synthesis.get("id", "")),
        "title": synthesis.get("title", ""),
        "summary": synthesis.get("summary", ""),
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
        "type": "synthesis"
    }


@router.get("/")
@limiter.limit("100/minute")
async def get_syntheses(
    request: Request,
    limit: int = Query(10, ge=1, le=50)
):
    """Get latest AI-generated syntheses"""
    try:
        qdrant = get_qdrant_service()
        raw_syntheses = qdrant.get_latest_syntheses(limit=limit)

        # Transform for frontend
        syntheses = [format_synthesis_for_frontend(s) for s in raw_syntheses]

        return {
            "data": syntheses,
            "total": len(syntheses),
            "type": "syntheses"
        }
    except Exception as e:
        logger.error(f"Failed to fetch syntheses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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

        return {
            "data": syntheses,
            "total": len(syntheses),
            "type": "breaking"
        }
    except Exception as e:
        logger.error(f"Failed to fetch breaking syntheses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/live")
@limiter.limit("60/minute")
async def get_live_syntheses(
    request: Request,
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get syntheses from the last X hours (for EN DIRECT page).

    Args:
        hours: Number of hours to look back (default 24, max 168 = 1 week)
        limit: Maximum number of syntheses to return (default 50)
    """
    try:
        qdrant = get_qdrant_service()
        raw_syntheses = qdrant.get_live_syntheses(hours=hours, limit=limit)
        syntheses = [format_synthesis_for_frontend(s) for s in raw_syntheses]

        return {
            "data": syntheses,
            "total": len(syntheses),
            "hours": hours,
            "type": "live"
        }
    except Exception as e:
        logger.error(f"Failed to fetch live syntheses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        logger.error(f"Failed to fetch syntheses by category {category}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/by-id/{synthesis_id}/persona/{persona_id}")
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
        raise HTTPException(status_code=500, detail=str(e))
