"""
Source Discovery Service - NovaPress AI v2
Auto-discovers replacement news sources when existing ones are blocked/blacklisted.
Uses LLM to suggest alternatives and auto-generate CSS selectors.
"""
import asyncio
import httpx
import json
import re
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
from loguru import logger
from datetime import datetime

from app.core.config import settings
from app.services.source_persistence import get_source_persistence, SourceHealth, SourceStatus


class SourceDiscoveryService:
    """
    Discovers and validates new news sources using LLM.

    Features:
    - LLM-based source suggestions based on blocked source characteristics
    - Automatic robots.txt validation
    - CSS selector auto-generation via LLM
    - Test scraping to validate source accessibility
    """

    # Categories for source matching
    SOURCE_CATEGORIES = {
        "MONDE": ["international", "world", "global", "geopolitics"],
        "TECH": ["technology", "tech", "digital", "innovation", "AI", "software"],
        "ECONOMIE": ["economy", "finance", "business", "markets", "banking"],
        "POLITIQUE": ["politics", "government", "elections", "policy"],
        "CULTURE": ["culture", "arts", "entertainment", "media", "lifestyle"],
        "SPORT": ["sports", "football", "basketball", "tennis", "olympics"],
        "SCIENCES": ["science", "research", "health", "medicine", "environment"]
    }

    # Regions for geographic matching
    SOURCE_REGIONS = {
        "fr": "France/French-speaking",
        "us": "United States",
        "uk": "United Kingdom",
        "de": "Germany/German-speaking",
        "es": "Spain/Spanish-speaking",
        "it": "Italy/Italian-speaking",
        "eu": "Europe",
        "asia": "Asia",
        "middle-east": "Middle East",
        "latam": "Latin America"
    }

    def __init__(self):
        self.client = httpx.AsyncClient(
            headers={"User-Agent": settings.USER_AGENT},
            timeout=15.0,
            follow_redirects=True
        )
        self._discovered_sources: Dict[str, Dict] = {}  # Cache of discovered sources
        self._discovery_attempts: Dict[str, int] = {}  # Track discovery attempts per domain
        self._persistence = None  # Source persistence service

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    def _infer_source_metadata(self, domain: str, source_config: dict = None) -> Dict[str, Any]:
        """
        Infer metadata about a source from its domain and config.
        """
        metadata = {
            "domain": domain,
            "name": source_config.get("name", domain) if source_config else domain,
            "category": "MONDE",  # Default
            "region": "unknown",
            "language": "en"
        }

        # Infer region from TLD
        tld = domain.split(".")[-1]
        tld_to_region = {
            "fr": "fr", "de": "de", "es": "es", "it": "it",
            "uk": "uk", "co.uk": "uk", "com.au": "asia",
            "jp": "asia", "cn": "asia", "kr": "asia",
            "br": "latam", "mx": "latam", "ar": "latam"
        }
        metadata["region"] = tld_to_region.get(tld, "us" if tld == "com" else "unknown")

        # Infer language
        tld_to_lang = {
            "fr": "fr", "de": "de", "es": "es", "it": "it",
            "jp": "ja", "cn": "zh", "kr": "ko", "br": "pt"
        }
        metadata["language"] = tld_to_lang.get(tld, "en")

        # Infer category from domain name
        domain_lower = domain.lower()
        for category, keywords in self.SOURCE_CATEGORIES.items():
            if any(kw in domain_lower for kw in keywords):
                metadata["category"] = category
                break

        return metadata

    async def find_replacement(
        self,
        blocked_domain: str,
        blocked_reason: str,
        source_config: dict = None,
        max_suggestions: int = 3
    ) -> Optional[Dict[str, Any]]:
        """
        Find a replacement source for a blocked domain.

        Args:
            blocked_domain: The domain that was blocked
            blocked_reason: Why it was blocked (timeout, robots.txt, etc.)
            source_config: Original source configuration if available
            max_suggestions: Maximum number of alternatives to try

        Returns:
            New source configuration dict or None if no valid replacement found
        """
        # Rate limit discovery attempts
        attempts = self._discovery_attempts.get(blocked_domain, 0)
        if attempts >= 3:
            logger.warning(f"Max discovery attempts reached for {blocked_domain}")
            return None
        self._discovery_attempts[blocked_domain] = attempts + 1

        # Get metadata about blocked source
        metadata = self._infer_source_metadata(blocked_domain, source_config)

        logger.info(f"🔍 Searching replacement for {blocked_domain} ({metadata['category']}, {metadata['region']})")

        # Ask LLM for suggestions
        suggestions = await self._get_llm_suggestions(metadata, blocked_reason, max_suggestions)

        if not suggestions:
            logger.warning(f"No LLM suggestions for {blocked_domain}")
            return None

        # Try each suggestion
        for suggestion in suggestions:
            try:
                # Validate the source
                validated = await self._validate_source(suggestion)
                if validated:
                    # Generate CSS selectors
                    selectors = await self._discover_selectors(suggestion["url"])
                    if selectors:
                        new_source = {
                            "name": suggestion["name"],
                            "url": suggestion["url"],
                            "selectors": selectors,
                            "rate_limit": 2.0,  # Conservative default
                            "discovered_at": datetime.now().isoformat(),
                            "replaced": blocked_domain,
                            "auto_discovered": True
                        }

                        # Cache the discovery
                        self._discovered_sources[suggestion["domain"]] = new_source

                        # Persist the discovered source
                        await self._persist_discovered_source(
                            suggestion["domain"],
                            new_source,
                            replaces=blocked_domain
                        )

                        logger.success(f"✅ Found replacement: {suggestion['name']} ({suggestion['domain']})")
                        return new_source

            except Exception as e:
                logger.warning(f"Failed to validate {suggestion.get('domain', 'unknown')}: {e}")
                continue

        logger.warning(f"No valid replacement found for {blocked_domain}")
        return None

    async def _get_llm_suggestions(
        self,
        metadata: Dict[str, Any],
        blocked_reason: str,
        max_suggestions: int
    ) -> List[Dict[str, str]]:
        """
        Use LLM to suggest alternative news sources.
        """
        if not settings.OPENROUTER_API_KEY:
            logger.warning("No OPENROUTER_API_KEY configured for source discovery")
            return []

        region_desc = self.SOURCE_REGIONS.get(metadata["region"], metadata["region"])

        prompt = f"""You are a news source expert. A news scraper needs replacement sources.

BLOCKED SOURCE:
- Domain: {metadata['domain']}
- Name: {metadata['name']}
- Category: {metadata['category']}
- Region: {region_desc}
- Language: {metadata['language']}
- Block Reason: {blocked_reason}

Find {max_suggestions} ALTERNATIVE news sources that:
1. Cover similar topics ({metadata['category']})
2. Are from the same region/language if possible
3. Are major, reputable news outlets
4. Have accessible websites (no heavy paywalls)
5. Are NOT already commonly blocked (avoid: rt.com, scmp.com)

Return ONLY a JSON array with this exact format:
[
  {{"domain": "example.com", "name": "Example News", "url": "https://www.example.com", "language": "en"}},
  ...
]

Return ONLY the JSON array, no other text."""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": settings.OPENROUTER_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                        "max_tokens": 500
                    }
                )

                if response.status_code != 200:
                    logger.error(f"LLM API error: {response.status_code}")
                    return []

                result = response.json()
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

                # Parse JSON from response
                # Try to extract JSON array from the response
                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                if json_match:
                    suggestions = json.loads(json_match.group())
                    return suggestions[:max_suggestions]

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response: {e}")
        except Exception as e:
            logger.error(f"LLM suggestion error: {e}")

        return []

    async def _validate_source(self, suggestion: Dict[str, str]) -> bool:
        """
        Validate a suggested source:
        1. Check if URL is accessible
        2. Check robots.txt allows scraping
        3. Verify it returns HTML content
        """
        domain = suggestion.get("domain", "")
        url = suggestion.get("url", "")

        if not domain or not url:
            return False

        try:
            # 1. Check robots.txt
            robots_url = f"https://{domain}/robots.txt"
            try:
                robots_response = await self.client.get(robots_url)
                if robots_response.status_code == 200:
                    rp = RobotFileParser()
                    rp.parse(robots_response.text.split("\n"))
                    if not rp.can_fetch(settings.USER_AGENT, url):
                        logger.warning(f"robots.txt blocks scraping for {domain}")
                        return False
            except Exception:
                pass  # No robots.txt or error = assume allowed

            # 2. Check URL accessibility
            response = await self.client.get(url)
            if response.status_code != 200:
                logger.warning(f"URL not accessible: {url} (status {response.status_code})")
                return False

            # 3. Check content type
            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type:
                logger.warning(f"Not HTML content: {url}")
                return False

            # 4. Basic content check - has article-like structure
            html = response.text
            has_articles = any(tag in html.lower() for tag in ["<article", "class=\"article", "class='article"])
            has_links = html.count("<a ") > 10

            if not has_links:
                logger.warning(f"No article structure found: {url}")
                return False

            logger.info(f"✓ Validated source: {domain}")
            return True

        except httpx.TimeoutException:
            logger.warning(f"Timeout validating {domain}")
            return False
        except Exception as e:
            logger.warning(f"Validation error for {domain}: {e}")
            return False

    async def _discover_selectors(self, url: str) -> Optional[Dict[str, str]]:
        """
        Use LLM to discover CSS selectors for a news site.
        Analyzes the HTML structure to find article links, titles, and content.
        """
        if not settings.OPENROUTER_API_KEY:
            return self._get_default_selectors()

        try:
            # Fetch the page
            response = await self.client.get(url)
            if response.status_code != 200:
                return self._get_default_selectors()

            html = response.text

            # Truncate HTML for LLM (first 15000 chars should have the structure)
            html_sample = html[:15000]

            prompt = f"""Analyze this news website HTML and find the CSS selectors for scraping articles.

HTML SAMPLE (truncated):
```html
{html_sample}
```

Find CSS selectors for:
1. article_links: Links to individual articles (usually in <article> tags or news lists)
2. title: Article title selector (usually h1)
3. content: Article body text selector (usually div with paragraphs)

Return ONLY a JSON object with this exact format:
{{
  "article_links": "CSS selector for article links",
  "title": "CSS selector for title",
  "content": "CSS selector for content paragraphs"
}}

Be specific with selectors. Use classes/IDs when available.
Return ONLY the JSON object, no other text."""

            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": settings.OPENROUTER_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2,
                        "max_tokens": 300
                    }
                )

                if response.status_code != 200:
                    return self._get_default_selectors()

                result = response.json()
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

                # Parse JSON from response
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    selectors = json.loads(json_match.group())
                    # Validate required keys
                    if all(k in selectors for k in ["article_links", "title", "content"]):
                        logger.info(f"✓ Discovered selectors for {url}")
                        return selectors

        except Exception as e:
            logger.warning(f"Selector discovery error: {e}")

        return self._get_default_selectors()

    def _get_default_selectors(self) -> Dict[str, str]:
        """Return generic fallback selectors that work for many news sites."""
        return {
            "article_links": "article a, h2 a, h3 a, a[href*='/202']",
            "title": "h1",
            "content": "article p, div.article-content p, div.entry-content p, div.post-content p"
        }

    def get_discovered_sources(self) -> Dict[str, Dict]:
        """Get all auto-discovered sources."""
        return self._discovered_sources.copy()

    def clear_discovery_cache(self):
        """Clear the discovery cache."""
        self._discovered_sources.clear()
        self._discovery_attempts.clear()
        logger.info("Discovery cache cleared")

    # ==================== PERSISTENCE METHODS ====================

    async def _get_persistence(self):
        """Get or initialize persistence service"""
        if self._persistence is None:
            self._persistence = await get_source_persistence()
        return self._persistence

    async def _persist_discovered_source(
        self,
        domain: str,
        config: Dict[str, Any],
        replaces: Optional[str] = None
    ):
        """Persist a discovered source to Redis/JSON"""
        try:
            persistence = await self._get_persistence()
            await persistence.save_discovered_source(
                domain=domain,
                config={
                    "name": config.get("name", domain),
                    "tier": 2,  # Discovered sources start as tier 2
                    "category": self._infer_source_metadata(domain).get("category", "MONDE"),
                    "language": config.get("language", "unknown")
                },
                discovered_by="llm",
                replaces=replaces
            )
        except Exception as e:
            logger.error(f"Failed to persist discovered source {domain}: {e}")

    async def load_persisted_sources(self) -> Dict[str, Dict]:
        """Load all persisted sources from storage"""
        try:
            persistence = await self._get_persistence()
            all_sources = await persistence.get_all_sources()

            # Convert to discovered_sources format
            for domain, health in all_sources.items():
                if health.status in [SourceStatus.ACTIVE, SourceStatus.DISCOVERED]:
                    self._discovered_sources[domain] = {
                        "name": health.name,
                        "url": f"https://www.{domain}",
                        "selectors": self._get_default_selectors(),
                        "rate_limit": 2.0,
                        "discovered_at": health.discovered_at,
                        "auto_discovered": True,
                        "tier": health.tier,
                        "has_rss": health.has_rss,
                        "rss_urls": health.rss_urls
                    }

            logger.info(f"📥 Loaded {len(self._discovered_sources)} persisted sources")
            return self._discovered_sources

        except Exception as e:
            logger.error(f"Failed to load persisted sources: {e}")
            return {}

    async def record_scrape_result(self, domain: str, success: bool, error: str = ""):
        """Record a scrape result for health tracking"""
        try:
            persistence = await self._get_persistence()
            if success:
                await persistence.record_success(domain)
            else:
                await persistence.record_failure(domain, error)
        except Exception as e:
            logger.debug(f"Failed to record scrape result for {domain}: {e}")

    async def get_health_report(self) -> Dict[str, Any]:
        """Get a comprehensive health report of all sources"""
        try:
            persistence = await self._get_persistence()
            return await persistence.get_health_report()
        except Exception as e:
            logger.error(f"Failed to get health report: {e}")
            return {"error": str(e)}


# Singleton instance
_discovery_service: Optional[SourceDiscoveryService] = None


def get_discovery_service() -> SourceDiscoveryService:
    """Get the singleton discovery service."""
    global _discovery_service
    if _discovery_service is None:
        _discovery_service = SourceDiscoveryService()
    return _discovery_service
