"""
Test Clustering Pipeline - NovaPress AI v2
Runs the pipeline with multiple sources to test HDBSCAN clustering
"""
import asyncio
import sys
import os

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.pipeline import pipeline_engine
from app.ml.embeddings import init_embedding_model
from app.ml.knowledge_graph import init_knowledge_graph
from app.db.qdrant_client import init_qdrant, qdrant_service
from loguru import logger


async def run_clustering_test():
    print("=" * 60)
    print("NOVAPRESS CLUSTERING TEST PIPELINE")
    print("=" * 60)

    # Initialize services
    print("\n[1/5] Initializing services...")
    await init_embedding_model()
    await init_knowledge_graph()
    await init_qdrant()
    await pipeline_engine.initialize()
    print("Services initialized!")

    # Check current count
    print("\n[2/5] Checking current articles in Qdrant...")
    recent = qdrant_service.get_recent_articles(hours=48)
    print(f"Current articles in Qdrant: {len(recent)}")

    # Run Pipeline with diverse sources for better clustering
    sources_to_test = [
        # Tech sources
        "theverge.com",
        "techcrunch.com",
        "wired.com",
        # General news (international)
        "bbc.com",
        "reuters.com",
        "theguardian.com",
        # French sources
        "lemonde.fr",
        "lefigaro.fr",
        # Science
        "sciencedaily.com",
    ]

    print(f"\n[3/5] Scraping from {len(sources_to_test)} sources...")
    print(f"Sources: {', '.join(sources_to_test)}")

    results = await pipeline_engine.run_full_pipeline(
        sources=sources_to_test,
        mode="SCRAPE",
        max_articles_per_source=10  # More articles per source
    )

    # Display results
    print("\n" + "=" * 60)
    print("CLUSTERING TEST RESULTS")
    print("=" * 60)

    stats = results.get("stats", {})
    print(f"\nArticles Scraped:     {stats.get('total_scraped', 0)}")
    print(f"Unique Articles:      {stats.get('unique_articles', 0)}")
    print(f"Duplicates Removed:   {results.get('duplicates_removed', 0)}")
    print(f"Clusters Found:       {stats.get('clusters_found', 0)}")
    print(f"Syntheses Generated:  {stats.get('syntheses_generated', 0)}")
    print(f"Sources Used:         {stats.get('sources_used', 0)}")

    if results.get("cluster_stats"):
        print("\nCluster Statistics:")
        for key, value in results["cluster_stats"].items():
            print(f"  - {key}: {value}")

    # Final Qdrant count
    print("\n[4/5] Final Qdrant check...")
    final_articles = qdrant_service.get_recent_articles(hours=48)
    print(f"Total articles in Qdrant now: {len(final_articles)}")

    print("\n[5/5] Done!")
    print("=" * 60)

    return results


if __name__ == "__main__":
    asyncio.run(run_clustering_test())
