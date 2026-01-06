import asyncio
import sys
import os

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.advanced_scraper import advanced_scraper
from loguru import logger

async def test_discovery():
    source = "edition.cnn.com"
    print(f"🔍 Testing discovery for: {source}")
    
    try:
        urls = await advanced_scraper.discover_article_urls(source, max_articles=5)
        print(f"✅ Found {len(urls)} URLs")
        for url in urls:
            print(f"  - {url}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_discovery())
