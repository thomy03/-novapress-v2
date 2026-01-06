"""
NovaPress AI v2 - FastAPI Backend
Main application entry point
NO GOOGLE/GEMINI - 100% Open Source Stack
"""
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
from app.api.routes import articles, trending, auth, search, websocket, syntheses, time_traveler, causal, admin
from app.core.circuit_breaker import init_circuit_breakers
from app.core.metrics import generate_metrics, get_content_type, set_app_info

# Rate limiter instance
limiter = Limiter(key_func=get_remote_address)
# from app.db.session import init_db  # TEMP DISABLED
from app.db.qdrant_client import init_qdrant
from app.ml.embeddings import init_embedding_model
# from app.ml.llm import init_llm  # TEMP DISABLED
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

    # Initialize database (TEMPORARILY DISABLED - using Qdrant only)
    # logger.info("📦 Initializing database...")
    # await init_db()

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

    # Ollama LLM (TEMPORARILY DISABLED - not needed for testing)
    # logger.info("🧠 Connecting to Ollama LLM...")
    # await init_llm()

    # Initialize spaCy (optional - auth works without it)
    try:
        logger.info("🕸️ Loading spaCy for Knowledge Graph...")
        await init_knowledge_graph()
    except Exception as e:
        logger.warning(f"⚠️ spaCy not available: {e}. Continuing without NLP.")

    logger.success("✅ Backend ready!")

    yield

    logger.info("👋 Shutting down NovaPress AI v2 Backend")


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=5000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
