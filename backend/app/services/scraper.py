"""
News Scraper Service
Open Source Web Scraping - NO GEMINI
Using: BeautifulSoup, Newspaper3k, RSS Feeds
"""
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
import feedparser
from newspaper import Article as NewsArticle
from datetime import datetime
import asyncio
from loguru import logger

from app.core.config import settings


class ScraperService:
    """Web Scraper for News Sources - NO GEMINI"""

    def __init__(self):
        self.headers = {
            "User-Agent": settings.USER_AGENT
        }

    async def scrape_rss_feeds(self) -> List[Dict[str, Any]]:
        """
        Scrape articles from RSS feeds

        Returns:
            List of raw article data
        """
        articles = []

        for feed_url in settings.rss_feeds_list:
            try:
                logger.info(f"📡 Scraping RSS feed: {feed_url}")
                feed = await asyncio.to_thread(feedparser.parse, feed_url)

                for entry in feed.entries[:settings.MAX_ARTICLES_PER_SOURCE]:
                    article_data = {
                        "source_name": feed.feed.get("title", "Unknown"),
                        "raw_title": entry.get("title", ""),
                        "raw_text": entry.get("summary", ""),
                        "published_at": entry.get("published", datetime.now().isoformat()),
                        "url": entry.get("link", ""),
                        "author": entry.get("author", "")
                    }
                    articles.append(article_data)

                logger.success(f"✅ Scraped {len(feed.entries)} articles from {feed.feed.get('title')}")

            except Exception as e:
                logger.error(f"Failed to scrape RSS feed {feed_url}: {e}")
                continue

        return articles

    async def scrape_article_url(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Scrape full article content from URL using Newspaper3k

        Args:
            url: Article URL

        Returns:
            Article data dictionary
        """
        try:
            article = await asyncio.to_thread(self._extract_article, url)

            return {
                "url": url,
                "raw_title": article.title,
                "raw_text": article.text,
                "summary": article.meta_description or article.text[:300],
                "published_at": article.publish_date.isoformat() if article.publish_date else datetime.now().isoformat(),
                "author": ", ".join(article.authors) if article.authors else "",
                "source_name": article.source_url,
                "image_url": article.top_image
            }

        except Exception as e:
            logger.error(f"Failed to scrape article {url}: {e}")
            return None

    def _extract_article(self, url: str) -> NewsArticle:
        """Extract article using newspaper3k (blocking)"""
        article = NewsArticle(url)
        article.download()
        article.parse()
        return article

    async def search_google_news(self, query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        """
        Search Google News RSS (NO API KEY NEEDED)

        Args:
            query: Search query
            max_results: Maximum results to return

        Returns:
            List of article data
        """
        try:
            # Google News RSS URL
            google_news_url = f"https://news.google.com/rss/search?q={query}&hl=fr&gl=FR&ceid=FR:fr"

            feed = await asyncio.to_thread(feedparser.parse, google_news_url)
            articles = []

            for entry in feed.entries[:max_results]:
                articles.append({
                    "source_name": entry.get("source", {}).get("title", "Google News"),
                    "raw_title": entry.get("title", ""),
                    "raw_text": entry.get("summary", ""),
                    "published_at": entry.get("published", datetime.now().isoformat()),
                    "url": entry.get("link", "")
                })

            logger.success(f"✅ Found {len(articles)} articles for query: {query}")
            return articles

        except Exception as e:
            logger.error(f"Google News search failed for '{query}': {e}")
            return []

    async def scrape_multiple_urls(self, urls: List[str]) -> List[Dict[str, Any]]:
        """
        Scrape multiple URLs concurrently

        Args:
            urls: List of article URLs

        Returns:
            List of article data
        """
        tasks = [self.scrape_article_url(url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out None and exceptions
        articles = [r for r in results if isinstance(r, dict)]
        return articles

    async def generate_simulated_articles(self, topic: str, count: int = 5) -> List[Dict[str, Any]]:
        """
        Generate simulated articles for testing (NO LLM NEEDED)

        Args:
            topic: Topic to simulate
            count: Number of articles

        Returns:
            List of simulated article data
        """
        articles = []
        for i in range(count):
            articles.append({
                "source_name": f"Source {i+1}",
                "raw_title": f"{topic} - Article {i+1}",
                "raw_text": f"Contenu simulé sur {topic}. " * 20,
                "published_at": datetime.now().isoformat(),
                "url": f"https://example.com/article-{i+1}",
                "author": f"Author {i+1}"
            })

        return articles


# Global instance
scraper_service = ScraperService()


def get_scraper_service() -> ScraperService:
    """Dependency injection for FastAPI"""
    return scraper_service
