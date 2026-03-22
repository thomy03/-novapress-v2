"""
NovaLex API Routes
Legal intelligence endpoints: search, documents, pipeline, verification.
"""
from fastapi import APIRouter, HTTPException, Query, Header, BackgroundTasks
from loguru import logger
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import asyncio

router = APIRouter()

# Pipeline state tracking
_pipeline_running = False
_pipeline_last_run: Optional[str] = None
_pipeline_last_results: Optional[dict] = None


# ============================================================================
# SEARCH
# ============================================================================

@router.get("/search")
async def search_legal_documents(
    q: str = Query(..., min_length=2, description="Search query"),
    doc_type: Optional[str] = Query(None, description="Filter: loi, decision, regulation, directive, guideline"),
    jurisdiction: Optional[str] = Query(None, description="Filter: FR, EU"),
    category: Optional[str] = Query(None, description="Filter: RGPD, CYBER, FINANCE"),
    limit: int = Query(10, ge=1, le=50),
):
    """Semantic search across legal documents using Gemini Embedding 2."""
    try:
        from app.services.legal_pipeline import get_legal_pipeline
        pipeline = get_legal_pipeline()
        await pipeline.initialize()

        results = await pipeline.search(
            query=q,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
            category=category,
            limit=limit,
        )

        return {
            "query": q,
            "count": len(results),
            "filters": {
                "doc_type": doc_type,
                "jurisdiction": jurisdiction,
                "category": category,
            },
            "results": results,
        }
    except Exception as e:
        logger.error(f"NovaLex search failed: {e}")
        raise HTTPException(status_code=500, detail="Search service unavailable")


# ============================================================================
# DOCUMENTS
# ============================================================================

