"""
French Text Preprocessor for TTS
Normalizes numbers, abbreviations, punctuation for natural French speech synthesis.
"""
import re
from typing import List, Tuple

from loguru import logger

# Try to import num2words (optional but recommended)
try:
    from num2words import num2words
    NUM2WORDS_AVAILABLE = True
except ImportError:
    NUM2WORDS_AVAILABLE = False
    logger.warning("num2words not installed — number expansion disabled. Install with: pip install num2words")


# --- Abbreviation expansion ---

# Common French abbreviations -> spoken form
ABBREVIATIONS = {
    # Titles (case-insensitive matching done separately)
    "M.": "Monsieur",
    "Mme": "Madame",
    "Mme.": "Madame",
    "Mlle": "Mademoiselle",
    "Mlle.": "Mademoiselle",
    "Dr.": "Docteur",
    "Dr": "Docteur",
    "Pr.": "Professeur",
    "Pr": "Professeur",
    "Me": "Maître",
    "Me.": "Maître",
    "Mgr": "Monseigneur",
    # Units
    "km/h": "kilomètres heure",
    "km": "kilomètres",
    "m²": "mètres carrés",
    "m2": "mètres carrés",
    "kg": "kilogrammes",
    "mg": "milligrammes",
    "°C": "degrés Celsius",
    "°F": "degrés Fahrenheit",
    "kWh": "kilowattheures",
    "GW": "gigawatts",
    "MW": "mégawatts",
    # Currency symbols
    "€": "euros",
    "$": "dollars",
    "£": "livres sterling",
    "¥": "yens",
    # Misc
    "etc.": "et cetera",
    "n°": "numéro",
    "N°": "numéro",
}

# Acronyms to spell out letter by letter (spoken as individual letters)
SPELLED_ACRONYMS = {
    "BCE", "PIB", "FMI", "ONU", "UE", "USA", "FBI", "CIA", "NSA",
    "OMS", "OMC", "ONG", "PME", "PMI", "PDG", "DRH", "RSA", "RSE",
    "TVA", "ISF", "CSG", "SMIC", "CDD", "CDI", "HLM", "SDF",
    "RER", "TGV", "SNCF", "RATP", "EDF", "GDF",
    "OTAN", "OPEP", "BRICS", "G7", "G20",
    "IA", "ML", "NLP", "API", "GPU", "CPU", "RAM", "SSD",
    "RGPD", "CNIL", "ANSSI", "DGSE", "DGSI",
}

# Acronyms that are read as words (not spelled out)
WORD_ACRONYMS = {
    "UNESCO", "UNICEF", "NASA", "NATO", "OTAN", "BRICS",
    "SIDA", "PACS", "CEDH", "GIEC",
}

# Ordinal patterns
ORDINAL_SUFFIXES = {
    "1er": "premier",
    "1ère": "première",
    "1re": "première",
    "2e": "deuxième",
    "2ème": "deuxième",
    "3e": "troisième",
    "3ème": "troisième",
}

# Titles that should NOT be treated as sentence-ending periods
TITLE_ABBREVIATIONS = {"M.", "Mme.", "Mlle.", "Dr.", "Pr.", "Me.", "St.", "Ste."}


def _expand_number(match: re.Match) -> str:
    """Convert a number match to French words."""
    if not NUM2WORDS_AVAILABLE:
        return match.group(0)

    num_str = match.group(0)
    # Remove spaces used as thousand separators in French
    clean = num_str.replace("\u202f", "").replace("\u00a0", "").replace(" ", "")

    # Handle decimal comma (French style: 3,5 -> 3.5)
    clean = clean.replace(",", ".")

    try:
        if "." in clean:
            num = float(clean)
            # For currency-like decimals, handle specially
            integer_part = int(num)
            decimal_part = round((num - integer_part) * 100)
            if decimal_part == 0:
                return num2words(integer_part, lang="fr")
            return f"{num2words(integer_part, lang='fr')} virgule {num2words(decimal_part, lang='fr')}"
        else:
            num = int(clean)
            return num2words(num, lang="fr")
    except (ValueError, OverflowError):
        return num_str


