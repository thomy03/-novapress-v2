"""
NovaPress AI v2 - FastAPI Backend
Main application entry point
NO GOOGLE/GEMINI - 100% Open Source Stack
"""
# Suppress SyntaxWarnings from newspaper3k (Python 3.12+ strict regex escapes)
import warnings
warnings.filterwarnings("ignore", category=SyntaxWarning, module="newspaper")

import sys
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from loguru import logger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings

# Configure loguru with settings LOG_LEVEL
logger.remove()  # Remove default handler
logger.add(
    sys.stderr,
    level=settings.LOG_LEVEL.upper(),
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    colorize=True
)
from app.api.routes import articles, trending, auth, search, websocket, syntheses, time_traveler, causal, admin, intelligence, artifacts
from app.core.circuit_breaker import init_circuit_breakers
from app.core.metrics import generate_metrics, get_content_type, set_app_info

# Rate limiter instance
limiter = Limiter(key_func=get_remote_address)
from app.db.qdrant_client import init_qdrant
from app.ml.embeddings import init_embedding_model
from app.ml.knowledge_graph import init_knowledge_graph


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("🚀 Starting NovaPress AI v2 Backend")

    # Validate security configuration FIRST
    from app.core.security_check import validate_secrets
    validate_secrets()

    # Initialize circuit breakers for external APIs
    init_circuit_breakers()

    # Set application info for Prometheus
    set_app_info(version="2.0.0", environment="development" if settings.DEBUG else "production")

    # Initialize Qdrant (optional - auth works without it)
    try:
        logger.info("🗄️ Connecting to Qdrant...")
        await init_qdrant()
    except Exception as e:
        logger.warning(f"⚠️ Qdrant not available: {e}. Continuing without vector DB.")

    # Initialize ML models (optional - auth works without it)
    try:
        logger.info("🤖 Loading BGE-M3 embedding model...")
        await init_embedding_model()
    except Exception as e:
        logger.warning(f"⚠️ Embedding model not available: {e}. Continuing without embeddings.")

    # Initialize spaCy (optional - auth works without it)
    try:
        logger.info("🕸️ Loading spaCy for Knowledge Graph...")
        await init_knowledge_graph()
    except Exception as e:
        logger.warning(f"⚠️ spaCy not available: {e}. Continuing without NLP.")

    # Initialize Topic Detection Service (Phase 10)
    try:
        logger.info("🔍 Initializing Topic Detection Service...")
        from app.ml.topic_detection import init_topic_detection
        await init_topic_detection()
        logger.success("✅ Topic Detection Service ready")
    except Exception as e:
        logger.warning(f"⚠️ Topic Detection Service not available: {e}")

    # Initialize Telegram Bot (Sprint 1 — Le Boss Briefing)
    if settings.TELEGRAM_BOT_TOKEN:
        try:
            logger.info("🤖 Initializing Telegram Bot...")
            from app.services.messaging.telegram_bot import init_telegram_bot
            bot_ok = await init_telegram_bot()
            if bot_ok:
                logger.success("✅ Telegram Bot ready — L'IA qui vous briefe!")
        except Exception as e:
            logger.warning(f"⚠️ Telegram Bot not available: {e}")
    else:
        logger.info("ℹ️ Telegram Bot disabled (no TELEGRAM_BOT_TOKEN)")

    logger.success("✅ Backend ready!")

    yield

    # Shutdown
    logger.info("👋 Shutting down NovaPress AI v2 Backend")
    try:
        from app.services.messaging.telegram_bot import get_telegram_bot
        await get_telegram_bot().shutdown()
    except Exception:
        pass


