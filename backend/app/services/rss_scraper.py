"""
RSS Scraper - NovaPress AI v2
Scraping 100% legal via flux RSS officiels fournis par les sites
+ Extraction contenu complet via newspaper3k
+ Suivi de sante des feeds
"""
from typing import List, Dict, Any, Optional, Set
import asyncio
import httpx
from newspaper import Article as NewsArticle, Config
from datetime import datetime, timedelta
from urllib.parse import urlparse
from loguru import logger
import hashlib
import feedparser
from dataclasses import dataclass, field
from enum import Enum

from app.core.config import settings
from app.services.rss_sources import RSS_FEEDS_DATABASE, get_all_feeds, get_source_tier


class FeedHealth(Enum):
    """Health status of an RSS feed"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    FAILING = "failing"
    UNKNOWN = "unknown"


@dataclass
class FeedStats:
    """Statistics for a single RSS feed"""
    url: str
    domain: str
    last_check: Optional[datetime] = None
    success_count: int = 0
    failure_count: int = 0
    articles_fetched: int = 0
    last_error: Optional[str] = None

    @property
    def health(self) -> FeedHealth:
        total = self.success_count + self.failure_count
        if total == 0:
            return FeedHealth.UNKNOWN
        success_rate = self.success_count / total
        if success_rate >= 0.8:
            return FeedHealth.HEALTHY
        elif success_rate >= 0.5:
            return FeedHealth.DEGRADED
        return FeedHealth.FAILING

    def record_success(self, articles_count: int):
        self.success_count += 1
        self.articles_fetched += articles_count
        self.last_check = datetime.now()
        self.last_error = None

    def record_failure(self, error: str):
        self.failure_count += 1
        self.last_check = datetime.now()
        self.last_error = error


class RssScraper:
    """
    Scraper RSS pour sources officielles
    - Parse flux RSS via feedparser
    - Extrait contenu complet via newspaper3k
    - Track sante de chaque flux
    - 100% legal (RSS = syndication officielle)
    """

    # Configuration
    DEFAULT_MAX_ARTICLES_PER_FEED = 10
    ARTICLE_TIMEOUT = 15.0  # secondes par article
    FEED_TIMEOUT = 30.0  # secondes par feed

    def __init__(self):
        self.client = httpx.AsyncClient(
            headers={"User-Agent": settings.USER_AGENT},
            timeout=self.FEED_TIMEOUT,
            follow_redirects=True
        )
        # Newspaper config
        self.newspaper_config = Config()
        self.newspaper_config.browser_user_agent = settings.USER_AGENT
        self.newspaper_config.request_timeout = self.ARTICLE_TIMEOUT
        self.newspaper_config.fetch_images = True
        self.newspaper_config.memoize_articles = False

        # Feed health tracking
        self.feed_stats: Dict[str, FeedStats] = {}

        # Deduplication
        self.article_hashes: Set[str] = set()

        # Max articles par feed (configurable)
        self.max_articles_per_feed = getattr(
            settings, 'RSS_MAX_ARTICLES_PER_FEED', self.DEFAULT_MAX_ARTICLES_PER_FEED
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    def _compute_hash(self, title: str, url: str) -> str:
        """Hash pour deduplication rapide"""
        text = f"{title}{url}".lower()
        return hashlib.md5(text.encode()).hexdigest()

    def _is_duplicate(self, title: str, url: str) -> bool:
        """Check if article already scraped"""
        h = self._compute_hash(title, url)
        if h in self.article_hashes:
            return True
        self.article_hashes.add(h)
        return False

    def _get_feed_stats(self, feed_url: str, domain: str) -> FeedStats:
        """Get or create feed stats"""
        if feed_url not in self.feed_stats:
            self.feed_stats[feed_url] = FeedStats(url=feed_url, domain=domain)
        return self.feed_stats[feed_url]

    async def _fetch_feed(self, feed_url: str) -> Optional[feedparser.FeedParserDict]:
        """Fetch and parse RSS feed"""
        try:
            response = await self.client.get(feed_url)
            response.raise_for_status()
            feed = feedparser.parse(response.content)

            if feed.bozo and feed.bozo_exception:
                logger.warning(f"Feed parsing warning for {feed_url}: {feed.bozo_exception}")

            return feed
        except httpx.TimeoutException:
            logger.warning(f"Timeout fetching feed: {feed_url}")
            return None
        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP error fetching feed {feed_url}: {e.response.status_code}")
            return None
        except Exception as e:
            logger.error(f"Error fetching feed {feed_url}: {e}")
            return None

    async def _extract_article_content(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Extract full article content using newspaper3k
        Similar to AdvancedNewsScraper._scrape_article_content()
        """
        try:
            article = NewsArticle(url, config=self.newspaper_config)

            # Download and parse
            await asyncio.get_event_loop().run_in_executor(
                None, article.download
            )
            await asyncio.get_event_loop().run_in_executor(
                None, article.parse
            )

            # Validate content
            if not article.title:
                return None

            effective_text = article.text or ""

            # Fallback to meta_description if text too short (paywall)
            if len(effective_text) < 200:
                has_valid_title = article.title and len(article.title) > 10
                has_meta_desc = article.meta_description and len(article.meta_description) > 30
                if has_valid_title and has_meta_desc:
                    effective_text = f"{article.title}. {article.meta_description}"

            return {
                "title": article.title,
                "text": effective_text,
                "summary": article.meta_description or effective_text[:300],
                "publish_date": article.publish_date,
                "authors": article.authors,
                "image_url": article.top_image,
                "language": article.meta_lang or "unknown",
                "keywords": article.meta_keywords,
            }

        except Exception as e:
            logger.debug(f"Error extracting article {url}: {e}")
            return None

    async def _scrape_feed(
        self,
        feed_url: str,
        source_name: str,
        domain: str,
        category: str = "MONDE"
    ) -> List[Dict[str, Any]]:
        """
        Scrape a single RSS feed
        Returns list of articles in pipeline-compatible format
        """
        stats = self._get_feed_stats(feed_url, domain)
        articles = []

        # Fetch feed
        feed = await self._fetch_feed(feed_url)
        if not feed or not feed.entries:
            stats.record_failure("Empty or invalid feed")
            return []

        logger.info(f"📡 RSS {source_name}: {len(feed.entries)} entries found")

        # Process entries (limit to max_articles_per_feed)
        entries_to_process = feed.entries[:self.max_articles_per_feed]

        for entry in entries_to_process:
            try:
                # Extract URL
                url = entry.get('link') or entry.get('url')
                if not url:
                    continue

                # Get title from RSS
                rss_title = entry.get('title', '')
                if not rss_title:
                    continue

                # Deduplication
                if self._is_duplicate(rss_title, url):
                    continue

                # Extract full content
                content = await self._extract_article_content(url)

                if content:
                    # Use extracted content
                    article_data = {
                        "url": url,
                        "source_name": source_name,
                        "source_domain": domain,
                        "raw_title": content["title"] or rss_title,
                        "raw_text": content["text"],
                        "summary": content["summary"],
                        "published_at": (
                            content["publish_date"].isoformat()
                            if content["publish_date"]
                            else self._parse_rss_date(entry)
                        ),
                        "authors": content["authors"],
                        "image_url": content["image_url"],
                        "language": content["language"],
                        "keywords": content["keywords"],
                        "scraped_at": datetime.now().isoformat(),
                        "scrape_method": "rss_full",
                        "source_tier": get_source_tier(domain),
                        "category_hint": category,
                    }
                else:
                    # Fallback: use RSS content only (no full extraction)
                    rss_summary = entry.get('summary', entry.get('description', ''))
                    # Clean HTML from RSS summary
                    if rss_summary:
                        from bs4 import BeautifulSoup
                        rss_summary = BeautifulSoup(rss_summary, 'html.parser').get_text()

                    article_data = {
                        "url": url,
                        "source_name": source_name,
                        "source_domain": domain,
                        "raw_title": rss_title,
                        "raw_text": rss_summary or rss_title,
                        "summary": rss_summary[:300] if rss_summary else rss_title,
                        "published_at": self._parse_rss_date(entry),
                        "authors": [entry.get('author', '')] if entry.get('author') else [],
                        "image_url": self._extract_rss_image(entry),
                        "language": "unknown",
                        "keywords": [],
                        "scraped_at": datetime.now().isoformat(),
                        "scrape_method": "rss_metadata",
                        "source_tier": get_source_tier(domain),
                        "category_hint": category,
                    }

                articles.append(article_data)

            except Exception as e:
                logger.debug(f"Error processing RSS entry: {e}")
                continue

        # Update stats
        if articles:
            stats.record_success(len(articles))
            logger.info(f"✅ RSS {source_name}: {len(articles)} articles scraped")
        else:
            stats.record_failure("No valid articles extracted")
            logger.warning(f"⚠️ RSS {source_name}: 0 articles extracted")

        return articles

    def _parse_rss_date(self, entry: Dict) -> str:
        """Parse date from RSS entry"""
        try:
            # Try published_parsed first
            if entry.get('published_parsed'):
                from time import mktime
                return datetime.fromtimestamp(mktime(entry.published_parsed)).isoformat()
            # Try updated_parsed
            if entry.get('updated_parsed'):
                from time import mktime
                return datetime.fromtimestamp(mktime(entry.updated_parsed)).isoformat()
            # Try published string
            if entry.get('published'):
                from dateutil import parser
                return parser.parse(entry.published).isoformat()
        except Exception:
            pass
        return datetime.now().isoformat()

    def _extract_rss_image(self, entry: Dict) -> Optional[str]:
        """Extract image URL from RSS entry"""
        # Try media:content
        if hasattr(entry, 'media_content') and entry.media_content:
            for media in entry.media_content:
                if media.get('medium') == 'image' or 'image' in media.get('type', ''):
                    return media.get('url')
        # Try media:thumbnail
        if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
            return entry.media_thumbnail[0].get('url')
        # Try enclosure
        if entry.get('enclosures'):
            for enc in entry.enclosures:
                if 'image' in enc.get('type', ''):
                    return enc.get('href')
        return None

    async def scrape_all_feeds(
        self,
        domains: Optional[List[str]] = None,
        categories: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Scrape all configured RSS feeds

        Args:
            domains: Optional list of domains to scrape (if None, scrape all)
            categories: Optional list of categories to filter feeds

        Returns:
            List of articles in pipeline-compatible format
        """
        all_articles = []
        feeds_to_scrape = get_all_feeds()

        # Filter by domains if specified
        if domains:
            feeds_to_scrape = [f for f in feeds_to_scrape if f['domain'] in domains]

        # Filter by categories if specified
        if categories:
            feeds_to_scrape = [f for f in feeds_to_scrape if f['category'] in categories]

        logger.info(f"📡 Starting RSS scraping: {len(feeds_to_scrape)} feeds")

        # Scrape feeds concurrently (with semaphore to limit concurrency)
        semaphore = asyncio.Semaphore(5)  # Max 5 concurrent feed scrapes

        async def scrape_with_semaphore(feed_info: Dict) -> List[Dict]:
            async with semaphore:
                return await self._scrape_feed(
                    feed_url=feed_info['url'],
                    source_name=feed_info['source_name'],
                    domain=feed_info['domain'],
                    category=feed_info['category']
                )

        # Create tasks
        tasks = [scrape_with_semaphore(f) for f in feeds_to_scrape]

        # Execute with progress
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect results
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error scraping feed {feeds_to_scrape[i]['url']}: {result}")
            elif result:
                all_articles.extend(result)

        logger.info(f"📡 RSS scraping complete: {len(all_articles)} total articles from {len(feeds_to_scrape)} feeds")

        return all_articles

    async def scrape_domain(self, domain: str) -> List[Dict[str, Any]]:
        """
        Scrape all RSS feeds for a specific domain
        Useful for replacing a failing scraped source with its RSS alternative
        """
        if domain not in RSS_FEEDS_DATABASE:
            logger.warning(f"No RSS feeds configured for domain: {domain}")
            return []

        source_config = RSS_FEEDS_DATABASE[domain]
        articles = []

        for feed in source_config.get('feeds', []):
            feed_articles = await self._scrape_feed(
                feed_url=feed['url'],
                source_name=source_config['name'],
                domain=domain,
                category=feed.get('category', 'MONDE')
            )
            articles.extend(feed_articles)

        return articles

    def get_health_report(self) -> Dict[str, Any]:
        """
        Generate health report for all tracked feeds
        """
        healthy = []
        degraded = []
        failing = []
        unknown = []

        for url, stats in self.feed_stats.items():
            entry = {
                "url": url,
                "domain": stats.domain,
                "success_count": stats.success_count,
                "failure_count": stats.failure_count,
                "articles_fetched": stats.articles_fetched,
                "last_error": stats.last_error,
            }

            if stats.health == FeedHealth.HEALTHY:
                healthy.append(entry)
            elif stats.health == FeedHealth.DEGRADED:
                degraded.append(entry)
            elif stats.health == FeedHealth.FAILING:
                failing.append(entry)
            else:
                unknown.append(entry)

        total = len(self.feed_stats)
        return {
            "total_feeds_tracked": total,
            "healthy_count": len(healthy),
            "degraded_count": len(degraded),
            "failing_count": len(failing),
            "unknown_count": len(unknown),
            "success_rate": len(healthy) / total if total > 0 else 0,
            "feeds": {
                "healthy": healthy,
                "degraded": degraded,
                "failing": failing,
                "unknown": unknown,
            }
        }

    def get_failing_domains(self) -> List[str]:
        """Get list of domains with failing RSS feeds"""
        failing_domains = set()
        for url, stats in self.feed_stats.items():
            if stats.health == FeedHealth.FAILING:
                failing_domains.add(stats.domain)
        return list(failing_domains)


# Singleton instance
_rss_scraper: Optional[RssScraper] = None


def get_rss_scraper() -> RssScraper:
    """Get or create RSS scraper singleton"""
    global _rss_scraper
    if _rss_scraper is None:
        _rss_scraper = RssScraper()
    return _rss_scraper


async def scrape_rss_feeds(
    domains: Optional[List[str]] = None,
    categories: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Convenience function to scrape RSS feeds

    Args:
        domains: Optional list of domains to scrape
        categories: Optional list of categories to filter

    Returns:
        List of articles
    """
    scraper = get_rss_scraper()
    async with scraper:
        return await scraper.scrape_all_feeds(domains, categories)