def _expand_percentage(match: re.Match) -> str:
    """Convert '45%' or '45 %' to 'quarante-cinq pour cent'."""
    num_part = match.group(1).strip()
    clean = num_part.replace("\u202f", "").replace("\u00a0", "").replace(" ", "").replace(",", ".")

    if not NUM2WORDS_AVAILABLE:
        return f"{num_part} pour cent"

    try:
        if "." in clean:
            num = float(clean)
            integer_part = int(num)
            decimal_part = round((num - integer_part) * 100)
            if decimal_part == 0:
                return f"{num2words(integer_part, lang='fr')} pour cent"
            return f"{num2words(integer_part, lang='fr')} virgule {num2words(decimal_part, lang='fr')} pour cent"
        else:
            num = int(clean)
            return f"{num2words(num, lang='fr')} pour cent"
    except (ValueError, OverflowError):
        return f"{num_part} pour cent"


def _expand_currency(match: re.Match) -> str:
    """Convert '2 500 €' or '€2,500' to spoken form."""
    amount_str = match.group("amount")
    currency = match.group("currency")

    clean = amount_str.replace("\u202f", "").replace("\u00a0", "").replace(" ", "")

    currency_names = {
        "€": ("euro", "euros"),
        "$": ("dollar", "dollars"),
        "£": ("livre sterling", "livres sterling"),
    }
    singular, plural = currency_names.get(currency, (currency, currency))

    if not NUM2WORDS_AVAILABLE:
        return f"{amount_str} {plural}"

    clean = clean.replace(",", ".")
    try:
        if "." in clean:
            num = float(clean)
        else:
            num = int(clean)
        word = num2words(int(num), lang="fr")
        unit = singular if abs(num) == 1 else plural
        return f"{word} {unit}"
    except (ValueError, OverflowError):
        return f"{amount_str} {plural}"


def _spell_acronym(acronym: str) -> str:
    """Spell out an acronym letter by letter with dots: BCE -> B.C.E."""
    return ".".join(acronym)


def expand_abbreviations(text: str) -> str:
    """Expand common French abbreviations."""
    # Titles first (before sentence splitting)
    for abbr, expansion in ABBREVIATIONS.items():
        if abbr in text:
            text = text.replace(abbr, expansion)

    # Spell out acronyms (uppercase 2-5 letter words not in word-acronyms)
    def _maybe_spell(m: re.Match) -> str:
        word = m.group(0)
        if word in WORD_ACRONYMS:
            return word
        if word in SPELLED_ACRONYMS:
            return _spell_acronym(word)
        return word

    text = re.sub(r'\b[A-Z]{2,5}\b', _maybe_spell, text)

    return text


def expand_numbers(text: str) -> str:
    """Expand numbers to French words."""
    # Ordinals first: 1er, 2ème, etc.
    for pattern, replacement in ORDINAL_SUFFIXES.items():
        text = re.sub(rf'\b{re.escape(pattern)}\b', replacement, text)

    # Ordinals with larger numbers: 21e, 45ème
    def _ordinal_match(m: re.Match) -> str:
        num = int(m.group(1))
        suffix = m.group(2)
        if not NUM2WORDS_AVAILABLE:
            return m.group(0)
        try:
            return num2words(num, lang="fr", to="ordinal")
        except (ValueError, OverflowError):
            return m.group(0)

    text = re.sub(r'\b(\d+)(e|ème|eme)\b', _ordinal_match, text)

    # Currency: "2 500 €", "€2,500", "45 dollars"
    text = re.sub(
        r'(?P<currency>[€$£])[\s]*(?P<amount>[\d\s\u202f\u00a0]+(?:[.,]\d+)?)',
        _expand_currency, text
    )
    text = re.sub(
        r'(?P<amount>[\d\s\u202f\u00a0]+(?:[.,]\d+)?)[\s]*(?P<currency>[€$£])',
        _expand_currency, text
    )

    # Percentages: "45%" or "45 %"
    text = re.sub(r'(\d[\d\s\u202f\u00a0]*(?:[.,]\d+)?)\s*%', _expand_percentage, text)

    # General numbers (with French thousand separators: spaces or narrow no-break spaces)
    # Match numbers like: 2500, 2 500, 2 500 000, 3,5
    # Use word boundary to avoid consuming surrounding text
    text = re.sub(
        r'(?<!\w)\d[\d\s\u202f\u00a0]*(?:[.,]\d+)?(?!\w)',
        _expand_number, text
    )

    return text


