"""
Configuration settings for NovaPress AI v2
Using pydantic-settings for type-safe environment variables
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
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

    # Security
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OpenRouter LLM - NEVER hardcode API keys! Use .env file
    OPENROUTER_API_KEY: str = ""  # Required: set in .env
    OPENROUTER_MODEL: str = "deepseek/deepseek-v3.2"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # Search Enrichment APIs (Optional)
    # Perplexity Sonar - https://docs.perplexity.ai/
    PERPLEXITY_API_KEY: str = ""
    # xAI Grok - https://docs.x.ai/
    XAI_API_KEY: str = ""

    # YouTube Data API v3 (Optional - get from https://console.cloud.google.com)
    YOUTUBE_API_KEY: str = ""

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
    API_V1_PREFIX: str = "/api"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3002"]
    DEBUG: bool = False  # Set to True only in development via .env

    # Clustering (HDBSCAN) - Paramètres équilibrés
    MIN_CLUSTER_SIZE: int = 3          # Minimum 3 articles par cluster
    MIN_SAMPLES: int = 2               # Moins strict pour plus de clusters
    CLUSTER_SELECTION_EPSILON: float = 0.08  # Modéré: équilibre qualité/quantité
    MIN_CLUSTER_SIMILARITY: float = 0.55    # AJUSTÉ: seuil réaliste (était 0.80 - trop strict)
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

    @property
    def rss_feeds_list(self) -> List[str]:
        """Parse RSS feeds string into list"""
        return [feed.strip() for feed in self.RSS_FEEDS.split(",") if feed.strip()]


settings = Settings()
