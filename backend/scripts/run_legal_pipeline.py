"""
NovaLex Legal Pipeline CLI
Run: python scripts/run_legal_pipeline.py [--category RGPD]

Scrapes legal sources (CNIL, Legifrance, EUR-Lex, CEPD),
embeds with Gemini Embedding 2, stores in Qdrant, clusters,
generates syntheses, and verifies references.
"""
import asyncio
import sys
import os
import argparse
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Fix Windows console encoding
os.environ['PYTHONIOENCODING'] = 'utf-8'
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


async def main(category: str = "RGPD", sources: list = None):
    from app.services.legal_pipeline import get_legal_pipeline

    print(f"\n{'='*60}")
    print(f"  NOVALEX LEGAL PIPELINE")
    print(f"  Category: {category}")
    print(f"  Sources: {', '.join(sources) if sources else 'ALL'}")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    pipeline = get_legal_pipeline()

    try:
        results = await pipeline.run_full_pipeline(
            sources=sources,
            category=category,
        )

        print(f"\n{'='*60}")
        print(f"  PIPELINE COMPLETE")
        print(f"{'='*60}")
        print(f"  Raw documents scraped:  {results.get('raw_documents', 0)}")
        print(f"  Documents embedded:     {results.get('embedded_documents', 0)}")
        print(f"  Documents stored:       {results.get('stored_documents', 0)}")
        print(f"  Clusters found:         {results.get('clusters', 0)}")
        print(f"  Syntheses generated:    {results.get('syntheses', 0)}")
        if results.get('errors'):
            print(f"  Errors:                 {len(results['errors'])}")
            for err in results['errors']:
                print(f"    - {err}")
        print(f"  Completed:              {results.get('completed_at', 'N/A')}")
        print(f"{'='*60}\n")

        return results

    except Exception as e:
        print(f"\n  PIPELINE FAILED: {e}")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NovaLex Legal Pipeline")
    parser.add_argument("--category", default="RGPD", help="Legal category (RGPD, CYBER, FINANCE)")
    parser.add_argument("--sources", nargs="*", help="Specific sources to scrape (e.g., CNIL Legifrance)")
    args = parser.parse_args()

    asyncio.run(main(category=args.category, sources=args.sources))
