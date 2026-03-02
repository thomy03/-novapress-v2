"""
Stop Words & Entity Normalization Module for NovaPress AI v2
Provides comprehensive French/English stop word lists, entity normalization,
and deduplication for clean trending entities and topic names.
"""
from typing import List, Set

# ============================================================
# FRENCH STOP WORDS (~600 words)
# Articles, prepositions, conjunctions, common verbs, temporal
# ============================================================
STOP_WORDS_FR: Set[str] = {
    # Articles & déterminants
    "le", "la", "les", "un", "une", "des", "du", "de", "d", "l",
    "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes",
    "son", "sa", "ses", "notre", "nos", "votre", "vos", "leur", "leurs",
    "quel", "quelle", "quels", "quelles", "quelque", "quelques",
    "chaque", "tout", "tous", "toute", "toutes", "aucun", "aucune",
    "certain", "certaine", "certains", "certaines", "même", "mêmes",
    "tel", "telle", "tels", "telles", "autre", "autres",
    "plusieurs", "divers", "diverses",

    # Pronoms
    "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
    "me", "te", "se", "lui", "y", "en",
    "qui", "que", "quoi", "dont", "où", "lequel", "laquelle", "lesquels", "lesquelles",
    "celui", "celle", "ceux", "celles",
    "ceci", "cela", "ça",
    "rien", "personne", "quiconque",

    # Prépositions
    "à", "au", "aux", "de", "du", "des", "en", "dans", "sur", "sous",
    "par", "pour", "avec", "sans", "contre", "entre", "vers", "chez",
    "depuis", "pendant", "durant", "avant", "après", "dès",
    "jusque", "jusqu", "devant", "derrière", "hors", "outre",
    "parmi", "selon", "malgré", "sauf", "via", "envers",

    # Conjonctions
    "et", "ou", "ni", "mais", "or", "donc", "car", "que", "quand",
    "lorsque", "puisque", "comme", "si", "sinon", "quoique",
    "bien", "afin", "tandis", "alors",

    # Verbes courants (conjugaisons fréquentes)
    "est", "sont", "a", "ont", "fait", "été", "être", "avoir", "faire",
    "peut", "doit", "va", "vont", "sera", "seront", "était", "étaient",
    "avait", "avaient", "fut", "furent", "ait", "soit",
    "pourrait", "devrait", "serait", "aurait", "ferait",
    "pourraient", "devraient", "seraient", "auraient", "feraient",
    "semble", "semblent", "reste", "restent", "vient", "viennent",
    "dit", "disent", "montre", "montrent", "indique", "indiquent",
    "annonce", "annoncent", "confirme", "confirment", "révèle", "révèlent",
    "prévoit", "prévoient", "estime", "estiment", "considère", "considèrent",
    "pense", "pensent", "veut", "veulent", "donne", "donnent",
    "prend", "prennent", "met", "mettent", "tient", "tiennent",
    "arrive", "arrivent", "passe", "passent", "trouve", "trouvent",
    "continue", "continuent", "lance", "lancent", "pose", "posent",

    # Adverbes
    "ne", "pas", "plus", "moins", "très", "trop", "bien", "mal",
    "encore", "aussi", "déjà", "toujours", "jamais", "souvent",
    "parfois", "seulement", "vraiment", "plutôt", "assez",
    "ici", "là", "partout", "ailleurs", "environ", "presque",
    "autant", "combien", "comment", "pourquoi", "quand",
    "maintenant", "bientôt", "ensuite", "enfin", "puis",
    "ainsi", "cependant", "pourtant", "néanmoins", "toutefois",
    "notamment", "particulièrement", "surtout", "également",
    "probablement", "apparemment", "effectivement", "évidemment",

    # Mots temporels (mois, jours, etc.)
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
    "jour", "jours", "semaine", "semaines", "mois", "année", "années",
    "hier", "demain", "aujourd", "hui", "aujourd'hui",
    "matin", "soir", "nuit",
    "heure", "heures", "minute", "minutes", "seconde", "secondes",

    # Mots quantitatifs
    "premier", "première", "premiers", "premières",
    "dernier", "dernière", "derniers", "dernières",
    "nouveau", "nouvelle", "nouveaux", "nouvelles",
    "grand", "grande", "grands", "grandes",
    "petit", "petite", "petits", "petites",
    "bon", "bonne", "bons", "bonnes",
    "mauvais", "mauvaise",
    "long", "longue", "longs", "longues",
    "gros", "grosse",
    "haut", "haute", "hauts", "hautes",
    "bas", "basse",
    "vieux", "vieille", "vieux", "vieilles",
    "jeune", "jeunes",
    "ancien", "ancienne", "anciens", "anciennes",
    "nombreux", "nombreuses",
    "seul", "seule", "seuls", "seules",
    "propre", "propres",
    "forte", "forts", "fortes", "fort",
    "important", "importante", "importants", "importantes",
    "possible", "possibles", "impossible",
    "différent", "différente", "différents", "différentes",
    "plein", "pleine",
    "entier", "entière",
    "prochain", "prochaine", "prochains", "prochaines",

    # Mots fonctionnels
    "selon", "face", "suite", "vis",
    "grâce", "lors", "côté",
    "travers", "cours", "sein", "lieu",
    "cas", "fois", "part", "fin", "début",
    "point", "mise", "prise", "aide",
    "non", "oui",
    "voici", "voilà",
    "soit", "voire",

    # Mots piège qui polluent les entités
    "unis", "etat", "état", "etats", "états",  # "unis" seul, pas "États-Unis"
    "monde", "pays", "ville", "région",
    "gouvernement", "président", "ministre", "chef",
    "politique", "économie", "société", "culture",
    "question", "réponse", "problème", "solution",
    "rapport", "analyse", "synthèse", "article",
    "information", "données", "résultat", "résultats",
    "situation", "position", "décision", "mesure", "mesures",
    "projet", "plan", "programme", "système", "service",
    "million", "millions", "milliard", "milliards",
    "dollar", "dollars", "euro", "euros",
    "pourcent", "pourcentage",
    "partie", "ensemble", "groupe", "nombre",
    "niveau", "forme", "type", "genre", "sorte",
    "chose", "manière", "façon", "raison", "cause", "effet",
    "sens", "idée", "objet", "place", "rôle",
    "besoin", "moyen", "moyens", "effort", "efforts",
    "travail", "action", "actions", "réforme", "réformes",
    "crise", "conflit", "guerre", "paix",
    "avenir", "futur", "passé", "présent", "histoire",
    "nouvelle", "nouvelles",  # Ambiguous: "une nouvelle" vs proper name
}

