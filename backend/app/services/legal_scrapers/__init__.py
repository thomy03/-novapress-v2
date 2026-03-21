"""
NovaLex Legal Scrapers Package
Provides scrapers for French and EU legal sources related to data protection.
"""

from typing import List

from .base import BaseLegalScraper
from .cnil_scraper import CNILScraper
from .legifrance_scraper import LegifranceScraper
from .eurlex_scraper import EurLexScraper
from .cepd_scraper import CEPDScraper


def get_all_legal_scrapers() -> List[BaseLegalScraper]:
    """
    Return instances of all available legal scrapers.

    Returns:
        List of BaseLegalScraper instances ready to call .scrape()
    """
    return [
        CNILScraper(),
        LegifranceScraper(),
        EurLexScraper(),
        CEPDScraper(),
    ]


__all__ = [
    "BaseLegalScraper",
    "CNILScraper",
    "LegifranceScraper",
    "EurLexScraper",
    "CEPDScraper",
    "get_all_legal_scrapers",
]
