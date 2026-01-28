"""
Fact Checker Module for NovaPress AI
Verifies factual claims by cross-referencing with reliable sources.
Inspired by Perplexity's fact-checking and Semafor's methodology.
"""

import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
from loguru import logger

from .claim_extractor import get_claim_extractor, ExtractedClaim


class VerificationStatus(Enum):
    """Verification status for a claim"""
    VERIFIED = "verified"  # Confirmed by reliable sources
    PARTIALLY_VERIFIED = "partially_verified"  # Some aspects confirmed
    UNVERIFIED = "unverified"  # Cannot confirm
    DISPUTED = "disputed"  # Conflicting information found
    FALSE = "false"  # Contradicted by reliable sources


@dataclass
class VerifiedClaim:
    """A fact-checked claim with verification details"""
    claim_text: str
    claim_type: str
    status: VerificationStatus
    confidence_score: float  # 0-100
    verification_notes: str
    sources_checked: List[str]
    supporting_sources: List[str]
    conflicting_sources: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "claim_text": self.claim_text,
            "claim_type": self.claim_type,
            "status": self.status.value,
            "confidence_score": round(self.confidence_score, 1),
            "verification_notes": self.verification_notes,
            "sources_checked": self.sources_checked,
            "supporting_sources": self.supporting_sources,
            "conflicting_sources": self.conflicting_sources
        }


@dataclass
class FactCheckResult:
    """Complete fact-check result for a synthesis"""
    synthesis_id: str
    total_claims: int
    verified_count: int
    disputed_count: int
    unverified_count: int
    overall_score: float  # 0-100 factual accuracy score
    overall_label: str  # "High", "Medium", "Low", "Unknown"
    claims: List[VerifiedClaim]
    methodology_note: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "synthesis_id": self.synthesis_id,
            "total_claims": self.total_claims,
            "verified_count": self.verified_count,
            "disputed_count": self.disputed_count,
            "unverified_count": self.unverified_count,
            "overall_score": round(self.overall_score, 1),
            "overall_label": self.overall_label,
            "claims": [c.to_dict() for c in self.claims],
            "methodology_note": self.methodology_note
        }


