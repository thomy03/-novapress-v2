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

async def run_fast_pipeline():
    print("🚀 Starting FAST Pipeline Test...")
    
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

        # Run Pipeline on ALL available sources for maximum coverage
        # Sources organisées par région/thème pour meilleur clustering
        sources_to_test = [
            # === FRANCE (Généraliste) ===
            "lemonde.fr",
            "lefigaro.fr",
            "liberation.fr",
            "leparisien.fr",
            "francetvinfo.fr",

            # === FRANCE (Économie) ===
            "lesechos.fr",
            "latribune.fr",

            # === FRANCE (Science/Tech) ===
            "futura-sciences.com",
            "frandroid.com",

            # === EUROPE ===
            "lesoir.be",           # Belgique
            "spiegel.de",          # Allemagne
            "bild.de",             # Allemagne
            "elpais.com",          # Espagne
            "elmundo.es",          # Espagne
            "corriere.it",         # Italie
            "repubblica.it",       # Italie

            # === UK ===
            "bbc.com",
            "theguardian.com",
            "ft.com",              # Finance

            # === USA ===
            "edition.cnn.com",
            "nytimes.com",
            "washingtonpost.com",
            "reuters.com",

            # === USA (Tech) ===
            "techcrunch.com",
            "theverge.com",
            "wired.com",

            # === USA (Finance) ===
            "bloomberg.com",

            # === MOYEN-ORIENT ===
            "aljazeera.com",

            # === ASIE ===
            "asahi.com",                      # Japon
            "timesofindia.indiatimes.com",    # Inde

            # === AMÉRIQUE DU SUD ===
            "oglobo.globo.com",    # Brésil

            # === OCÉANIE ===
            "smh.com.au",          # Australie

            # === SCIENCE ===
            "sciencedaily.com",

            # === SPORT ===
            "lequipe.fr",
            "espn.com",
            "marca.com",

            # === CULTURE & SOCIÉTÉ ===
            "slate.fr",
            "theconversation.com",
            "huffingtonpost.fr",

            # === ENVIRONNEMENT ===
            "reporterre.net",

            # === INTERNATIONAL (Asie) ===
            "scmp.com",              # Hong Kong / Chine
            "japantimes.co.jp",      # Japon
            "koreaherald.com",       # Corée du Sud

            # === INTERNATIONAL (Autres) ===
            "rt.com",                # Russie
            "dw.com",                # Allemagne (anglais)
            "rfi.fr",                # France International
            "france24.com",          # France International
            "abc.net.au",            # Australie
            "cbc.ca",                # Canada

            # === AFRIQUE ===
            "jeuneafrique.com",
            "lematin.ma",            # Maroc

            # === AMÉRIQUE LATINE ===
            "clarin.com",            # Argentine
            "eluniversal.com.mx",    # Mexique
        ]

        results = await pipeline_engine.run_full_pipeline(
            sources=sources_to_test,
            mode="SCRAPE",
            max_articles_per_source=5  # 5 articles par source
        )
        
        print("\n✅ FAST Pipeline Complete!")
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
    asyncio.run(run_fast_pipeline())
