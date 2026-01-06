import sys
import os
import asyncio
from unittest.mock import MagicMock

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock dependencies to avoid ImportErrors
sys.modules['newspaper'] = MagicMock()
sys.modules['httpx'] = MagicMock()
sys.modules['bs4'] = MagicMock()
sys.modules['loguru'] = MagicMock()
sys.modules['app.core.config'] = MagicMock()
sys.modules['app.ml.embeddings'] = MagicMock()

# Now import the class (it will use mocks)
from app.services.advanced_scraper import AdvancedNewsScraper

async def verify_config():
    print("🔍 Verifying Scraper Configuration...")
    
    scraper = AdvancedNewsScraper()
    sources = scraper.WORLD_NEWS_SOURCES
    
    print(f"✅ Loaded {len(sources)} sources")
    
    categories = {
        "US/UK": ["nytimes.com", "cnn.com", "bbc.com"],
        "France": ["lemonde.fr", "lesechos.fr", "frandroid.com"],
        "Europe": ["bild.de", "elpais.com"],
        "Tech": ["techcrunch.com", "wired.com"],
        "Finance": ["ft.com", "bloomberg.com"]
    }
    
    for category, domains in categories.items():
        print(f"\nChecking {category} sources:")
        for domain in domains:
            if domain in sources:
                print(f"  ✅ {domain} configured")
            else:
                print(f"  ❌ {domain} MISSING")

    print("\n✅ Configuration check complete.")

if __name__ == "__main__":
    asyncio.run(verify_config())
