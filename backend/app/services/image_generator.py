"""
Image generation service for NovaPress AI v2.
Uses fal.ai API with multi-model selection per category.

Models:
  - Recraft V4 (design): MONDE, POLITIQUE, ECONOMIE, SCIENCES (~$0.04/image)
  - Nano Banana Pro (photorealistic): SPORT (~$0.04/image)
  - Flux 2 Flex (default): TECH, CULTURE (~$0.03/image)
  - Flux Schnell (fast): fallback (~$0.003/image)

Graceful fallback: if primary model fails, retry with Flux Schnell.
"""
import httpx
from typing import Optional, Dict, Any
from loguru import logger

from app.core.config import settings
from app.core.circuit_breaker import get_circuit_breaker, CircuitOpenError


# Category → model tier mapping
CATEGORY_MODEL_MAP: Dict[str, str] = {
    "MONDE": "design",
    "POLITIQUE": "design",
    "ECONOMIE": "design",
    "SCIENCES": "design",
    "SPORT": "photorealistic",
    "TECH": "default",
    "CULTURE": "default",
}

# Per-model API parameters (each fal.ai model has a different schema)
MODEL_CONFIGS: Dict[str, Dict[str, Any]] = {
    "fal-ai/nano-banana-pro": {
        "params": {
            "aspect_ratio": "16:9",
            "num_images": 1,
            "safety_tolerance": "2",
            "enable_safety_checker": True,
        },
    },
    "fal-ai/recraft/v4/text-to-image": {
        "params": {
            "image_size": {"width": 1024, "height": 576},
            "style": "digital_illustration",
        },
    },
    "fal-ai/flux-2-flex": {
        "params": {
            "image_size": "landscape_16_9",
            "num_inference_steps": 20,
            "guidance_scale": 3.5,
            "num_images": 1,
            "enable_safety_checker": True,
        },
    },
    "fal-ai/flux/schnell": {
        "params": {
            "image_size": "landscape_16_9",
            "num_inference_steps": 4,
            "num_images": 1,
            "enable_safety_checker": True,
        },
    },
}

# Category-specific style prompts — all enforce zero text/logos
STYLE_PROMPTS: Dict[str, str] = {
    "MONDE": "Editorial newspaper illustration, geopolitical theme, world map elements, diplomatic setting, muted documentary tones",
    "POLITIQUE": "Institutional editorial illustration, political symbols, formal architecture, serious mood, press conference atmosphere",
    "ECONOMIE": "Clean editorial illustration, financial theme, abstract geometric data patterns, professional color palette, business atmosphere",
    "SCIENCES": "Scientific editorial illustration, laboratory elements, molecular structures, precise clean lines, educational style",
    "SPORT": "Dynamic sports photography, frozen motion, athletic energy, stadium atmosphere, dramatic cinematic angle",
    "TECH": "Futuristic digital art, circuit patterns, holographic elements, neon blue accents, abstract technology concept",
    "CULTURE": "Artistic editorial illustration, cultural symbolism, museum quality composition, vibrant yet sophisticated palette",
}

NO_TEXT_SUFFIX = "absolutely no text, no letters, no words, no numbers, no logos, no watermarks, no captions"


class FalImageGenerator:
    """Generate editorial illustrations via fal.ai API with multi-model support."""

    def __init__(self):
        self.api_key = settings.FAL_API_KEY
        self.base_url = "https://fal.run"  # Synchronous endpoint (queue.fal.run returns IN_QUEUE)
        self.circuit_breaker = get_circuit_breaker("fal_ai")
        self.enabled = bool(self.api_key)

        if self.enabled:
            logger.info("fal.ai multi-model image generation enabled")
        else:
            logger.info("fal.ai image generation disabled (no FAL_API_KEY)")

    def _get_model_for_category(self, category: str) -> str:
        """Select the best fal.ai model based on synthesis category."""
        tier = CATEGORY_MODEL_MAP.get(category, "default")
        if tier == "design":
            return settings.FAL_MODEL_DESIGN
        elif tier == "photorealistic":
            return settings.FAL_MODEL_PHOTOREALISTIC
        elif tier == "default":
            return settings.FAL_MODEL_DEFAULT
        return settings.FAL_MODEL_FAST

    async def generate_for_synthesis(self, synthesis: Dict[str, Any]) -> Optional[str]:
        """
        Generate an editorial illustration based on synthesis content.
        Uses category-appropriate model with fallback to Flux Schnell.

        Returns:
            Image URL string (hosted by fal.ai) or None on failure.
        """
        if not self.enabled:
            return None

        category = synthesis.get("category", "MONDE")
        primary_model = self._get_model_for_category(category)
        prompt = self._build_prompt(synthesis, category)

        # Try primary model first
        url = await self._call_model(primary_model, prompt, category)
        if url:
            return url

        # Fallback to Flux Schnell
        fallback_model = settings.FAL_MODEL_FAST
        if fallback_model != primary_model:
            logger.warning(f"Primary model {primary_model} failed for {category}, falling back to {fallback_model}")
            url = await self._call_model(fallback_model, prompt, category)
            if url:
                return url

        return None

    async def _call_model(self, model: str, prompt: str, category: str) -> Optional[str]:
        """Call a specific fal.ai model and return the image URL."""
        config = MODEL_CONFIGS.get(model, MODEL_CONFIGS["fal-ai/flux/schnell"])
        params = {**config["params"], "prompt": prompt}

        async def _do_call() -> Optional[str]:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/{model}",
                    headers={
                        "Authorization": f"Key {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=params,
                )

                if response.status_code == 200:
                    data = response.json()
                    images = data.get("images", [])
                    if images:
                        url = images[0].get("url", "")
                        if url:
                            logger.info(f"[{model}] Generated image for category={category}")
                            return url

                    raise ValueError(f"fal.ai returned no images: {data}")
                else:
                    raise ValueError(f"fal.ai error {response.status_code}: {response.text[:200]}")

        try:
            return await self.circuit_breaker.call(_do_call)
        except CircuitOpenError:
            logger.warning("fal.ai circuit breaker is open, skipping image generation")
            return None
        except Exception as e:
            logger.error(f"[{model}] Image generation failed: {e}")
            return None

    def _build_prompt(self, synthesis: Dict[str, Any], category: str) -> str:
        """
        Build a fal.ai prompt from synthesis metadata.
        Uses category-specific style hints. Enforces zero text/logos.
        """
        title = synthesis.get("title", "")

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
            entity_names = ", ".join(n for n in names if n)
            if entity_names:
                entity_text = f" Featuring elements related to: {entity_names}."

        style = STYLE_PROMPTS.get(category, "sophisticated, professional editorial illustration")

        return (
            f"Editorial newspaper illustration for: {title}.{entity_text} "
            f"Style: {style}, minimal, professional, muted colors, "
            f"no people faces, abstract conceptual art, newspaper quality, "
            f"sophisticated composition. {NO_TEXT_SUFFIX}."
        )


# Singleton
_generator: Optional[FalImageGenerator] = None


def get_image_generator() -> FalImageGenerator:
    """Get or create the image generator singleton."""
    global _generator
    if _generator is None:
        _generator = FalImageGenerator()
    return _generator