@router.get("/documents")
async def list_documents(
    doc_type: Optional[str] = Query(None),
    jurisdiction: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List legal documents with filters."""
    try:
        from app.db.qdrant_client import get_qdrant_service
        qdrant = get_qdrant_service()

        # Use a generic query to list documents (empty vector = list all)
        # For listing, we use scroll instead of search
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        filters = []
        if doc_type:
            filters.append(FieldCondition(key="doc_type", match=MatchValue(value=doc_type)))
        if jurisdiction:
            filters.append(FieldCondition(key="jurisdiction", match=MatchValue(value=jurisdiction)))
        if category:
            filters.append(FieldCondition(key="category", match=MatchValue(value=category)))

        scroll_filter = Filter(must=filters) if filters else None

        results, next_offset = qdrant.client.scroll(
            collection_name=qdrant.novalex_collection,
            scroll_filter=scroll_filter,
            limit=limit,
            offset=offset if offset else None,
            with_payload=True,
            with_vectors=False,
        )

        documents = [
            {"id": str(point.id), **point.payload}
            for point in results
        ]

        return {
            "count": len(documents),
            "offset": offset,
            "limit": limit,
            "documents": documents,
        }
    except Exception as e:
        logger.error(f"NovaLex list documents failed: {e}")
        raise HTTPException(status_code=500, detail="Document listing unavailable")


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """Get a single legal document by ID."""
    try:
        from app.db.qdrant_client import get_qdrant_service
        qdrant = get_qdrant_service()

        points = qdrant.client.retrieve(
            collection_name=qdrant.novalex_collection,
            ids=[doc_id],
            with_payload=True,
            with_vectors=False,
        )

        if not points:
            raise HTTPException(status_code=404, detail="Document not found")

        point = points[0]
        return {"id": str(point.id), **point.payload}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"NovaLex get document failed: {e}")
        raise HTTPException(status_code=500, detail="Document retrieval failed")


# ============================================================================
# STATS
# ============================================================================

@router.get("/stats")
async def get_stats():
    """Get NovaLex collection statistics."""
    try:
        from app.db.qdrant_client import get_qdrant_service
        qdrant = get_qdrant_service()

        doc_count = qdrant.get_legal_document_count()

        return {
            "total_documents": doc_count,
            "collection": "novalex_documents",
            "embedding_model": "gemini-embedding-exp-03-07",
            "embedding_dimensions": 3072,
            "sources": ["CNIL", "Legifrance", "EUR-Lex", "CEPD/EDPB"],
            "pipeline_last_run": _pipeline_last_run,
            "pipeline_running": _pipeline_running,
        }
    except Exception as e:
        logger.error(f"NovaLex stats failed: {e}")
        return {
            "total_documents": 0,
            "error": "Stats unavailable",
            "pipeline_last_run": _pipeline_last_run,
            "pipeline_running": _pipeline_running,
        }


# ============================================================================
# PIPELINE CONTROL
# ============================================================================

class PipelineStartRequest(BaseModel):
    category: str = "RGPD"
    sources: Optional[List[str]] = None


@router.post("/pipeline/start")
async def start_pipeline(
    request: PipelineStartRequest,
    background_tasks: BackgroundTasks,
    x_admin_key: str = Header(None),
):
    """Start the legal pipeline (requires admin API key)."""
    global _pipeline_running

    from app.core.config import settings
    if not x_admin_key or x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")

    if _pipeline_running:
        raise HTTPException(status_code=409, detail="Pipeline already running")

    async def run_pipeline():
        global _pipeline_running, _pipeline_last_run, _pipeline_last_results
        _pipeline_running = True
        try:
            from app.services.legal_pipeline import get_legal_pipeline
            pipeline = get_legal_pipeline()
            results = await pipeline.run_full_pipeline(
                sources=request.sources,
                category=request.category,
            )
            _pipeline_last_results = results
            _pipeline_last_run = datetime.now().isoformat()
            logger.info(f"NovaLex pipeline completed: {results}")
        except Exception as e:
            logger.error(f"NovaLex pipeline failed: {e}")
            _pipeline_last_results = {"error": str(e)}
        finally:
            _pipeline_running = False

    background_tasks.add_task(lambda: asyncio.get_event_loop().create_task(run_pipeline()))

    return {
        "status": "started",
        "category": request.category,
        "sources": request.sources or "all",
    }


@router.get("/pipeline/status")
async def pipeline_status():
    """Get current pipeline status."""
    return {
        "running": _pipeline_running,
        "last_run": _pipeline_last_run,
        "last_results": _pipeline_last_results,
    }


# ============================================================================
# SYNTHESES
# ============================================================================

@router.get("/syntheses")
async def list_syntheses(
    category: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """List legal syntheses (stored as documents with doc_type='synthesis')."""
    try:
        from app.db.qdrant_client import get_qdrant_service
        qdrant = get_qdrant_service()

        from qdrant_client.models import Filter, FieldCondition, MatchValue

        filters = [FieldCondition(key="doc_type", match=MatchValue(value="synthesis"))]
        if category:
            filters.append(FieldCondition(key="category", match=MatchValue(value=category)))

        results, _ = qdrant.client.scroll(
            collection_name=qdrant.novalex_collection,
            scroll_filter=Filter(must=filters),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )

        syntheses = [
            {"id": str(point.id), **point.payload}
            for point in results
        ]

        return {"count": len(syntheses), "syntheses": syntheses}
    except Exception as e:
        logger.error(f"NovaLex syntheses listing failed: {e}")
        return {"count": 0, "syntheses": []}


# ============================================================================
# VERIFICATION
# ============================================================================

class VerifyRequest(BaseModel):
    text: str


@router.post("/verify")
async def verify_text(request: VerifyRequest):
    """Verify legal references in a text (anti-hallucination)."""
    try:
        from app.ml.legal_verifier import verify_synthesis
        result = await verify_synthesis(request.text)
        return result
    except Exception as e:
        logger.error(f"NovaLex verification failed: {e}")
        raise HTTPException(status_code=500, detail="Verification service unavailable")
