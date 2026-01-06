"""
BGE-M3 Embedding Model
Open Source Alternative to Google Embeddings
BAAI/bge-m3: 1024-dimensional multilingual embeddings
Includes Redis caching for performance optimization
"""
from sentence_transformers import SentenceTransformer
from typing import List, Optional
import torch
import numpy as np
import hashlib
import redis
from loguru import logger

from app.core.config import settings

# Redis cache settings
EMBEDDING_CACHE_TTL = 60 * 60 * 24 * 7  # 7 days
EMBEDDING_CACHE_PREFIX = "emb:"


class EmbeddingService:
    """BGE-M3 Embedding Service with Redis caching"""

    def __init__(self):
        self.model: Optional[SentenceTransformer] = None
        self.device = settings.EMBEDDING_DEVICE
        self._fallback_mode = False  # Use random embeddings when model unavailable
        self._dimension = settings.EMBEDDING_DIMENSION  # 1024
        self._redis: Optional[redis.Redis] = None
        self._cache_enabled = True
        self._cache_hits = 0
        self._cache_misses = 0

    async def initialize(self):
        """Load BGE-M3 model and connect to Redis with graceful fallback"""
        # Initialize Redis cache
        try:
            self._redis = redis.from_url(settings.REDIS_URL, decode_responses=False)
            self._redis.ping()
            logger.success("✅ Redis embedding cache connected")
        except Exception as e:
            logger.warning(f"⚠️ Redis cache unavailable: {e}")
            self._cache_enabled = False

        # Load embedding model
        try:
            logger.info(f"Loading BGE-M3 model: {settings.EMBEDDING_MODEL}")
            self.model = SentenceTransformer(
                settings.EMBEDDING_MODEL,
                device=self.device
            )
            logger.success(f"✅ BGE-M3 loaded on {self.device}")
            self._fallback_mode = False
        except Exception as e:
            logger.warning(f"⚠️ Failed to load embedding model: {e}")
            logger.warning("⚠️ Switching to fallback mode (random embeddings for testing)")
            self._fallback_mode = True
            # Don't raise - allow system to continue in degraded mode

    def _get_cache_key(self, text: str) -> str:
        """Generate cache key from text hash"""
        text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]
        return f"{EMBEDDING_CACHE_PREFIX}{text_hash}"

    def _get_from_cache(self, text: str) -> Optional[np.ndarray]:
        """Try to get embedding from Redis cache"""
        if not self._cache_enabled or not self._redis:
            return None
        try:
            key = self._get_cache_key(text)
            cached = self._redis.get(key)
            if cached:
                self._cache_hits += 1
                return np.frombuffer(cached, dtype=np.float32)
            self._cache_misses += 1
            return None
        except Exception as e:
            logger.debug(f"Cache read error: {e}")
            return None

    def _save_to_cache(self, text: str, embedding: np.ndarray):
        """Save embedding to Redis cache"""
        if not self._cache_enabled or not self._redis:
            return
        try:
            key = self._get_cache_key(text)
            self._redis.setex(key, EMBEDDING_CACHE_TTL, embedding.tobytes())
        except Exception as e:
            logger.debug(f"Cache write error: {e}")

    def get_cache_stats(self) -> dict:
        """Return cache hit/miss statistics"""
        total = self._cache_hits + self._cache_misses
        return {
            "hits": self._cache_hits,
            "misses": self._cache_misses,
            "hit_rate": self._cache_hits / total if total > 0 else 0,
            "enabled": self._cache_enabled,
        }

    def encode(self, texts: List[str], batch_size: int = 32, use_cache: bool = True) -> np.ndarray:
        """
        Encode texts into 1024-dimensional embeddings with Redis caching

        Args:
            texts: List of text strings to encode
            batch_size: Batch size for encoding
            use_cache: Whether to use Redis cache (default True)

        Returns:
            numpy array of shape (len(texts), 1024)
        """
        # Fallback mode: return random embeddings for testing
        if self._fallback_mode:
            logger.debug(f"Using fallback random embeddings for {len(texts)} texts")
            embeddings = np.random.randn(len(texts), self._dimension).astype(np.float32)
            # Normalize for cosine similarity
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            return embeddings / norms

        if not self.model:
            raise RuntimeError("Model not initialized. Call initialize() first.")

        # Check cache for each text
        embeddings = np.zeros((len(texts), self._dimension), dtype=np.float32)
        texts_to_encode = []
        indices_to_encode = []

        if use_cache and self._cache_enabled:
            for i, text in enumerate(texts):
                cached = self._get_from_cache(text)
                if cached is not None:
                    embeddings[i] = cached
                else:
                    texts_to_encode.append(text)
                    indices_to_encode.append(i)
        else:
            texts_to_encode = texts
            indices_to_encode = list(range(len(texts)))

        # Encode uncached texts
        if texts_to_encode:
            new_embeddings = self.model.encode(
                texts_to_encode,
                batch_size=batch_size,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True  # Important for cosine similarity
            )

            # Store in result array and cache
            for i, idx in enumerate(indices_to_encode):
                embeddings[idx] = new_embeddings[i]
                if use_cache:
                    self._save_to_cache(texts_to_encode[i], new_embeddings[i])

        if use_cache and self._cache_enabled and len(texts) > 1:
            cache_rate = (len(texts) - len(texts_to_encode)) / len(texts) * 100
            if cache_rate > 0:
                logger.debug(f"Embedding cache: {cache_rate:.0f}% hit rate ({len(texts) - len(texts_to_encode)}/{len(texts)})")

        return embeddings

    def encode_single(self, text: str) -> np.ndarray:
        """Encode a single text"""
        return self.encode([text])[0]

    def similarity(self, text1: str, text2: str) -> float:
        """Compute cosine similarity between two texts"""
        emb1 = self.encode_single(text1)
        emb2 = self.encode_single(text2)
        return float(np.dot(emb1, emb2))

    def batch_similarity(self, query: str, candidates: List[str]) -> List[float]:
        """
        Compute similarity between query and multiple candidates

        Args:
            query: Query text
            candidates: List of candidate texts

        Returns:
            List of similarity scores
        """
        query_emb = self.encode_single(query)
        candidate_embs = self.encode(candidates)

        # Cosine similarity (embeddings are already normalized)
        similarities = np.dot(candidate_embs, query_emb)
        return similarities.tolist()


# Global instance
embedding_service = EmbeddingService()


async def init_embedding_model():
    """Initialize the global embedding service"""
    await embedding_service.initialize()


def get_embedding_service() -> EmbeddingService:
    """Dependency injection for FastAPI"""
    if not embedding_service.model:
        raise RuntimeError("Embedding service not initialized")
    return embedding_service
