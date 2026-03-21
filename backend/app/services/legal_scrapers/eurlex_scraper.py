"""
EUR-Lex Scraper — Scrapes EU regulations, directives, and case law related to data protection.
Source: https://eur-lex.europa.eu

Uses the EUR-Lex public search interface and attempts the REST API
(https://eur-lex.europa.eu/eurlex-ws/) when available.
"""

from typing import Any, Dict, List, Optional
import re

from bs4 import BeautifulSoup
from loguru import logger

from .base import BaseLegalScraper


class EurLexScraper(BaseLegalScraper):
    """Scraper for EU legal documents from EUR-Lex (GDPR / data protection focus)."""

    source_name = "EUR-Lex"
    source_url = "https://eur-lex.europa.eu"
    jurisdiction = "EU"
    rate_limit = 2.0

    # Key GDPR / data protection documents (CELEX identifiers)
    KEY_DOCUMENTS = [
        {
            "celex": "32016R0679",
            "title": "RGPD - Règlement (UE) 2016/679",
            "doc_type": "regulation",
            "reference": "Règlement (UE) 2016/679",
        },
        {
            "celex": "32002L0058",
            "title": "Directive ePrivacy 2002/58/CE",
            "doc_type": "directive",
            "reference": "Directive 2002/58/CE",
        },
        {
            "celex": "32016L0680",
            "title": "Directive (UE) 2016/680 - Police/Justice",
            "doc_type": "directive",
            "reference": "Directive (UE) 2016/680",
        },
        {
            "celex": "32022R0868",
            "title": "Data Governance Act - Règlement (UE) 2022/868",
            "doc_type": "regulation",
            "reference": "Règlement (UE) 2022/868",
        },
        {
            "celex": "32023R2854",
            "title": "Data Act - Règlement (UE) 2023/2854",
            "doc_type": "regulation",
            "reference": "Règlement (UE) 2023/2854",
        },
        {
            "celex": "32024R1689",
            "title": "AI Act - Règlement (UE) 2024/1689",
            "doc_type": "regulation",
            "reference": "Règlement (UE) 2024/1689",
        },
    ]

    SEARCH_URL = "https://eur-lex.europa.eu/search.html"
    SEARCH_QUERIES = [
        "protection données personnelles RGPD",
        "data protection GDPR",
        "cybersecurity NIS2",
    ]

    async def scrape(self) -> List[Dict[str, Any]]:
        """Scrape key EU legal texts and search results."""
        documents: List[Dict[str, Any]] = []

        # 1. Scrape key documents
        for target in self.KEY_DOCUMENTS:
            try:
                doc = await self._scrape_celex(target)
                if doc:
                    documents.append(doc)
            except Exception as e:
                logger.warning(f"[EUR-Lex] Error scraping {target['celex']}: {e}")

        # 2. Search for recent documents
        for query in self.SEARCH_QUERIES:
            try:
                results = await self._search_documents(query)
                documents.extend(results)
            except Exception as e:
                logger.warning(f"[EUR-Lex] Search error for '{query}': {e}")

        # Deduplicate by URL
        seen_urls = set()
        unique = []
        for doc in documents:
            if doc["url"] not in seen_urls:
                seen_urls.add(doc["url"])
                unique.append(doc)

        logger.info(f"[EUR-Lex] Scraped {len(unique)} documents total")
        return unique

    async def _scrape_celex(self, target: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Scrape a specific document by its CELEX number."""
        celex = target["celex"]
        # EUR-Lex legal content URL (French version)
        url = f"{self.source_url}/legal-content/FR/TXT/?uri=CELEX:{celex}"

        try:
            response = await self._rate_limited_get(url)
        except Exception as e:
            logger.warning(f"[EUR-Lex] Failed to fetch {celex}: {e}")
            return None

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract main content
        content_el = soup.select_one(
            "#document1, .eli-main-title + div, "
            "#TexteOnly, .texte, .eli-container, article"
        )
        content = ""
        if content_el:
            content = self._clean_html(str(content_el))
        else:
            main = soup.select_one("main, #mainContent, body")
            if main:
                content = self._clean_html(str(main))

        if not content or len(content) < 50:
            # Still return with title even without full content
            content = target["title"]
            logger.debug(f"[EUR-Lex] Minimal content for {celex}")

        # Extract date
        date_el = soup.select_one(
            "time, .eli-date, [property='cdm:date_document'], "
            "meta[name='date'], .doc-date"
        )
        date_str = ""
        if date_el:
            date_str = (
                date_el.get("datetime")
                or date_el.get("content")
                or date_el.get_text(strip=True)
            )

        # PDF link
        pdf_url = f"{self.source_url}/legal-content/FR/TXT/PDF/?uri=CELEX:{celex}"

        # Determine category
        category = "RGPD"
        title_lower = target["title"].lower()
        if "cyber" in title_lower or "nis" in title_lower:
            category = "CYBER"
        elif "ai act" in title_lower or "intelligence artificielle" in title_lower:
            category = "IA"
        elif "data act" in title_lower or "data governance" in title_lower:
            category = "DATA"

        return self._build_document(
            title=target["title"],
            url=url,
            content=content,
            published_at=self._parse_date(date_str) if date_str else None,
            doc_type=target.get("doc_type", "regulation"),
            category=category,
            pdf_url=pdf_url,
            reference=target.get("reference", celex),
        )

    async def _search_documents(self, query: str) -> List[Dict[str, Any]]:
        """Search EUR-Lex for recent documents matching a query."""
        documents: List[Dict[str, Any]] = []

        params = {
            "scope": "EURLEX",
            "text": query,
            "lang": "fr",
            "type": "quick",
            "qid": "",
            "page": "1",
        }

        try:
            response = await self._rate_limited_get(self.SEARCH_URL, params=params)
        except Exception as e:
            logger.warning(f"[EUR-Lex] Search request failed: {e}")
            return documents

        soup = BeautifulSoup(response.text, "html.parser")

        # Parse search results
        results = soup.select(
            ".SearchResult, .result-item, .EurlexContent, "
            "article, .list-item"
        )

        if not results:
            # Fallback: look for CELEX links
            results = soup.select("a[href*='CELEX']")
            logger.debug(f"[EUR-Lex] Fallback found {len(results)} CELEX links")

        for item in results[:10]:
            try:
                doc = self._parse_search_result(item, query)
                if doc:
                    documents.append(doc)
            except Exception as e:
                logger.warning(f"[EUR-Lex] Error parsing search result: {e}")

        return documents

    def _parse_search_result(self, item, query: str) -> Optional[Dict[str, Any]]:
        """Parse a single search result."""
        # Extract title and link
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

        # Extract date
        date_el = item.select_one("time, .date, [class*='date']")
        date_str = ""
        if date_el:
            date_str = date_el.get("datetime") or date_el.get_text(strip=True)

        # Extract summary
        desc_el = item.select_one("p, .summary, .description, .excerpt")
        summary = desc_el.get_text(strip=True) if desc_el else ""

        # Determine doc_type from title/URL
        doc_type = self._infer_doc_type(title, url)

        # Determine category
        category = "RGPD"
        text_lower = (title + " " + query).lower()
        if "cyber" in text_lower or "nis" in text_lower:
            category = "CYBER"
        elif "intelligence artificielle" in text_lower or "ai act" in text_lower:
            category = "IA"

        # Extract CELEX reference
        celex_match = re.search(r"CELEX[:/](\d{5}[A-Z]\d{4})", url)
        reference = celex_match.group(1) if celex_match else self._extract_reference(title)

        return self._build_document(
            title=title,
            url=url,
            content=summary or title,
            published_at=self._parse_date(date_str) if date_str else None,
            doc_type=doc_type,
            category=category,
            reference=reference,
        )

    @staticmethod
    def _infer_doc_type(title: str, url: str) -> str:
        """Infer the document type from its title or URL."""
        text = (title + " " + url).lower()
        if "règlement" in text or "regulation" in text:
            return "regulation"
        if "directive" in text:
            return "directive"
        if "décision" in text or "decision" in text:
            return "decision"
        if "avis" in text or "opinion" in text:
            return "opinion"
        if "recommandation" in text or "recommendation" in text:
            return "guideline"
        return "regulation"

    @staticmethod
    def _extract_reference(text: str) -> str:
        """Extract an EU legal reference."""
        patterns = [
            r"(Règlement\s*\(UE\)\s*\d{4}/\d+)",
            r"(Directive\s*\(UE\)\s*\d{4}/\d+)",
            r"(Directive\s+\d{4}/\d+/CE)",
            r"(Décision\s*\(UE\)\s*\d{4}/\d+)",
            r"(\d{5}[A-Z]\d{4})",  # CELEX number
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""
