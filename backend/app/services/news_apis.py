"""
News APIs Service - NovaPress AI v2
Integration with external news APIs (GDELT, etc.)
100% gratuit, sans authentification requise
"""
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from urllib.parse import urlencode
from loguru import logger

from app.core.config import settings


class GdeltApi:
    """
    GDELT Project API Client
    https://api.gdeltproject.org

    GDELT monitors world news in 100+ languages from thousands of sources.
    100% FREE, no API key required!

    Features:
    - Real-time news monitoring
    - Multi-language support
    - Geographic filtering
    - Tone/sentiment analysis
    - Free unlimited access
    """

    BASE_URL = "https://api.gdeltproject.org/api/v2"

    # Language codes for filtering
    LANGUAGE_CODES = {
        "fr": "french",
        "en": "english",
        "de": "german",
        "es": "spanish",
        "it": "italian",
        "pt": "portuguese",
        "ar": "arabic",
        "zh": "chinese",
        "ja": "japanese",
        "ru": "russian"
    }

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def fetch_articles(
        self,
        query: Optional[str] = None,
        languages: Optional[List[str]] = None,
        limit: int = 50,
        timespan: str = "24h",
        sort: str = "DateDesc"
    ) -> List[Dict[str, Any]]:
        """
        Fetch articles from GDELT DOC API

        Args:
            query: Search query (optional)
            languages: List of language codes (e.g., ["fr", "en"])
            limit: Max number of articles (max 250)
            timespan: Time window (e.g., "24h", "1w", "1m")
            sort: Sort order ("DateDesc", "DateAsc", "ToneDesc", "ToneAsc")

        Returns:
            List of articles in pipeline-compatible format
        """
        # Build query
        query_parts = []

        if query:
            query_parts.append(query)

        # Add language filter
        if languages:
            lang_filters = [f"sourcelang:{self.LANGUAGE_CODES.get(lang, lang)}"
                          for lang in languages]
            query_parts.append(f"({' OR '.join(lang_filters)})")
        else:
            # Default to French and English
            query_parts.append("(sourcelang:french OR sourcelang:english)")

        final_query = " ".join(query_parts) if query_parts else "*"

        # API parameters
        params = {
            "query": final_query,
            "mode": "artlist",
            "maxrecords": min(limit, 250),  # API max is 250
            "format": "json",
            "timespan": timespan,
            "sort": sort
        }

        url = f"{self.BASE_URL}/doc/doc?{urlencode(params)}"

        try:
            response = await self.client.get(url)
            response.raise_for_status()
            data = response.json()

            articles = []
            for item in data.get("articles", []):
                article = self._convert_to_pipeline_format(item)
                if article:
                    articles.append(article)

            logger.info(f"🌍 GDELT: {len(articles)} articles fetched")
            return articles

        except httpx.HTTPStatusError as e:
            logger.error(f"GDELT API HTTP error: {e.response.status_code}")
            return []
        except Exception as e:
            logger.error(f"GDELT API error: {e}")
            return []

    async def fetch_by_topic(
        self,
        topic: str,
        languages: Optional[List[str]] = None,
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Fetch articles about a specific topic

        Args:
            topic: Topic to search for
            languages: Language filter
            limit: Max articles

        Returns:
            List of articles
        """
        return await self.fetch_articles(
            query=f'"{topic}"',
            languages=languages,
            limit=limit,
            timespan="48h"  # Look back 48h for topic search
        )

    async def fetch_trending(
        self,
        languages: Optional[List[str]] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Fetch trending/high-impact articles

        Uses tone sorting to get most impactful articles
        """
        return await self.fetch_articles(
            languages=languages,
            limit=limit,
            timespan="12h",
            sort="ToneDesc"  # Most positive/impactful first
        )

    async def fetch_breaking(
        self,
        languages: Optional[List[str]] = None,
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Fetch most recent breaking news
        """
        return await self.fetch_articles(
            languages=languages,
            limit=limit,
            timespan="2h",  # Last 2 hours only
            sort="DateDesc"
        )

    def _convert_to_pipeline_format(self, gdelt_article: Dict) -> Optional[Dict[str, Any]]:
        """
        Convert GDELT article format to NovaPress pipeline format
        """
        try:
            url = gdelt_article.get("url", "")
            title = gdelt_article.get("title", "")

            if not url or not title:
                return None

            # Extract domain
            from urllib.parse import urlparse
            domain = urlparse(url).netloc.replace("www.", "")

            # Parse date
            date_str = gdelt_article.get("seendate", "")
            if date_str:
                # GDELT format: YYYYMMDDTHHMMSSZ
                try:
                    published_at = datetime.strptime(date_str, "%Y%m%dT%H%M%SZ").isoformat()
                except ValueError:
                    published_at = datetime.now().isoformat()
            else:
                published_at = datetime.now().isoformat()

            return {
                "url": url,
                "source_name": gdelt_article.get("domain", domain),
                "source_domain": domain,
                "raw_title": title,
                "raw_text": title,  # GDELT doesn't provide full text, need to scrape
                "summary": title,
                "published_at": published_at,
                "authors": [],
                "image_url": gdelt_article.get("socialimage", ""),
                "language": gdelt_article.get("language", "unknown"),
                "keywords": [],
                "scraped_at": datetime.now().isoformat(),
                "scrape_method": "gdelt_api",
                "source_tier": 2,  # GDELT sources are generally tier 2
                "gdelt_metadata": {
                    "tone": gdelt_article.get("tone", 0),
                    "country": gdelt_article.get("sourcecountry", ""),
                    "domain_rank": gdelt_article.get("domain_rank", 0)
                }
            }
        except Exception as e:
            logger.debug(f"Failed to convert GDELT article: {e}")
            return None


class NewsApisService:
    """
    Aggregator for multiple news APIs
    Currently supports:
    - GDELT (free, no auth)

    Future:
    - NewsAPI.org (requires API key)
    - MediaStack (requires API key)
    """

    def __init__(self):
        self.gdelt = GdeltApi()
        self._enabled = getattr(settings, 'GDELT_ENABLED', True)

    async def __aenter__(self):
        await self.gdelt.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.gdelt.__aexit__(exc_type, exc_val, exc_tb)

    async def fetch_all(
        self,
        query: Optional[str] = None,
        languages: Optional[List[str]] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Fetch articles from all enabled APIs
        """
        all_articles = []

        if self._enabled:
            try:
                gdelt_articles = await self.gdelt.fetch_articles(
                    query=query,
                    languages=languages or ["fr", "en"],
                    limit=limit
                )
                all_articles.extend(gdelt_articles)
            except Exception as e:
                logger.error(f"GDELT fetch failed: {e}")

        return all_articles

    async def fetch_breaking(
        self,
        languages: Optional[List[str]] = None,
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Fetch breaking news from all APIs
        """
        if not self._enabled:
            return []

        return await self.gdelt.fetch_breaking(languages, limit)

    async def fetch_trending(
        self,
        languages: Optional[List[str]] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Fetch trending articles from all APIs
        """
        if not self._enabled:
            return []

        return await self.gdelt.fetch_trending(languages, limit)


# Singleton instance
_news_apis: Optional[NewsApisService] = None


def get_news_apis() -> NewsApisService:
    """Get or create news APIs service singleton"""
    global _news_apis
    if _news_apis is None:
        _news_apis = NewsApisService()
    return _news_apis


async def fetch_gdelt(
    query: Optional[str] = None,
    languages: Optional[List[str]] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Convenience function to fetch from GDELT

    Args:
        query: Search query (optional)
        languages: Language codes (default: ["fr", "en"])
        limit: Max articles

    Returns:
        List of articles in pipeline format
    """
    async with GdeltApi() as gdelt:
        return await gdelt.fetch_articles(
            query=query,
            languages=languages or ["fr", "en"],
            limit=limit
        )
