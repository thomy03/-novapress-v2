"""
Category Classifier for NovaPress Syntheses
Uses keyword matching + NLP for automatic classification
"""
from typing import Tuple, List, Dict
from loguru import logger
import re
import unicodedata


# Category keyword mappings (French-focused)
CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "MONDE": [
        "international", "geopolitique", "diplomatie", "guerre", "conflit",
        "ONU", "OTAN", "NATO", "union europeenne", "UE", "sommet", "traite",
        "ambassadeur", "coalition", "sanctions", "frontiere", "migration",
        "refugies", "humanitaire", "OSCE", "G7", "G20", "COP", "climat mondial",
        "Trump", "Biden", "Poutine", "Xi Jinping", "Zelensky", "Netanyahu",
        "Ukraine", "Gaza", "Israel", "Palestine", "Chine", "Russie", "USA",
        "Etats-Unis", "Moyen-Orient", "Afrique", "Asie", "Amerique latine"
    ],
    "TECH": [
        "IA", "intelligence artificielle", "machine learning", "startup",
        "tech", "numerique", "Apple", "Google", "Microsoft", "OpenAI",
        "ChatGPT", "algorithme", "logiciel", "application", "cybersecurite",
        "5G", "cloud", "donnees", "robot", "automatisation", "Meta", "Facebook",
        "Tesla", "Elon Musk", "Sam Altman", "smartphone", "ordinateur",
        "programmation", "developpeur", "innovation", "deepfake", "blockchain",
        "NFT", "metaverse", "realite virtuelle", "VR", "AR", "GPU", "NVIDIA",
        "AMD", "Intel", "processeur", "semiconductor", "puces", "quantique"
    ],
    "ECONOMIE": [
        "economie", "PIB", "inflation", "BCE", "Fed", "bourse", "CAC",
        "crypto", "bitcoin", "ethereum", "finance", "marche", "commerce",
        "emploi", "chomage", "investissement", "entreprise", "croissance",
        "recession", "dette", "budget", "impot", "fiscalite", "banque",
        "assurance", "immobilier", "euro", "dollar", "devise", "monnaie",
        "export", "import", "commerce international", "startup", "levee de fonds",
        "introduction en bourse", "IPO", "fusion", "acquisition", "actionnaire",
        "dividende", "taux", "credit", "pret", "epargne", "retraite"
    ],
    "POLITIQUE": [
        "politique", "election", "gouvernement", "loi", "parlement",
        "senat", "assemblee", "maire", "vote", "referendum", "parti",
        "depute", "ministre", "Macron", "Elysee", "reforme", "opposition",
        "majorite", "gauche", "droite", "extreme", "RN", "LFI", "Renaissance",
        "LR", "PS", "EELV", "premier ministre", "Attal", "Barnier", "Le Pen",
        "Melenchon", "Bardella", "motion de censure", "49.3", "constitution",
        "democratie", "republique", "citoyennete", "manifestation", "greve",
        "syndicat", "CGT", "CFDT", "retraite", "travail"
    ],
    "CULTURE": [
        "culture", "cinema", "musique", "art", "festival", "exposition",
        "livre", "theatre", "serie", "film", "concert", "musee",
        "litterature", "peinture", "Cannes", "Cesar", "Oscar", "Grammy",
        "Netflix", "Disney", "streaming", "artiste", "acteur", "actrice",
        "realisateur", "scenariste", "album", "chanson", "clip", "spectacle",
        "danse", "opera", "ballet", "galerie", "sculpture", "photographie",
        "mode", "fashion", "couture", "design", "architecture", "patrimoine",
        "UNESCO", "monument", "histoire", "archeologie"
    ],
    "SPORT": [
        "sport", "football", "rugby", "tennis", "JO", "olympique",
        "match", "competition", "equipe", "champion", "Ligue", "coupe",
        "FIFA", "UEFA", "PSG", "OM", "OL", "marathon", "Tour de France",
        "cyclisme", "natation", "athletisme", "basketball", "NBA", "handball",
        "volleyball", "golf", "formule 1", "F1", "MotoGP", "boxe", "MMA",
        "ski", "patinage", "hockey", "baseball", "NFL", "Super Bowl",
        "Roland Garros", "Wimbledon", "US Open", "Champions League",
        "Mbappe", "Griezmann", "Zidane", "Nadal", "Djokovic", "Federer"
    ],
    "SCIENCES": [
        "science", "recherche", "decouverte", "espace", "NASA", "climat",
        "environnement", "sante", "medical", "etude", "laboratoire",
        "vaccin", "molecule", "physique", "biologie", "CNRS", "INSERM",
        "universite", "chercheur", "scientifique", "experience", "theorie",
        "ADN", "gene", "genetique", "cancer", "maladie", "traitement",
        "medicament", "hopital", "epidemie", "pandemie", "virus", "bacterie",
        "astronomie", "planete", "Mars", "Lune", "satellite", "fusee", "SpaceX",
        "ESA", "telescope", "James Webb", "Big Bang", "trou noir", "galaxie",
        "rechauffement", "CO2", "carbone", "biodiversite", "extinction", "ecologie"
    ]
}


