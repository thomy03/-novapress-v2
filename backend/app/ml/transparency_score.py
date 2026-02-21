"""
Transparency Score Calculator for NovaPress AI v2

Calculates a 0-100 score measuring how transparent and well-sourced a synthesis is.
Breakdown:
  - Source diversity (30%): Number of unique sources
  - Language diversity (20%): Number of languages covered
  - Contradiction detection (20%): Whether contradictions were found and disclosed
  - Fact density (15%): Ratio of factual claims to opinions
  - Geographic coverage (15%): Diversity of source countries/regions
"""

import logging
from typing import Any, Dict, List
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Domain -> language mapping for known news sources
DOMAIN_LANGUAGE_MAP: Dict[str, str] = {
    "lemonde.fr": "fr", "lefigaro.fr": "fr", "liberation.fr": "fr",
    "lesechos.fr": "fr", "leparisien.fr": "fr", "francetvinfo.fr": "fr",
    "lequipe.fr": "fr", "frandroid.com": "fr",
    "cnn.com": "en", "nytimes.com": "en", "washingtonpost.com": "en",
    "reuters.com": "en", "bloomberg.com": "en", "theguardian.com": "en",
    "bbc.co.uk": "en", "bbc.com": "en", "ft.com": "en",
    "techcrunch.com": "en", "theverge.com": "en", "wired.com": "en",
    "espn.com": "en", "sciencedaily.com": "en",
    "smh.com.au": "en", "abc.net.au": "en",
    "timesofindia.indiatimes.com": "en", "aljazeera.com": "en",
    "spiegel.de": "de", "bild.de": "de", "dw.com": "de",
    "elpais.com": "es", "elmundo.es": "es", "marca.com": "es",
    "eluniversal.com.mx": "es",
    "corriere.it": "it", "repubblica.it": "it",
}

# Domain -> region mapping
DOMAIN_REGION_MAP: Dict[str, str] = {
    "lemonde.fr": "europe-west", "lefigaro.fr": "europe-west",
    "liberation.fr": "europe-west", "lesechos.fr": "europe-west",
    "leparisien.fr": "europe-west", "francetvinfo.fr": "europe-west",
    "lequipe.fr": "europe-west", "frandroid.com": "europe-west",
    "cnn.com": "north-america", "nytimes.com": "north-america",
    "washingtonpost.com": "north-america", "bloomberg.com": "north-america",
    "reuters.com": "international", "theguardian.com": "europe-west",
    "bbc.co.uk": "europe-west", "bbc.com": "europe-west",
    "ft.com": "europe-west", "techcrunch.com": "north-america",
    "theverge.com": "north-america", "wired.com": "north-america",
    "espn.com": "north-america", "sciencedaily.com": "north-america",
    "spiegel.de": "europe-central", "bild.de": "europe-central",
    "dw.com": "europe-central",
    "elpais.com": "europe-south", "elmundo.es": "europe-south",
    "marca.com": "europe-south", "eluniversal.com.mx": "latin-america",
    "corriere.it": "europe-south", "repubblica.it": "europe-south",
    "smh.com.au": "oceania", "abc.net.au": "oceania",
    "timesofindia.indiatimes.com": "south-asia",
    "aljazeera.com": "middle-east",
}


