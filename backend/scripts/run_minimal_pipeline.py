import asyncio
import sys
import os

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Add backend folder to path (works from any directory)
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.pipeline import pipeline_engine
from app.ml.embeddings import init_embedding_model
from app.ml.knowledge_graph import init_knowledge_graph
from app.db.qdrant_client import init_qdrant
from loguru import logger

async def run_minimal_pipeline():
    print("🚀 Starting MINIMAL Pipeline Test (5 sources only)...")

    try:
        # Initialize services
        await init_embedding_model()
        await init_knowledge_graph()
        await init_qdrant()
        await pipeline_engine.initialize()

        # Test Qdrant RAG directly first
        print("🔍 Testing Qdrant RAG fetch...")
        from app.db.qdrant_client import qdrant_service
        recent = qdrant_service.get_recent_articles(hours=48)
        print(f"✅ Qdrant returned {len(recent)} recent articles")

        # ONLY 5 reliable sources for fast testing
        sources_to_test = [
            "bbc.com",
            "theguardian.com",
            "techcrunch.com",
            "sciencedaily.com",
            "espn.com",
        ]

        print(f"📰 Testing with {len(sources_to_test)} sources only")

        results = await pipeline_engine.run_full_pipeline(
            sources=sources_to_test,
            mode="SCRAPE",
            max_articles_per_source=3  # Only 3 articles per source
        )

        print("\n✅ MINIMAL Pipeline Complete!")
        stats = results.get('stats', {})
        print(f"📊 Articles Scraped: {stats.get('total_scraped', 0)}")
        print(f"📊 Unique Articles (with RAG): {stats.get('unique_articles', 0)}")
        print(f"📊 Clusters Found: {stats.get('clusters_found', 0)}")
        print(f"📊 Syntheses Generated: {stats.get('syntheses_generated', 0)}")

        if not stats:
            print("⚠️ Warning: Stats are empty. Pipeline might have aborted early.")
            print(f"Results keys: {results.keys()}")
            print(f"Raw articles count: {results.get('raw_articles')}")

    except Exception as e:
        logger.error(f"❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(run_minimal_pipeline())
