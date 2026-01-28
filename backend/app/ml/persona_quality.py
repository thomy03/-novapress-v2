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
    # ═══════════════════════════════════════════════════════════════
    # ORIGINAUX (4 non-neutre)
    # ═══════════════════════════════════════════════════════════════
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

    # ═══════════════════════════════════════════════════════════════
    # POLITIQUES/IDÉOLOGIQUES (5)
    # ═══════════════════════════════════════════════════════════════
    PersonaType.LE_SOUVERAINISTE: {
        "keywords": [
            "souveraineté", "frontières", "nation", "identité", "patrie",
            "bruxelles", "technocrates", "mondialisation", "élites",
            "déconnectés", "la france d'abord", "nos", "notre",
            "indépendance", "traités", "directives"
        ],
        "patterns": [
            r"la france d'abord",
            r"nos frontières|notre souveraineté|notre nation",
            r"bruxelles|technocrates|élites",
        ],
        "forbidden": [],
    },
    PersonaType.L_ECOLOGISTE: {
        "keywords": [
            "urgence climatique", "carbone", "giec", "biodiversité",
            "écosystème", "planète b", "générations futures", "effondrement",
            "greenwashing", "fossiles", "renouvelables", "sobriété",
            "point de bascule", "empreinte"
        ],
        "patterns": [
            r"il n'y a pas de planète b",
            r"urgence climatique|effondrement",
            r"giec|biodiversité",
        ],
        "forbidden": [],
    },
    PersonaType.LE_TECHNO_SCEPTIQUE: {
        "keywords": [
            "vie privée", "données personnelles", "surveillance", "gafam",
            "big tech", "algorithme", "biais", "consentement", "éthique",
            "logiciel libre", "décentralisation", "rgpd", "opacité",
            "l'humain avant la machine"
        ],
        "patterns": [
            r"l'humain avant la machine",
            r"gafam|big tech|surveillance",
            r"vie privée|données personnelles",
        ],
        "forbidden": [],
    },
    PersonaType.L_ECONOMISTE: {
        "keywords": [
            "pib", "croissance", "inflation", "récession", "marché",
            "cac40", "wall street", "investisseurs", "milliards",
            "pourcentage", "statistiques", "tendance", "indicateurs",
            "les chiffres ne mentent jamais"
        ],
        "patterns": [
            r"les chiffres ne mentent jamais",
            r"\d+%|\d+ milliards",
            r"pib|inflation|croissance",
            r"cac40|wall street",
        ],
        "forbidden": [],
    },
    PersonaType.LE_POPULISTE: {
        "keywords": [
            "le peuple", "les élites", "ceux d'en haut", "technocrates",
            "bon sens", "déconnectés", "les gens", "les oubliés",
            "privilèges", "entre-soi", "système", "ça suffit",
            "le peuple a toujours raison"
        ],
        "patterns": [
            r"le peuple a toujours raison",
            r"le peuple|les élites|ceux d'en haut",
            r"bon sens|déconnectés",
        ],
        "forbidden": [],
    },

    # ═══════════════════════════════════════════════════════════════
    # PHILOSOPHIQUES/INTELLECTUELS (3)
    # ═══════════════════════════════════════════════════════════════
    PersonaType.L_HISTORIEN: {
        "keywords": [
            "comme en", "rappelle", "cycle", "répétition", "histoire",
            "nos ancêtres", "leçons du passé", "éternel retour",
            "générations précédentes", "déjà vu", "l'histoire rime"
        ],
        "patterns": [
            r"l'histoire ne se répète pas.+rime",
            r"comme en \d{4}|rappelle \d{4}",
            r"leçons du passé|nos ancêtres",
        ],
        "forbidden": [],
    },
    PersonaType.LE_PHILOSOPHE: {
        "keywords": [
            "qu'est-ce que", "vraiment", "posons-nous la question",
            "interrogeons-nous", "au fond", "fondamentalement", "sens",
            "existence", "liberté", "vérité", "comme disait", "selon",
            "la question est plus importante"
        ],
        "patterns": [
            r"la question est plus importante",
            r"qu'est-ce que.+vraiment",
            r"posons-nous la question|interrogeons-nous",
        ],
        "forbidden": [],
    },
    PersonaType.LE_SCIENTIFIQUE: {
        "keywords": [
            "selon une étude", "les données montrent", "corrélation",
            "causalité", "méta-analyse", "peer-review", "échantillon",
            "reproductibilité", "hypothèse", "prudence", "nuance",
            "correlation n'est pas causalité"
        ],
        "patterns": [
            r"corrélation n'est pas causalité",
            r"selon une étude|les données",
            r"méta-analyse|peer-review",
        ],
        "forbidden": [],
    },

    # ═══════════════════════════════════════════════════════════════
    # GÉNÉRATIONNELS (3)
    # ═══════════════════════════════════════════════════════════════
    PersonaType.LE_BOOMER: {
        "keywords": [
            "de mon temps", "à mon époque", "quand j'étais jeune",
            "les jeunes d'aujourd'hui", "on savait", "on respectait",
            "les valeurs", "le mérite", "l'effort", "ces téléphones",
            "cette modernité", "de mon temps c'était mieux"
        ],
        "patterns": [
            r"de mon temps.+mieux",
            r"de mon temps|à mon époque",
            r"les jeunes d'aujourd'hui",
        ],
        "forbidden": [],
    },
    PersonaType.LE_MILLENNIAL: {
        "keywords": [
            "ok boomer", "cringe", "mood", "vibe", "burnout",
            "précarité", "cdi", "on fait avec", "c'est la vie",
            "on survit", "cursed", "timeline"
        ],
        "patterns": [
            r"ok boomer",
            r"cringe|mood|vibe",
            r"burnout|précarité",
        ],
        "forbidden": [],
    },
    PersonaType.LE_GEN_Z: {
        "keywords": [
            "no cap", "fr fr", "slay", "sus", "based", "lowkey",
            "highkey", "bet", "deadass", "mid", "w", "l", "💀", "🔥"
        ],
        "patterns": [
            r"no cap|fr fr",
            r"slay|sus|based|mid",
            r"lowkey|highkey",
        ],
        "forbidden": [],
    },

    # ═══════════════════════════════════════════════════════════════
    # CONTROVERSÉS (2)
    # ═══════════════════════════════════════════════════════════════
    PersonaType.LE_COMPLOTISTE: {
        "keywords": [
            "cui bono", "à qui profite", "coïncidence", "on peut se demander",
            "certains pensent", "il est légitime", "suivez l'argent",
            "troublant", "curieux", "hasard"
        ],
        "patterns": [
            r"à qui profite le crime",
            r"cui bono|suivez l'argent",
            r"certains.+demandent|on peut.+interroger",
        ],
        "forbidden": [
            "reptiliens", "terre plate"  # Théories délirantes interdites
        ],
    },
    PersonaType.LE_PROVOCATEUR: {
        "keywords": [
            "et si au contraire", "à contre-courant", "osons le dire",
            "personne n'ose", "tabou", "avocat du diable", "l'autre côté",
            "pensée unique", "consensus mou", "remettons en question",
            "et si on voyait les choses autrement"
        ],
        "patterns": [
            r"et si on voyait les choses autrement",
            r"et si au contraire|à contre-courant",
            r"osons le dire|personne n'ose",
        ],
        "forbidden": [],
    },
}

