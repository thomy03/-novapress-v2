"""
MarketTagger — Post-process syntheses with market-oriented metadata.
Keyword/regex based, no LLM call required.
"""
import re
from typing import Dict, List, Any

# ---------------------------------------------------------------------------
# Ticker detection
# ---------------------------------------------------------------------------

FALSE_POSITIVE_TICKERS = {
    # Common English words
    "THE", "AND", "FOR", "ARE", "NOT", "BUT", "ALL", "CAN", "HAS", "HER",
    "HIS", "ONE", "OUR", "OUT", "WHO", "ITS", "NEW", "NOW", "USE", "TWO",
    "WAY", "MAY", "SAY", "GET", "HOW", "YOU", "ANY", "MORE", "WILL", "WITH",
    "HAVE", "FROM", "THEY", "THIS", "THAT", "BEEN", "WHAT", "WHEN", "YOUR",
    "ALSO", "EACH", "SUCH", "INTO", "VERY", "WERE", "THAN", "THEN", "BEEN",
    "OVER", "WELL", "ONLY", "EVEN", "BOTH", "AFTER", "ABOUT", "COULD",
    "THEIR", "WHICH", "OTHER", "WHILE", "SINCE", "THERE", "WOULD",
    # Common French words
    "LES", "DES", "UNE", "DANS", "PLUS", "POUR", "QUE", "PAR", "SUR",
    "EST", "SON", "AUX", "AUX", "AVEC", "MAIS", "COMME", "SON", "LEUR",
    "LEURS", "BIEN", "TOUT", "SANS", "ENTRE", "LORS", "SELON",
    # Financial / abbreviation false positives
    "CEO", "CFO", "COO", "CTO", "GDP", "CPI", "PPI", "PMI", "IPO", "SEC",
    "FED", "ECB", "IMF", "ETF", "EPS", "ROI", "ROE", "ESG", "NAV", "AUM",
    "FDA", "CDC", "WHO", "WTO", "NATO", "OPEC", "FOMC", "REPO", "SPAC",
    "USA", "EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY",
    "OIL", "GAS", "LNG", "LPG", "COAL", "IRON", "GOLD", "ZINC", "LEAD",
    "HIGH", "LOW", "OPEN", "CLOSE", "LAST", "PREV", "NEXT", "FULL",
    "PLAN", "DEAL", "BILL", "BOND", "BANK", "FUND", "FIRM", "UNIT",
    "RISE", "FALL", "GAIN", "LOSS", "RISK", "RATE", "YEAR", "WEEK", "DAYS",
    "TIER", "CORP", "INTL", "REIT",
}

KNOWN_TICKERS = {
    # US Tech
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA",
    "AMD", "INTC", "QCOM", "AVGO", "TXN", "MU", "AMAT", "LRCX", "KLAC",
    "CRM", "ORCL", "SAP", "IBM", "CSCO", "HPQ", "DELL", "ADBE", "NOW",
    "SNOW", "PLTR", "UBER", "LYFT", "ABNB", "SPOT",
    # US Financials
    "JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW", "AXP", "V", "MA",
    "PYPL", "SQ", "COIN",
    # US Healthcare
    "JNJ", "PFE", "MRK", "ABBV", "BMY", "GILD", "AMGN", "BIIB", "REGN",
    "LLY", "UNH", "CVS", "HUM", "CI",
    # US Energy
    "XOM", "CVX", "COP", "SLB", "HAL", "OXY", "PSX", "VLO", "MPC",
    # US Consumer / Industrial
    "WMT", "COST", "TGT", "AMZN", "HD", "LOW", "MCD", "SBUX", "NKE",
    "BA", "LMT", "RTX", "NOC", "GE", "MMM", "CAT", "DE", "UPS", "FDX",
    # European stocks
    "ASML", "LVMH", "SAP", "NESN", "NOVN", "ROG", "AZN", "BP", "SHEL",
    "HSBC", "BNP", "SAN", "ING", "ALV", "MBG", "BMW", "VOW", "SIE", "AIR",
    "TTE", "ENI", "ENEL", "IBE", "DTE",
    # ETFs
    "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "GLD", "SLV", "USO",
    "TLT", "HYG", "LQD", "EEM", "EFA", "VIX",
    # Crypto
    "BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE", "DOT", "AVAX",
    "MATIC", "LINK", "UNI", "AAVE", "LTC", "BCH", "XLM", "TRX", "ATOM",
    "FTM", "NEAR", "APT", "ARB", "OP", "INJ", "SUI",
}

_TICKER_RE = re.compile(r"\b([A-Z]{1,5})(?:\.[A-Z]{2})?\b")


