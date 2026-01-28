"""
RSS Feeds Database - NovaPress AI v2
100% Legal - RSS feeds are provided by news sites for syndication

This module contains curated RSS feed URLs from major news sources.
RSS is explicitly provided for syndication, making it the most legal
and reliable way to aggregate news content.
"""

from typing import Dict, List, Any

# =============================================================================
# RSS FEEDS DATABASE
# =============================================================================

RSS_FEEDS_DATABASE: Dict[str, Dict[str, Any]] = {
    # =========================================================================
    # FRANCE - Major Sources
    # =========================================================================
    "lemonde.fr": {
        "name": "Le Monde",
        "tier": 1,
        "language": "fr",
        "feeds": [
            {"url": "https://www.lemonde.fr/rss/une.xml", "category": "MONDE"},
            {"url": "https://www.lemonde.fr/international/rss_full.xml", "category": "MONDE"},
            {"url": "https://www.lemonde.fr/politique/rss_full.xml", "category": "POLITIQUE"},
            {"url": "https://www.lemonde.fr/economie/rss_full.xml", "category": "ECONOMIE"},
            {"url": "https://www.lemonde.fr/sciences/rss_full.xml", "category": "SCIENCES"},
            {"url": "https://www.lemonde.fr/technologies/rss_full.xml", "category": "TECH"},
        ]
    },
    "lefigaro.fr": {
        "name": "Le Figaro",
        "tier": 1,
        "language": "fr",
        "feeds": [
            {"url": "https://www.lefigaro.fr/rss/figaro_actualites.xml", "category": "MONDE"},
            {"url": "https://www.lefigaro.fr/rss/figaro_politique.xml", "category": "POLITIQUE"},
            {"url": "https://www.lefigaro.fr/rss/figaro_economie.xml", "category": "ECONOMIE"},
            {"url": "https://www.lefigaro.fr/rss/figaro_sciences.xml", "category": "SCIENCES"},
        ]
    },
    "liberation.fr": {
        "name": "Liberation",
        "tier": 2,
        "language": "fr",
        "feeds": [
            {"url": "https://www.liberation.fr/arc/outboundfeeds/rss/?outputType=xml", "category": "MONDE"},
        ]
    },
    "lesechos.fr": {
        "name": "Les Echos",
        "tier": 1,
        "language": "fr",
        "feeds": [
            {"url": "https://www.lesechos.fr/rss/rss_une.xml", "category": "ECONOMIE"},
            {"url": "https://www.lesechos.fr/rss/rss_tech_medias.xml", "category": "TECH"},
        ]
    },
    # Replaces blocked scraping
    "20minutes.fr": {
        "name": "20 Minutes",
        "tier": 2,
        "language": "fr",
        "feeds": [
            {"url": "https://www.20minutes.fr/feeds/rss-une.xml", "category": "MONDE"},
            {"url": "https://www.20minutes.fr/feeds/rss-france.xml", "category": "POLITIQUE"},
            {"url": "https://www.20minutes.fr/feeds/rss-high-tech.xml", "category": "TECH"},
        ]
    },
    # Replaces blocked scraping
    "france24.com": {
        "name": "France 24",
        "tier": 1,
        "language": "fr",
        "feeds": [
            {"url": "https://www.france24.com/fr/rss", "category": "MONDE"},
            {"url": "https://www.france24.com/fr/france/rss", "category": "POLITIQUE"},
            {"url": "https://www.france24.com/fr/eco-tech/rss", "category": "ECONOMIE"},
        ]
    },
    # Replaces blocked scraping
    "rfi.fr": {
        "name": "RFI",
        "tier": 2,
        "language": "fr",
        "feeds": [
            {"url": "https://www.rfi.fr/fr/rss", "category": "MONDE"},
        ]
    },
    "francetvinfo.fr": {
        "name": "France Info",
        "tier": 1,
        "language": "fr",
        "feeds": [
            {"url": "https://www.francetvinfo.fr/titres.rss", "category": "MONDE"},
            {"url": "https://www.francetvinfo.fr/politique.rss", "category": "POLITIQUE"},
            {"url": "https://www.francetvinfo.fr/economie.rss", "category": "ECONOMIE"},
        ]
    },
    "leparisien.fr": {
        "name": "Le Parisien",
        "tier": 2,
        "language": "fr",
        "feeds": [
            {"url": "https://www.leparisien.fr/arc/outboundfeeds/rss/", "category": "MONDE"},
        ]
    },

    # =========================================================================
    # USA - Major Sources
    # =========================================================================
    "nytimes.com": {
        "name": "New York Times",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", "category": "MONDE"},
            {"url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "category": "MONDE"},
            {"url": "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", "category": "POLITIQUE"},
            {"url": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", "category": "TECH"},
            {"url": "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml", "category": "SCIENCES"},
        ]
    },
    "washingtonpost.com": {
        "name": "Washington Post",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://feeds.washingtonpost.com/rss/world", "category": "MONDE"},
            {"url": "https://feeds.washingtonpost.com/rss/politics", "category": "POLITIQUE"},
            {"url": "https://feeds.washingtonpost.com/rss/business/technology", "category": "TECH"},
        ]
    },
    "reuters.com": {
        "name": "Reuters",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best", "category": "MONDE"},
        ]
    },
    "cnn.com": {
        "name": "CNN",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "http://rss.cnn.com/rss/edition.rss", "category": "MONDE"},
            {"url": "http://rss.cnn.com/rss/edition_world.rss", "category": "MONDE"},
            {"url": "http://rss.cnn.com/rss/money_technology.rss", "category": "TECH"},
        ]
    },
    "apnews.com": {
        "name": "Associated Press",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://apnews.com/apf-topnews/feed", "category": "MONDE"},
            {"url": "https://apnews.com/apf-intlnews/feed", "category": "MONDE"},
        ]
    },

    # =========================================================================
    # UK - Major Sources
    # =========================================================================
    "theguardian.com": {
        "name": "The Guardian",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.theguardian.com/world/rss", "category": "MONDE"},
            {"url": "https://www.theguardian.com/uk/technology/rss", "category": "TECH"},
            {"url": "https://www.theguardian.com/science/rss", "category": "SCIENCES"},
            {"url": "https://www.theguardian.com/politics/rss", "category": "POLITIQUE"},
        ]
    },
    "bbc.com": {
        "name": "BBC News",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://feeds.bbci.co.uk/news/rss.xml", "category": "MONDE"},
            {"url": "https://feeds.bbci.co.uk/news/world/rss.xml", "category": "MONDE"},
            {"url": "https://feeds.bbci.co.uk/news/technology/rss.xml", "category": "TECH"},
            {"url": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "category": "SCIENCES"},
            {"url": "https://feeds.bbci.co.uk/news/politics/rss.xml", "category": "POLITIQUE"},
        ]
    },
    "ft.com": {
        "name": "Financial Times",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.ft.com/rss/home", "category": "ECONOMIE"},
            {"url": "https://www.ft.com/technology?format=rss", "category": "TECH"},
        ]
    },
    "telegraph.co.uk": {
        "name": "The Telegraph",
        "tier": 2,
        "language": "en",
        "feeds": [
            {"url": "https://www.telegraph.co.uk/rss.xml", "category": "MONDE"},
        ]
    },

    # =========================================================================
    # TECH - Specialized Sources
    # =========================================================================
    "techcrunch.com": {
        "name": "TechCrunch",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://techcrunch.com/feed/", "category": "TECH"},
        ]
    },
    "theverge.com": {
        "name": "The Verge",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.theverge.com/rss/index.xml", "category": "TECH"},
        ]
    },
    "arstechnica.com": {
        "name": "Ars Technica",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://feeds.arstechnica.com/arstechnica/index", "category": "TECH"},
        ]
    },
    "wired.com": {
        "name": "Wired",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.wired.com/feed/rss", "category": "TECH"},
        ]
    },
    "engadget.com": {
        "name": "Engadget",
        "tier": 2,
        "language": "en",
        "feeds": [
            {"url": "https://www.engadget.com/rss.xml", "category": "TECH"},
        ]
    },
    "zdnet.com": {
        "name": "ZDNet",
        "tier": 2,
        "language": "en",
        "feeds": [
            {"url": "https://www.zdnet.com/news/rss.xml", "category": "TECH"},
        ]
    },
    # French Tech
    "frandroid.com": {
        "name": "Frandroid",
        "tier": 2,
        "language": "fr",
        "feeds": [
            {"url": "https://www.frandroid.com/feed", "category": "TECH"},
        ]
    },
    "numerama.com": {
        "name": "Numerama",
        "tier": 2,
        "language": "fr",
        "feeds": [
            {"url": "https://www.numerama.com/feed/", "category": "TECH"},
        ]
    },

    # =========================================================================
    # SCIENCES - Specialized Sources
    # =========================================================================
    "nature.com": {
        "name": "Nature",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.nature.com/nature.rss", "category": "SCIENCES"},
        ]
    },
    "sciencedaily.com": {
        "name": "Science Daily",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.sciencedaily.com/rss/all.xml", "category": "SCIENCES"},
        ]
    },
    "scientificamerican.com": {
        "name": "Scientific American",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://rss.sciam.com/ScientificAmerican-Global", "category": "SCIENCES"},
        ]
    },
    "newscientist.com": {
        "name": "New Scientist",
        "tier": 2,
        "language": "en",
        "feeds": [
            {"url": "https://www.newscientist.com/feed/home/", "category": "SCIENCES"},
        ]
    },

    # =========================================================================
    # EUROPE - International Sources
    # =========================================================================
    "spiegel.de": {
        "name": "Der Spiegel",
        "tier": 1,
        "language": "de",
        "feeds": [
            {"url": "https://www.spiegel.de/international/index.rss", "category": "MONDE"},
        ]
    },
    "elpais.com": {
        "name": "El Pais",
        "tier": 1,
        "language": "es",
        "feeds": [
            {"url": "https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada", "category": "MONDE"},
        ]
    },
    "euronews.com": {
        "name": "Euronews",
        "tier": 2,
        "language": "en",
        "feeds": [
            {"url": "https://www.euronews.com/rss", "category": "MONDE"},
        ]
    },
    "politico.eu": {
        "name": "Politico Europe",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.politico.eu/feed/", "category": "POLITIQUE"},
        ]
    },

    # =========================================================================
    # ECONOMY/FINANCE - Specialized Sources
    # =========================================================================
    "bloomberg.com": {
        "name": "Bloomberg",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.bloomberg.com/feed/podcast/bloomberg-surveillance.xml", "category": "ECONOMIE"},
        ]
    },
    "economist.com": {
        "name": "The Economist",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.economist.com/rss", "category": "ECONOMIE"},
        ]
    },

    # =========================================================================
    # SPORT - Specialized Sources
    # =========================================================================
    "lequipe.fr": {
        "name": "L'Equipe",
        "tier": 1,
        "language": "fr",
        "feeds": [
            {"url": "https://www.lequipe.fr/rss/actu_rss.xml", "category": "SPORT"},
        ]
    },
    "espn.com": {
        "name": "ESPN",
        "tier": 1,
        "language": "en",
        "feeds": [
            {"url": "https://www.espn.com/espn/rss/news", "category": "SPORT"},
        ]
    },
}