app = FastAPI(
    title="NovaPress AI v2 API",
    description="Professional News Intelligence Platform - 100% Open Source",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    redirect_slashes=True  # Enable auto-redirect: /api/articles -> /api/articles/
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health Checks - Kubernetes compatible
@app.get("/health")
async def health_check():
    """Basic health check - always returns 200 if app is running"""
    return JSONResponse({
        "status": "healthy",
        "version": "2.0.0",
        "stack": "100% Open Source (NO Gemini)"
    })


@app.get("/health/live")
async def liveness_check():
    """Liveness probe - indicates if application is alive and should not be restarted"""
    return JSONResponse({"status": "alive"})


@app.get("/health/ready")
async def readiness_check():
    """Readiness probe - checks if application is ready to serve traffic"""
    from app.db.qdrant_client import get_qdrant_service
    from app.core.circuit_breaker import get_all_circuit_statuses

    checks = {
        "qdrant": False,
        "embedding_model": False,
    }

    # Check Qdrant
    try:
        qdrant = get_qdrant_service()
        if qdrant and qdrant.client:
            checks["qdrant"] = True
    except Exception:
        pass

    # Check embedding model
    try:
        from app.ml.embeddings import get_embedding_service
        embeddings = get_embedding_service()
        if embeddings and embeddings.model:
            checks["embedding_model"] = True
    except Exception:
        pass

    # Get circuit breaker status
    circuit_status = get_all_circuit_statuses()

    all_ready = checks["qdrant"] and checks["embedding_model"]
    status_code = 200 if all_ready else 503

    return JSONResponse(
        content={
            "status": "ready" if all_ready else "not_ready",
            "checks": checks,
            "circuit_breakers": {
                name: cb.get("state", "unknown")
                for name, cb in circuit_status.items()
            }
        },
        status_code=status_code
    )


# Prometheus Metrics Endpoint
@app.get("/metrics")
async def metrics():
    """
    Prometheus metrics endpoint.

    Returns metrics in Prometheus text format for scraping.
    Includes:
    - Pipeline metrics (runs, duration, articles, syntheses)
    - API metrics (requests, latency, errors)
    - LLM metrics (calls, tokens, latency)
    - Scraping metrics (articles fetched, errors)
    - System gauges (WebSocket connections, circuit breakers)
    """
    from fastapi.responses import Response
    return Response(
        content=generate_metrics(),
        media_type=get_content_type()
    )


# API Routes
app.include_router(articles.router, prefix=f"{settings.API_V1_PREFIX}/articles", tags=["Articles"])
app.include_router(syntheses.router, prefix=f"{settings.API_V1_PREFIX}/syntheses", tags=["Syntheses"])
app.include_router(trending.router, prefix=f"{settings.API_V1_PREFIX}/trending", tags=["Trending"])
app.include_router(search.router, prefix=f"{settings.API_V1_PREFIX}/search", tags=["Search"])
app.include_router(auth.router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["Authentication"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])
app.include_router(time_traveler.router, prefix=f"{settings.API_V1_PREFIX}/time-traveler", tags=["Time-Traveler"])
app.include_router(causal.router, prefix=f"{settings.API_V1_PREFIX}/causal", tags=["Nexus-Causal"])
app.include_router(admin.router, prefix=f"{settings.API_V1_PREFIX}/admin", tags=["Admin"])
app.include_router(intelligence.router, prefix=f"{settings.API_V1_PREFIX}/intelligence", tags=["Intelligence-Hub"])
app.include_router(artifacts.router, prefix=f"{settings.API_V1_PREFIX}/artifacts", tags=["Artifacts"])


# ─── Telegram Webhook ───

@app.post("/webhook/telegram")
async def telegram_webhook(request: Request):
    """
    Receive Telegram bot updates via webhook.
    Configure with: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/webhook/telegram
    """
    try:
        from app.services.messaging.telegram_bot import get_telegram_bot
        bot = get_telegram_bot()
        update = await request.json()
        await bot.handle_update(update)
        return JSONResponse({"ok": True})
    except Exception as e:
        logger.error(f"Telegram webhook error: {e}")
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


# ─── Briefing API ───

@app.get(f"{settings.API_V1_PREFIX}/briefing")
async def get_briefing():
    """
    Get the latest AI briefing — "L'IA qui vous briefe."
    Returns the top syntheses of the day, ranked by relevance.
    """
    from app.services.briefing_service import get_briefing_service
    service = get_briefing_service()
    briefing = await service.get_latest_briefing()
    return briefing


# ─── Telegram Broadcast Endpoint ───

@app.post(f"{settings.API_V1_PREFIX}/telegram/send-briefing")
async def telegram_send_briefing(request: Request):
    """
    Send the daily briefing to configured Telegram chat IDs.
    Protected by x-admin-key header.
    Usage: POST /api/telegram/send-briefing
    """
    admin_key = request.headers.get("x-admin-key", "")
    if admin_key != settings.ADMIN_API_KEY:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    try:
        from app.services.messaging.telegram_bot import get_telegram_bot
        from app.services.briefing_service import get_briefing_service

        bot = get_telegram_bot()
        if not bot._initialized:
            return JSONResponse({"error": "Telegram bot not initialized"}, status_code=503)

        service = get_briefing_service()
        briefing = await service.get_latest_briefing()
        formatted = service.format_telegram_briefing(briefing)

        chat_ids_str = settings.TELEGRAM_OWNER_CHAT_ID
        if not chat_ids_str:
            return JSONResponse({"error": "TELEGRAM_OWNER_CHAT_ID not configured"}, status_code=400)

        # Support comma-separated list of chat IDs
        chat_ids = [cid.strip() for cid in chat_ids_str.split(",") if cid.strip()]
        sent = 0
        for chat_id in chat_ids:
            ok = await bot.send_message(int(chat_id), formatted)
            if ok:
                sent += 1

        logger.info(f"Daily briefing sent to {sent}/{len(chat_ids)} Telegram chats")
        return JSONResponse({"ok": True, "sent": sent, "total": len(chat_ids)})

    except Exception as e:
        logger.error(f"Telegram broadcast error: {e}")
        return JSONResponse({"error": "Broadcast failed"}, status_code=500)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=5000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
