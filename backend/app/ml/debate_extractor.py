"""
Debate Extractor Module for NovaPress AI
Extracts PRO and CON arguments from synthesis text for balanced presentation.
Inspired by AllSides but with automatic AI extraction.
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
    logger.warning("spaCy model not loaded - debate extraction will be limited")


@dataclass
class Argument:
    """A single argument in a debate"""
    text: str
    side: str  # 'pro' or 'con'
    source: Optional[str]
    confidence: float
    entities: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "side": self.side,
            "source": self.source,
            "confidence": self.confidence,
            "entities": self.entities
        }


@dataclass
class DebateAnalysis:
    """Complete debate analysis for a synthesis"""
    is_controversial: bool
    controversy_score: float  # 0-1
    topic: str
    pro_arguments: List[Argument]
    con_arguments: List[Argument]
    neutral_points: List[str]
    methodology_note: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_controversial": self.is_controversial,
            "controversy_score": round(self.controversy_score, 2),
            "topic": self.topic,
            "pro_arguments": [a.to_dict() for a in self.pro_arguments],
            "con_arguments": [a.to_dict() for a in self.con_arguments],
            "neutral_points": self.neutral_points,
            "total_arguments": len(self.pro_arguments) + len(self.con_arguments),
            "methodology_note": self.methodology_note
        }


class DebateExtractor:
    """Extracts debate arguments from synthesis text"""

    # Patterns indicating controversy
    CONTROVERSY_INDICATORS = [
        r'controvers[ée]',
        r'débat',
        r'opposants?',
        r'partisans?',
        r'critiques?',
        r'défenseurs?',
        r'pour ou contre',
        r'divise',
        r'polémique',
        r'contentieux',
    ]

    # Pro argument patterns (French)
    PRO_PATTERNS = [
        r'(les partisans|les défenseurs|les supporters?)\s+([^.]+)',
        r'(en faveur de|pour|soutient|défend)\s+([^.]+)',
        r'(avantages?|bénéfices?|atouts?)\s*:?\s*([^.]+)',
        r'(permettrait|favoriserait|améliorerait)\s+([^.]+)',
        r'selon (ses|les) partisans?,?\s*([^.]+)',
    ]

    # Con argument patterns (French)
    CON_PATTERNS = [
        r'(les opposants?|les critiques|les détracteurs?)\s+([^.]+)',
        r'(contre|s\'oppose|critique|dénonce)\s+([^.]+)',
        r'(inconvénients?|risques?|dangers?)\s*:?\s*([^.]+)',
        r'(pourrait nuire|menacerait|détériorerait)\s+([^.]+)',
        r'selon (ses|les) critiques?,?\s*([^.]+)',
    ]

    def __init__(self):
        self.nlp = nlp

    def analyze_debate(self, synthesis: Dict[str, Any]) -> DebateAnalysis:
        """
        Analyze a synthesis for debate arguments.

        Args:
            synthesis: Synthesis dict with body, keyPoints, etc.

        Returns:
            DebateAnalysis with pro/con arguments
        """
        title = synthesis.get("title", "")
        body = synthesis.get("body", "") or synthesis.get("summary", "")
        key_points = synthesis.get("keyPoints", synthesis.get("key_points", []))
        analysis = synthesis.get("analysis", "")

        # Combine text
        full_text = f"{title} {body} {' '.join(key_points) if isinstance(key_points, list) else ''} {analysis}"

        if not full_text.strip():
            return self._empty_result(title)

        # Check if topic is controversial
        controversy_score = self._calculate_controversy_score(full_text)

        if controversy_score < 0.3:
            return self._empty_result(title, controversy_score)

        # Extract arguments
        pro_args = self._extract_arguments(full_text, 'pro')
        con_args = self._extract_arguments(full_text, 'con')

        # Extract neutral points (if available)
        neutral_points = self._extract_neutral_points(key_points)

        # Determine topic
        topic = self._extract_topic(title, full_text)

        return DebateAnalysis(
            is_controversial=True,
            controversy_score=controversy_score,
            topic=topic,
            pro_arguments=pro_args,
            con_arguments=con_args,
            neutral_points=neutral_points,
            methodology_note=(
                "Arguments extraits automatiquement du texte de la synthèse. "
                "Pour une analyse complète, consultez les sources originales."
            )
        )

    def _calculate_controversy_score(self, text: str) -> float:
        """Calculate how controversial the topic is"""
        text_lower = text.lower()
        score = 0.0

        # Check controversy indicators
        for pattern in self.CONTROVERSY_INDICATORS:
            if re.search(pattern, text_lower):
                score += 0.15

        # Check for debate-like structure
        if re.search(r'pour\s+et\s+contre', text_lower):
            score += 0.2
        if re.search(r'd\'un côté.*de l\'autre', text_lower):
            score += 0.2

        # Check for opinion diversity mentions
        opinion_words = ['certains', 'd\'autres', 'selon', 'estiment', 'pensent', 'affirment']
        opinion_count = sum(1 for w in opinion_words if w in text_lower)
        score += min(opinion_count * 0.1, 0.3)

        return min(score, 1.0)

    def _extract_arguments(self, text: str, side: str) -> List[Argument]:
        """Extract arguments for a specific side"""
        arguments = []
        patterns = self.PRO_PATTERNS if side == 'pro' else self.CON_PATTERNS

        sentences = self._split_sentences(text)

        for sentence in sentences:
            for pattern in patterns:
                match = re.search(pattern, sentence, re.IGNORECASE)
                if match:
                    arg_text = self._clean_argument(sentence)
                    if len(arg_text) > 20:  # Filter too short
                        entities = self._extract_entities(sentence)
                        source = self._extract_source(sentence)

                        arguments.append(Argument(
                            text=arg_text,
                            side=side,
                            source=source,
                            confidence=0.7,
                            entities=entities
                        ))
                        break  # One argument per sentence

        # Remove duplicates
        seen = set()
        unique_args = []
        for arg in arguments:
            key = arg.text[:50]
            if key not in seen:
                seen.add(key)
                unique_args.append(arg)

        return unique_args[:5]  # Max 5 per side

    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        if self.nlp:
            doc = self.nlp(text)
            return [sent.text.strip() for sent in doc.sents]
        else:
            return re.split(r'[.!?]+', text)

    def _extract_entities(self, text: str) -> List[str]:
        """Extract named entities"""
        if self.nlp:
            doc = self.nlp(text)
            return [ent.text for ent in doc.ents if ent.label_ in ['PER', 'ORG', 'GPE']][:3]
        return []

    def _extract_source(self, sentence: str) -> Optional[str]:
        """Extract source attribution from sentence"""
        # Patterns for source attribution
        source_patterns = [
            r'selon\s+([A-Z][a-zA-Zéèêëàâîïôûùç\s-]+)',
            r'd\'après\s+([A-Z][a-zA-Zéèêëàâîïôûùç\s-]+)',
            r'affirme\s+([A-Z][a-zA-Zéèêëàâîïôûùç\s-]+)',
        ]

        for pattern in source_patterns:
            match = re.search(pattern, sentence)
            if match:
                return match.group(1).strip()[:50]

        return None

    def _clean_argument(self, text: str) -> str:
        """Clean and format argument text"""
        # Remove excess whitespace
        text = ' '.join(text.split())
        # Truncate if too long
        if len(text) > 200:
            text = text[:197] + '...'
        return text

    def _extract_neutral_points(self, key_points: List) -> List[str]:
        """Extract neutral/factual points"""
        if not isinstance(key_points, list):
            return []

        neutral = []
        for point in key_points:
            if isinstance(point, str):
                # Skip if clearly argumentative
                lower = point.lower()
                if not any(w in lower for w in ['pour', 'contre', 'partisan', 'opposant', 'critique']):
                    neutral.append(point[:150])

        return neutral[:3]

    def _extract_topic(self, title: str, text: str) -> str:
        """Extract the main debate topic"""
        # Try to find explicit topic mentions
        topic_patterns = [
            r'débat\s+sur\s+([^.]+)',
            r'question\s+de\s+([^.]+)',
            r'polémique\s+(?:sur|autour de)\s+([^.]+)',
        ]

        for pattern in topic_patterns:
            match = re.search(pattern, text.lower())
            if match:
                topic = match.group(1).strip()
                return topic[:100]

        # Fall back to title
        return title[:100] if title else "Sujet de débat"

    def _empty_result(self, title: str, controversy_score: float = 0.0) -> DebateAnalysis:
        """Return empty result for non-controversial topics"""
        return DebateAnalysis(
            is_controversial=False,
            controversy_score=controversy_score,
            topic=title[:100] if title else "",
            pro_arguments=[],
            con_arguments=[],
            neutral_points=[],
            methodology_note="Ce sujet ne semble pas être controversé ou manque d'arguments opposés clairement identifiés."
        )


# Global instance
_debate_extractor: Optional[DebateExtractor] = None


def get_debate_extractor() -> DebateExtractor:
    """Get or create the global debate extractor instance"""
    global _debate_extractor
    if _debate_extractor is None:
        _debate_extractor = DebateExtractor()
    return _debate_extractor


def extract_debate(synthesis: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function to extract debate from synthesis"""
    extractor = get_debate_extractor()
    result = extractor.analyze_debate(synthesis)
    return result.to_dict()