class TransparencyScorer:
    """Calculates transparency scores for syntheses."""

    def calculate(
        self,
        synthesis: Dict[str, Any],
        articles: List[Dict[str, Any]],
        rag_analysis: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Calculate the transparency score for a synthesis.

        Args:
            synthesis: The synthesis dict (with source_articles, etc.)
            articles: The raw articles used for this synthesis
            rag_analysis: Optional dict with contradictions/fact_density from Advanced RAG

        Returns:
            Dict with score (0-100), breakdown, and label
        """
        source_score = self._source_diversity_score(synthesis, articles)
        language_score = self._language_diversity_score(articles)
        contradiction_score = self._contradiction_score(synthesis, rag_analysis)
        fact_score = self._fact_density_score(synthesis, rag_analysis)
        geo_score = self._geo_coverage_score(articles)

        total = (
            source_score * 0.30
            + language_score * 0.20
            + contradiction_score * 0.20
            + fact_score * 0.15
            + geo_score * 0.15
        )

        score = round(total * 100)
        score = max(0, min(100, score))

        if score >= 80:
            label = "Excellent"
        elif score >= 60:
            label = "Bon"
        elif score >= 40:
            label = "Moyen"
        else:
            label = "Faible"

        return {
            "score": score,
            "label": label,
            "breakdown": {
                "source_diversity": {
                    "score": round(source_score * 100),
                    "weight": 30,
                    "detail": f"{self._count_unique_sources(synthesis, articles)} sources uniques",
                },
                "language_diversity": {
                    "score": round(language_score * 100),
                    "weight": 20,
                    "detail": f"{len(self._get_languages(articles))} langues",
                },
                "contradictions": {
                    "score": round(contradiction_score * 100),
                    "weight": 20,
                    "detail": self._contradiction_detail(synthesis, rag_analysis),
                },
                "fact_density": {
                    "score": round(fact_score * 100),
                    "weight": 15,
                    "detail": "Ratio faits/opinions",
                },
                "geo_coverage": {
                    "score": round(geo_score * 100),
                    "weight": 15,
                    "detail": f"{len(self._get_regions(articles))} regions",
                },
            },
        }

    def _count_unique_sources(
        self, synthesis: Dict[str, Any], articles: List[Dict[str, Any]]
    ) -> int:
        sources = set()
        for sa in synthesis.get("source_articles", []):
            name = sa.get("name", "")
            if name:
                sources.add(name.lower())
        for a in articles:
            name = a.get("source_name", "") or a.get("source_domain", "")
            if name:
                sources.add(name.lower())
        return len(sources) or 1

    def _source_diversity_score(
        self, synthesis: Dict[str, Any], articles: List[Dict[str, Any]]
    ) -> float:
        count = self._count_unique_sources(synthesis, articles)
        # 1 source = 0.1, 3 sources = 0.5, 5+ = 0.8, 8+ = 1.0
        if count >= 8:
            return 1.0
        if count >= 5:
            return 0.8
        if count >= 3:
            return 0.5
        if count >= 2:
            return 0.3
        return 0.1

    def _get_languages(self, articles: List[Dict[str, Any]]) -> set:
        languages = set()
        for a in articles:
            lang = a.get("language", "")
            if lang:
                languages.add(lang[:2].lower())
                continue
            domain = self._extract_domain(a)
            if domain and domain in DOMAIN_LANGUAGE_MAP:
                languages.add(DOMAIN_LANGUAGE_MAP[domain])
        return languages or {"fr"}

    def _language_diversity_score(self, articles: List[Dict[str, Any]]) -> float:
        langs = self._get_languages(articles)
        count = len(langs)
        if count >= 4:
            return 1.0
        if count >= 3:
            return 0.8
        if count >= 2:
            return 0.5
        return 0.2

    def _contradiction_score(
        self,
        synthesis: Dict[str, Any],
        rag_analysis: Dict[str, Any] | None,
    ) -> float:
        contradictions_count = 0
        if rag_analysis:
            contradictions_count = rag_analysis.get("contradictions_count", 0)
        else:
            contradictions_count = synthesis.get("contradictions_count", 0)

        has_contradictions = synthesis.get("has_contradictions", False)

        # Having contradictions detected AND disclosed = higher transparency
        if contradictions_count > 0 and has_contradictions:
            return 0.9  # Contradictions found and disclosed
        if contradictions_count > 0:
            return 0.7  # Found but maybe not prominently disclosed
        # No contradictions: neutral - could mean agreement or insufficient analysis
        return 0.5

    def _contradiction_detail(
        self,
        synthesis: Dict[str, Any],
        rag_analysis: Dict[str, Any] | None,
    ) -> str:
        count = 0
        if rag_analysis:
            count = rag_analysis.get("contradictions_count", 0)
        else:
            count = synthesis.get("contradictions_count", 0)
        if count > 0:
            return f"{count} contradiction(s) detectee(s)"
        return "Pas de contradictions detectees"

    def _fact_density_score(
        self,
        synthesis: Dict[str, Any],
        rag_analysis: Dict[str, Any] | None,
    ) -> float:
        if rag_analysis and "fact_density" in rag_analysis:
            return float(rag_analysis["fact_density"])
        # Estimate from synthesis content
        text = synthesis.get("summary", "") or synthesis.get("body", "")
        if not text:
            return 0.3
        # Simple heuristic: count numbers, dates, quotes
        fact_indicators = 0
        for char in text:
            if char.isdigit():
                fact_indicators += 1
        # Normalize by text length
        density = min(1.0, fact_indicators / max(len(text) * 0.02, 1))
        return max(0.2, density)

    def _get_regions(self, articles: List[Dict[str, Any]]) -> set:
        regions = set()
        for a in articles:
            domain = self._extract_domain(a)
            if domain and domain in DOMAIN_REGION_MAP:
                regions.add(DOMAIN_REGION_MAP[domain])
        return regions or {"unknown"}

    def _geo_coverage_score(self, articles: List[Dict[str, Any]]) -> float:
        regions = self._get_regions(articles)
        count = len(regions)
        if "unknown" in regions and count == 1:
            return 0.2
        if count >= 4:
            return 1.0
        if count >= 3:
            return 0.8
        if count >= 2:
            return 0.5
        return 0.3

    def _extract_domain(self, article: Dict[str, Any]) -> str:
        url = article.get("url", "") or article.get("source_url", "")
        domain = article.get("source_domain", "")
        if domain:
            return domain.lower().replace("www.", "")
        if url:
            try:
                parsed = urlparse(url)
                return parsed.netloc.lower().replace("www.", "")
            except (ValueError, AttributeError):
                pass
        return ""


# Singleton instance
transparency_scorer = TransparencyScorer()
