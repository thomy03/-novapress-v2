"""
NovaPress AI - Persona Quality Reviewer
Evaluates the quality of persona-styled syntheses automatically.

Features:
- Tone analysis: Does the synthesis match the persona's expected tone?
- Style markers: Are characteristic phrases/patterns present?
- Signature check: Is the persona's signature properly included?
- Vocabulary alignment: Does the vocabulary match the persona's style?

Usage:
    reviewer = PersonaQualityReviewer()
    result = reviewer.evaluate(synthesis, persona)
    if result['overall_score'] < 0.6:
        # Use fallback neutral version or regenerate
"""
from typing import Dict, Any, List, Optional
import re
from dataclasses import dataclass
from loguru import logger

from app.ml.persona import Persona, PersonaType, PERSONAS


@dataclass
class QualityResult:
    """Result of quality evaluation"""
    overall_score: float
    tone_score: float
    style_markers_count: int
    signature_present: bool
    vocabulary_score: float
    issues: List[str]
    recommendations: List[str]


# Style markers for each persona
PERSONA_STYLE_MARKERS = {
    PersonaType.LE_CYNIQUE: {
        "keywords": [
            "n'est-ce pas", "on se demande", "comme disait", "curieusement",
            "étonnamment", "à qui profite", "quelle surprise", "bien sûr",
            "évidemment", "naturellement", "sans surprise", "fait amusant",
            "coïncidence", "hasard", "on notera", "paradoxalement",
            "ironie", "cynisme", "désillusion"
        ],
        "patterns": [
            r"[\?\!]$",  # Questions rhetoriques / exclamations
            r"comme disait.+",  # Signature references
            r"on se demande",
            r"curieusement|étonnamment",
            r"à qui profite",
        ],
        "forbidden": [
            "formidable", "extraordinaire", "merveilleux", "fantastique",
            "incroyable", "génial", "super"  # Trop positif pour le cynique
        ],
        "min_questions": 1,  # Au moins une question rhétorique
    },
    PersonaType.L_OPTIMISTE: {
        "keywords": [
            "pourrait bien", "permet", "transforme", "révolutionne", "ouvre",
            "potentiel", "prometteur", "opportunité", "avenir", "solution",
            "innovant", "positif", "progrès", "espoir", "amélioration",
            "et si c'était", "imaginons", "fascinant", "passionnant"
        ],
        "patterns": [
            r"Et si.+\?",  # Ouvertures optimistes
            r"pourrait|permettrait",
            r"et si c'était le début",
            r"potentiel|opportunité",
        ],
        "forbidden": [
            "catastrophe", "désastre", "échec total", "sans espoir",
            "irrémédiable"  # Trop négatif pour l'optimiste
        ],
        "min_solutions": 1,  # Au moins une mention de solution
    },
    PersonaType.LE_CONTEUR: {
        "keywords": [
            "dans les couloirs", "bataille", "siège", "alliance", "trahison",
            "échiquier", "personnage", "acte", "scène", "intrigue", "saga",
            "rebondissement", "dénouement", "suspense", "haletant", "épique",
            "la suite au prochain", "feuilleton", "dramaturgie"
        ],
        "patterns": [
            r"la suite au prochain",
            r"acte|scène",
            r"bataille|siège|alliance",
            r"échiquier",
            r"\.\.\..*$",  # Suspense avec points
        ],
        "forbidden": [],  # Le conteur peut tout utiliser
        "min_narrative_elements": 2,  # Au moins 2 éléments narratifs
    },
    PersonaType.LE_SATIRISTE: {
        "keywords": [
            "on ne sait plus si c'est vrai", "selon un expert", "73%",
            "communiqué de presse", "source proche", "officiellement",
            "bien évidemment", "naturellement", "comme prévu",
            "en toute logique", "sans surprise aucune", "quelle coïncidence"
        ],
        "patterns": [
            r"on ne sait plus si c'est vrai",
            r"\d+%",  # Statistiques (souvent parodiques)
            r"selon.+qui souhaite",  # Sources anonymes parodiques
            r"officiellement|communiqué",
        ],
        "forbidden": [],
        "min_parody_markers": 2,  # Au moins 2 éléments parodiques
    },
}

