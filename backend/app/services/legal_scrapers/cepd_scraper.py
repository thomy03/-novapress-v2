"""
CEPD / EDPB Scraper — Scrapes guidelines, recommendations, and opinions from the
European Data Protection Board.
Source: https://www.edpb.europa.eu
"""

from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup
from loguru import logger

from .base import BaseLegalScraper


class CEPDScraper(BaseLegalScraper):
    """Scraper for EDPB (European Data Protection Board) guidelines and recommendations."""

    source_name = "EDPB"
    source_url = "https://www.edpb.europa.eu"
    jurisdiction = "EU"
    rate_limit = 2.0

    GUIDELINES_URL = (
        "https://www.edpb.europa.eu/our-work-tools/general-guidance/"
        "guidelines-recommendations-best-practices_en"
    )
    DECISIONS_URL = (
        "https://www.edpb.europa.eu/our-work-tools/consistency-findings/"
        "binding-decisions_en"
    )
    OPINIONS_URL = (
        "https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-boardart64_en"
    )

    async def scrape(self) -> List[Dict[str, Any]]:
        """Scrape EDPB guidelines, decisions, and opinions."""
        documents: List[Dict[str, Any]] = []

        # Scrape each section
        sections = [
            (self.GUIDELINES_URL, "guideline", self._parse_guidelines_page),
            (self.DECISIONS_URL, "decision", self._parse_listing_page),
            (self.OPINIONS_URL, "opinion", self._parse_listing_page),
        ]

        for url, doc_type, parser in sections:
            try:
                response = await self._rate_limited_get(url)
                soup = BeautifulSoup(response.text, "html.parser")
                results = parser(soup, doc_type)
                documents.extend(results)
                logger.info(f"[EDPB] {doc_type}: found {len(results)} items")
            except Exception as e:
                logger.error(f"[EDPB] Error scraping {doc_type} from {url}: {e}")

        # Deduplicate
        seen_urls = set()
        unique = []
        for doc in documents:
            if doc["url"] not in seen_urls:
                seen_urls.add(doc["url"])
                unique.append(doc)

        logger.info(f"[EDPB] Scraped {len(unique)} documents total")
        return unique

    def _parse_guidelines_page(
        self, soup: BeautifulSoup, doc_type: str
    ) -> List[Dict[str, Any]]:
        """Parse the guidelines/recommendations listing page."""
        documents: List[Dict[str, Any]] = []

        # EDPB pages use views for listing content
        items = soup.select(
            ".views-row, .node--type-document, article, "
            ".view-content .item-list li, .field-content"
        )

        if not items:
            # Broader fallback
            items = soup.select("table tbody tr, .listing-item, .c-listing__item")

        logger.debug(f"[EDPB] Guidelines page: {len(items)} items found")

        for item in items:
            try:
                doc = self._parse_edpb_item(item, doc_type)
                if doc:
                    documents.append(doc)
            except Exception as e:
                logger.warning(f"[EDPB] Error parsing guideline item: {e}")

        # If structured parsing yielded nothing, try link extraction
        if not documents:
            documents = self._extract_document_links(soup, doc_type)

        return documents

    def _parse_listing_page(
        self, soup: BeautifulSoup, doc_type: str
    ) -> List[Dict[str, Any]]:
        """Parse a generic EDPB listing page (decisions, opinions)."""
        documents: List[Dict[str, Any]] = []

        items = soup.select(
            ".views-row, article, .node--type-document, "
            "table tbody tr, .view-content li"
        )

        logger.debug(f"[EDPB] Listing page ({doc_type}): {len(items)} items found")

        for item in items:
            try:
                doc = self._parse_edpb_item(item, doc_type)
                if doc:
                    documents.append(doc)
            except Exception as e:
                logger.warning(f"[EDPB] Error parsing {doc_type} item: {e}")

        if not documents:
            documents = self._extract_document_links(soup, doc_type)

        return documents

    def _parse_edpb_item(self, item, doc_type: str) -> Optional[Dict[str, Any]]:
        """Parse a single EDPB document item."""
        # Title and link
        title_el = item.select_one(
            "h2 a, h3 a, .field-title a, .views-field-title a, "
            "td:first-child a, a[href*='/our-work-tools/']"
        )
        if not title_el:
            title_el = item.select_one("a[href]")

        if not title_el:
            return None

        title = title_el.get_text(strip=True)
        if not title or len(title) < 5:
            return None

        href = title_el.get("href", "")
        url = href if href.startswith("http") else f"{self.source_url}{href}"

        # Date
        date_el = item.select_one(
            "time, .date, .field-date, .views-field-created, "
            "td.date, span[class*='date']"
        )
        date_str = ""
        if date_el:
            date_str = date_el.get("datetime") or date_el.get_text(strip=True)

        published_at = self._parse_date(date_str) if date_str else None

        # Summary
        desc_el = item.select_one(
            ".field-body, .field-summary, p, .description, "
            ".views-field-body, td:nth-child(2)"
        )
        summary = desc_el.get_text(strip=True) if desc_el else ""

        # PDF link
        pdf_link = item.select_one("a[href$='.pdf'], a[href*='download']")
        pdf_url = None
        if pdf_link and pdf_link.get("href"):
            h = pdf_link["href"]
            pdf_url = h if h.startswith("http") else f"{self.source_url}{h}"

        # Extract reference
        reference = self._extract_reference(title)

        # Determine specific category
        category = self._categorize(title + " " + summary)

        return self._build_document(
            title=title,
            url=url,
            content=summary or title,
            published_at=published_at,
            doc_type=doc_type,
            category=category,
            pdf_url=pdf_url,
            reference=reference,
            summary=summary or None,
        )

    def _extract_document_links(
        self, soup: BeautifulSoup, doc_type: str
    ) -> List[Dict[str, Any]]:
        """Fallback: extract document links from the page."""
        documents: List[Dict[str, Any]] = []
        seen_urls = set()

        # Look for links to EDPB documents
        relevant_patterns = [
            "/our-work-tools/",
            "/guidelines/",
            "/recommendations/",
            "/opinion",
            "/binding-decision",
        ]

        for link in soup.select("a[href]"):
            href = link.get("href", "")
            text = link.get_text(strip=True)

            if not text or len(text) < 10:
                continue

            if not any(pat in href.lower() for pat in relevant_patterns):
                continue

            url = href if href.startswith("http") else f"{self.source_url}{href}"
            if url in seen_urls:
                continue
            seen_urls.add(url)

            documents.append(self._build_document(
                title=text,
                url=url,
                content=text,
                doc_type=doc_type,
                category=self._categorize(text),
                reference=self._extract_reference(text),
            ))

        logger.debug(f"[EDPB] Fallback extracted {len(documents)} links for {doc_type}")
        return documents

    @staticmethod
    def _extract_reference(text: str) -> str:
        """Extract an EDPB reference from text."""
        import re

        patterns = [
            r"(Guidelines?\s+\d+/\d{4})",
            r"(Recommendation\s+\d+/\d{4})",
            r"(Opinion\s+\d+/\d{4})",
            r"(Binding\s+Decision\s+\d+/\d{4})",
            r"(\d+/\d{4})",  # Generic number/year
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""

    @staticmethod
    def _categorize(text: str) -> str:
        """Determine the category from document text."""
        text_lower = text.lower()
        if any(kw in text_lower for kw in [
            "gdpr", "rgpd", "data protection", "protection des données",
            "consent", "consentement", "dpo", "data breach",
        ]):
            return "RGPD"
        if any(kw in text_lower for kw in [
            "cybersecurity", "cybersécurité", "nis", "security",
        ]):
            return "CYBER"
        if any(kw in text_lower for kw in [
            "artificial intelligence", "intelligence artificielle", "ai act",
        ]):
            return "IA"
        if any(kw in text_lower for kw in [
            "children", "enfants", "minor", "mineur", "age verification",
        ]):
            return "MINEURS"
        return "RGPD"  # Default for EDPB