# =============================================================================
# SOURCE TIERS CONFIGURATION
# =============================================================================

SOURCE_TIERS: Dict[int, List[str]] = {
    # Tier 1 - Major sources (justify Perplexity fallback if scraping fails)
    1: [
        "lemonde.fr", "lefigaro.fr", "lesechos.fr", "france24.com", "francetvinfo.fr",
        "nytimes.com", "washingtonpost.com", "reuters.com", "cnn.com", "apnews.com",
        "theguardian.com", "bbc.com", "ft.com",
        "techcrunch.com", "theverge.com", "arstechnica.com", "wired.com",
        "nature.com", "sciencedaily.com", "scientificamerican.com",
        "spiegel.de", "elpais.com", "politico.eu",
        "bloomberg.com", "economist.com",
        "lequipe.fr", "espn.com",
    ],

    # Tier 2 - Standard sources
    2: [
        "liberation.fr", "20minutes.fr", "rfi.fr", "leparisien.fr",
        "telegraph.co.uk",
        "engadget.com", "zdnet.com", "frandroid.com", "numerama.com",
        "newscientist.com",
        "euronews.com",
    ],

    # Tier 3 - Minor sources (never use paid APIs)
    3: [],
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_all_feeds() -> List[Dict[str, Any]]:
    """Get all RSS feeds as a flat list with metadata"""
    feeds = []
    for domain, config in RSS_FEEDS_DATABASE.items():
        for feed in config["feeds"]:
            feeds.append({
                "domain": domain,
                "name": config["name"],
                "tier": config["tier"],
                "language": config["language"],
                "url": feed["url"],
                "category": feed["category"],
            })
    return feeds


def get_feeds_by_category(category: str) -> List[Dict[str, Any]]:
    """Get RSS feeds filtered by category"""
    return [f for f in get_all_feeds() if f["category"] == category]


def get_feeds_by_language(language: str) -> List[Dict[str, Any]]:
    """Get RSS feeds filtered by language"""
    return [f for f in get_all_feeds() if f["language"] == language]


def get_feeds_by_tier(tier: int) -> List[Dict[str, Any]]:
    """Get RSS feeds filtered by tier (1=major, 2=standard, 3=minor)"""
    return [f for f in get_all_feeds() if f["tier"] == tier]


def get_source_tier(domain: str) -> int:
    """Get the tier of a source domain"""
    for tier, domains in SOURCE_TIERS.items():
        if domain in domains:
            return tier
    return 3  # Default to minor


def get_total_feed_count() -> int:
    """Get total number of RSS feeds configured"""
    return len(get_all_feeds())


def get_stats() -> Dict[str, Any]:
    """Get statistics about RSS feeds configuration"""
    all_feeds = get_all_feeds()
    return {
        "total_sources": len(RSS_FEEDS_DATABASE),
        "total_feeds": len(all_feeds),
        "by_language": {
            "fr": len([f for f in all_feeds if f["language"] == "fr"]),
            "en": len([f for f in all_feeds if f["language"] == "en"]),
            "de": len([f for f in all_feeds if f["language"] == "de"]),
            "es": len([f for f in all_feeds if f["language"] == "es"]),
        },
        "by_category": {
            "MONDE": len([f for f in all_feeds if f["category"] == "MONDE"]),
            "POLITIQUE": len([f for f in all_feeds if f["category"] == "POLITIQUE"]),
            "ECONOMIE": len([f for f in all_feeds if f["category"] == "ECONOMIE"]),
            "TECH": len([f for f in all_feeds if f["category"] == "TECH"]),
            "SCIENCES": len([f for f in all_feeds if f["category"] == "SCIENCES"]),
            "SPORT": len([f for f in all_feeds if f["category"] == "SPORT"]),
        },
        "by_tier": {
            1: len([f for f in all_feeds if f["tier"] == 1]),
            2: len([f for f in all_feeds if f["tier"] == 2]),
            3: len([f for f in all_feeds if f["tier"] == 3]),
        },
    }
