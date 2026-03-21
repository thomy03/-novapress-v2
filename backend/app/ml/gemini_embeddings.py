"""
Gemini Embedding Service for NovaPress AI v2.

Uses Google's Gemini embedding models for text, PDF, and image embeddings.
Supports multiple task types: retrieval, fact verification, etc.
"""

import asyncio
from typing import List, Optional

from loguru import logger

from app.core.config import settings

try:
    from google import genai
    from google.genai import types

    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    logger.warning("google-genai SDK not installed. Install with: pip install google-genai")


class GeminiEmbeddingService:
    """Embedding service using Google Gemini models with multimodal support."""

    def __init__(self) -> None:
        self._client: Optional["genai.Client"] = None
        self._model: str = getattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-exp-03-07")
        self._dimensions: int = getattr(settings, "GEMINI_EMBEDDING_DIMENSIONS", 3072)

        api_key = getattr(settings, "GOOGLE_AI_API_KEY", None)
        if not api_key:
            logger.warning("GOOGLE_AI_API_KEY not set - Gemini embeddings will not be available")
            return

        if not GENAI_AVAILABLE:
            logger.warning("google-genai SDK not available - Gemini embeddings will not be available")
            return

        try:
            self._client = genai.Client(api_key=api_key)
            logger.info(
                f"Gemini Embedding Service initialized: model={self._model}, "
                f"dimensions={self._dimensions}"
            )
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            self._client = None

    @property
    def is_available(self) -> bool:
        """Check if the service is ready to use."""
        return self._client is not None

    def _check_available(self) -> None:
        """Raise if service is not available."""
        if not self.is_available:
            raise RuntimeError(
                "Gemini Embedding Service is not available. "
                "Check GOOGLE_AI_API_KEY and google-genai installation."
            )

    async def embed_text(self, text: str, task: str = "RETRIEVAL_DOCUMENT") -> List[float]:
        """Embed a single text string.

        Args:
            text: The text to embed.
            task: Embedding task type (RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY,
                  FACT_VERIFICATION, etc.).

        Returns:
            List of floats representing the embedding vector.
        """
        self._check_available()

        def _embed() -> List[float]:
            result = self._client.models.embed_content(
                model=self._model,
                contents=text,
                config=types.EmbedContentConfig(
                    task_type=task,
                    output_dimensionality=self._dimensions,
                ),
            )
            return list(result.embeddings[0].values)

        try:
            return await asyncio.to_thread(_embed)
        except Exception as e:
            logger.error(f"Gemini embed_text failed: {e}")
            raise

    async def embed_texts(
        self, texts: List[str], task: str = "RETRIEVAL_DOCUMENT"
    ) -> List[List[float]]:
        """Batch embed multiple texts.

        Args:
            texts: List of texts to embed.
            task: Embedding task type.

        Returns:
            List of embedding vectors.
        """
        self._check_available()

        if not texts:
            return []

        def _embed_batch() -> List[List[float]]:
            result = self._client.models.embed_content(
                model=self._model,
                contents=texts,
                config=types.EmbedContentConfig(
                    task_type=task,
                    output_dimensionality=self._dimensions,
                ),
            )
            return [list(emb.values) for emb in result.embeddings]

        try:
            return await asyncio.to_thread(_embed_batch)
        except Exception as e:
            logger.error(f"Gemini embed_texts failed for {len(texts)} texts: {e}")
            raise

    async def embed_pdf(self, pdf_bytes: bytes) -> List[float]:
        """Embed a PDF document natively using Gemini's multimodal capabilities.

        Args:
            pdf_bytes: Raw bytes of the PDF file.

        Returns:
            List of floats representing the embedding vector.
        """
        self._check_available()

        def _embed() -> List[float]:
            pdf_part = types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")
            result = self._client.models.embed_content(
                model=self._model,
                contents=pdf_part,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=self._dimensions,
                ),
            )
            return list(result.embeddings[0].values)

        try:
            return await asyncio.to_thread(_embed)
        except Exception as e:
            logger.error(f"Gemini embed_pdf failed: {e}")
            raise

    async def embed_image(
        self, image_bytes: bytes, mime_type: str = "image/png"
    ) -> List[float]:
        """Embed an image using Gemini's multimodal capabilities.

        Args:
            image_bytes: Raw bytes of the image file.
            mime_type: MIME type of the image (image/png, image/jpeg, etc.).

        Returns:
            List of floats representing the embedding vector.
        """
        self._check_available()

        def _embed() -> List[float]:
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            result = self._client.models.embed_content(
                model=self._model,
                contents=image_part,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=self._dimensions,
                ),
            )
            return list(result.embeddings[0].values)

        try:
            return await asyncio.to_thread(_embed)
        except Exception as e:
            logger.error(f"Gemini embed_image failed: {e}")
            raise

    async def search_query(self, query: str) -> List[float]:
        """Embed a search query optimized for retrieval.

        Args:
            query: The search query text.

        Returns:
            List of floats representing the embedding vector.
        """
        return await self.embed_text(query, task="RETRIEVAL_QUERY")

    async def verify_fact(self, claim: str) -> List[float]:
        """Embed a claim for fact verification.

        Args:
            claim: The claim text to embed for fact checking.

        Returns:
            List of floats representing the embedding vector.
        """
        return await self.embed_text(claim, task="FACT_VERIFICATION")


# Module-level singleton
_gemini_embedding_service: Optional[GeminiEmbeddingService] = None


def get_gemini_embedding_service() -> GeminiEmbeddingService:
    """Get or create the singleton GeminiEmbeddingService instance."""
    global _gemini_embedding_service
    if _gemini_embedding_service is None:
        _gemini_embedding_service = GeminiEmbeddingService()
    return _gemini_embedding_service
