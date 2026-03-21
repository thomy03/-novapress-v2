"""
Legifrance Scraper — Scrapes French legislation related to data protection and RGPD.
Source: https://www.legifrance.gouv.fr

Uses the public Legifrance search interface. The official DILA/AIFE API
(https://api.aife.economie.gouv.fr) requires an API key obtained via PISTE;
this scraper works without credentials by querying the public search.
"""

from typing import Any, Dict, List, Optional
import re

from bs4 import BeautifulSoup
from loguru import logger

from .base import BaseLegalScraper


class LegifranceScraper(BaseLegalScraper):
    """Scraper for French legislation from Legifrance (RGPD / data protection focus)."""

    source_name = "Legifrance"
    source_url = "https://www.legifrance.gouv.fr"
    jurisdiction = "FR"
    rate_limit = 2.0  # Public service, be respectful

    # Key legal texts for data protection in France
    TARGETS = [
        {
            "name": "Loi Informatique et Libertés",
            "path": "/loda/id/JORFTEXT000000886460",
            "reference": "Loi n° 78-17",
            "category": "RGPD",
        },
        {
            "name": "RGPD - Règlement (UE) 2016/679 (version française)",
            "path": "/jorf/id/JORFTEXT000037085952",
            "reference": "Règlement (UE) 2016/679",
            "category": "RGPD",
        },
        {
            "name": "Ordonnance n° 2018-1125 (refonte Informatique et Libertés)",
            "path": "/loda/id/JORFTEXT000037800506",
            "reference": "Ordonnance n° 2018-1125",
            "category": "RGPD",
        },
        {
            "name": "Décret n° 2019-536 (application Loi Informatique et Libertés)",
            "path": "/loda/id/JORFTEXT000038528420",
            "reference": "Décret n° 2019-536",
            "category": "RGPD",
        },
    ]

    # Public search endpoint for finding recent RGPD-related texts
    SEARCH_URL = "https://www.legifrance.gouv.fr/search/all"
    SEARCH_QUERIES = [
        "protection des données personnelles",
        "RGPD",
        "cybersécurité",
    ]

    async def scrape(self) -> List[Dict[str, Any]]:
        """Scrape key legal texts and recent search results."""
        documents: List[Dict[str, Any]] = []

        # 1. Scrape known key texts
        for target in self.TARGETS:
            try:
                doc = await self._scrape_text(target)
                if doc:
                    documents.append(doc)
            except Exception as e:
                logger.warning(f"[Legifrance] Error scraping {target['name']}: {e}")

        # 2. Search for recent texts
        for query in self.SEARCH_QUERIES:
            try:
                results = await self._search_texts(query)
                documents.extend(results)
            except Exception as e:
                logger.warning(f"[Legifrance] Search error for '{query}': {e}")

        # Deduplicate by URL
        seen_urls = set()
        unique = []
        for doc in documents:
            if doc["url"] not in seen_urls:
                seen_urls.add(doc["url"])
                unique.append(doc)

        logger.info(f"[Legifrance] Scraped {len(unique)} documents total")
        return unique

    async def _scrape_text(self, target: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Scrape a specific legal text by its Legifrance path."""
        url = f"{self.source_url}{target['path']}"

        try:
            response = await self._rate_limited_get(url)
        except Exception as e:
            logger.warning(f"[Legifrance] Failed to fetch {url}: {e}")
            return None

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract the main content
        content_el = soup.select_one(
            "#content-jorf, #content-loda, .content-text, "
            "article, .main-content, #main"
        )
        content = ""
        if content_el:
            content = self._clean_html(str(content_el))
        else:
            # Fallback: grab the body text
            body = soup.select_one("main, body")
            if body:
                content = self._clean_html(str(body))

        if not content or len(content) < 50:
            logger.warning(f"[Legifrance] No content for {target['name']}")
            return None

        # Extract publication date
        date_el = soup.select_one(
            "time, .date-publication, .nor-date, "
            "[class*='date'], meta[name='date']"
        )
        date_str = ""
        if date_el:
            date_str = (
                date_el.get("datetime")
                or date_el.get("content")
                or date_el.get_text(strip=True)
            )

        # Look for PDF link
        pdf_link = soup.select_one("a[href*='.pdf'], a[href*='download']")
        pdf_url = None
        if pdf_link and pdf_link.get("href"):
            href = pdf_link["href"]
            pdf_url = href if href.startswith("http") else f"{self.source_url}{href}"

        return self._build_document(
            title=target["name"],
            url=url,
            content=content,
            published_at=self._parse_date(date_str) if date_str else None,
            doc_type="loi",
            category=target.get("category", "RGPD"),
            pdf_url=pdf_url,
            reference=target.get("reference", ""),
        )

    async def _search_texts(self, query: str) -> List[Dict[str, Any]]:
        """Search Legifrance for recent texts matching a query."""
        documents: List[Dict[str, Any]] = []

        params = {
            "tab_selection": "all",
            "searchField": "ALL",
            "query": query,
            "searchType": "ALL",
            "typePagination": "DEFAULT",
            "sortValue": "DATE_DESC",
            "pageSize": "10",
            "page": "1",
        }

        try:
            response = await self._rate_limited_get(self.SEARCH_URL, params=params)
        except Exception as e:
            logger.warning(f"[Legifrance] Search request failed: {e}")
            return documents

        soup = BeautifulSoup(response.text, "html.parser")

        # Parse search results
        results = soup.select(
            ".result-item, .search-result, .list-item, "
            "article.result, .result-content"
        )

        if not results:
            # Fallback: look for linked items
            results = soup.select("a[href*='/loda/'], a[href*='/jorf/'], a[href*='/codes/']")
            logger.debug(f"[Legifrance] Fallback found {len(results)} search links")

        for item in results[:10]:  # Limit to 10 results
            try:
                doc = self._parse_search_result(item, query)
                if doc:
                    documents.append(doc)
            except Exception as e:
                logger.warning(f"[Legifrance] Error parsing search result: {e}")

        return documents

    def _parse_search_result(self, item, query: str) -> Optional[Dict[str, Any]]:
        """Parse a single search result item."""
        # Get title and link
        if item.name == "a":
            title = item.get_text(strip=True)
            href = item.get("href", "")
        else:
            link = item.select_one("a[href]")
            if not link:
                return None
            title = link.get_text(strip=True)
            href = link.get("href", "")

        if not title or len(title) < 5:
            return None

        url = href if href.startswith("http") else f"{self.source_url}{href}"

        # Extract date if available
        date_el = item.select_one("time, .date, [class*='date']")
        date_str = ""
        if date_el:
            date_str = date_el.get("datetime") or date_el.get_text(strip=True)

        # Extract summary
        desc_el = item.select_one("p, .description, .summary, .excerpt")
        summary = desc_el.get_text(strip=True) if desc_el else ""

        # Determine doc_type from URL
        doc_type = "loi"
        if "/codes/" in url:
            doc_type = "code"
        elif "/jorf/" in url:
            doc_type = "loi"
        elif "/ceta/" in url or "/cons/" in url:
            doc_type = "decision"

        # Determine category from query
        category = "RGPD"
        if "cybersécurité" in query.lower():
            category = "CYBER"

        return self._build_document(
            title=title,
            url=url,
            content=summary or title,
            published_at=self._parse_date(date_str) if date_str else None,
            doc_type=doc_type,
            category=category,
            reference=self._extract_reference(title),
        )

    @staticmethod
    def _extract_reference(text: str) -> str:
        """Extract a French legal reference from text."""
        patterns = [
            r"(Loi\s+n[°o]\s*\d{2,4}-\d+)",
            r"(Décret\s+n[°o]\s*\d{4}-\d+)",
            r"(Ordonnance\s+n[°o]\s*\d{4}-\d+)",
            r"(Arrêté\s+du\s+\d{1,2}\s+\w+\s+\d{4})",
            r"(Règlement\s*\(UE\)\s*\d{4}/\d+)",
            r"(Article\s+L?\d+[-\d]*)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""