# ============================================================
# ENGLISH STOP WORDS (~300 words)
# ============================================================
STOP_WORDS_EN: Set[str] = {
    # Articles & determiners
    "the", "a", "an", "this", "that", "these", "those",
    "my", "your", "his", "her", "its", "our", "their",
    "some", "any", "no", "every", "each", "all", "both",
    "few", "many", "much", "more", "most", "other", "another",
    "such", "what", "which", "whose",

    # Pronouns
    "i", "me", "you", "he", "him", "she", "it", "we", "us", "they", "them",
    "who", "whom", "what", "where", "when", "why", "how",
    "myself", "yourself", "himself", "herself", "itself",
    "ourselves", "themselves",

    # Prepositions
    "in", "on", "at", "to", "for", "with", "by", "from", "of",
    "about", "into", "through", "during", "before", "after",
    "above", "below", "between", "under", "over", "against",
    "along", "across", "behind", "beyond", "within", "without",
    "upon", "toward", "towards", "among", "around", "until",

    # Conjunctions
    "and", "or", "but", "nor", "so", "yet", "for",
    "because", "although", "though", "while", "since", "unless",
    "if", "whether", "than", "as",

    # Common verbs
    "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "having",
    "do", "does", "did", "doing", "done",
    "will", "would", "shall", "should",
    "can", "could", "may", "might", "must",
    "get", "gets", "got", "getting",
    "make", "makes", "made", "making",
    "go", "goes", "went", "gone", "going",
    "come", "comes", "came", "coming",
    "take", "takes", "took", "taken",
    "say", "says", "said", "saying",
    "see", "sees", "saw", "seen",
    "know", "knows", "knew", "known",
    "think", "thinks", "thought",
    "give", "gives", "gave", "given",
    "find", "finds", "found",
    "tell", "tells", "told",
    "become", "becomes", "became",
    "show", "shows", "showed", "shown",
    "keep", "keeps", "kept",
    "let", "lets",
    "begin", "begins", "began", "begun",
    "seem", "seems", "seemed",
    "help", "helps", "helped",
    "set", "sets",
    "run", "runs", "ran",
    "move", "moves", "moved",
    "try", "tries", "tried",
    "ask", "asks", "asked",
    "need", "needs", "needed",
    "mean", "means", "meant",
    "put", "puts",
    "turn", "turns", "turned",
    "want", "wants", "wanted",
    "look", "looks", "looked",
    "use", "uses", "used",
    "work", "works", "worked",
    "call", "calls", "called",
    "play", "plays", "played",

    # Adverbs
    "not", "very", "also", "just", "only", "still",
    "already", "even", "now", "then", "here", "there",
    "always", "never", "often", "sometimes", "usually",
    "really", "quite", "rather", "too", "almost", "enough",
    "well", "back", "again", "away", "once", "ever",
    "however", "therefore", "moreover", "furthermore",
    "meanwhile", "instead", "perhaps", "probably",
    "recently", "today", "yesterday", "tomorrow",

    # Temporal
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "day", "days", "week", "weeks", "month", "months", "year", "years",
    "morning", "evening", "night",

    # Quantitative / descriptive
    "first", "second", "third", "last", "next", "new",
    "old", "big", "small", "long", "short", "high", "low",
    "good", "bad", "great", "little", "large",
    "same", "different", "own", "other",
    "public", "national", "international", "global", "local",
    "major", "important", "significant",
    "million", "billion", "percent", "number",

    # News-specific functional words
    "according", "report", "reports", "reported",
    "officials", "official", "statement", "source", "sources",
    "country", "countries", "government", "president", "minister",
    "people", "world", "state", "states",
    "crisis", "conflict", "issue", "issues",
    "decision", "policy", "plan", "program",
    "part", "case", "way", "end", "time",
}

