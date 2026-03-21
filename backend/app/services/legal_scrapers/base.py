"""
Base class for all legal scrapers in the NovaLex pipeline.
Provides shared HTTP client, rate limiting, HTML cleaning, and date parsing.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from datetime import datetime
import asyncio
import re

import httpx
from bs4 import BeautifulSoup
from loguru import logger


class BaseLegalScraper(ABC):
    """Abstract base class for legal document scrapers."""

    source_name: str = ""
    source_url: str = ""
    jurisdiction: str = ""  # "FR", "EU"
    rate_limit: float = 1.0  # seconds between requests

    _USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    )

    def __init__(self):
        self._last_request_time: float = 0.0
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the shared async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                headers={
                    "User-Agent": self._USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
                },
                timeout=httpx.Timeout(30.0, connect=10.0),
                follow_redirects=True,
                verify=True,
            )
        return self._client

    async def _rate_limited_get(self, url: str, **kwargs) -> httpx.Response:
        """Perform a GET request with rate limiting."""
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_time
        if elapsed < self.rate_limit:
            await asyncio.sleep(self.rate_limit - elapsed)

        client = await self._get_client()
        logger.debug(f"[{self.source_name}] GET {url}")
        response = await client.get(url, **kwargs)
        self._last_request_time = asyncio.get_event_loop().time()
        response.raise_for_status()
        return response

    async def _rate_limited_post(self, url: str, **kwargs) -> httpx.Response:
        """Perform a POST request with rate limiting."""
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_time
        if elapsed < self.rate_limit:
            await asyncio.sleep(self.rate_limit - elapsed)

        client = await self._get_client()
        logger.debug(f"[{self.source_name}] POST {url}")
        response = await client.post(url, **kwargs)
        self._last_request_time = asyncio.get_event_loop().time()
        response.raise_for_status()
        return response

    async def close(self):
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    @abstractmethod
    async def scrape(self) -> List[Dict[str, Any]]:
        """
        Scrape legal documents from the source.

        Returns a list of dicts with standardized fields:
            title, url, source_name, source_domain, content, summary,
            published_at, doc_type, jurisdiction, category, pdf_url,
            reference, scraped_at
        """
        ...

    # ---- Shared helpers ----

    @staticmethod
    def _clean_html(html: str) -> str:
        """Strip HTML tags and normalize whitespace."""
        if not html:
            return ""
        soup = BeautifulSoup(html, "html.parser")
        # Remove script and style elements
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text(separator=" ")
        # Collapse whitespace
        text = re.sub(r"\s+", " ", text).strip()
        return text

    @staticmethod
    def _parse_date(date_str: str) -> Optional[str]:
        """
        Try to parse a date string into ISO 8601 format.
        Handles common French and ISO patterns.
        Returns None if parsing fails.
        """
        if not date_str:
            return None

        date_str = date_str.strip()

        # French month names
        FR_MONTHS = {
            "janvier": "01", "février": "02", "mars": "03", "avril": "04",
            "mai": "05", "juin": "06", "juillet": "07", "août": "08",
            "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12",
        }

        # Try ISO format first
        for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ",
                     "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                continue

        # Try French long format: "21 décembre 2025"
        match = re.match(
            r"(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|"
            r"septembre|octobre|novembre|décembre)\s+(\d{4})",
            date_str.lower(),
        )
        if match:
            day, month_name, year = match.groups()
            month = FR_MONTHS.get(month_name)
            if month:
                try:
                    dt = datetime(int(year), int(month), int(day))
                    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                except ValueError:
                    pass

        logger.warning(f"Could not parse date: {date_str!r}")
        return None

    def _build_document(
        self,
        *,
        title: str,
        url: str,
        content: str,
        published_at: Optional[str] = None,
        doc_type: str = "",
        category: str = "RGPD",
        pdf_url: Optional[str] = None,
        reference: Optional[str] = None,
        summary: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build a standardized document dict."""
        clean_content = content.strip() if content else ""
        return {
            "title": title.strip() if title else "",
            "url": url.strip() if url else "",
            "source_name": self.source_name,
            "source_domain": self.source_url.split("//")[-1].split("/")[0] if self.source_url else "",
            "content": clean_content,
            "summary": (summary or clean_content)[:500],
            "published_at": published_at or "",
            "doc_type": doc_type,
            "jurisdiction": self.jurisdiction,
            "category": category,
            "pdf_url": pdf_url,
            "reference": reference,
            "scraped_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