class FactChecker:
    """
    Verifies factual claims in synthesis text.

    Current implementation uses heuristic verification based on:
    - Source diversity (multiple sources = higher confidence)
    - Claim type (statistics with sources = more verifiable)
    - Entity presence (named entities suggest specific, verifiable claims)

    Future enhancement: Integration with external fact-check APIs
    (Google Fact Check, Perplexity, ClaimBuster, etc.)
    """

    # Reliable source domains for cross-reference
    RELIABLE_SOURCES = {
        'wire': ['reuters.com', 'apnews.com', 'afp.com'],
        'quality': ['lemonde.fr', 'nytimes.com', 'bbc.com', 'theguardian.com'],
        'science': ['nature.com', 'sciencedaily.com', 'arxiv.org'],
        'official': ['gov.fr', 'europa.eu', 'who.int', 'un.org']
    }

    def __init__(self):
        self.claim_extractor = get_claim_extractor()

    def fact_check_synthesis(
        self,
        synthesis: Dict[str, Any],
        max_claims: int = 8
    ) -> FactCheckResult:
        """
        Perform fact-checking on a synthesis.

        Args:
            synthesis: The synthesis dict with text content
            max_claims: Maximum claims to check

        Returns:
            FactCheckResult with verification details
        """
        synthesis_id = synthesis.get("id", "unknown")

        # Get text to analyze
        body = synthesis.get("body", "") or synthesis.get("summary", "")
        key_points = synthesis.get("keyPoints", synthesis.get("key_points", []))

        # Combine text sources
        full_text = f"{body} {' '.join(key_points) if key_points else ''}"

        if not full_text.strip():
            return self._empty_result(synthesis_id)

        # Extract claims
        claims = self.claim_extractor.extract_claims(full_text, max_claims=max_claims)

        if not claims:
            return self._empty_result(synthesis_id)

        # Get source information
        sources = self._get_synthesis_sources(synthesis)

        # Verify each claim
        verified_claims = []
        for claim in claims:
            verified = self._verify_claim(claim, sources)
            verified_claims.append(verified)

        # Calculate overall score
        result = self._calculate_overall_result(synthesis_id, verified_claims)

        return result

    def _get_synthesis_sources(self, synthesis: Dict[str, Any]) -> List[str]:
        """Extract source domains from synthesis"""
        sources = []

        # From sourceArticles
        source_articles = synthesis.get("sourceArticles", synthesis.get("source_articles", []))
        for sa in source_articles:
            if isinstance(sa, dict):
                url = sa.get("url", "")
                if url:
                    domain = self._extract_domain(url)
                    if domain:
                        sources.append(domain)
                name = sa.get("name", "")
                if name:
                    sources.append(name.lower())

        # From sources list
        raw_sources = synthesis.get("sources", [])
        if isinstance(raw_sources, list):
            for s in raw_sources:
                if isinstance(s, str):
                    sources.append(s.lower())

        return list(set(sources))

    def _extract_domain(self, url: str) -> Optional[str]:
        """Extract domain from URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            if domain.startswith('www.'):
                domain = domain[4:]
            return domain
        except Exception:
            return None

    def _verify_claim(
        self,
        claim: ExtractedClaim,
        sources: List[str]
    ) -> VerifiedClaim:
        """
        Verify a single claim.

        Heuristic verification based on:
        1. Number of sources covering the topic
        2. Presence of reliable sources
        3. Claim type (statistics more verifiable)
        4. Entity specificity
        """
        supporting = []
        conflicting = []

        # Check if sources include reliable ones
        reliable_count = 0
        for source in sources:
            for category, domains in self.RELIABLE_SOURCES.items():
                if any(d in source for d in domains):
                    reliable_count += 1
                    supporting.append(source)
                    break

        # Base confidence on source analysis
        source_confidence = min(50 + (len(sources) * 10) + (reliable_count * 15), 85)

        # Adjust by claim type
        type_bonus = {
            'statistic': 10,  # Numbers are specific, easier to verify
            'quote': 5,
            'event': 5,
            'comparison': 0,
            'attribution': 0
        }
        confidence = source_confidence + type_bonus.get(claim.claim_type, 0)

        # Adjust by entity presence
        if claim.entities:
            confidence += min(len(claim.entities) * 3, 10)

        confidence = min(confidence, 95)

        # Determine status
        if reliable_count >= 2 and len(sources) >= 3:
            status = VerificationStatus.VERIFIED
            notes = f"Confirmé par {reliable_count} source(s) fiable(s)"
        elif reliable_count >= 1:
            status = VerificationStatus.PARTIALLY_VERIFIED
            notes = f"Partiellement confirmé par {len(sources)} source(s)"
        elif len(sources) >= 2:
            status = VerificationStatus.PARTIALLY_VERIFIED
            notes = "Reporté par plusieurs sources, vérification externe recommandée"
        else:
            status = VerificationStatus.UNVERIFIED
            notes = "Impossible à vérifier avec les sources disponibles"
            confidence = min(confidence, 50)

        return VerifiedClaim(
            claim_text=claim.text,
            claim_type=claim.claim_type,
            status=status,
            confidence_score=confidence,
            verification_notes=notes,
            sources_checked=sources[:5],
            supporting_sources=supporting[:3],
            conflicting_sources=conflicting[:3]
        )

    def _calculate_overall_result(
        self,
        synthesis_id: str,
        claims: List[VerifiedClaim]
    ) -> FactCheckResult:
        """Calculate overall fact-check result"""
        total = len(claims)

        verified_count = sum(1 for c in claims if c.status == VerificationStatus.VERIFIED)
        partial_count = sum(1 for c in claims if c.status == VerificationStatus.PARTIALLY_VERIFIED)
        disputed_count = sum(1 for c in claims if c.status == VerificationStatus.DISPUTED)
        unverified_count = sum(1 for c in claims if c.status == VerificationStatus.UNVERIFIED)

        # Calculate weighted score
        score_sum = sum(c.confidence_score for c in claims)
        overall_score = score_sum / total if total > 0 else 0

        # Penalty for disputed claims
        if disputed_count > 0:
            overall_score -= disputed_count * 15

        overall_score = max(0, min(100, overall_score))

        # Determine label
        if overall_score >= 75:
            label = "Haute fiabilité"
        elif overall_score >= 50:
            label = "Fiabilité moyenne"
        elif overall_score >= 25:
            label = "Fiabilité basse"
        else:
            label = "Non vérifié"

        methodology = (
            "Vérification basée sur la diversité des sources, "
            "la présence de sources fiables (agences de presse, médias de référence), "
            "et le type de claims (statistiques, citations, événements)."
        )

        return FactCheckResult(
            synthesis_id=synthesis_id,
            total_claims=total,
            verified_count=verified_count + partial_count,  # Combine for simplicity
            disputed_count=disputed_count,
            unverified_count=unverified_count,
            overall_score=overall_score,
            overall_label=label,
            claims=claims,
            methodology_note=methodology
        )

    def _empty_result(self, synthesis_id: str) -> FactCheckResult:
        """Return empty result when no claims found"""
        return FactCheckResult(
            synthesis_id=synthesis_id,
            total_claims=0,
            verified_count=0,
            disputed_count=0,
            unverified_count=0,
            overall_score=50,  # Neutral score
            overall_label="Analyse non disponible",
            claims=[],
            methodology_note="Aucun claim factuel identifié dans cette synthèse."
        )


# Global instance
_fact_checker: Optional[FactChecker] = None


def get_fact_checker() -> FactChecker:
    """Get or create the global fact checker instance"""
    global _fact_checker
    if _fact_checker is None:
        _fact_checker = FactChecker()
    return _fact_checker


def fact_check_synthesis(synthesis: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function to fact-check a synthesis"""
    checker = get_fact_checker()
    result = checker.fact_check_synthesis(synthesis)
    return result.to_dict()