# Combined set for quick lookup
STOP_WORDS_ALL: Set[str] = STOP_WORDS_FR | STOP_WORDS_EN


# ============================================================
# ENTITY ALIASES — Normalisation de formes courtes/variantes
# ============================================================
ENTITY_ALIASES = {
    # Personnes politiques
    "trump": "Donald Trump",
    "donald trump": "Donald Trump",
    "biden": "Joe Biden",
    "joe biden": "Joe Biden",
    "macron": "Emmanuel Macron",
    "emmanuel macron": "Emmanuel Macron",
    "poutine": "Vladimir Poutine",
    "putin": "Vladimir Poutine",
    "vladimir putin": "Vladimir Poutine",
    "vladimir poutine": "Vladimir Poutine",
    "zelensky": "Volodymyr Zelensky",
    "zelenskyy": "Volodymyr Zelensky",
    "xi": "Xi Jinping",
    "xi jinping": "Xi Jinping",
    "scholz": "Olaf Scholz",
    "starmer": "Keir Starmer",
    "modi": "Narendra Modi",
    "netanyahu": "Benjamin Netanyahu",
    "netanyahou": "Benjamin Netanyahu",
    "meloni": "Giorgia Meloni",
    "musk": "Elon Musk",
    "elon musk": "Elon Musk",

    # Pays / Géopolitique
    "etats-unis": "États-Unis",
    "états-unis": "États-Unis",
    "usa": "États-Unis",
    "us": "États-Unis",
    "ue": "Union Européenne",
    "eu": "Union Européenne",
    "union européenne": "Union Européenne",
    "union europeenne": "Union Européenne",
    "otan": "OTAN",
    "nato": "OTAN",
    "onu": "ONU",
    "un": "ONU",  # Note: only applied when identified as entity, not article "un"
    "russie": "Russie",
    "russia": "Russie",
    "chine": "Chine",
    "china": "Chine",
    "ukraine": "Ukraine",
    "palestine": "Palestine",
    "gaza": "Gaza",
    "israel": "Israël",
    "israël": "Israël",
    "iran": "Iran",
    "royaume-uni": "Royaume-Uni",
    "uk": "Royaume-Uni",

    # Tech
    "ia": "Intelligence Artificielle",
    "ai": "Intelligence Artificielle",
    "openai": "OpenAI",
    "google": "Google",
    "meta": "Meta",
    "apple": "Apple",
    "microsoft": "Microsoft",
    "chatgpt": "ChatGPT",
    "gpt": "GPT",
}


