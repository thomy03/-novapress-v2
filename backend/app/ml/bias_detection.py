"""
Bias Detection Module for NovaPress AI
Analyzes source political bias and calculates synthesis balance scores.
Inspired by Ground News and AllSides methodology.
"""

import json
import os
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from urllib.parse import urlparse
from loguru import logger


@dataclass
class SourceBias:
    """Bias information for a single source"""
    name: str
    domain: str
    political_bias: float  # -2 (far left) to +2 (far right)
    reliability: float     # 1 (very low) to 5 (very high)
    country: str
    source_type: str
    tags: List[str]

    @property
    def bias_label(self) -> str:
        """Human-readable bias label"""
        if self.political_bias <= -1.5:
            return "Far Left"
        elif self.political_bias <= -0.5:
            return "Left"
        elif self.political_bias < 0.5:
            return "Center"
        elif self.political_bias < 1.5:
            return "Right"
        else:
            return "Far Right"

    @property
    def bias_code(self) -> str:
        """Short code for UI display"""
        if self.political_bias <= -1.5:
            return "FL"
        elif self.political_bias <= -0.5:
            return "L"
        elif self.political_bias < 0.5:
            return "C"
        elif self.political_bias < 1.5:
            return "R"
        else:
            return "FR"

    @property
    def reliability_label(self) -> str:
        """Human-readable reliability label"""
        if self.reliability >= 4.5:
            return "Very High"
        elif self.reliability >= 3.5:
            return "High"
        elif self.reliability >= 2.5:
            return "Medium"
        elif self.reliability >= 1.5:
            return "Low"
        else:
            return "Very Low"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "domain": self.domain,
            "political_bias": self.political_bias,
            "bias_label": self.bias_label,
            "bias_code": self.bias_code,
            "reliability": self.reliability,
            "reliability_label": self.reliability_label,
            "country": self.country,
            "type": self.source_type,
            "tags": self.tags
        }


@dataclass
class SynthesisBalance:
    """Balance analysis for a synthesis based on its sources"""
    left_count: int
    center_count: int
    right_count: int
    total_sources: int
    average_bias: float
    bias_spread: float  # Standard deviation of biases
    average_reliability: float
    balance_score: float  # 0-100, higher = more balanced
    coverage_label: str  # "Balanced", "Left-Leaning", "Right-Leaning", "One-Sided"
    sources_analyzed: List[SourceBias]
    unknown_sources: List[str]

    @property
    def is_balanced(self) -> bool:
        """Returns True if sources represent multiple perspectives"""
        return self.balance_score >= 60

    def to_dict(self) -> Dict[str, Any]:
        return {
            "left_count": self.left_count,
            "center_count": self.center_count,
            "right_count": self.right_count,
            "total_sources": self.total_sources,
            "average_bias": round(self.average_bias, 2),
            "bias_spread": round(self.bias_spread, 2),
            "average_reliability": round(self.average_reliability, 2),
            "balance_score": round(self.balance_score, 1),
            "coverage_label": self.coverage_label,
            "is_balanced": self.is_balanced,
            "sources": [s.to_dict() for s in self.sources_analyzed],
            "unknown_sources": self.unknown_sources
        }


