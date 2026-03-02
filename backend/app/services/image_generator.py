"""
Image generation service for NovaPress AI v2.
Uses fal.ai API (Flux Schnell) to generate editorial illustrations for syntheses.

Cost: ~$0.003/image → ~$3.60/month at 40 syntheses/day.
Graceful fallback: if fal.ai fails, synthesis keeps image_url=None.
"""
import httpx
from typing import Optional, Dict, Any
from loguru import logger

from app.core.config import settings
from app.core.circuit_breaker import get_circuit_breaker, CircuitOpenError


class FalImageGenerator:
    """Generate editorial illustrations via fal.ai API."""

    def __init__(self):
        self.api_key = settings.FAL_API_KEY
        self.model = settings.FAL_MODEL
        self.base_url = "https://queue.fal.run"
        self.circuit_breaker = get_circuit_breaker("fal_ai")
        self.enabled = bool(self.api_key)

        if self.enabled:
            logger.info(f"fal.ai image generation enabled (model: {self.model})")
        else:
            logger.info("fal.ai image generation disabled (no FAL_API_KEY)")

    async def generate_for_synthesis(self, synthesis: Dict[str, Any]) -> Optional[str]:
        """
        Generate an editorial illustration based on synthesis content.

        Args:
            synthesis: Synthesis dict with title, category, key_entities, etc.

        Returns:
            Image URL string (hosted by fal.ai) or None on failure.
        """
        if not self.enabled:
            return None

        try:
            self.circuit_breaker.check()
        except CircuitOpenError:
            logger.warning("fal.ai circuit breaker is open, skipping image generation")
            return None

        prompt = self._build_prompt(synthesis)

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/{self.model}",
                    headers={
                        "Authorization": f"Key {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "prompt": prompt,
                        "image_size": "landscape_16_9",
                        "num_inference_steps": 4,
                        "num_images": 1,
                        "enable_safety_checker": True,
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    images = data.get("images", [])
                    if images:
                        url = images[0].get("url", "")
                        if url:
                            self.circuit_breaker.record_success()
                            logger.info(f"Generated image for: {synthesis.get('title', '')[:50]}...")
                            return url

                    logger.warning(f"fal.ai returned no images: {data}")
                    self.circuit_breaker.record_failure()
                    return None
                else:
                    logger.error(f"fal.ai error {response.status_code}: {response.text[:200]}")
                    self.circuit_breaker.record_failure()
                    return None

        except Exception as e:
            logger.error(f"fal.ai image generation failed: {e}")
            self.circuit_breaker.record_failure()
            return None

    def _build_prompt(self, synthesis: Dict[str, Any]) -> str:
        """
        Build a fal.ai prompt from synthesis metadata.
        Style: editorial newspaper illustration, no text, no logos.
        """
        title = synthesis.get("title", "")
        category = synthesis.get("category", "MONDE")

        # Extract key entities for specificity
        entities = synthesis.get("key_entities", [])
        entity_text = ""
        if entities:
            names = []
            for e in entities[:3]:
                if isinstance(e, dict):
                    names.append(e.get("name", ""))
                elif isinstance(e, str):
                    names.append(e)
            entity_text = f" Featuring elements related to: {', '.join(n for n in names if n)}."

        # Category-specific style hints
        style_hints = {
            "TECH": "digital, circuits, technology, blue tones",
            "ECONOMIE": "financial charts, buildings, formal, warm tones",
            "POLITIQUE": "political symbols, institutional buildings, serious mood",
            "SPORT": "athletic movement, dynamic, energy",
            "SCIENCES": "scientific elements, laboratory, discovery",
            "CULTURE": "artistic elements, cultural symbols, vibrant",
            "MONDE": "global perspective, world map elements, diplomatic",
        }
        style = style_hints.get(category, "sophisticated, professional")

        return (
            f"Editorial newspaper illustration for the following news story: {title}.{entity_text} "
            f"Style: {style}, minimal, professional editorial illustration, "
            f"muted colors, no text, no logos, no people faces, abstract conceptual art, "
            f"newspaper quality, sophisticated composition."
        )


# Singleton
_generator: Optional[FalImageGenerator] = None


def get_image_generator() -> FalImageGenerator:
    """Get or create the image generator singleton."""
    global _generator
    if _generator is None:
        _generator = FalImageGenerator()
    return _generator