def normalize_text(text: str) -> str:
    """Remove accents and normalize text for matching."""
    if not text:
        return ""
    # Normalize unicode and remove accents
    normalized = unicodedata.normalize('NFD', text)
    return ''.join(c for c in normalized if unicodedata.category(c) != 'Mn').lower()


def classify_synthesis(
    title: str,
    summary: str,
    key_entities: List[str] = None
) -> Tuple[str, float]:
    """
    Classify a synthesis into a category based on keywords.

    Args:
        title: Synthesis title
        summary: Synthesis summary/introduction (first 1000 chars used)
        key_entities: List of key entities from the synthesis

    Returns:
        Tuple of (category_name, confidence_score 0-1)
    """
    if not title and not summary:
        return "MONDE", 0.3

    # Combine text for analysis (limit summary to avoid performance issues)
    text = f"{title or ''} {(summary or '')[:1500]}"
    if key_entities:
        text += " " + " ".join(key_entities[:20])

    # Normalize text for matching
    text_normalized = normalize_text(text)
    title_normalized = normalize_text(title or "")

    # Score each category
    scores: Dict[str, float] = {}

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = 0.0
        matched_keywords = []

        for keyword in keywords:
            keyword_normalized = normalize_text(keyword)

            # Use word boundary matching for better precision
            # For short keywords (<=3 chars), require exact word match
            if len(keyword_normalized) <= 3:
                pattern = r'\b' + re.escape(keyword_normalized) + r'\b'
            else:
                # For longer keywords, also match as substring
                pattern = re.escape(keyword_normalized)

            try:
                # Count matches in full text
                text_matches = len(re.findall(pattern, text_normalized))

                # Title matches count triple (more important)
                title_matches = len(re.findall(pattern, title_normalized))

                if text_matches > 0 or title_matches > 0:
                    # Weight: title x3, text x1, with diminishing returns
                    keyword_score = min(title_matches * 3 + text_matches, 10)
                    score += keyword_score
                    matched_keywords.append(keyword)

            except re.error:
                continue

        scores[category] = score

        if score > 0:
            logger.debug(f"  {category}: {score:.1f} ({len(matched_keywords)} keywords matched)")

    # Get best category
    if not scores or max(scores.values()) == 0:
        logger.debug("No category keywords matched, defaulting to MONDE")
        return "MONDE", 0.3

    # Sort by score
    sorted_categories = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    best_category = sorted_categories[0][0]
    best_score = sorted_categories[0][1]

    # Calculate confidence based on:
    # 1. Absolute score (more matches = higher confidence)
    # 2. Relative score (how much better than second place)
    total_score = sum(scores.values())
    second_score = sorted_categories[1][1] if len(sorted_categories) > 1 else 0

    # Base confidence from proportion of total
    base_confidence = best_score / total_score if total_score > 0 else 0.5

    # Boost if significantly better than second place
    margin = (best_score - second_score) / best_score if best_score > 0 else 0
    confidence = base_confidence * 0.7 + margin * 0.3

    # Ensure minimum confidence for matched categories
    confidence = max(0.4, min(0.95, confidence))

    logger.info(f"Category classification: {best_category} (confidence: {confidence:.2f}, score: {best_score:.1f})")

    return best_category, round(confidence, 2)


def get_all_categories() -> List[str]:
    """Return list of all category names."""
    return list(CATEGORY_KEYWORDS.keys())


def get_category_keywords(category: str) -> List[str]:
    """Return keywords for a specific category."""
    return CATEGORY_KEYWORDS.get(category.upper(), [])


# For testing
if __name__ == "__main__":
    # Test cases
    test_cases = [
        ("Macron annonce une reforme des retraites", "Le president Emmanuel Macron a presente son projet de reforme des retraites devant l'Assemblee nationale"),
        ("OpenAI lance GPT-5", "La startup d'intelligence artificielle OpenAI a devoile son nouveau modele de langage"),
        ("Le PSG bat le Real Madrid", "Le Paris Saint-Germain s'est impose 3-1 face au Real Madrid en Ligue des Champions"),
        ("Decouverte d'une nouvelle exoplanete", "Des chercheurs du CNRS ont identifie une planete potentiellement habitable"),
        ("La BCE maintient ses taux", "La Banque centrale europeenne a decide de maintenir ses taux directeurs inchanges"),
    ]

    for title, summary in test_cases:
        cat, conf = classify_synthesis(title, summary)
        print(f"'{title[:50]}...' -> {cat} ({conf})")
