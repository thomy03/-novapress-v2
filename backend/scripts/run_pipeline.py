import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.pipeline import pipeline_engine
from app.ml.embeddings import init_embedding_model
from app.ml.knowledge_graph import init_knowledge_graph
from app.db.qdrant_client import init_qdrant
from loguru import logger

async def run_pipeline():
    print("🚀 Starting Manual Pipeline Execution...")
    
    try:
        # Initialize Embeddings first
        print("🧠 Initializing Embeddings...")
        await init_embedding_model()
        
        # Initialize Knowledge Graph
        print("🕸️ Initializing Knowledge Graph...")
        await init_knowledge_graph()
        
        # Initialize Qdrant
        print("💾 Initializing Qdrant...")
        await init_qdrant()
        
        # Initialize Pipeline
        await pipeline_engine.initialize()
        
        # Run Pipeline
        # We collect 10 articles per source for better clustering and synthesis
        results = await pipeline_engine.run_full_pipeline(
            mode="SCRAPE",
            max_articles_per_source=10 
        )
        
        print("\n✅ Pipeline Execution Complete!")
        print(f"📊 Articles Scraped: {results['stats']['total_scraped']}")
        print(f"📊 Unique Articles: {results['stats']['unique_articles']}")
        print(f"📊 Clusters Found: {results['stats']['clusters_found']}")
        print(f"📊 Syntheses Generated: {results['stats']['syntheses_generated']}")
        
        if results['syntheses']:
            print("\n📝 Sample Synthesis:")
            synth = results['syntheses'][0]
            print(f"Title: {synth.get('title')}")
            print(f"Summary: {synth.get('summary')[:200]}...")

    except Exception as e:
        logger.error(f"❌ Pipeline failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(run_pipeline())