def normalize_punctuation(text: str) -> str:
    """Normalize punctuation for better TTS prosody."""
    # French guillemets -> nothing (pause is implicit from the quote context)
    text = text.replace("«\u00a0", "")
    text = text.replace("\u00a0»", "")
    text = text.replace("«", "")
    text = text.replace("»", "")

    # Em/en dashes -> comma for natural pause
    text = text.replace(" — ", ", ")
    text = text.replace(" – ", ", ")
    text = text.replace("—", ", ")
    text = text.replace("–", ", ")

    # Ellipsis -> short pause marker
    text = text.replace("...", "… ")
    text = text.replace("…", "… ")

    # Multiple exclamation/question -> single
    text = re.sub(r'!{2,}', '!', text)
    text = re.sub(r'\?{2,}', '?', text)

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


def smart_split_sentences(text: str) -> List[str]:
    """Split text into sentences, handling French abbreviations correctly.

    Unlike a naive split on '.', this handles M., Dr., Mme., numbered lists, etc.
    """
    if len(text) < 200:
        return [text]

    # Protect abbreviations by replacing their periods temporarily
    protected = text
    protections: List[Tuple[str, str]] = []
    for abbr in TITLE_ABBREVIATIONS:
        if abbr in protected:
            placeholder = f"__ABBR{len(protections)}__"
            protections.append((placeholder, abbr))
            protected = protected.replace(abbr, placeholder)

    # Protect numbered lists: "1. ", "2. ", etc.
    protected = re.sub(r'(\d+)\.\s', r'\1__DOT__ ', protected)

    # Protect decimal numbers: "3.5", "1.2"
    protected = re.sub(r'(\d)\.(\d)', r'\1__DEC__\2', protected)

    # Split on sentence-ending punctuation
    parts = re.split(r'(?<=[.!?])\s+', protected)

    # Restore protections
    result = []
    for part in parts:
        for placeholder, original in protections:
            part = part.replace(placeholder, original)
        part = part.replace("__DOT__ ", ". ")
        part = part.replace("__DEC__", ".")
        part = part.strip()
        if part:
            result.append(part)

    return result


def fix_plus_pronunciation(text: str) -> str:
    """Fix French 'plus' pronunciation: silent S vs pronounced S.

    Rules:
    - S is SILENT (negative/comparative): ne...plus, plus de, plus que, plus rien, plus jamais
    - S is PRONOUNCED (additive/superlative): en plus, de plus, le plus, au plus, non plus
    - We replace silent-S cases with 'plu' so TTS doesn't aspirate the S
    """
    # 1. Negative "ne...plus" — S is silent → "plu"
    # Handles: "n'est plus", "ne veut plus", "n'a plus", "ne ... plus"
    text = re.sub(
        r"\bn[e'][\w\s]{1,30}\bplus\b",
        lambda m: m.group(0)[:-4] + "plu",
        text,
        flags=re.IGNORECASE,
    )

    # 2. "plus de" / "plus que" / "plus rien" / "plus jamais" / "plus personne"
    # (comparative/negative — S silent) BUT NOT after "en/de/le/au"
    text = re.sub(
        r"(?<!\ben )(?<!\bde )(?<!\ble )(?<!\bau )(?<!\bnon )\bplus\s+(de|que|rien|jamais|personne|aucun|guère)\b",
        lambda m: "plu " + m.group(1),
        text,
        flags=re.IGNORECASE,
    )

    return text


def preprocess_french(text: str) -> str:
    """Full preprocessing pipeline for French TTS.

    Order matters:
    1. Expand abbreviations (before numbers, since some contain digits)
    2. Expand numbers (after abbreviations are resolved)
    3. Fix pronunciation edge cases (plus, etc.)
    4. Normalize punctuation (last, to clean up)
    """
    if not text or len(text.strip()) < 2:
        return text

    text = expand_abbreviations(text)
    text = expand_numbers(text)
    text = fix_plus_pronunciation(text)
    text = normalize_punctuation(text)

    return text
