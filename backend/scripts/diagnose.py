import asyncio
import sys
import os

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.advanced_scraper import advanced_scraper
from app.db.qdrant_client import init_qdrant, qdrant_service
from loguru import logger

async def diagnose():
    print("Diagnostic du systeme NovaPress\n")
    
    # 1. Verifier les sources configurees
    print("=" * 60)
    print("SOURCES CONFIGUREES")
    print("=" * 60)
    sources = advanced_scraper.WORLD_NEWS_SOURCES
    print(f"Nombre total de sources: {len(sources)}\n")
    
    for domain, config in sources.items():
        print(f"  - {config['name']} ({domain})")
    
    # 2. Verifier Qdrant
    print("\n" + "=" * 60)
    print("QDRANT DATABASE")
    print("=" * 60)
    
    try:
        await init_qdrant()
        stats = qdrant_service.get_collection_stats()
        print(f"OK Connecte a Qdrant")
        print(f"  - Articles stockes: {stats.get('points_count', 0)}")
        print(f"  - Vecteurs: {stats.get('vectors_count', 0)}")
        
        # Recuperer quelques articles
        result = qdrant_service.get_latest_articles(limit=50)
        articles = result['articles']
        print(f"\nDerniers articles dans la DB: {len(articles)}")
        
        if articles:
            print("\nExemples d'articles:")
            for i, article in enumerate(articles[:5], 1):
                print(f"  {i}. {article.get('title', 'N/A')[:60]}...")
                print(f"     Source: {article.get('source', 'N/A')}")
                print(f"     Date: {article.get('published_at', 'N/A')[:10]}")
        
    except Exception as e:
        print(f"ERREUR Qdrant: {e}")
    
    # 3. Test de scraping sur une source
    print("\n" + "=" * 60)
    print("TEST DE SCRAPING (CNN)")
    print("=" * 60)
    
    try:
        urls = await advanced_scraper.discover_article_urls("cnn.com", max_articles=5)
        print(f"URLs decouvertes: {len(urls)}")
        for url in urls[:3]:
            print(f"  - {url}")
    except Exception as e:
        print(f"ERREUR: {e}")

if __name__ == "__main__":
    asyncio.run(diagnose())
