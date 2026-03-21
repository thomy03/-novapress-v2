"""
CNIL Scraper — Scrapes sanctions and decisions from the French data protection authority.
Source: https://www.cnil.fr/fr/les-sanctions
"""

from typing import Any, Dict, List
import re

from bs4 import BeautifulSoup
from loguru import logger

from .base import BaseLegalScraper


class CNILScraper(BaseLegalScraper):
    """Scraper for CNIL sanctions and deliberations."""

    source_name = "CNIL"
    source_url = "https://www.cnil.fr"
    jurisdiction = "FR"
    rate_limit = 2.0  # Be polite to public institutions

    SANCTIONS_URL = "https://www.cnil.fr/fr/les-sanctions"
    DELIBERATIONS_URL = "https://www.cnil.fr/fr/recherche-deliberations"

    async def scrape(self) -> List[Dict[str, Any]]:
        """Scrape CNIL sanctions page."""
        documents: List[Dict[str, Any]] = []

        try:
            documents.extend(await self._scrape_sanctions())
        except Exception as e:
            logger.error(f"[CNIL] Error scraping sanctions: {e}")

        logger.info(f"[CNIL] Scraped {len(documents)} documents total")
        return documents

    async def _scrape_sanctions(self) -> List[Dict[str, Any]]:
        """Scrape the sanctions listing page."""
        documents: List[Dict[str, Any]] = []

        try:
            response = await self._rate_limited_get(self.SANCTIONS_URL)
            soup = BeautifulSoup(response.text, "html.parser")

            # CNIL sanctions page uses article/card elements for each decision
            # Look for common listing patterns
            items = soup.select(
                "article, .node--type-sanction, .views-row, "
                ".sanction-item, .list-item, .c-card"
            )

            if not items:
                # Fallback: try to find any linked decision blocks
                items = soup.select(".field-content, .views-field")
                logger.debug(f"[CNIL] Fallback selector found {len(items)} items")

            logger.info(f"[CNIL] Found {len(items)} sanction items on page")

            for item in items:
                try:
                    doc = self._parse_sanction_item(item)
                    if doc and doc.get("title"):
                        documents.append(doc)
                except Exception as e:
                    logger.warning(f"[CNIL] Error parsing sanction item: {e}")
                    continue

            # If structured parsing failed, try extracting from links
            if not documents:
                documents = self._extract_from_links(soup)

        except Exception as e:
            logger.error(f"[CNIL] Failed to fetch sanctions page: {e}")

        return documents

    def _parse_sanction_item(self, item) -> Dict[str, Any]:
        """Parse a single sanction item from the listing."""
        # Extract title from heading or first link
        title_el = item.select_one("h2, h3, h4, .field-title, a[href*='sanction']")
        if not title_el:
            title_el = item.select_one("a")

        if not title_el:
            return {}

        title = title_el.get_text(strip=True)
        if not title or len(title) < 5:
            return {}

        # Extract URL
        link = title_el if title_el.name == "a" else title_el.select_one("a")
        url = ""
        if link and link.get("href"):
            href = link["href"]
            url = href if href.startswith("http") else f"{self.source_url}{href}"

        # Extract date
        date_el = item.select_one(
            "time, .date, .field-date, .views-field-created, "
            ".c-card__date, span[class*='date']"
        )
        date_str = ""
        if date_el:
            date_str = date_el.get("datetime") or date_el.get_text(strip=True)

        published_at = self._parse_date(date_str) if date_str else None

        # Extract summary/description
        desc_el = item.select_one(
            ".field-body, .field-summary, .views-field-body, "
            ".c-card__body, p, .teaser"
        )
        summary = desc_el.get_text(strip=True) if desc_el else ""

        # Extract sanction amount from title or summary
        sanction_amount = self._extract_amount(title + " " + summary)

        # Look for PDF link
        pdf_link = item.select_one("a[href$='.pdf']")
        pdf_url = None
        if pdf_link and pdf_link.get("href"):
            href = pdf_link["href"]
            pdf_url = href if href.startswith("http") else f"{self.source_url}{href}"

        # Extract reference number
        reference = self._extract_reference(title + " " + summary)

        content = summary or title
        if sanction_amount:
            content += f"\nMontant de la sanction : {sanction_amount}"

        return self._build_document(
            title=title,
            url=url,
            content=content,
            published_at=published_at,
            doc_type="decision",
            category="RGPD",
            pdf_url=pdf_url,
            reference=reference,
            summary=summary or None,
        )

    def _extract_from_links(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Fallback: extract decisions from any relevant links on the page."""
        documents: List[Dict[str, Any]] = []
        seen_urls = set()

        for link in soup.select("a[href]"):
            href = link.get("href", "")
            text = link.get_text(strip=True)

            # Filter for sanction/deliberation links
            if not any(kw in href.lower() for kw in
                       ["sanction", "deliberation", "decision", "mise-en-demeure"]):
                continue

            if not text or len(text) < 10:
                continue

            url = href if href.startswith("http") else f"{self.source_url}{href}"
            if url in seen_urls:
                continue
            seen_urls.add(url)

            documents.append(self._build_document(
                title=text,
                url=url,
                content=text,
                doc_type="decision",
                category="RGPD",
                reference=self._extract_reference(text),
            ))

        logger.debug(f"[CNIL] Fallback extracted {len(documents)} links")
        return documents

    @staticmethod
    def _extract_amount(text: str) -> str:
        """Extract a sanction amount from text (e.g., '150 000 euros')."""
        patterns = [
            r"(\d[\d\s]*(?:,\d+)?\s*(?:millions?\s+d[e\']?\s*)?euros?)",
            r"(\d[\d\s]*(?:,\d+)?\s*€)",
            r"(\d[\d\s]*(?:,\d+)?\s*EUR)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""

    @staticmethod
    def _extract_reference(text: str) -> str:
        """Extract a CNIL reference number (e.g., SAN-2024-001, MED-2024-001)."""
        patterns = [
            r"(SAN-\d{4}-\d+)",
            r"(MED-\d{4}-\d+)",
            r"(CNIL-\d{4}-\d+)",
            r"(Délibération\s+n[°o]\s*\d{4}-\d+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""