def extract_symbols(text: str) -> List[str]:
    """Extract known market tickers from text."""
    found = set()
    for match in _TICKER_RE.finditer(text):
        ticker = match.group(1)
        if ticker in KNOWN_TICKERS and ticker not in FALSE_POSITIVE_TICKERS:
            found.add(ticker)
    return sorted(found)


# ---------------------------------------------------------------------------
# Sector detection
# ---------------------------------------------------------------------------

_SECTOR_KEYWORDS: Dict[str, List[str]] = {
    "Technology": [
        "tech", "software", "semiconductor", "chip", "ai", "artificial intelligence",
        "cloud", "cyber", "data center", "smartphone", "hardware", "silicon",
        "microchip", "processor", "gpu", "cpu", "algorithm", "digital",
        "logiciel", "numérique", "puce", "intelligence artificielle",
    ],
    "Healthcare": [
        "pharma", "biotech", "drug", "fda", "clinical trial", "vaccine", "therapy",
        "medicine", "hospital", "health", "cancer", "treatment", "approval",
        "médicament", "santé", "essai clinique", "vaccin", "thérapie", "maladie",
    ],
    "Energy": [
        "oil", "gas", "opec", "crude", "brent", "wti", "refinery", "pipeline",
        "renewable", "solar", "wind", "nuclear", "lng", "shale", "energy",
        "pétrole", "gaz naturel", "énergie renouvelable", "éolien", "solaire",
    ],
    "Financials": [
        "bank", "interest rate", "federal reserve", "ecb", "bond", "yield",
        "credit", "loan", "insurance", "hedge fund", "private equity", "ipo",
        "banque", "taux d'intérêt", "obligation", "crédit", "assurance",
    ],
    "Consumer": [
        "retail", "consumer", "spending", "e-commerce", "luxury", "brand",
        "store", "shopping", "fashion", "food", "beverage", "automobile",
        "distribution", "vente", "consommateur", "luxe", "alimentation",
    ],
    "Industrials": [
        "aerospace", "defense", "manufacturing", "infrastructure", "logistics",
        "supply chain", "factory", "industrial", "rail", "aviation", "shipping",
        "industrie", "défense", "aérospatiale", "logistique", "fabrication",
    ],
    "Materials": [
        "mining", "steel", "copper", "aluminum", "gold", "silver", "lithium",
        "rare earth", "commodity", "metals", "iron ore", "zinc",
        "mines", "acier", "cuivre", "aluminium", "or", "argent", "lithium",
    ],
    "Real Estate": [
        "reit", "real estate", "property", "housing", "mortgage", "rents",
        "commercial real estate", "residential", "construction", "developer",
        "immobilier", "logement", "hypothèque", "loyer", "promoteur",
    ],
    "Crypto": [
        "bitcoin", "ethereum", "crypto", "blockchain", "defi", "nft", "token",
        "stablecoin", "web3", "halving", "wallet", "mining", "altcoin",
        "cryptomonnaie", "portefeuille numérique",
    ],
}


def detect_sectors(text: str) -> List[str]:
    """Detect relevant market sectors from text."""
    lower = text.lower()
    return [
        sector
        for sector, keywords in _SECTOR_KEYWORDS.items()
        if any(kw in lower for kw in keywords)
    ]


# ---------------------------------------------------------------------------
# Asset class detection
# ---------------------------------------------------------------------------

_ASSET_CLASS_KEYWORDS: Dict[str, List[str]] = {
    "stocks": [
        "stock", "share", "equity", "nasdaq", "nyse", "s&p", "earnings",
        "dividend", "ipo", "action", "bourse", "indice", "cac40", "dax",
    ],
    "crypto": [
        "bitcoin", "ethereum", "crypto", "blockchain", "token", "defi",
        "altcoin", "cryptomonnaie", "web3",
    ],
    "commodities": [
        "oil", "gold", "silver", "copper", "wheat", "corn", "natural gas",
        "commodity", "brent", "wti", "matière première", "pétrole", "or",
    ],
    "forex": [
        "dollar", "euro", "yen", "forex", "currency", "exchange rate",
        "usd", "eur", "gbp", "jpy", "devise", "taux de change",
    ],
    "bonds": [
        "bond", "treasury", "yield", "credit", "coupon", "fixed income",
        "sovereign debt", "obligation", "taux", "dette souveraine",
    ],
}


def detect_asset_classes(text: str) -> List[str]:
    """Detect relevant asset classes from text."""
    lower = text.lower()
    return [
        asset_class
        for asset_class, keywords in _ASSET_CLASS_KEYWORDS.items()
        if any(kw in lower for kw in keywords)
    ]