# ============================================================
# VALIDATION & NORMALIZATION FUNCTIONS
# ============================================================

def is_valid_entity(text: str, min_length: int = 4) -> bool:
    """
    Check if a string is a valid entity (not a stop word, not too short, not numeric).

    Args:
        text: The entity text to validate
        min_length: Minimum character length (default 4)

    Returns:
        True if the entity is valid
    """
    if not text or not text.strip():
        return False

    cleaned = text.strip()

    # Too short
    if len(cleaned) < min_length:
        return False

    # Pure numeric
    if cleaned.isdigit():
        return False

    # Check against stop words (case-insensitive)
    if cleaned.lower() in STOP_WORDS_ALL:
        return False

    # Reject single common words that look like entities but aren't
    # (e.g., "Après", "Depuis", "Nouveau" when title-cased)
    if cleaned.lower().rstrip('s') in STOP_WORDS_ALL:
        return False

    # Reject strings that are mostly non-alphabetic
    alpha_count = sum(1 for c in cleaned if c.isalpha())
    if alpha_count < len(cleaned) * 0.5:
        return False

    return True


def normalize_entity(text: str) -> str:
    """
    Normalize an entity string: strip, resolve aliases, title-case.

    Args:
        text: The raw entity text

    Returns:
        Normalized entity string
    """
    if not text:
        return ""

    cleaned = text.strip()
    lower = cleaned.lower()

    # Check aliases first
    if lower in ENTITY_ALIASES:
        return ENTITY_ALIASES[lower]

    # Title-case for proper nouns, but preserve acronyms (all-caps words)
    words = cleaned.split()
    normalized_words = []
    for word in words:
        if word.isupper() and len(word) >= 2:
            # Preserve acronyms: NATO, OTAN, UE, AI, etc.
            normalized_words.append(word)
        elif word[0].isupper() if word else False:
            # Already capitalized, keep as-is
            normalized_words.append(word)
        else:
            normalized_words.append(word.capitalize())

    return " ".join(normalized_words)


def deduplicate_entities(entities: List[dict]) -> List[dict]:
    """
    Deduplicate entity list, merging short forms into long forms.
    Expects list of dicts with 'entity' and 'count' keys.

    E.g., "Trump" (5) + "Donald Trump" (3) → "Donald Trump" (8)

    Args:
        entities: List of {"entity": str, "count": int} dicts

    Returns:
        Deduplicated and merged list
    """
    if not entities:
        return []

    # Build a map of normalized_lower → best_name, total_count
    merged: dict = {}

    for item in entities:
        name = item.get("entity", "")
        count = item.get("count", 1)
        key = name.lower().strip()

        if not key:
            continue

        if key in merged:
            merged[key]["count"] += count
            # Keep the longer form as display name
            if len(name) > len(merged[key]["entity"]):
                merged[key]["entity"] = name
        else:
            # Check if this is a substring of an existing key or vice versa
            found_parent = False
            keys_to_check = list(merged.keys())
            for existing_key in keys_to_check:
                # "trump" is in "donald trump"
                if key in existing_key:
                    merged[existing_key]["count"] += count
                    found_parent = True
                    break
                # "donald trump" contains "trump"
                elif existing_key in key:
                    # Merge existing into this (longer) key
                    old = merged.pop(existing_key)
                    merged[key] = {
                        "entity": name if len(name) >= len(old["entity"]) else old["entity"],
                        "count": old["count"] + count,
                    }
                    found_parent = True
                    break

            if not found_parent:
                merged[key] = {"entity": name, "count": count}

    # Convert back to list, sorted by count
    result = sorted(merged.values(), key=lambda x: x["count"], reverse=True)
    return result
