"""
Advanced News Scraper - NovaPress AI v2
Scraping intelligent de sites d'actualité mondiaux
Respect des règles: robots.txt, rate limiting, paywalls
"""
from typing import List, Dict, Any, Optional, Set
import asyncio
import httpx
from bs4 import BeautifulSoup
from newspaper import Article as NewsArticle, Config
from datetime import datetime, timedelta
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
from loguru import logger
import hashlib
from functools import lru_cache
import re

from app.core.config import settings
from app.ml.embeddings import get_embedding_service


class AdvancedNewsScraper:
    """
    Scraper professionnel pour journaux mondiaux
    - Respect robots.txt
    - Rate limiting intelligent
    - Détection paywall
    - Déduplication par embeddings
    - Multi-sources simultanées
    - Per-source timeout protection
    """

    # Default timeout per source (seconds)
    DEFAULT_SOURCE_TIMEOUT = 30.0  # Timeout for entire source scraping
    DEFAULT_ARTICLE_TIMEOUT = 15.0  # Timeout per individual article

    # Sources mondiales de qualité
    WORLD_NEWS_SOURCES = {
        # Français
        "lemonde.fr": {
            "name": "Le Monde",
            "url": "https://www.lemonde.fr",
            "selectors": {
                "article_links": "article a[href*='/article/']",
                "title": "h1.article__title",
                "content": "div.article__content p",
                "author": "span.author__name",
                "date": "time"
            },
            "rate_limit": 1.0  # secondes entre requêtes
        },
        "lefigaro.fr": {
            "name": "Le Figaro",
            "url": "https://www.lefigaro.fr",
            "selectors": {
                "article_links": "article a.fig-profile__link",
                "title": "h1",
                "content": "div.fig-content__body p"
            },
            "rate_limit": 1.0
        },
        "liberation.fr": {
            "name": "Libération",
            "url": "https://www.liberation.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.0
        },

        # Anglais
        "nytimes.com": {
            "name": "The New York Times",
            "url": "https://www.nytimes.com",
            "selectors": {
                "article_links": "article a",
                "title": "h1[data-testid='headline']",
                "content": "section[name='articleBody'] p"
            },
            "rate_limit": 2.0  # Plus conservateur
        },
        "theguardian.com": {
            "name": "The Guardian",
            "url": "https://www.theguardian.com/international",
            "selectors": {
                "article_links": "a[data-link-name='article']",
                "title": "h1",
                "content": "div.article-body-commercial-selector p, div[data-gu-name='body'] p"
            },
            "rate_limit": 1.0
        },
        "bbc.com": {
            "name": "BBC News",
            "url": "https://www.bbc.com/news",
            "selectors": {
                "article_links": "a[data-testid='internal-link'], h2 a[href*='/news/'], a.sc-f98732b0-0",
                "title": "h1",
                "content": "div[data-component='text-block'] p, article p"
            },
            "rate_limit": 1.0
        },
        "reuters.com": {
            "name": "Reuters",
            "url": "https://www.reuters.com/world/",
            "selectors": {
                "article_links": "a[href*='/world/'], a[href*='/business/'], a[href*='/technology/']",
                "title": "h1",
                "content": "div[class*='article-body'] p, div[data-testid='paragraph'] p"
            },
            "rate_limit": 1.5
        },

        # Allemand
        "spiegel.de": {
            "name": "Der Spiegel",
            "url": "https://www.spiegel.de",
            "selectors": {
                "article_links": "article a",
                "title": "h2.article-title",
                "content": "div.article-section p"
            },
            "rate_limit": 1.5
        },

        # Espagnol
        "elpais.com": {
            "name": "El País",
            "url": "https://elpais.com",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article_body p"
            },
            "rate_limit": 1.5
        },

        # Italien
        "corriere.it": {
            "name": "Corriere della Sera",
            "url": "https://www.corriere.it",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.chapter-paragraph p"
            },
            "rate_limit": 1.5
        },

        # USA (Additional)
        "edition.cnn.com": {
            "name": "CNN",
            "url": "https://edition.cnn.com",
            "selectors": {
                "article_links": "a[href*='/202']", # Links with year
                "title": "h1.headline__text",
                "content": "div.article__content p"
            },
            "rate_limit": 2.0
        },
        "washingtonpost.com": {
            "name": "The Washington Post",
            "url": "https://www.washingtonpost.com",
            "selectors": {
                "article_links": "a[data-pb-field='web_headline']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 2.0
        },

        # Middle East
        "aljazeera.com": {
            "name": "Al Jazeera",
            "url": "https://www.aljazeera.com",
            "selectors": {
                "article_links": "a.u-clickable-card__link",
                "title": "h1",
                "content": "div.wysiwyg p"
            },
            "rate_limit": 1.5
        },

        # Asia
        "asahi.com": {
            "name": "The Asahi Shimbun",
            "url": "https://www.asahi.com/ajw/",
            "selectors": {
                "article_links": "a.EnTopNewsList",
                "title": "h1",
                "content": "div.ArticleBody p"
            },
            "rate_limit": 1.5
        },
        "timesofindia.indiatimes.com": {
            "name": "The Times of India",
            "url": "https://timesofindia.indiatimes.com/world",
            "selectors": {
                "article_links": "div.col_l_6 a",
                "title": "h1",
                "content": "div._3WlLe"
            },
            "rate_limit": 1.5
        },

        # South America
        "oglobo.globo.com": {
            "name": "O Globo",
            "url": "https://oglobo.globo.com",
            "selectors": {
                "article_links": "a.feed-post-link",
                "title": "h1.content-head__title",
                "content": "p.content-text__container"
            },
            "rate_limit": 1.5
        },

        # Australia
        "smh.com.au": {
            "name": "The Sydney Morning Herald",
            "url": "https://www.smh.com.au",
            "selectors": {
                "article_links": "h3 a",
                "title": "h1",
                "content": "section[data-testid='article-body'] p"
            },
            "rate_limit": 1.5
        },

        # === FRANCE & EUROPE ===
        "lesechos.fr": {
            "name": "Les Echos",
            "url": "https://www.lesechos.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.post-content p"
            },
            "rate_limit": 1.5
        },
        "leparisien.fr": {
            "name": "Le Parisien",
            "url": "https://www.leparisien.fr",
            "selectors": {
                "article_links": "a.story-link",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },
        "francetvinfo.fr": {
            "name": "France Info",
            "url": "https://www.francetvinfo.fr",
            "selectors": {
                "article_links": "a.card-article-link",
                "title": "h1",
                "content": "div.text-container p"
            },
            "rate_limit": 1.5
        },
        "bild.de": {
            "name": "Bild",
            "url": "https://www.bild.de",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.txt p"
            },
            "rate_limit": 1.5
        },
        "repubblica.it": {
            "name": "La Repubblica",
            "url": "https://www.repubblica.it",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.story__text p"
            },
            "rate_limit": 1.5
        },
        "elmundo.es": {
            "name": "El Mundo",
            "url": "https://www.elmundo.es",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.ue-c-article__body p"
            },
            "rate_limit": 1.5
        },
        # Le Soir - REMOVED (robots.txt blocks scraping)

        # === THEMATIC: TECH ===
        "techcrunch.com": {
            "name": "TechCrunch",
            "url": "https://techcrunch.com",
            "selectors": {
                "article_links": "a[href*='/20'][href*='/']",
                "title": "h1",
                "content": "div.article-content p, div.entry-content p"
            },
            "rate_limit": 2.0
        },
        "theverge.com": {
            "name": "The Verge",
            "url": "https://www.theverge.com",
            "selectors": {
                "article_links": "h2 a, a[href*='/202']",
                "title": "h1",
                "content": "div.c-entry-content p, div.duet--article--article-body-component p"
            },
            "rate_limit": 2.0
        },
        "wired.com": {
            "name": "Wired",
            "url": "https://www.wired.com",
            "selectors": {
                "article_links": "a[href*='/story/'], a[href*='/article/']",
                "title": "h1",
                "content": "div.body__inner-container p, div[class*='body'] p"
            },
            "rate_limit": 2.0
        },
        "frandroid.com": {
            "name": "Frandroid",
            "url": "https://www.frandroid.com",
            "selectors": {
                "article_links": "h2.post-title a",
                "title": "h1",
                "content": "div.content-box p"
            },
            "rate_limit": 1.5
        },

        # === THEMATIC: FINANCE ===
        "ft.com": {
            "name": "Financial Times",
            "url": "https://www.ft.com",
            "selectors": {
                "article_links": "div.o-teaser__heading a",
                "title": "h1",
                "content": "div.n-content-body p"
            },
            "rate_limit": 2.0
        },
        "bloomberg.com": {
            "name": "Bloomberg",
            "url": "https://www.bloomberg.com",
            "selectors": {
                "article_links": "a[href*='/news/articles/']",
                "title": "h1",
                "content": "div.body-copy-v2 p"
            },
            "rate_limit": 2.0
        },
        # La Tribune - REMOVED (robots.txt blocks scraping)

        # === THEMATIC: SCIENCE/HEALTH ===
        "sciencedaily.com": {
            "name": "Science Daily",
            "url": "https://www.sciencedaily.com",
            "selectors": {
                "article_links": "div.latest-head a",
                "title": "h1",
                "content": "div#text p"
            },
            "rate_limit": 1.5
        },
        # Futura Sciences - REMOVED (robots.txt blocks scraping)

        # === THEMATIC: SPORT ===
        "lequipe.fr": {
            "name": "L'Équipe",
            "url": "https://www.lequipe.fr",
            "selectors": {
                "article_links": "a.Link[href*='/']",
                "title": "h1",
                "content": "div.article__body p, div.Paragraph p"
            },
            "rate_limit": 1.5
        },
        "espn.com": {
            "name": "ESPN",
            "url": "https://www.espn.com",
            "selectors": {
                "article_links": "a[href*='/story/'], a.contentItem__padding",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 2.0
        },
        "sport.fr": {
            "name": "Sport.fr",
            "url": "https://www.sport.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 1.5
        },
        "marca.com": {
            "name": "Marca",
            "url": "https://www.marca.com",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },

        # === THEMATIC: CULTURE & SOCIETY ===
        "slate.fr": {
            "name": "Slate FR",
            "url": "https://www.slate.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 1.5
        },
        "theconversation.com": {
            "name": "The Conversation",
            "url": "https://theconversation.com/fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.content-body p"
            },
            "rate_limit": 1.5
        },
        "huffingtonpost.fr": {
            "name": "HuffPost FR",
            "url": "https://www.huffingtonpost.fr",
            "selectors": {
                "article_links": "a[href*='/entry/']",
                "title": "h1",
                "content": "div.entry__content p"
            },
            "rate_limit": 1.5
        },
        "mediapart.fr": {
            "name": "Mediapart",
            "url": "https://www.mediapart.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.content-article p"
            },
            "rate_limit": 2.0
        },

        # === THEMATIC: ENVIRONMENT ===
        "reporterre.net": {
            "name": "Reporterre",
            "url": "https://reporterre.net",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-texte p"
            },
            "rate_limit": 1.5
        },

        # === INTERNATIONAL ADDITIONAL ===
        "rt.com": {
            "name": "RT (Russia Today)",
            "url": "https://www.rt.com",
            "selectors": {
                "article_links": "a.link",
                "title": "h1",
                "content": "div.article__text p"
            },
            "rate_limit": 2.0
        },
        "scmp.com": {
            "name": "South China Morning Post",
            "url": "https://www.scmp.com",
            "selectors": {
                "article_links": "a[href*='/article/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 2.0
        },
        "japantimes.co.jp": {
            "name": "The Japan Times",
            "url": "https://www.japantimes.co.jp",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },
        "koreaherald.com": {
            "name": "The Korea Herald",
            "url": "https://www.koreaherald.com",
            "selectors": {
                "article_links": "div.main_sec a",
                "title": "h1",
                "content": "div.view_con p"
            },
            "rate_limit": 1.5
        },
        # ABC News Australia - REMOVED (blocks/timeouts)
        "cbc.ca": {
            "name": "CBC News Canada",
            "url": "https://www.cbc.ca/news",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.story p"
            },
            "rate_limit": 1.5
        },
        "dw.com": {
            "name": "Deutsche Welle",
            "url": "https://www.dw.com/en",
            "selectors": {
                "article_links": "a[href*='/a-']",
                "title": "h1",
                "content": "div.longText p"
            },
            "rate_limit": 1.5
        },
        # RFI - REMOVED (robots.txt blocks scraping)
        # France 24 - REMOVED (robots.txt blocks scraping)

        # === AFRICA ===
        # Jeune Afrique - REMOVED (robots.txt blocks scraping)
        "lematin.ma": {
            "name": "Le Matin (Maroc)",
            "url": "https://lematin.ma",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },

        # === LATIN AMERICA ===
        # Clarín - REMOVED (robots.txt blocks scraping)
        "eluniversal.com.mx": {
            "name": "El Universal (Mexico)",
            "url": "https://www.eluniversal.com.mx",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.field-body p"
            },
            "rate_limit": 1.5
        },

        # ═══════════════════════════════════════════════════════════════
        # === FRANCE - EXTENDED (Dec 2025) ===
        # ═══════════════════════════════════════════════════════════════
        "courrierinternational.com": {
            "name": "Courrier International",
            "url": "https://www.courrierinternational.com",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 1.5
        },
        "doctissimo.fr": {
            "name": "Doctissimo",
            "url": "https://www.doctissimo.fr",
            "selectors": {
                "article_links": "a[href*='/sante/'], a[href*='/nutrition/']",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 1.5
        },
        "lesnumeriques.com": {
            "name": "Les Numériques",
            "url": "https://www.lesnumeriques.com",
            "selectors": {
                "article_links": "a[href*='/article/'], a[href*='/news/']",
                "title": "h1",
                "content": "div.text p"
            },
            "rate_limit": 1.5
        },
        "gala.fr": {
            "name": "Gala",
            "url": "https://www.gala.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article__body p"
            },
            "rate_limit": 1.5
        },
        "actu.fr": {
            "name": "Actu.fr",
            "url": "https://actu.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.content p"
            },
            "rate_limit": 1.5
        },
        "clubic.com": {
            "name": "Clubic",
            "url": "https://www.clubic.com",
            "selectors": {
                "article_links": "a[href*='/actualite/'], a[href*='/news/']",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 1.5
        },
        "pleinevie.fr": {
            "name": "Pleine Vie",
            "url": "https://www.pleinevie.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },
        "rmcsport.bfmtv.com": {
            "name": "RMC Sport",
            "url": "https://rmcsport.bfmtv.com",
            "selectors": {
                "article_links": "a[href*='/actualite/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },
        "lexpress.fr": {
            "name": "L'Express",
            "url": "https://www.lexpress.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },
        "parismatch.com": {
            "name": "Paris Match",
            "url": "https://www.parismatch.com",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article__content p"
            },
            "rate_limit": 1.5
        },
        "sudouest.fr": {
            "name": "Sud Ouest",
            "url": "https://www.sudouest.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-text p"
            },
            "rate_limit": 1.5
        },
        "tf1info.fr": {
            "name": "TF1 Info",
            "url": "https://www.tf1info.fr",
            "selectors": {
                "article_links": "a[href*='/article/']",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 1.5
        },
        "charentelibre.fr": {
            "name": "Charente Libre",
            "url": "https://www.charentelibre.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },
        "marianne.net": {
            "name": "Marianne",
            "url": "https://www.marianne.net",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },
        "telerama.fr": {
            "name": "Télérama",
            "url": "https://www.telerama.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 1.5
        },
        "lavoixdunord.fr": {
            "name": "La Voix du Nord",
            "url": "https://www.lavoixdunord.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-text p"
            },
            "rate_limit": 1.5
        },
        "20minutes.fr": {
            "name": "20 Minutes",
            "url": "https://www.20minutes.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.content p"
            },
            "rate_limit": 1.5
        },
        "forbes.fr": {
            "name": "Forbes France",
            "url": "https://www.forbes.fr",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 1.5
        },

        # ═══════════════════════════════════════════════════════════════
        # === USA - EXTENDED (Dec 2025) ===
        # ═══════════════════════════════════════════════════════════════
        "usatoday.com": {
            "name": "USA Today",
            "url": "https://www.usatoday.com",
            "selectors": {
                "article_links": "a[href*='/story/']",
                "title": "h1",
                "content": "div.gnt_ar_b p"
            },
            "rate_limit": 2.0
        },
        "latimes.com": {
            "name": "Los Angeles Times",
            "url": "https://www.latimes.com",
            "selectors": {
                "article_links": "a[href*='/story/']",
                "title": "h1",
                "content": "div.rich-text-article-body p"
            },
            "rate_limit": 2.0
        },
        "foxnews.com": {
            "name": "Fox News",
            "url": "https://www.foxnews.com",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 2.0
        },
        "msnbc.com": {
            "name": "MSNBC",
            "url": "https://www.msnbc.com",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 2.0
        },
        "abcnews.go.com": {
            "name": "ABC News",
            "url": "https://abcnews.go.com",
            "selectors": {
                "article_links": "a[href*='/story']",
                "title": "h1",
                "content": "div.story-body p"
            },
            "rate_limit": 2.0
        },
        "cbsnews.com": {
            "name": "CBS News",
            "url": "https://www.cbsnews.com",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.content__body p"
            },
            "rate_limit": 2.0
        },
        "nbcnews.com": {
            "name": "NBC News",
            "url": "https://www.nbcnews.com",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 2.0
        },
        "politico.com": {
            "name": "Politico",
            "url": "https://www.politico.com",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.story-text p"
            },
            "rate_limit": 2.0
        },
        "axios.com": {
            "name": "Axios",
            "url": "https://www.axios.com",
            "selectors": {
                "article_links": "a[href*='/202']",
                "title": "h1",
                "content": "div.gtm-story-text p"
            },
            "rate_limit": 2.0
        },
        "thehill.com": {
            "name": "The Hill",
            "url": "https://thehill.com",
            "selectors": {
                "article_links": "a[href*='/news/'], a[href*='/policy/']",
                "title": "h1",
                "content": "div.article__text p"
            },
            "rate_limit": 2.0
        },
        "huffpost.com": {
            "name": "HuffPost",
            "url": "https://www.huffpost.com",
            "selectors": {
                "article_links": "a[href*='/entry/']",
                "title": "h1",
                "content": "div.entry__content p"
            },
            "rate_limit": 2.0
        },
        "breitbart.com": {
            "name": "Breitbart News",
            "url": "https://www.breitbart.com",
            "selectors": {
                "article_links": "article a",
                "title": "h1",
                "content": "div.entry-content p"
            },
            "rate_limit": 2.0
        },
        "technologyreview.com": {
            "name": "MIT Technology Review",
            "url": "https://www.technologyreview.com",
            "selectors": {
                "article_links": "a[href*='/202']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 2.0
        },
        "scientificamerican.com": {
            "name": "Scientific American",
            "url": "https://www.scientificamerican.com",
            "selectors": {
                "article_links": "a[href*='/article/']",
                "title": "h1",
                "content": "div.article-text p"
            },
            "rate_limit": 2.0
        },

        # ═══════════════════════════════════════════════════════════════
        # === UK - EXTENDED (Dec 2025) ===
        # ═══════════════════════════════════════════════════════════════
        "thetimes.co.uk": {
            "name": "The Times",
            "url": "https://www.thetimes.co.uk",
            "selectors": {
                "article_links": "a[href*='/article/']",
                "title": "h1",
                "content": "div.article__content p"
            },
            "rate_limit": 2.0
        },
        "telegraph.co.uk": {
            "name": "The Daily Telegraph",
            "url": "https://www.telegraph.co.uk",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article-body-text p"
            },
            "rate_limit": 2.0
        },
        "independent.co.uk": {
            "name": "The Independent",
            "url": "https://www.independent.co.uk",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 2.0
        },
        "economist.com": {
            "name": "The Economist",
            "url": "https://www.economist.com",
            "selectors": {
                "article_links": "a[href*='/']",
                "title": "h1",
                "content": "div.article__body p"
            },
            "rate_limit": 2.0
        },
        "news.sky.com": {
            "name": "Sky News",
            "url": "https://news.sky.com",
            "selectors": {
                "article_links": "a[href*='/story/']",
                "title": "h1",
                "content": "div.sdc-article-body p"
            },
            "rate_limit": 2.0
        },
        "dailymail.co.uk": {
            "name": "Daily Mail",
            "url": "https://www.dailymail.co.uk",
            "selectors": {
                "article_links": "a[href*='/article-']",
                "title": "h2",
                "content": "div.article-text p"
            },
            "rate_limit": 2.0
        },
        "thesun.co.uk": {
            "name": "The Sun",
            "url": "https://www.thesun.co.uk",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article__content p"
            },
            "rate_limit": 2.0
        },
        "mirror.co.uk": {
            "name": "The Mirror",
            "url": "https://www.mirror.co.uk",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 2.0
        },
        "spectator.co.uk": {
            "name": "The Spectator",
            "url": "https://www.spectator.co.uk",
            "selectors": {
                "article_links": "a[href*='/article/']",
                "title": "h1",
                "content": "div.article__content p"
            },
            "rate_limit": 2.0
        },
        "newstatesman.com": {
            "name": "New Statesman",
            "url": "https://www.newstatesman.com",
            "selectors": {
                "article_links": "a[href*='/article/']",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 2.0
        },

        # ═══════════════════════════════════════════════════════════════
        # === EUROPE - EXTENDED (Dec 2025) ===
        # ═══════════════════════════════════════════════════════════════
        "politico.eu": {
            "name": "Politico Europe",
            "url": "https://www.politico.eu",
            "selectors": {
                "article_links": "a[href*='/article/']",
                "title": "h1",
                "content": "div.story-text p"
            },
            "rate_limit": 2.0
        },
        "euronews.com": {
            "name": "Euronews",
            "url": "https://www.euronews.com",
            "selectors": {
                "article_links": "a[href*='/202']",
                "title": "h1",
                "content": "div.c-article-content p"
            },
            "rate_limit": 1.5
        },
        "euractiv.com": {
            "name": "Euractiv",
            "url": "https://www.euractiv.com",
            "selectors": {
                "article_links": "a[href*='/section/']",
                "title": "h1",
                "content": "div.ea-article-body p"
            },
            "rate_limit": 1.5
        },
        "euobserver.com": {
            "name": "EUobserver",
            "url": "https://euobserver.com",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },
        "handelsblatt.com": {
            "name": "Handelsblatt Global",
            "url": "https://www.handelsblatt.com",
            "selectors": {
                "article_links": "a[href*='/article/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 2.0
        },
        "ansa.it": {
            "name": "ANSA",
            "url": "https://www.ansa.it",
            "selectors": {
                "article_links": "a[href*='/notizie/']",
                "title": "h1",
                "content": "div.news-txt p"
            },
            "rate_limit": 1.5
        },
        "dutchnews.nl": {
            "name": "Dutch News",
            "url": "https://www.dutchnews.nl",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.entry-content p"
            },
            "rate_limit": 1.5
        },
        "nltimes.nl": {
            "name": "NL Times",
            "url": "https://nltimes.nl",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 1.5
        },
        "brusselstimes.com": {
            "name": "The Brussels Times",
            "url": "https://www.brusselstimes.com",
            "selectors": {
                "article_links": "a[href*='/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },
        "swissinfo.ch": {
            "name": "Swissinfo",
            "url": "https://www.swissinfo.ch/eng",
            "selectors": {
                "article_links": "a[href*='/eng/']",
                "title": "h1",
                "content": "div.si-detail__content p"
            },
            "rate_limit": 1.5
        },
        "notesfrompoland.com": {
            "name": "Notes from Poland",
            "url": "https://notesfrompoland.com",
            "selectors": {
                "article_links": "a[href*='/202']",
                "title": "h1",
                "content": "div.entry-content p"
            },
            "rate_limit": 1.5
        },
        "kyivindependent.com": {
            "name": "The Kyiv Independent",
            "url": "https://kyivindependent.com",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article-content p"
            },
            "rate_limit": 1.5
        },
        "lrt.lt": {
            "name": "LRT (Lithuania)",
            "url": "https://www.lrt.lt/en",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        },
        "err.ee": {
            "name": "ERR News (Estonia)",
            "url": "https://news.err.ee",
            "selectors": {
                "article_links": "a[href*='/news/']",
                "title": "h1",
                "content": "div.article-body p"
            },
            "rate_limit": 1.5
        }
    }

    def __init__(self):
        self.client = httpx.AsyncClient(
            headers={"User-Agent": settings.USER_AGENT},
            timeout=settings.REQUEST_TIMEOUT,
            follow_redirects=True
        )
        self.robots_cache: Dict[str, RobotFileParser] = {}
        self.scraped_urls: Set[str] = set()
        self.article_hashes: Set[str] = set()
        self.last_request_time: Dict[str, datetime] = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    def _get_domain(self, url: str) -> str:
        """Extract domain from URL"""
        return urlparse(url).netloc.replace("www.", "")

    @lru_cache(maxsize=100)
    def _check_robots_txt(self, domain: str, url: str) -> bool:
        """
        Vérifie si le scraping est autorisé par robots.txt
        IMPORTANT: Respect des règles du site
        """
        if domain not in self.robots_cache:
            robots_url = f"https://{domain}/robots.txt"
            rp = RobotFileParser()
            rp.set_url(robots_url)
            try:
                rp.read()
                self.robots_cache[domain] = rp
            except Exception as e:
                logger.warning(f"Could not read robots.txt for {domain}: {e}")
                return True  # Si pas de robots.txt, on autorise

        rp = self.robots_cache.get(domain)
        if rp:
            return rp.can_fetch(settings.USER_AGENT, url)
        return True

    async def _respect_rate_limit(self, domain: str):
        """
        Rate limiting intelligent par domaine
        Évite de surcharger les serveurs
        """
        source_config = self.WORLD_NEWS_SOURCES.get(domain, {})
        rate_limit = source_config.get("rate_limit", 2.0)

        if domain in self.last_request_time:
            elapsed = (datetime.now() - self.last_request_time[domain]).total_seconds()
            if elapsed < rate_limit:
                await asyncio.sleep(rate_limit - elapsed)

        self.last_request_time[domain] = datetime.now()

    def _detect_paywall(self, html: str, url: str) -> bool:
        """
        Détecte si l'article est derrière un paywall
        """
        paywall_indicators = [
            "paywall",
            "subscribe",
            "subscription required",
            "premium content",
            "members only",
            "log in to read",
            "register to continue"
        ]

        html_lower = html.lower()
        return any(indicator in html_lower for indicator in paywall_indicators)

    def _compute_article_hash(self, title: str, content: str) -> str:
        """Hash pour déduplication rapide"""
        text = f"{title}{content}".lower()
        return hashlib.md5(text.encode()).hexdigest()

    async def _is_duplicate(self, title: str, content: str) -> bool:
        """
        Déduplication avancée par hash ET similarité d'embeddings
        Évite les articles identiques de différentes sources
        """
        # 1. Déduplication rapide par hash
        article_hash = self._compute_article_hash(title, content)
        if article_hash in self.article_hashes:
            logger.debug(f"Duplicate detected (hash): {title[:50]}")
            return True

        self.article_hashes.add(article_hash)
        return False

    async def discover_article_urls(
        self,
        source_domain: str,
        max_articles: int = 20
    ) -> List[str]:
        """
        Découvre les URLs d'articles depuis la page d'accueil d'une source
        """
        source_config = self.WORLD_NEWS_SOURCES.get(source_domain)
        if not source_config:
            logger.error(f"Unknown source: {source_domain}")
            return []

        base_url = source_config["url"]

        # Vérifier robots.txt
        if not self._check_robots_txt(source_domain, base_url):
            logger.warning(f"Scraping not allowed by robots.txt: {base_url}")
            return []

        # Rate limiting
        await self._respect_rate_limit(source_domain)

        article_links = []

        # 1. Homepage - STOP dès qu'on a assez d'articles
        try:
            response = await self.client.get(base_url, timeout=10.0)
            soup = BeautifulSoup(response.text, 'html.parser')

            # Extract article links from homepage
            links = soup.select(source_config["selectors"]["article_links"])

            for link in links:
                if len(article_links) >= max_articles:  # STOP EARLY
                    break
                href = link.get('href')
                if href:
                    full_url = urljoin(base_url, href)
                    if self._is_valid_article_url(full_url, source_domain):
                        article_links.append(full_url)

            # 2. Category Pages - SKIP si on a déjà assez
            if len(article_links) < max_articles:
                categories = ["world", "politics", "tech"]

                for category in categories:
                    if len(article_links) >= max_articles:
                        break

                    cat_url = urljoin(base_url, category)
                    if category in cat_url:
                        try:
                            cat_response = await self.client.get(cat_url, timeout=8.0)
                            if cat_response.status_code == 200:
                                cat_soup = BeautifulSoup(cat_response.text, 'html.parser')
                                cat_links = cat_soup.select(source_config["selectors"]["article_links"])

                                for link in cat_links:
                                    if len(article_links) >= max_articles:
                                        break

                                    href = link.get('href')
                                    if href:
                                        full_url = urljoin(base_url, href)
                                        if self._is_valid_article_url(full_url, source_domain):
                                            article_links.append(full_url)
                        except Exception:
                            continue

        except Exception as e:
            logger.error(f"Failed to discover articles from {base_url}: {e}")
            pass

        # Remove duplicates and limit
        unique_links = list(set(article_links))[:max_articles]
        logger.info(f"Discovered {len(unique_links)} articles from {source_config['name']}")
        return unique_links[:max_articles]

    def _is_valid_article_url(self, url: str, domain: str) -> bool:
        """Valide qu'une URL est bien un article"""
        # Filtrer les sections, catégories, etc.
        invalid_patterns = [
            '/section/', '/category/', '/tag/', '/author/',
            '/videos/', '/podcasts/', '/live/', '/topic/'
        ]

        return not any(pattern in url.lower() for pattern in invalid_patterns)

    async def scrape_article(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Scrape un article complet depuis son URL
        Utilise Newspaper3k pour extraction robuste
        """
        domain = self._get_domain(url)

        # Vérifier si déjà scrapé
        if url in self.scraped_urls:
            return None

        # Vérifier robots.txt
        if not self._check_robots_txt(domain, url):
            logger.warning(f"Scraping not allowed: {url}")
            return None

        # Rate limiting
        await self._respect_rate_limit(domain)

        try:
            # Télécharger et parser avec Newspaper3k - timeout global de 15s
            try:
                article = await asyncio.wait_for(
                    asyncio.to_thread(self._extract_with_newspaper, url),
                    timeout=15.0
                )
            except asyncio.TimeoutError:
                logger.warning(f"⏱️ Timeout scraping: {url[:60]}")
                return None

            # Accepter le contenu partiel (paywall) si titre + meta_description disponibles
            is_partial_content = False
            effective_text = article.text or ""

            if len(effective_text) < 200:
                # Vérifier si on peut utiliser le contenu partiel (titre + meta_description)
                has_valid_title = article.title and len(article.title) > 10
                has_meta_desc = article.meta_description and len(article.meta_description) > 30

                if has_valid_title and has_meta_desc:
                    # Utiliser meta_description comme texte principal pour le clustering
                    effective_text = f"{article.title}. {article.meta_description}"
                    is_partial_content = True
                    logger.info(f"📰 Partial content accepted (paywall): {article.title[:50]}")
                elif len(effective_text) < 50:
                    # Vraiment trop court, rejeter
                    logger.warning(f"Article too short or empty: {url}")
                    return None

            # Vérifier paywall (Disabled for now as it's too aggressive)
            # if article.html and self._detect_paywall(article.html, url):
            #     logger.warning(f"Paywall detected: {url}")
            #     return None

            # Vérifier duplication (utiliser effective_text pour partial content)
            if await self._is_duplicate(article.title, effective_text):
                return None

            # Marquer comme scrapé
            self.scraped_urls.add(url)

            # Extraire métadonnées
            source_config = self.WORLD_NEWS_SOURCES.get(domain, {})

            article_data = {
                "url": url,
                "source_name": source_config.get("name", domain),
                "source_domain": domain,
                "raw_title": article.title,
                "raw_text": effective_text,  # Utilise effective_text (peut être meta_description pour paywall)
                "summary": article.meta_description or effective_text[:300],
                "published_at": article.publish_date.isoformat() if article.publish_date else datetime.now().isoformat(),
                "authors": article.authors,
                "image_url": article.top_image,
                "language": article.meta_lang or "unknown",
                "keywords": article.meta_keywords,
                "scraped_at": datetime.now().isoformat(),
                "is_partial_content": is_partial_content  # Flag pour tracking
            }

            log_prefix = "📰" if is_partial_content else "✅"
            logger.success(f"{log_prefix} Scraped: {article.title[:60]}")
            return article_data

        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")
            return None

    def _extract_with_newspaper(self, url: str) -> NewsArticle:
        """Extract article using Newspaper3k (blocking)"""
        # Configure proper headers with realistic User-Agent
        config = Config()
        config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        config.request_timeout = 10  # Réduit de 30s à 10s pour performance
        config.number_threads = 1
        config.memoize_articles = False
        config.fetch_images = False

        article = NewsArticle(url, config=config)
        article.download()
        article.parse()
        return article

    async def scrape_source(
        self,
        source_domain: str,
        max_articles: int = 10,
        timeout: float = None
    ) -> List[Dict[str, Any]]:
        """
        Scrape a single source and return articles.
        Used by pipeline manager for per-source progress tracking.

        Args:
            source_domain: Domain to scrape (e.g., "lemonde.fr")
            max_articles: Maximum articles to retrieve
            timeout: Optional timeout for entire source (defaults to DEFAULT_SOURCE_TIMEOUT)

        Returns:
            List of article dictionaries
        """
        if source_domain not in self.WORLD_NEWS_SOURCES:
            logger.warning(f"Unknown source: {source_domain}")
            return []

        source_timeout = timeout or self.DEFAULT_SOURCE_TIMEOUT

        async def _scrape_source_internal() -> List[Dict[str, Any]]:
            articles = []

            # Discover URLs with timeout
            try:
                urls = await asyncio.wait_for(
                    self.discover_article_urls(source_domain, max_articles),
                    timeout=source_timeout / 2  # Half timeout for discovery
                )
            except asyncio.TimeoutError:
                logger.warning(f"Timeout discovering URLs for {source_domain}")
                return []

            if not urls:
                return []

            # Scrape articles with semaphore and per-article timeout
            semaphore = asyncio.Semaphore(min(5, settings.MAX_CONCURRENT_REQUESTS))

            async def scrape_with_semaphore(url):
                async with semaphore:
                    try:
                        return await asyncio.wait_for(
                            self.scrape_article(url),
                            timeout=self.DEFAULT_ARTICLE_TIMEOUT
                        )
                    except asyncio.TimeoutError:
                        logger.debug(f"Timeout scraping article: {url[:60]}...")
                        return None
                    except Exception as e:
                        logger.debug(f"Error scraping {url[:60]}: {e}")
                        return None

            tasks = [scrape_with_semaphore(url) for url in urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Filter valid results
            for result in results:
                if isinstance(result, dict) and result:
                    articles.append(result)

            return articles

        # Wrap entire operation with source timeout
        try:
            return await asyncio.wait_for(_scrape_source_internal(), timeout=source_timeout)
        except asyncio.TimeoutError:
            logger.warning(f"Source {source_domain} timed out after {source_timeout}s")
            return []

    async def scrape_multiple_sources(
        self,
        sources: List[str] = None,
        max_articles_per_source: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Scrape plusieurs sources en parallèle
        Gestion intelligente de la concurrence
        """
        if sources is None:
            sources = list(self.WORLD_NEWS_SOURCES.keys())

        all_articles = []

        # Phase 1: Découverte des URLs (séquentiel par source)
        logger.info(f"🔍 Discovering articles from {len(sources)} sources...")
        all_urls = []

        for source_domain in sources:
            urls = await self.discover_article_urls(source_domain, max_articles_per_source)
            all_urls.extend(urls)

        logger.info(f"📰 Found {len(all_urls)} article URLs")

        # Phase 2: Scraping des articles (concurrent avec limite)
        logger.info(f"⚙️ Scraping {len(all_urls)} articles...")

        # Limiter la concurrence pour ne pas surcharger
        semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_REQUESTS)
        completed = 0
        total = len(all_urls)

        async def scrape_with_semaphore(url):
            nonlocal completed
            async with semaphore:
                result = await self.scrape_article(url)
                completed += 1
                if completed % 5 == 0 or completed == total:
                    logger.info(f"📊 Progress: {completed}/{total} articles scraped")
                return result

        tasks = [scrape_with_semaphore(url) for url in all_urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filtrer les résultats valides
        for result in results:
            if isinstance(result, dict) and result:
                all_articles.append(result)

        logger.success(f"✅ Successfully scraped {len(all_articles)} articles")
        return all_articles

    async def scrape_by_topic(
        self,
        topic: str,
        sources: List[str] = None,
        max_results: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Scrape des articles sur un topic spécifique
        Utilise recherche Google News (sans API key)
        """
        logger.info(f"🔍 Searching for topic: {topic}")

        # Utiliser Google News RSS (pas besoin d'API)
        google_news_url = f"https://news.google.com/rss/search?q={topic}&hl=fr&gl=FR&ceid=FR:fr"

        try:
            import feedparser
            feed = await asyncio.to_thread(feedparser.parse, google_news_url)

            article_urls = [entry.get("link") for entry in feed.entries[:max_results]]

            # Scraper les articles trouvés
            semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_REQUESTS)

            async def scrape_with_semaphore(url):
                async with semaphore:
                    return await self.scrape_article(url)

            tasks = [scrape_with_semaphore(url) for url in article_urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            articles = [r for r in results if isinstance(r, dict) and r]
            logger.success(f"✅ Found {len(articles)} articles on topic: {topic}")

            return articles

        except Exception as e:
            logger.error(f"Failed to search topic '{topic}': {e}")
            return []


# Global instance
advanced_scraper = AdvancedNewsScraper()


async def get_advanced_scraper() -> AdvancedNewsScraper:
    """Dependency injection for FastAPI"""
    return advanced_scraper