# ---------------------------------------------------------------------------
# Sentiment scoring
# ---------------------------------------------------------------------------

_BULLISH_WORDS = {
    "surge", "rally", "beat", "upgrade", "growth", "approval", "hausse",
    "record", "breakout", "outperform", "buy", "bullish", "boom", "soar",
    "rise", "gain", "profit", "recovery", "breakthrough", "positive",
    "strong", "robust", "accelerate", "expand", "momentum", "optimistic",
    "rebond", "croissance", "hausse", "progression", "amelioration",
}

_BEARISH_WORDS = {
    "crash", "plunge", "miss", "downgrade", "recession", "bankruptcy",
    "baisse", "selloff", "sell-off", "bearish", "decline", "fall", "drop",
    "loss", "risk", "warning", "concern", "default", "crisis", "fear",
    "weak", "slowdown", "contraction", "negative", "disappointing",
    "inflation", "stagflation", "effondrement", "chute", "crise", "faillite",
}


def compute_sentiment(text: str) -> float:
    """
    Score sentiment from -1.0 (bearish) to +1.0 (bullish).
    Returns 0.0 if no signal words found.
    """
    lower = text.lower()
    words = re.findall(r"\b\w+\b", lower)
    word_set = set(words)

    bull_count = len(word_set & _BULLISH_WORDS)
    bear_count = len(word_set & _BEARISH_WORDS)
    total = bull_count + bear_count

    if total == 0:
        return 0.0
    return round((bull_count - bear_count) / total, 3)


# ---------------------------------------------------------------------------
# Impact estimation
# ---------------------------------------------------------------------------

_TRADING_KEYWORDS = [
    "earnings", "revenue", "guidance", "fda", "merger", "acquisition", "ipo",
    "rate cut", "rate hike", "rate increase", "rate decrease", "layoffs",
    "dividend", "buyback", "share repurchase", "tariff", "sanctions", "halving",
    "etf", "approval", "bankruptcy", "default", "downgrade", "upgrade",
    "beat", "miss", "forecast", "outlook", "inflation", "recession",
    "stimulus", "bailout", "listing", "delisting", "spin-off", "restructuring",
    "profit warning", "write-down", "settlement", "investigation",
    "indictment", "election", "referendum", "war", "ceasefire", "embargo",
    "opec", "fed meeting", "ecb meeting", "earnings call",
]


def extract_trading_keywords(text: str) -> List[str]:
    """Extract trading-relevant keywords from text."""
    lower = text.lower()
    return [kw for kw in _TRADING_KEYWORDS if kw in lower]


def compute_impact(
    num_sources: int,
    sectors: List[str],
    symbols: List[str],
    trading_keywords: List[str],
) -> str:
    """
    Estimate market impact level: HIGH / MEDIUM / LOW.

    Scoring:
    - num_sources: up to 10 points (1pt each, capped at 10)
    - sectors: 2pts each
    - symbols: 1pt each
    - trading keywords: 2pts each
    """
    score = 0
    score += min(num_sources, 10)
    score += len(sectors) * 2
    score += len(symbols)
    score += len(trading_keywords) * 2

    if score >= 15:
        return "HIGH"
    elif score >= 8:
        return "MEDIUM"
    else:
        return "LOW"


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def tag_synthesis(synthesis: Dict[str, Any]) -> Dict[str, Any]:
    """
    Post-process a synthesis dict with market-oriented metadata.

    Expected keys in synthesis:
        - title: str
        - body or summary: str
        - num_sources: int (optional, defaults to 1)

    Adds these keys:
        - market_symbols: List[str]
        - market_sectors: List[str]
        - market_asset_classes: List[str]
        - market_sentiment: float  (-1.0 to 1.0)
        - market_impact: str       (HIGH / MEDIUM / LOW)
        - market_trading_keywords: List[str]
    """
    title = synthesis.get("title", "") or ""
    body = synthesis.get("body", "") or synthesis.get("summary", "") or ""
    num_sources = synthesis.get("num_sources", 1) or 1

    full_text = f"{title} {body}"

    symbols = extract_symbols(full_text)
    sectors = detect_sectors(full_text)
    asset_classes = detect_asset_classes(full_text)
    sentiment = compute_sentiment(full_text)
    trading_keywords = extract_trading_keywords(full_text)
    impact = compute_impact(num_sources, sectors, symbols, trading_keywords)

    synthesis["market_symbols"] = symbols
    synthesis["market_sectors"] = sectors
    synthesis["market_asset_classes"] = asset_classes
    synthesis["market_sentiment"] = sentiment
    synthesis["market_impact"] = impact
    synthesis["market_trading_keywords"] = trading_keywords

    return synthesis
