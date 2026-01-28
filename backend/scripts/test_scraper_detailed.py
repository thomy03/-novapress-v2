import asyncio
import sys
import os

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.advanced_scraper import advanced_scraper
from loguru import logger

async def test_detailed():
    url = "https://edition.cnn.com/2025/11/21/americas/faa-warning-venezuela-flights-intl-hnk/index.html"
    print(f"🧪 Testing scrape on: {url}")
    
    # 1. Check Robots
    domain = advanced_scraper._get_domain(url)
    allowed = advanced_scraper._check_robots_txt(domain, url)
    print(f"🤖 Robots.txt allowed: {allowed}")
    
    if not allowed:
        print("❌ Blocked by robots.txt")
        return

    # 2. Extract
    print("📥 Downloading...")
    try:
        article = await asyncio.to_thread(advanced_scraper._extract_with_newspaper, url)
        print(f"📄 Title: {article.title}")
        print(f"📝 Text length: {len(article.text)}")
        
        if len(article.text) < 200:
            print("⚠️ Text too short")
            
        # 3. Paywall
        if article.html and advanced_scraper._detect_paywall(article.html, url):
            print("💰 Paywall detected")
        else:
            print("✅ No paywall detected")
            
        # 4. Full scrape
        print("\n🔄 Running full scrape_article...")
        result = await advanced_scraper.scrape_article(url)
        if result:
            print("✅ Scrape SUCCESS!")
            print(result.keys())
        else:
            print("❌ Scrape FAILED (returned None)")
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_detailed())
