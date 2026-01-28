"""
Claim Extractor Module for NovaPress AI
Extracts factual claims from synthesis text for fact-checking.
Uses NER + pattern matching to identify verifiable statements.
"""

import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from loguru import logger

try:
    import spacy
    nlp = spacy.load("fr_core_news_lg")
except Exception:
    nlp = None
    logger.warning("spaCy model not loaded - claim extraction will be limited")


@dataclass
class ExtractedClaim:
    """A factual claim extracted from text"""
    text: str
    claim_type: str  # 'statistic', 'quote', 'event', 'comparison', 'attribution'
    entities: List[str]
    confidence: float  # 0-1 how likely this is a verifiable claim
    source_sentence: str
    position: int  # Position in text

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "claim_type": self.claim_type,
            "entities": self.entities,
            "confidence": self.confidence,
            "source_sentence": self.source_sentence,
            "position": self.position
        }


class ClaimExtractor:
    """Extracts verifiable claims from synthesis text"""

    # Patterns for different claim types
    STAT_PATTERNS = [
        r'\b(\d+(?:[.,]\d+)?)\s*(%|pour\s*cent|pourcent)',
        r'\b(\d+(?:[.,]\d+)?)\s*(millions?|milliards?|milliers?)',
        r'\b(\d+(?:[.,]\d+)?)\s*(euros?|dollars?|€|\$)',
        r'augment[ée]?\s+de\s+(\d+)',
        r'baiss[ée]?\s+de\s+(\d+)',
        r'(hausse|baisse)\s+de\s+(\d+)',
    ]

    QUOTE_PATTERNS = [
        r'[«"]([^»"]+)[»"]',
        r'selon\s+([^,\.]+)',
        r'd\'après\s+([^,\.]+)',
        r'a\s+déclaré\s+([^,\.]+)',
        r'a\s+affirmé\s+([^,\.]+)',
    ]

    EVENT_PATTERNS = [
        r'(le\s+\d{1,2}\s+\w+\s+\d{4})',
        r'(hier|aujourd\'hui|demain)',
        r'(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+dernier',
        r'a\s+(annoncé|révélé|confirmé|démenti)',
    ]

    COMPARISON_PATTERNS = [
        r'(plus|moins)\s+(que|de)\s+',
        r'(supérieur|inférieur)\s+à',
        r'(le|la)\s+plus\s+(grand|petit|important)',
        r'(premier|deuxième|troisième)',
    ]

    def __init__(self):
        self.nlp = nlp

    def extract_claims(
        self,
        text: str,
        max_claims: int = 10,
        min_confidence: float = 0.5
    ) -> List[ExtractedClaim]:
        """
        Extract verifiable claims from text.

        Args:
            text: The synthesis text to analyze
            max_claims: Maximum number of claims to extract
            min_confidence: Minimum confidence threshold

        Returns:
            List of ExtractedClaim objects
        """
        if not text:
            return []

        claims: List[ExtractedClaim] = []
        sentences = self._split_sentences(text)

        for i, sentence in enumerate(sentences):
            sentence_claims = self._extract_from_sentence(sentence, i)
            claims.extend(sentence_claims)

        # Filter by confidence and limit
        claims = [c for c in claims if c.confidence >= min_confidence]
        claims = sorted(claims, key=lambda x: x.confidence, reverse=True)
        claims = claims[:max_claims]

        return claims

    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        if self.nlp:
            doc = self.nlp(text)
            return [sent.text.strip() for sent in doc.sents]
        else:
            # Fallback: simple regex split
            return re.split(r'[.!?]+', text)

    def _extract_from_sentence(self, sentence: str, position: int) -> List[ExtractedClaim]:
        """Extract claims from a single sentence"""
        claims = []

        # Extract statistics
        for pattern in self.STAT_PATTERNS:
            matches = re.findall(pattern, sentence, re.IGNORECASE)
            if matches:
                entities = self._extract_entities(sentence)
                claims.append(ExtractedClaim(
                    text=self._clean_claim(sentence),
                    claim_type='statistic',
                    entities=entities,
                    confidence=0.85,  # Statistics are usually verifiable
                    source_sentence=sentence,
                    position=position
                ))
                break  # Only one stat claim per sentence

        # Extract quotes/attributions
        for pattern in self.QUOTE_PATTERNS:
            matches = re.findall(pattern, sentence, re.IGNORECASE)
            if matches:
                entities = self._extract_entities(sentence)
                claims.append(ExtractedClaim(
                    text=self._clean_claim(sentence),
                    claim_type='quote',
                    entities=entities,
                    confidence=0.75,
                    source_sentence=sentence,
                    position=position
                ))
                break

        # Extract event claims
        for pattern in self.EVENT_PATTERNS:
            matches = re.findall(pattern, sentence, re.IGNORECASE)
            if matches:
                entities = self._extract_entities(sentence)
                claims.append(ExtractedClaim(
                    text=self._clean_claim(sentence),
                    claim_type='event',
                    entities=entities,
                    confidence=0.70,
                    source_sentence=sentence,
                    position=position
                ))
                break

        # Extract comparisons
        for pattern in self.COMPARISON_PATTERNS:
            if re.search(pattern, sentence, re.IGNORECASE):
                entities = self._extract_entities(sentence)
                claims.append(ExtractedClaim(
                    text=self._clean_claim(sentence),
                    claim_type='comparison',
                    entities=entities,
                    confidence=0.65,
                    source_sentence=sentence,
                    position=position
                ))
                break

        return claims

    def _extract_entities(self, text: str) -> List[str]:
        """Extract named entities from text"""
        entities = []

        if self.nlp:
            doc = self.nlp(text)
            for ent in doc.ents:
                if ent.label_ in ['PER', 'ORG', 'LOC', 'GPE', 'MISC']:
                    entities.append(ent.text)
        else:
            # Fallback: look for capitalized words
            words = re.findall(r'\b[A-Z][a-zA-Zéèêëàâîïôûùç]+(?:\s+[A-Z][a-zA-Zéèêëàâîïôûùç]+)*\b', text)
            entities = list(set(words))[:5]

        return entities[:5]

    def _clean_claim(self, sentence: str) -> str:
        """Clean and truncate claim text"""
        # Remove extra whitespace
        claim = ' '.join(sentence.split())
        # Truncate if too long
        if len(claim) > 200:
            claim = claim[:197] + '...'
        return claim


# Global instance
_claim_extractor: Optional[ClaimExtractor] = None


def get_claim_extractor() -> ClaimExtractor:
    """Get or create the global claim extractor instance"""
    global _claim_extractor
    if _claim_extractor is None:
        _claim_extractor = ClaimExtractor()
    return _claim_extractor


def extract_claims(text: str, max_claims: int = 10) -> List[Dict[str, Any]]:
    """Convenience function to extract claims from text"""
    extractor = get_claim_extractor()
    claims = extractor.extract_claims(text, max_claims=max_claims)
    return [c.to_dict() for c in claims]