# Tone keywords for analysis
TONE_KEYWORDS = {
    "sardonic": ["cynique", "ironique", "sardonique", "désabusé", "amer", "mordant"],
    "optimistic": ["positif", "prometteur", "espoir", "solution", "progrès", "opportunité"],
    "dramatic": ["épique", "dramatique", "haletant", "suspense", "rebondissement"],
    "satirical": ["parodique", "absurde", "exagération", "satire"],
    "neutral": ["factuel", "objectif", "neutre", "informatif"],
}


class PersonaQualityReviewer:
    """
    Evaluates the quality of persona-styled syntheses.

    Scoring rubric:
    - tone_score (0-1): How well does the tone match the persona?
    - style_markers (count): How many characteristic markers are present?
    - signature_present (bool): Is the persona's signature included?
    - vocabulary_score (0-1): Does vocabulary align with persona?
    - overall_score (0-1): Weighted average

    Weights:
    - Tone: 35%
    - Style markers: 25%
    - Signature: 15%
    - Vocabulary: 25%
    """

    TONE_WEIGHT = 0.35
    STYLE_WEIGHT = 0.25
    SIGNATURE_WEIGHT = 0.15
    VOCABULARY_WEIGHT = 0.25

    # Minimum thresholds
    MIN_ACCEPTABLE_SCORE = 0.6
    IDEAL_SCORE = 0.8

    def __init__(self):
        self.markers = PERSONA_STYLE_MARKERS

    def evaluate(self, synthesis: Dict[str, Any], persona: Persona) -> QualityResult:
        """
        Evaluate the quality of a persona synthesis.

        Args:
            synthesis: The generated synthesis dict
            persona: The Persona used for generation

        Returns:
            QualityResult with scores and recommendations
        """
        if persona.id == PersonaType.NEUTRAL:
            # Neutral doesn't need persona evaluation
            return QualityResult(
                overall_score=1.0,
                tone_score=1.0,
                style_markers_count=0,
                signature_present=True,
                vocabulary_score=1.0,
                issues=[],
                recommendations=[]
            )

        # Combine all text for analysis
        full_text = self._get_full_text(synthesis)

        # Calculate individual scores
        tone_score = self._analyze_tone(full_text, persona)
        style_markers_count, style_score = self._count_style_markers(full_text, persona)
        signature_present = self._check_signature(synthesis, persona)
        vocabulary_score = self._check_vocabulary(full_text, persona)

        # Calculate overall score
        overall_score = (
            tone_score * self.TONE_WEIGHT +
            style_score * self.STYLE_WEIGHT +
            (1.0 if signature_present else 0.0) * self.SIGNATURE_WEIGHT +
            vocabulary_score * self.VOCABULARY_WEIGHT
        )

        # Generate issues and recommendations
        issues, recommendations = self._generate_feedback(
            tone_score, style_markers_count, signature_present,
            vocabulary_score, overall_score, persona
        )

        result = QualityResult(
            overall_score=round(overall_score, 3),
            tone_score=round(tone_score, 3),
            style_markers_count=style_markers_count,
            signature_present=signature_present,
            vocabulary_score=round(vocabulary_score, 3),
            issues=issues,
            recommendations=recommendations
        )

        logger.debug(
            f"Persona quality evaluation for '{persona.id}': "
            f"score={overall_score:.2f}, markers={style_markers_count}, "
            f"signature={signature_present}"
        )

        return result

    def _get_full_text(self, synthesis: Dict[str, Any]) -> str:
        """Combine all text fields for analysis"""
        parts = [
            synthesis.get("title", ""),
            synthesis.get("introduction", ""),
            synthesis.get("body", ""),
            synthesis.get("analysis", ""),
        ]
        key_points = synthesis.get("keyPoints", [])
        if key_points:
            parts.extend(key_points)
        return " ".join(str(p) for p in parts if p).lower()

    def _analyze_tone(self, text: str, persona: Persona) -> float:
        """
        Analyze if the text tone matches the expected persona tone.

        Returns a score 0-1 where 1 = perfect match.
        """
        persona_type = PersonaType(persona.id)

        # Map persona to expected tone
        tone_mapping = {
            PersonaType.LE_CYNIQUE: "sardonic",
            PersonaType.L_OPTIMISTE: "optimistic",
            PersonaType.LE_CONTEUR: "dramatic",
            PersonaType.LE_SATIRISTE: "satirical",
            PersonaType.NEUTRAL: "neutral",
        }

        expected_tone = tone_mapping.get(persona_type, "neutral")
        expected_keywords = TONE_KEYWORDS.get(expected_tone, [])

        # Count expected tone keywords
        expected_count = sum(1 for kw in expected_keywords if kw in text)

        # Count contradicting tone keywords (e.g., optimistic keywords in cynical text)
        contradicting_count = 0
        for tone, keywords in TONE_KEYWORDS.items():
            if tone != expected_tone and tone != "neutral":
                contradicting_count += sum(1 for kw in keywords if kw in text)

        # Calculate score
        if expected_count == 0:
            base_score = 0.3  # No expected markers = low score
        else:
            base_score = min(1.0, expected_count / 3)  # Need at least 3 for full score

        # Penalty for contradicting tone
        penalty = min(0.3, contradicting_count * 0.1)

        return max(0.0, base_score - penalty)

    def _count_style_markers(self, text: str, persona: Persona) -> tuple:
        """
        Count characteristic style markers for the persona.

        Returns:
            (count, normalized_score)
        """
        persona_type = PersonaType(persona.id)
        markers_config = self.markers.get(persona_type, {})

        keywords = markers_config.get("keywords", [])
        patterns = markers_config.get("patterns", [])
        forbidden = markers_config.get("forbidden", [])

        # Count keyword matches
        keyword_count = sum(1 for kw in keywords if kw.lower() in text)

        # Count pattern matches
        pattern_count = 0
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                pattern_count += 1

        # Check for forbidden words (should not appear)
        forbidden_count = sum(1 for fw in forbidden if fw.lower() in text)

        total_count = keyword_count + pattern_count

        # Normalize score (expect at least 3 markers for good score)
        base_score = min(1.0, total_count / 4)

        # Penalty for forbidden words
        forbidden_penalty = min(0.4, forbidden_count * 0.2)

        normalized_score = max(0.0, base_score - forbidden_penalty)

        return total_count, normalized_score

    def _check_signature(self, synthesis: Dict[str, Any], persona: Persona) -> bool:
        """
        Check if the persona's signature is present in the synthesis.
        """
        if not persona.signature:
            return True  # No signature required

        # Check in dedicated signature field
        if persona.signature.lower() in str(synthesis.get("signature", "")).lower():
            return True

        # Check in body/analysis
        body = str(synthesis.get("body", "")).lower()
        analysis = str(synthesis.get("analysis", "")).lower()

        return persona.signature.lower() in body or persona.signature.lower() in analysis

    def _check_vocabulary(self, text: str, persona: Persona) -> float:
        """
        Check if the vocabulary aligns with persona's style level.

        - Le Cynique: Vocabulaire soutenu avec expressions populaires
        - L'Optimiste: Verbes d'action, dynamique
        - Le Conteur: Vocabulaire riche et littéraire
        - Le Satiriste: Termes officiels détournés
        """
        persona_type = PersonaType(persona.id)

        vocabulary_maps = {
            PersonaType.LE_CYNIQUE: {
                "positive": ["certes", "néanmoins", "toutefois", "force est de constater",
                            "il appert", "en substance", "de facto"],
                "negative": ["trop cool", "génial", "super", "wow"]
            },
            PersonaType.L_OPTIMISTE: {
                "positive": ["transforme", "révolutionne", "permet", "ouvre", "innove",
                            "améliore", "développe", "crée", "lance", "déploie"],
                "negative": ["impossible", "échec", "catastrophe", "jamais"]
            },
            PersonaType.LE_CONTEUR: {
                "positive": ["ainsi", "tandis que", "or", "cependant", "néanmoins",
                            "dès lors", "en effet", "de surcroît", "jadis"],
                "negative": []
            },
            PersonaType.LE_SATIRISTE: {
                "positive": ["officiellement", "communiqué", "selon nos informations",
                            "source autorisée", "expert", "statistiques"],
                "negative": []
            },
        }

        vocab_config = vocabulary_maps.get(persona_type, {"positive": [], "negative": []})

        positive_count = sum(1 for w in vocab_config["positive"] if w.lower() in text)
        negative_count = sum(1 for w in vocab_config["negative"] if w.lower() in text)

        # Score based on positive matches
        base_score = min(1.0, positive_count / 3) if vocab_config["positive"] else 0.7

        # Penalty for negative matches
        penalty = min(0.3, negative_count * 0.15)

        return max(0.0, base_score - penalty)

    def _generate_feedback(
        self,
        tone_score: float,
        style_markers_count: int,
        signature_present: bool,
        vocabulary_score: float,
        overall_score: float,
        persona: Persona
    ) -> tuple:
        """
        Generate issues and recommendations based on scores.

        Returns:
            (issues: List[str], recommendations: List[str])
        """
        issues = []
        recommendations = []

        # Tone issues
        if tone_score < 0.5:
            issues.append(f"Le ton ne correspond pas au persona '{persona.name}'")
            recommendations.append(f"Utiliser plus de vocabulaire {persona.tone}")

        # Style markers
        if style_markers_count < 2:
            issues.append(f"Pas assez de marqueurs stylistiques ({style_markers_count}/4 min)")
            recommendations.append(f"Ajouter des expressions caractéristiques de {persona.name}")

        # Signature
        if not signature_present and persona.signature:
            issues.append(f"Signature manquante: '{persona.signature}'")
            recommendations.append("Ajouter la signature du persona en fin d'article")

        # Vocabulary
        if vocabulary_score < 0.5:
            issues.append("Vocabulaire non aligné avec le style du persona")
            recommendations.append(f"Adapter le niveau de langue au style: {persona.style_reference}")

        # Overall assessment
        if overall_score < self.MIN_ACCEPTABLE_SCORE:
            recommendations.append("RECOMMANDATION: Utiliser la version neutre ou régénérer")

        return issues, recommendations

    def should_fallback_to_neutral(self, result: QualityResult) -> bool:
        """
        Determine if we should use the neutral version instead.

        Returns True if:
        - Overall score < MIN_ACCEPTABLE_SCORE (0.6)
        - Signature missing AND tone score < 0.4
        """
        if result.overall_score < self.MIN_ACCEPTABLE_SCORE:
            return True

        if not result.signature_present and result.tone_score < 0.4:
            return True

        return False

    def get_quality_tier(self, result: QualityResult) -> str:
        """
        Get a quality tier label for the result.

        Returns:
            "excellent" (>= 0.8), "good" (>= 0.7), "acceptable" (>= 0.6), "poor" (< 0.6)
        """
        if result.overall_score >= 0.8:
            return "excellent"
        elif result.overall_score >= 0.7:
            return "good"
        elif result.overall_score >= 0.6:
            return "acceptable"
        else:
            return "poor"


# Global instance
persona_quality_reviewer = PersonaQualityReviewer()


def get_persona_quality_reviewer() -> PersonaQualityReviewer:
    """Dependency injection for FastAPI"""
    return persona_quality_reviewer


def evaluate_persona_synthesis(synthesis: Dict[str, Any], persona_id: str) -> Dict[str, Any]:
    """
    Convenience function to evaluate a synthesis.

    Args:
        synthesis: The generated synthesis
        persona_id: ID of the persona used

    Returns:
        Dict with evaluation results
    """
    persona = PERSONAS.get(persona_id)
    if not persona:
        return {
            "error": f"Unknown persona: {persona_id}",
            "overall_score": 0.0,
            "should_fallback": True
        }

    result = persona_quality_reviewer.evaluate(synthesis, persona)

    return {
        "overall_score": result.overall_score,
        "tone_score": result.tone_score,
        "style_markers_count": result.style_markers_count,
        "signature_present": result.signature_present,
        "vocabulary_score": result.vocabulary_score,
        "issues": result.issues,
        "recommendations": result.recommendations,
        "quality_tier": persona_quality_reviewer.get_quality_tier(result),
        "should_fallback": persona_quality_reviewer.should_fallback_to_neutral(result)
    }
