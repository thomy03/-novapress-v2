"""
Test script to verify pipeline fixes
"""
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

def test_qdrant_import():
    """Test Qdrant Range import"""
    try:
        from qdrant_client.models import Range, Filter, FieldCondition
        print("✅ Qdrant imports OK (Range, Filter, FieldCondition)")
        return True
    except ImportError as e:
        print(f"❌ Qdrant import failed: {e}")
        return False

def test_advanced_scraper_sources():
    """Test if CNN source uses correct domain"""
    try:
        from app.services.advanced_scraper import AdvancedNewsScraper
        scraper = AdvancedNewsScraper()

        # Check if 'edition.cnn.com' is a key
        if 'edition.cnn.com' in scraper.WORLD_NEWS_SOURCES:
            print("✅ CNN source uses correct domain 'edition.cnn.com'")
            cnn_config = scraper.WORLD_NEWS_SOURCES['edition.cnn.com']
            print(f"   Name: {cnn_config['name']}")
            print(f"   URL: {cnn_config['url']}")
            return True
        else:
            print("❌ 'edition.cnn.com' not found in sources")
            print(f"   Available sources: {list(scraper.WORLD_NEWS_SOURCES.keys())[:5]}...")
            return False
    except Exception as e:
        print(f"❌ Advanced scraper test failed: {e}")
        return False

def test_newspaper_config():
    """Test Newspaper3k configuration"""
    try:
        from newspaper import Article
        test_url = "https://www.example.com/article"

        config = {
            'browser_user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'request_timeout': 30
        }

        article = Article(test_url, config=config)
        print("✅ Newspaper3k config works (User-Agent set)")
        return True
    except Exception as e:
        print(f"❌ Newspaper3k config failed: {e}")
        return False

def main():
    print("🔍 Testing NovaPress Pipeline Fixes\n")

    tests = [
        ("Qdrant Range Import", test_qdrant_import),
        ("Advanced Scraper Sources", test_advanced_scraper_sources),
        ("Newspaper3k Config", test_newspaper_config),
    ]

    results = []
    for name, test_func in tests:
        print(f"\n--- Test: {name} ---")
        result = test_func()
        results.append(result)

    print("\n" + "="*50)
    passed = sum(results)
    total = len(results)
    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print("✅ All fixes verified!")
    else:
        print(f"⚠️ {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