class BiasDetector:
    """Detects and analyzes source bias for syntheses"""

    def __init__(self, database_path: Optional[str] = None):
        """Initialize with bias database"""
        if database_path is None:
            # Default path relative to this file
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            database_path = os.path.join(base_dir, "data", "source_bias_database.json")

        self.database: Dict[str, Dict] = {}
        self._load_database(database_path)

    def _load_database(self, path: str) -> None:
        """Load bias database from JSON file"""
        try:
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.database = data.get("sources", {})
                    logger.info(f"Loaded bias database with {len(self.database)} sources")
            else:
                logger.warning(f"Bias database not found at {path}, using empty database")
                self.database = {}
        except Exception as e:
            logger.error(f"Failed to load bias database: {e}")
            self.database = {}

    def _extract_domain(self, url_or_name: str) -> str:
        """Extract domain from URL or source name"""
        # If it looks like a URL
        if url_or_name.startswith(('http://', 'https://', 'www.')):
            try:
                parsed = urlparse(url_or_name if '://' in url_or_name else f'https://{url_or_name}')
                domain = parsed.netloc.lower()
                # Remove www. prefix
                if domain.startswith('www.'):
                    domain = domain[4:]
                return domain
            except Exception:
                pass

        # Try to match by name
        url_lower = url_or_name.lower().strip()

        # Direct domain match
        if url_lower in self.database:
            return url_lower

        # Try adding common TLDs
        for tld in ['.fr', '.com', '.org', '.net', '.co.uk', '.de', '.es', '.it']:
            test_domain = f"{url_lower}{tld}"
            if test_domain in self.database:
                return test_domain

        # Name-based matching (fuzzy)
        for domain, info in self.database.items():
            if info.get("name", "").lower() == url_lower:
                return domain
            # Partial match
            if url_lower in domain or url_lower in info.get("name", "").lower():
                return domain

        return url_lower

    def get_source_bias(self, source: str) -> Optional[SourceBias]:
        """Get bias information for a single source"""
        domain = self._extract_domain(source)

        if domain not in self.database:
            return None

        info = self.database[domain]
        return SourceBias(
            name=info.get("name", domain),
            domain=domain,
            political_bias=info.get("political_bias", 0.0),
            reliability=info.get("reliability", 3.0),
            country=info.get("country", "Unknown"),
            source_type=info.get("type", "unknown"),
            tags=info.get("tags", [])
        )

    def analyze_sources(self, sources: List[str]) -> SynthesisBalance:
        """
        Analyze a list of sources and calculate balance metrics.

        Args:
            sources: List of source names or URLs

        Returns:
            SynthesisBalance with detailed analysis
        """
        analyzed: List[SourceBias] = []
        unknown: List[str] = []

        for source in sources:
            bias = self.get_source_bias(source)
            if bias:
                analyzed.append(bias)
            else:
                unknown.append(source)

        # Count by category
        left_count = sum(1 for s in analyzed if s.political_bias < -0.5)
        center_count = sum(1 for s in analyzed if -0.5 <= s.political_bias < 0.5)
        right_count = sum(1 for s in analyzed if s.political_bias >= 0.5)

        # Calculate averages
        if analyzed:
            biases = [s.political_bias for s in analyzed]
            reliabilities = [s.reliability for s in analyzed]

            average_bias = sum(biases) / len(biases)
            average_reliability = sum(reliabilities) / len(reliabilities)

            # Calculate spread (std dev)
            if len(biases) > 1:
                mean = average_bias
                variance = sum((x - mean) ** 2 for x in biases) / len(biases)
                bias_spread = variance ** 0.5
            else:
                bias_spread = 0.0
        else:
            average_bias = 0.0
            average_reliability = 3.0
            bias_spread = 0.0

        # Calculate balance score (0-100)
        balance_score = self._calculate_balance_score(
            left_count, center_count, right_count, bias_spread, len(analyzed)
        )

        # Determine coverage label
        coverage_label = self._get_coverage_label(average_bias, balance_score, len(analyzed))

        return SynthesisBalance(
            left_count=left_count,
            center_count=center_count,
            right_count=right_count,
            total_sources=len(sources),
            average_bias=average_bias,
            bias_spread=bias_spread,
            average_reliability=average_reliability,
            balance_score=balance_score,
            coverage_label=coverage_label,
            sources_analyzed=analyzed,
            unknown_sources=unknown
        )

    def _calculate_balance_score(
        self,
        left: int,
        center: int,
        right: int,
        spread: float,
        total_analyzed: int
    ) -> float:
        """
        Calculate a balance score from 0-100.

        Factors:
        - Presence of multiple perspectives (+points)
        - Spread of biases (+points for diversity)
        - Center sources (+points for neutrality)
        - Extreme imbalance (-points)
        """
        if total_analyzed == 0:
            return 50.0  # Neutral if no sources analyzed

        score = 50.0  # Base score

        # Bonus for having multiple perspectives
        perspectives = sum(1 for count in [left, center, right] if count > 0)
        score += perspectives * 10  # +10 per perspective type, max +30

        # Bonus for center sources
        center_ratio = center / total_analyzed if total_analyzed > 0 else 0
        score += center_ratio * 15  # Up to +15 for all center

        # Bonus for spread (diversity)
        score += min(spread * 10, 15)  # Up to +15 for high diversity

        # Penalty for extreme imbalance
        if total_analyzed >= 2:
            max_count = max(left, center, right)
            dominance_ratio = max_count / total_analyzed
            if dominance_ratio > 0.8:
                score -= 20  # Heavy penalty for 80%+ from one perspective
            elif dominance_ratio > 0.6:
                score -= 10  # Moderate penalty

        # Ensure bounds
        return max(0.0, min(100.0, score))

    def _get_coverage_label(self, avg_bias: float, balance_score: float, total: int) -> str:
        """Determine the coverage label based on analysis"""
        if total == 0:
            return "Unknown"

        if balance_score >= 70:
            return "Balanced"
        elif balance_score >= 50:
            if avg_bias < -0.3:
                return "Slightly Left-Leaning"
            elif avg_bias > 0.3:
                return "Slightly Right-Leaning"
            else:
                return "Mostly Balanced"
        else:
            if avg_bias < -0.5:
                return "Left-Leaning"
            elif avg_bias > 0.5:
                return "Right-Leaning"
            else:
                return "Limited Coverage"

    def get_bias_for_synthesis(self, synthesis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze bias for a complete synthesis object.

        Args:
            synthesis: Synthesis dict with 'sources' or 'sourceArticles' field

        Returns:
            Bias analysis dict ready for API response
        """
        # Extract sources from synthesis
        sources = []

        # Try sourceArticles first (has more detail)
        source_articles = synthesis.get("sourceArticles", [])
        if source_articles:
            for sa in source_articles:
                if isinstance(sa, dict):
                    sources.append(sa.get("name", sa.get("url", "")))
                elif isinstance(sa, str):
                    sources.append(sa)

        # Fallback to sources list
        if not sources:
            raw_sources = synthesis.get("sources", [])
            if isinstance(raw_sources, str):
                sources = [s.strip() for s in raw_sources.split(",") if s.strip()]
            elif isinstance(raw_sources, list):
                sources = raw_sources

        # Analyze
        balance = self.analyze_sources(sources)
        return balance.to_dict()


# Global instance
_bias_detector: Optional[BiasDetector] = None


def get_bias_detector() -> BiasDetector:
    """Get or create the global bias detector instance"""
    global _bias_detector
    if _bias_detector is None:
        _bias_detector = BiasDetector()
    return _bias_detector


def analyze_synthesis_bias(synthesis: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function to analyze a synthesis"""
    detector = get_bias_detector()
    return detector.get_bias_for_synthesis(synthesis)