# Tone keywords for analysis
TONE_KEYWORDS = {
    # Originaux
    "sardonic": ["cynique", "ironique", "sardonique", "désabusé", "amer", "mordant"],
    "optimistic": ["positif", "prometteur", "espoir", "solution", "progrès", "opportunité"],
    "dramatic": ["épique", "dramatique", "haletant", "suspense", "rebondissement"],
    "satirical": ["parodique", "absurde", "exagération", "satire"],
    "neutral": ["factuel", "objectif", "neutre", "informatif"],
    # Nouveaux tons
    "patriotic": ["nation", "souveraineté", "patrie", "frontières", "identité"],
    "ecological": ["climat", "planète", "urgence", "environnement", "biodiversité"],
    "skeptical": ["surveillance", "vie privée", "données", "éthique", "consentement"],
    "analytical": ["chiffres", "statistiques", "pourcentage", "croissance", "indicateurs"],
    "populist": ["peuple", "élites", "bon sens", "déconnectés", "système"],
    "historical": ["histoire", "cycle", "répétition", "ancêtres", "leçons"],
    "philosophical": ["question", "sens", "existence", "vérité", "fondamentalement"],
    "scientific": ["étude", "données", "corrélation", "hypothèse", "méthodologie"],
    "nostalgic": ["temps", "époque", "valeurs", "mérite", "respect"],
    "ironic_millennial": ["cringe", "burnout", "précarité", "vibe", "mood"],
    "gen_z_slang": ["no cap", "fr fr", "slay", "sus", "based"],
    "questioning": ["cui bono", "coïncidence", "troublant", "curieux"],
    "contrarian": ["contre-courant", "tabou", "pensée unique", "remettons en question"],
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

    # Minimum thresholds - Lowered from 0.6 to 0.35 to allow more persona content
    # The LLM often produces good persona content that doesn't hit all markers
    MIN_ACCEPTABLE_SCORE = 0.35
    IDEAL_SCORE = 0.7

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
            # Originaux
            PersonaType.LE_CYNIQUE: "sardonic",
            PersonaType.L_OPTIMISTE: "optimistic",
            PersonaType.LE_CONTEUR: "dramatic",
            PersonaType.LE_SATIRISTE: "satirical",
            PersonaType.NEUTRAL: "neutral",
            # Politiques/Idéologiques
            PersonaType.LE_SOUVERAINISTE: "patriotic",
            PersonaType.L_ECOLOGISTE: "ecological",
            PersonaType.LE_TECHNO_SCEPTIQUE: "skeptical",
            PersonaType.L_ECONOMISTE: "analytical",
            PersonaType.LE_POPULISTE: "populist",
            # Philosophiques/Intellectuels
            PersonaType.L_HISTORIEN: "historical",
            PersonaType.LE_PHILOSOPHE: "philosophical",
            PersonaType.LE_SCIENTIFIQUE: "scientific",
            # Générationnels
            PersonaType.LE_BOOMER: "nostalgic",
            PersonaType.LE_MILLENNIAL: "ironic_millennial",
            PersonaType.LE_GEN_Z: "gen_z_slang",
            # Controversés
            PersonaType.LE_COMPLOTISTE: "questioning",
            PersonaType.LE_PROVOCATEUR: "contrarian",
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

        # Calculate score - More lenient scoring
        if expected_count == 0:
            base_score = 0.5  # No expected markers = base score (was 0.3)
        else:
            base_score = min(1.0, 0.5 + expected_count / 4)  # 1 keyword = 0.75, 2 = 1.0

        # Penalty for contradicting tone - reduced from 0.1 per keyword
        penalty = min(0.2, contradicting_count * 0.05)

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

        # Normalize score - More lenient (1 marker = 0.5, 2 = 0.75, 3+ = 1.0)
        base_score = min(1.0, 0.25 + total_count * 0.25)

        # Penalty for forbidden words - reduced
        forbidden_penalty = min(0.3, forbidden_count * 0.15)

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
            # ═══════════════════════════════════════════════════════════════
            # ORIGINAUX
            # ═══════════════════════════════════════════════════════════════
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
            # ═══════════════════════════════════════════════════════════════
            # POLITIQUES/IDÉOLOGIQUES
            # ═══════════════════════════════════════════════════════════════
            PersonaType.LE_SOUVERAINISTE: {
                "positive": ["souveraineté", "nation", "frontières", "indépendance",
                            "patrie", "identité", "nos"],
                "negative": ["mondialiste", "cosmopolite"]
            },
            PersonaType.L_ECOLOGISTE: {
                "positive": ["durable", "renouvelable", "biodiversité", "carbone",
                            "climat", "écosystème", "planète"],
                "negative": ["greenwashing", "fossile"]
            },
            PersonaType.LE_TECHNO_SCEPTIQUE: {
                "positive": ["vie privée", "éthique", "consentement", "décentralisé",
                            "libre", "humain"],
                "negative": []
            },
            PersonaType.L_ECONOMISTE: {
                "positive": ["milliards", "pourcentage", "croissance", "indicateur",
                            "tendance", "marché", "investissement"],
                "negative": []
            },
            PersonaType.LE_POPULISTE: {
                "positive": ["peuple", "bon sens", "gens", "réalité",
                            "terrain", "concret"],
                "negative": ["technocrate", "élitiste"]
            },
            # ═══════════════════════════════════════════════════════════════
            # PHILOSOPHIQUES/INTELLECTUELS
            # ═══════════════════════════════════════════════════════════════
            PersonaType.L_HISTORIEN: {
                "positive": ["cycle", "histoire", "précédent", "parallèle",
                            "répétition", "leçon", "jadis"],
                "negative": []
            },
            PersonaType.LE_PHILOSOPHE: {
                "positive": ["question", "sens", "essence", "fondamentalement",
                            "existence", "vérité", "liberté"],
                "negative": []
            },
            PersonaType.LE_SCIENTIFIQUE: {
                "positive": ["étude", "données", "hypothèse", "méthodologie",
                            "échantillon", "corrélation", "prudence"],
                "negative": []
            },
            # ═══════════════════════════════════════════════════════════════
            # GÉNÉRATIONNELS
            # ═══════════════════════════════════════════════════════════════
            PersonaType.LE_BOOMER: {
                "positive": ["époque", "temps", "valeurs", "respect",
                            "mérite", "effort", "tradition"],
                "negative": ["tiktok", "snapchat"]
            },
            PersonaType.LE_MILLENNIAL: {
                "positive": ["cringe", "vibe", "mood", "burnout",
                            "précarité", "galère"],
                "negative": []
            },
            PersonaType.LE_GEN_Z: {
                "positive": ["no cap", "fr fr", "slay", "sus", "based",
                            "lowkey", "deadass"],
                "negative": []
            },
            # ═══════════════════════════════════════════════════════════════
            # CONTROVERSÉS
            # ═══════════════════════════════════════════════════════════════
            PersonaType.LE_COMPLOTISTE: {
                "positive": ["cui bono", "coïncidence", "troublant", "curieux",
                            "hasard", "questionnement"],
                "negative": ["reptilien", "terre plate"]
            },
            PersonaType.LE_PROVOCATEUR: {
                "positive": ["contre-courant", "tabou", "remettons", "osons",
                            "consensus", "pensée unique"],
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
            "excellent" (>= 0.7), "good" (>= 0.5), "acceptable" (>= 0.35), "poor" (< 0.35)
        """
        if result.overall_score >= 0.7:
            return "excellent"
        elif result.overall_score >= 0.5:
            return "good"
        elif result.overall_score >= 0.35:
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
