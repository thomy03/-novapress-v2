"""
BGE-M3 Embedding Model
Open Source Alternative to Google Embeddings
BAAI/bge-m3: 1024-dimensional multilingual embeddings
"""
from sentence_transformers import SentenceTransformer
from typing import List, Optional
import torch
import numpy as np
from loguru import logger

from app.core.config import settings


class EmbeddingService:
    """BGE-M3 Embedding Service - NO GEMINI"""

    def __init__(self):
        self.model: Optional[SentenceTransformer] = None
        self.device = settings.EMBEDDING_DEVICE
        self._fallback_mode = False  # Use random embeddings when model unavailable
        self._dimension = settings.EMBEDDING_DIMENSION  # 1024

    async def initialize(self):
        """Load BGE-M3 model with graceful fallback"""
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

    def encode(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """
        Encode texts into 1024-dimensional embeddings

        Args:
            texts: List of text strings to encode
            batch_size: Batch size for encoding

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

        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True  # Important for cosine similarity
        )

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
