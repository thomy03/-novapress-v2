"""
Wikimedia Commons Image Service for NovaPress AI v2

Searches Wikimedia Commons for editorial images of entities/places/events.
100% free, no API key required. Rate limit: 200 req/s (generous).

Replaces fal.ai image generation ($0.15/image) with free editorial photos.
"""
import re
import logging
from typing import List, Optional

import httpx

logger = logging.getLogger("novapress.wikimedia")

# Wikimedia API requires a descriptive User-Agent
USER_AGENT = "NovaPress/2.0 (novapressai.com; contact@novapressai.com)"

# Words to skip when building search queries from titles
STOP_WORDS_FR = {
    "le", "la", "les", "un", "une", "des", "de", "du", "au", "aux",
    "et", "ou", "en", "par", "pour", "avec", "dans", "sur", "sous",
    "ce", "cette", "ces", "est", "sont", "a", "ont", "qui", "que",
    "ne", "pas", "plus", "se", "sa", "son", "ses", "leur", "leurs",
    "il", "elle", "ils", "elles", "nous", "vous", "on", "tout",
    "comme", "mais", "donc", "car", "ni", "entre", "vers", "chez",
    "sans", "aussi", "très", "bien", "peut", "être", "fait", "faire",
    "dit", "selon", "après", "avant", "lors", "depuis", "the", "and",
    "for", "with", "from", "that", "this", "has", "have", "was", "are",
}

MIN_WIDTH = 800  # Minimum image width in pixels
ALLOWED_MIMES = {"image/jpeg", "image/png"}
SEARCH_TIMEOUT = 8.0  # seconds


class WikimediaImageService:
    """Search Wikimedia Commons for editorial images."""

    API_URL = "https://commons.wikimedia.org/w/api.php"

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=SEARCH_TIMEOUT,
                headers={"User-Agent": USER_AGENT},
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def search_image(self, query: str) -> Optional[str]:
        """
        Search Wikimedia Commons for an image matching the query.
        Returns a thumbnail URL (1024px wide) or None.
        """
        if not query or len(query.strip()) < 3:
            return None

        client = await self._get_client()

        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": f"File: {query}",
            "gsrlimit": 5,
            "gsrnamespace": 6,  # File namespace
            "prop": "imageinfo",
            "iiprop": "url|size|mime",
            "iiurlwidth": 1024,
            "format": "json",
        }

        try:
            resp = await client.get(self.API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, ValueError) as e:
            logger.warning(f"Wikimedia API error for query '{query}': {e}")
            return None

        pages = data.get("query", {}).get("pages", {})
        if not pages:
            return None

        # Sort by page index (most relevant first)
        sorted_pages = sorted(pages.values(), key=lambda p: p.get("index", 999))

        for page in sorted_pages:
            imageinfo = page.get("imageinfo", [])
            if not imageinfo:
                continue

            info = imageinfo[0]
            mime = info.get("mime", "")
            width = info.get("width", 0)
            thumb_url = info.get("thumburl", "")

            # Filter: JPEG/PNG only, width >= MIN_WIDTH
            if mime not in ALLOWED_MIMES:
                continue
            if width < MIN_WIDTH:
                continue
            if not thumb_url:
                continue

            logger.info(f"Wikimedia image found for '{query}': {thumb_url[:80]}...")
            return thumb_url

        return None

    async def find_best_image(
        self,
        entities: List[str],
        title: str,
        category: str,
    ) -> Optional[str]:
        """
        Strategy: try entities first (most specific), then title keywords.
        Returns the first matching image URL or None.
        """
        # 1. Try each entity
        for entity in entities[:3]:
            entity_clean = entity.strip()
            if len(entity_clean) < 3:
                continue
            url = await self.search_image(entity_clean)
            if url:
                return url

        # 2. Try title keywords (2-3 significant words)
        keywords = _extract_keywords(title)
        if keywords:
            url = await self.search_image(" ".join(keywords))
            if url:
                return url

        # 3. Try category + first entity combo
        if entities and category:
            combo = f"{entities[0]} {category.lower()}"
            url = await self.search_image(combo)
            if url:
                return url

        return None


def _extract_keywords(title: str) -> List[str]:
    """Extract 2-3 significant keywords from a title for search."""
    if not title:
        return []

    # Remove punctuation and split
    words = re.sub(r"[^\w\s]", " ", title).split()

    # Filter stop words and short words
    significant = [
        w for w in words
        if w.lower() not in STOP_WORDS_FR and len(w) > 2
    ]

    # Return the first 3 significant words
    return significant[:3]


# Singleton
_service: Optional[WikimediaImageService] = None


def get_wikimedia_service() -> WikimediaImageService:
    global _service
    if _service is None:
        _service = WikimediaImageService()
    return _service
