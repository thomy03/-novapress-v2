"""
Configuration settings for NovaPress AI v2
Using pydantic-settings for type-safe environment variables
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from pathlib import Path
import warnings

# Get the backend directory (where .env should be)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://novapress:password@localhost:5432/novapress_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Qdrant Vector DB
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "novapress_articles"

    # Security — MUST be set via .env for stable JWT sessions
    # If not set, a default dev key is used (NOT safe for production)
    SECRET_KEY: str = "novapress-dev-key-CHANGE-IN-PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ADMIN_API_KEY: str = ""  # Required for admin endpoints

    # OpenRouter LLM - NEVER hardcode API keys! Use .env file
    OPENROUTER_API_KEY: str = ""  # Required: set in .env
    OPENROUTER_MODEL: str = "deepseek/deepseek-v3.2"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # Search Enrichment APIs (Optional)
    # Perplexity Sonar - https://docs.perplexity.ai/
    PERPLEXITY_API_KEY: str = ""
    # xAI Grok - https://docs.x.ai/
    XAI_API_KEY: str = ""

    # BGE-M3 Embeddings (Open Source)
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DEVICE: str = "cpu"  # or "cuda" if GPU available
    EMBEDDING_BATCH_SIZE: int = 32
    EMBEDDING_DIMENSION: int = 1024

    # Scraping
    USER_AGENT: str = "NovaPress/2.0 (+https://novapress.ai)"
    REQUEST_TIMEOUT: int = 30
    MAX_CONCURRENT_REQUESTS: int = 10

    # RSS Feeds
    RSS_FEEDS: str = "https://www.lemonde.fr/rss/une.xml,https://www.lefigaro.fr/rss/figaro_actualites.xml"

    # Reddit Scraping
    REDDIT_SUBREDDITS: str = "artificialintelligence,technology,news,france"
    REDDIT_RATE_LIMIT: float = 2.0

    # API Settings
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003", "http://localhost:3004", "http://localhost:3005"]
    DEBUG: bool = False  # Set to True only in development via .env
    LOG_LEVEL: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL

    # Clustering (HDBSCAN) - Paramètres équilibrés
    MIN_CLUSTER_SIZE: int = 3          # Minimum 3 articles par cluster
    MIN_SAMPLES: int = 2               # Moins strict pour plus de clusters
    CLUSTER_SELECTION_EPSILON: float = 0.08  # Modéré: équilibre qualité/quantité
    MIN_CLUSTER_SIMILARITY: float = 0.50    # AJUSTÉ: seuil assoupli (0.80 → 0.55 → 0.50)
    MAX_CLUSTER_SIZE: int = 20         # Augmenté: permet plus d'articles par cluster

    # Knowledge Graph (spaCy + NetworkX)
    SPACY_MODEL: str = "fr_core_news_lg"
    MAX_GRAPH_NODES: int = 50
    MAX_GRAPH_EDGES: int = 100

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 1000

    # Pipeline
    PIPELINE_INTERVAL_MINUTES: int = 15  # Run pipeline every 15 minutes
    MAX_ARTICLES_PER_SOURCE: int = 20

    # RSS Scraping - 100% legal via official RSS feeds
    ENABLE_RSS_SCRAPING: bool = True  # Enable RSS feed scraping
    RSS_MAX_ARTICLES_PER_FEED: int = 10  # Max articles per RSS feed

    # GDELT API - 100% free, no authentication required
    GDELT_ENABLED: bool = True  # Enable GDELT news API

    # Social Triggers - Avant-garde synthesis from social media trends
    ENABLE_SOCIAL_TRIGGERS: bool = True  # Detect emerging topics from social

    # Source Control - Disable extended sources for faster/more reliable scraping
    ENABLE_EXTENDED_SOURCES: bool = False  # Set to True to enable 50+ additional sources

    # Auto-Discovery of Sources - Find replacements for blocked sources using LLM
    ENABLE_AUTO_DISCOVERY: bool = True  # Enable automatic source replacement
    AUTO_DISCOVERY_MAX_ATTEMPTS: int = 3  # Max discovery attempts per blocked source
    AUTO_DISCOVERY_MAX_SOURCES: int = 10  # Max auto-discovered sources to keep

    # Persona Generation Mode
    # SINGLE_PERSONA_MODE (recommended): Use category-based rotation to pick ONE persona per synthesis
    # This saves ~80% of LLM costs compared to pre-generating all personas
    SINGLE_PERSONA_MODE: bool = True  # True = one persona per synthesis (rotation), False = all personas

    # Legacy: Pre-generation of ALL persona versions (only used if SINGLE_PERSONA_MODE=False)
    # NOTE: If SINGLE_PERSONA_MODE=True, this is automatically ignored (REF-004 fix)
    ENABLE_PERSONA_PREGENERATION: bool = False  # Set to True only if SINGLE_PERSONA_MODE=False
    PERSONA_PREGENERATION_LIST: str = "le_cynique,l_optimiste,le_conteur,le_satiriste"  # Personas to pre-generate

    def get_effective_pregeneration_enabled(self) -> bool:
        """
        Returns True only if persona pre-generation should actually run.
        Prevents conflicting config where both SINGLE_PERSONA_MODE and ENABLE_PERSONA_PREGENERATION are True.
        REF-004: Fix flags config conflictuels
        FIX-001: Changed from @property to method for Pydantic v2 compatibility
        """
        # Pre-generation only makes sense when NOT in single-persona mode
        if self.SINGLE_PERSONA_MODE:
            return False
        return self.ENABLE_PERSONA_PREGENERATION

    def get_personas_to_pregenerate(self) -> List[str]:
        """Parse persona list for pre-generation"""
        if not self.get_effective_pregeneration_enabled():
            return []
        return [p.strip() for p in self.PERSONA_PREGENERATION_LIST.split(",") if p.strip()]

    # Synthesis Deduplication & Update Mode
    # Prevent creating duplicate syntheses when pipeline runs frequently
    ENABLE_SYNTHESIS_DEDUP: bool = True  # Enable deduplication checks
    ENABLE_SYNTHESIS_UPDATE: bool = True  # Update existing syntheses with new articles instead of skipping
    DEDUP_HOURS_LOOKBACK: int = 24  # Check for duplicates in last N hours
    DEDUP_URL_OVERLAP_THRESHOLD: float = 0.7  # 70% URL overlap = duplicate
    DEDUP_EMBEDDING_THRESHOLD: float = 0.92  # 92% embedding similarity = duplicate

    # Search Enrichment Configuration (Perplexity + Grok)
    # Enable systematic enrichment of all syntheses with web context and social sentiment
    ENABLE_SEARCH_ENRICHMENT: bool = True  # Master toggle for search enrichment
    ENRICHMENT_REQUIRED: bool = True  # If True, track enrichment status (syntheses without = incomplete)
    PERPLEXITY_TIMEOUT: int = 45  # Timeout in seconds for Perplexity API calls
    GROK_TIMEOUT: int = 45  # Timeout in seconds for Grok API calls
    ENABLE_BREAKING_NEWS: bool = True  # Enable Grok's get_breaking_context() for real-time alerts
    ENABLE_FACT_CHECKING: bool = True  # Enable Perplexity fact-checking on contradictory claims
    MAX_FACT_CHECK_CLAIMS: int = 3  # Max claims to verify per synthesis
    ENRICHMENT_RETRY_COUNT: int = 3  # Number of retries on API failure

    # Telegram Bot — "Le Boss Briefing"
    TELEGRAM_BOT_TOKEN: str = ""  # Required: get from @BotFather on Telegram
    TELEGRAM_WEBHOOK_URL: str = ""  # Public URL for webhook (e.g., https://your-domain/webhook/telegram)
    TELEGRAM_DAILY_BRIEFING_HOUR: int = 7  # Send daily briefing at 7:00 AM
    TELEGRAM_DAILY_BRIEFING_MINUTE: int = 0
    TELEGRAM_MAX_SEARCH_RESULTS: int = 3  # Max search results per /search command

    # Briefing Service
    BRIEFING_TOP_SYNTHESES: int = 5  # Number of top syntheses per briefing
    BRIEFING_MIN_COMPLIANCE_SCORE: int = 70  # Minimum compliance score for inclusion

    # Discord Webhook
    DISCORD_WEBHOOK_URL: str = ""  # Discord channel webhook URL
    DISCORD_NOTIFY_BREAKING: bool = False  # If True, only send breaking news notifications

    @property
    def rss_feeds_list(self) -> List[str]:
        """Parse RSS feeds string into list"""
        return [feed.strip() for feed in self.RSS_FEEDS.split(",") if feed.strip()]


settings = Settings()

if settings.SECRET_KEY == "novapress-dev-key-CHANGE-IN-PRODUCTION":
    warnings.warn(
        "SECRET_KEY is using default dev value! Set a secure key in .env for production.",
        stacklevel=1,
    )
