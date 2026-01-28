"""
Social Media & Alternative Sources Scraper - NovaPress AI v2
Legal scraping via official APIs: Reddit, Hacker News, Bluesky, ArXiv, Wikipedia
"""
from typing import List, Dict, Any, Optional
import asyncio
import httpx
from datetime import datetime, timedelta
from loguru import logger
import hashlib
import re
import xml.etree.ElementTree as ET

from app.core.config import settings


class SocialScraper:
    """
    Multi-source scraper using official APIs only.
    100% legal - respects ToS of all platforms.
    """

    def __init__(self):
        self.client = httpx.AsyncClient(
            headers={"User-Agent": "NovaPress/2.0 (News Aggregator)"},
            timeout=30.0,
            follow_redirects=True
        )
        self.scraped_ids: set = set()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    def _generate_id(self, source: str, identifier: str) -> str:
        """Generate unique ID for deduplication"""
        return hashlib.md5(f"{source}:{identifier}".encode()).hexdigest()

    # ========================================
    # REDDIT API (No Auth needed for public)
    # ========================================
    async def scrape_reddit(
        self,
        subreddits: List[str] = None,
        limit_per_sub: int = 10,
        time_filter: str = "day"
    ) -> List[Dict[str, Any]]:
        """
        Scrape Reddit via public JSON API (no OAuth needed for read-only).

        Args:
            subreddits: List of subreddit names
            limit_per_sub: Max posts per subreddit
            time_filter: 'hour', 'day', 'week', 'month', 'year', 'all'
        """
        if subreddits is None:
            subreddits = [
                # French
                "france", "french",
                # News
                "worldnews", "news", "europe",
                # Tech
                "technology", "programming", "artificialintelligence",
                # Science
                "science", "space", "environment",
                # Finance
                "economics", "finance",
                # Sports
                "sports", "soccer", "football"
            ]

        articles = []

        for subreddit in subreddits:
            try:
                url = f"https://www.reddit.com/r/{subreddit}/top.json"
                params = {"limit": limit_per_sub, "t": time_filter}

                response = await self.client.get(url, params=params)

                if response.status_code != 200:
                    logger.warning(f"Reddit r/{subreddit}: HTTP {response.status_code}")
                    continue

                data = response.json()
                posts = data.get("data", {}).get("children", [])

                for post in posts:
                    post_data = post.get("data", {})
                    post_id = post_data.get("id", "")

                    # Skip if already scraped
                    unique_id = self._generate_id("reddit", post_id)
                    if unique_id in self.scraped_ids:
                        continue
                    self.scraped_ids.add(unique_id)

                    # Skip if too short
                    title = post_data.get("title", "")
                    selftext = post_data.get("selftext", "")
                    if len(title) < 20:
                        continue

                    articles.append({
                        "id": unique_id,
                        "url": f"https://reddit.com{post_data.get('permalink', '')}",
                        "source_name": f"Reddit r/{subreddit}",
                        "source_domain": "reddit.com",
                        "source_type": "social",
                        "raw_title": title,
                        "raw_text": selftext if selftext else title,
                        "summary": selftext[:300] if selftext else title,
                        "published_at": datetime.fromtimestamp(post_data.get("created_utc", 0)).isoformat(),
                        "authors": [post_data.get("author", "anonymous")],
                        "score": post_data.get("score", 0),
                        "num_comments": post_data.get("num_comments", 0),
                        "language": "en",  # Reddit is mostly English
                        "scraped_at": datetime.now().isoformat()
                    })

                logger.info(f"✅ Reddit r/{subreddit}: {len(posts)} posts")
                await asyncio.sleep(1)  # Rate limiting

            except Exception as e:
                logger.error(f"❌ Reddit r/{subreddit} failed: {e}")
                continue

        logger.success(f"📱 Reddit total: {len(articles)} articles")
        return articles

    # ========================================
    # HACKER NEWS API (Free, no auth)
    # ========================================
    async def scrape_hackernews(
        self,
        story_type: str = "top",
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Scrape Hacker News via official Firebase API (free, no auth).

        Args:
            story_type: 'top', 'new', 'best', 'ask', 'show'
            limit: Max stories to fetch
        """
        articles = []

        try:
            # Get story IDs
            url = f"https://hacker-news.firebaseio.com/v0/{story_type}stories.json"
            response = await self.client.get(url)
            story_ids = response.json()[:limit]

            # Fetch each story
            for story_id in story_ids:
                try:
                    story_url = f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
                    story_response = await self.client.get(story_url)
                    story = story_response.json()

                    if not story or story.get("type") != "story":
                        continue

                    unique_id = self._generate_id("hackernews", str(story_id))
                    if unique_id in self.scraped_ids:
                        continue
                    self.scraped_ids.add(unique_id)

                    title = story.get("title", "")
                    text = story.get("text", "")  # For Ask HN / Show HN

                    articles.append({
                        "id": unique_id,
                        "url": story.get("url", f"https://news.ycombinator.com/item?id={story_id}"),
                        "source_name": "Hacker News",
                        "source_domain": "news.ycombinator.com",
                        "source_type": "tech_forum",
                        "raw_title": title,
                        "raw_text": text if text else title,
                        "summary": text[:300] if text else title,
                        "published_at": datetime.fromtimestamp(story.get("time", 0)).isoformat(),
                        "authors": [story.get("by", "anonymous")],
                        "score": story.get("score", 0),
                        "num_comments": story.get("descendants", 0),
                        "language": "en",
                        "scraped_at": datetime.now().isoformat()
                    })

                except Exception as e:
                    logger.debug(f"HN story {story_id} failed: {e}")
                    continue

            logger.success(f"🔶 Hacker News: {len(articles)} stories")

        except Exception as e:
            logger.error(f"❌ Hacker News failed: {e}")

        return articles

    # ========================================
    # BLUESKY API (AT Protocol)
    # ========================================
    async def scrape_bluesky(
        self,
        search_terms: List[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Scrape Bluesky via AT Protocol public API (no auth for public posts).
        """
        if search_terms is None:
            search_terms = ["actualités", "news", "tech", "france", "politique"]

        articles = []

        for term in search_terms:
            try:
                # Bluesky public search endpoint
                url = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts"
                params = {"q": term, "limit": min(limit, 25)}

                response = await self.client.get(url, params=params)

                if response.status_code != 200:
                    logger.debug(f"Bluesky search '{term}': HTTP {response.status_code}")
                    continue

                data = response.json()
                posts = data.get("posts", [])

                for post in posts:
                    post_uri = post.get("uri", "")
                    record = post.get("record", {})
                    author = post.get("author", {})

                    unique_id = self._generate_id("bluesky", post_uri)
                    if unique_id in self.scraped_ids:
                        continue
                    self.scraped_ids.add(unique_id)

                    text = record.get("text", "")
                    if len(text) < 50:  # Skip very short posts
                        continue

                    # Convert AT URI to web URL
                    handle = author.get("handle", "")
                    rkey = post_uri.split("/")[-1] if "/" in post_uri else ""
                    web_url = f"https://bsky.app/profile/{handle}/post/{rkey}"

                    articles.append({
                        "id": unique_id,
                        "url": web_url,
                        "source_name": f"Bluesky - @{handle}",
                        "source_domain": "bsky.app",
                        "source_type": "social",
                        "raw_title": text[:100] + "..." if len(text) > 100 else text,
                        "raw_text": text,
                        "summary": text[:300],
                        "published_at": record.get("createdAt", datetime.now().isoformat()),
                        "authors": [author.get("displayName", handle)],
                        "language": "auto",
                        "scraped_at": datetime.now().isoformat()
                    })

                logger.info(f"✅ Bluesky '{term}': {len(posts)} posts")
                await asyncio.sleep(0.5)

            except Exception as e:
                logger.error(f"❌ Bluesky '{term}' failed: {e}")
                continue

        logger.success(f"🦋 Bluesky total: {len(articles)} posts")
        return articles

    # ========================================
    # ARXIV API (OAI-PMH - 100% Free)
    # ========================================
    async def scrape_arxiv(
        self,
        categories: List[str] = None,
        max_results: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Scrape ArXiv via official API (free, no auth).

        Args:
            categories: ArXiv categories (cs.AI, cs.CL, physics, etc.)
            max_results: Max papers to fetch
        """
        if categories is None:
            categories = [
                "cs.AI",      # Artificial Intelligence
                "cs.CL",      # Computation and Language (NLP)
                "cs.LG",      # Machine Learning
                "physics",    # Physics
                "econ",       # Economics
                "q-bio"       # Quantitative Biology
            ]

        articles = []
        base_url = "http://export.arxiv.org/api/query"

        for category in categories:
            try:
                params = {
                    "search_query": f"cat:{category}",
                    "start": 0,
                    "max_results": max_results // len(categories),
                    "sortBy": "submittedDate",
                    "sortOrder": "descending"
                }

                response = await self.client.get(base_url, params=params)

                if response.status_code != 200:
                    logger.warning(f"ArXiv {category}: HTTP {response.status_code}")
                    continue

                # Parse Atom XML
                root = ET.fromstring(response.text)
                ns = {"atom": "http://www.w3.org/2005/Atom"}
                entries = root.findall("atom:entry", ns)

                for entry in entries:
                    arxiv_id = entry.find("atom:id", ns).text

                    unique_id = self._generate_id("arxiv", arxiv_id)
                    if unique_id in self.scraped_ids:
                        continue
                    self.scraped_ids.add(unique_id)

                    title = entry.find("atom:title", ns).text.strip().replace("\n", " ")
                    summary = entry.find("atom:summary", ns).text.strip().replace("\n", " ")
                    published = entry.find("atom:published", ns).text

                    authors = []
                    for author in entry.findall("atom:author", ns):
                        name = author.find("atom:name", ns)
                        if name is not None:
                            authors.append(name.text)

                    articles.append({
                        "id": unique_id,
                        "url": arxiv_id,
                        "source_name": f"ArXiv [{category}]",
                        "source_domain": "arxiv.org",
                        "source_type": "academic",
                        "raw_title": title,
                        "raw_text": summary,
                        "summary": summary[:500],
                        "published_at": published,
                        "authors": authors[:5],  # Limit authors
                        "language": "en",
                        "scraped_at": datetime.now().isoformat()
                    })

                logger.info(f"✅ ArXiv {category}: {len(entries)} papers")
                await asyncio.sleep(1)  # ArXiv rate limit: 1 req/sec

            except Exception as e:
                logger.error(f"❌ ArXiv {category} failed: {e}")
                continue

        logger.success(f"📚 ArXiv total: {len(articles)} papers")
        return articles

    # ========================================
    # WIKIPEDIA CURRENT EVENTS
    # ========================================
    async def scrape_wikipedia_news(
        self,
        languages: List[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Scrape Wikipedia Current Events portal via API.
        """
        if languages is None:
            languages = ["en", "fr"]

        articles = []

        for lang in languages:
            try:
                # Wikipedia API for current events page
                url = f"https://{lang}.wikipedia.org/api/rest_v1/page/html/Portal:Current_events"

                response = await self.client.get(url)

                if response.status_code != 200:
                    logger.warning(f"Wikipedia {lang}: HTTP {response.status_code}")
                    continue

                # Extract text content (simplified)
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.text, 'html.parser')

                # Find event items
                events = soup.find_all(['li', 'p'])

                for i, event in enumerate(events[:20]):  # Limit
                    text = event.get_text().strip()
                    if len(text) < 50 or len(text) > 1000:
                        continue

                    unique_id = self._generate_id(f"wikipedia_{lang}", str(hash(text)))
                    if unique_id in self.scraped_ids:
                        continue
                    self.scraped_ids.add(unique_id)

                    articles.append({
                        "id": unique_id,
                        "url": f"https://{lang}.wikipedia.org/wiki/Portal:Current_events",
                        "source_name": f"Wikipedia ({lang.upper()})",
                        "source_domain": f"{lang}.wikipedia.org",
                        "source_type": "encyclopedia",
                        "raw_title": text[:100] + "..." if len(text) > 100 else text,
                        "raw_text": text,
                        "summary": text[:300],
                        "published_at": datetime.now().isoformat(),
                        "authors": ["Wikipedia Contributors"],
                        "language": lang,
                        "scraped_at": datetime.now().isoformat()
                    })

                logger.info(f"✅ Wikipedia ({lang}): {len(articles)} events")

            except Exception as e:
                logger.error(f"❌ Wikipedia {lang} failed: {e}")
                continue

        logger.success(f"📖 Wikipedia total: {len(articles)} events")
        return articles

    # ========================================
    # MASTER SCRAPE ALL SOURCES
    # ========================================
    async def scrape_all_sources(
        self,
        include_reddit: bool = True,
        include_hackernews: bool = True,
        include_bluesky: bool = True,
        include_arxiv: bool = True,
        include_wikipedia: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Scrape all configured social/alternative sources.
        """
        all_articles = []

        tasks = []

        if include_reddit:
            tasks.append(("Reddit", self.scrape_reddit()))

        if include_hackernews:
            tasks.append(("HackerNews", self.scrape_hackernews()))

        if include_bluesky:
            tasks.append(("Bluesky", self.scrape_bluesky()))

        if include_arxiv:
            tasks.append(("ArXiv", self.scrape_arxiv()))

        if include_wikipedia:
            tasks.append(("Wikipedia", self.scrape_wikipedia_news()))

        # Run all scrapers
        for name, task in tasks:
            try:
                logger.info(f"🔄 Scraping {name}...")
                articles = await task
                all_articles.extend(articles)
                logger.success(f"✅ {name}: {len(articles)} items")
            except Exception as e:
                logger.error(f"❌ {name} failed: {e}")
                continue

        logger.success(f"🎉 Total from all sources: {len(all_articles)} items")
        return all_articles


# Global instance
social_scraper = SocialScraper()


async def get_social_scraper() -> SocialScraper:
    """Dependency injection for FastAPI"""
    return social_scraper
