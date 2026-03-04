"""
Image generation service for NovaPress AI v2.
Uses fal.ai z-image/turbo — fast & cheap (~$0.003/image at 16:9).
Phase 2A: LLM scene description for contextual images.
"""
import httpx
from typing import Optional, Dict, Any
from loguru import logger

from app.core.config import settings
from app.core.circuit_breaker import get_circuit_breaker, CircuitOpenError


# Category-specific style prompts — photojournalistic editorial, NO abstract art
STYLE_PROMPTS: Dict[str, str] = {
    "MONDE": "Photojournalistic editorial scene, documentary photography, realistic setting, dramatic natural lighting, press agency quality, cinematic composition",
    "POLITIQUE": "Press photography style, institutional setting, parliament or government building, serious documentary tone, natural lighting, editorial newspaper quality",
    "ECONOMIE": "Business editorial photography, trading floor or financial district, professional documentary style, clean composition, muted professional tones",
    "SCIENCES": "Scientific documentary photography, laboratory or research facility, precise clean composition, educational editorial style, natural lighting",
    "SPORT": "Dynamic sports photography, frozen motion, athletic energy, stadium atmosphere, dramatic cinematic angle",
    "TECH": "Modern technology editorial, silicon valley aesthetic, clean minimalist hardware, blue-tinted lighting, professional product photography style",
    "CULTURE": "Cultural editorial photography, museum or theater setting, artistic composition, warm sophisticated lighting, documentary quality",
}

NO_TEXT_SUFFIX = "absolutely no text, no letters, no words, no numbers, no logos, no watermarks, no captions"


class FalImageGenerator:
    """Generate editorial illustrations via fal.ai z-image/turbo."""

    MODEL = "fal-ai/z-image/turbo"

    def __init__(self):
        self.api_key = settings.FAL_API_KEY
        self.base_url = "https://fal.run"
        self.circuit_breaker = get_circuit_breaker("fal_ai")
        self.enabled = bool(self.api_key)

        if self.enabled:
            logger.info(f"fal.ai image generation enabled (model: {self.MODEL})")
        else:
            logger.info("fal.ai image generation disabled (no FAL_API_KEY)")

    async def generate_for_synthesis(self, synthesis: Dict[str, Any]) -> Optional[str]:
        """
        Generate an editorial illustration for a synthesis.
        Uses LLM scene description for contextual prompts, falls back to basic prompt.

        Returns:
            Image URL string (hosted by fal.ai) or None on failure.
        """
        if not self.enabled:
            return None

        category = synthesis.get("category", "MONDE")
        prompt = await self._build_scene_prompt(synthesis, category)

        return await self._call_model(prompt, category)

    async def _call_model(self, prompt: str, category: str) -> Optional[str]:
        """Call fal.ai z-image/turbo and return the image URL."""
        params = {
            "prompt": prompt,
            "image_size": "landscape_16_9",
            "num_inference_steps": 8,
            "num_images": 1,
            "output_format": "jpeg",
            "enable_safety_checker": True,
        }

        async def _do_call() -> Optional[str]:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/{self.MODEL}",
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
                            logger.info(f"[z-image/turbo] Generated image for category={category}")
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
            logger.error(f"[z-image/turbo] Image generation failed: {e}")
            return None

    async def _build_scene_prompt(self, synthesis: Dict[str, Any], category: str) -> str:
        """
        Phase 2A: Build an image prompt using LLM scene description.
        Falls back to basic prompt if LLM fails.
        """
        try:
            scene_desc = await self._get_llm_scene_description(synthesis)
            if scene_desc and len(scene_desc) > 20:
                style = STYLE_PROMPTS.get(category, "professional editorial photography")
                return (
                    f"{scene_desc}. "
                    f"Style: {style}, "
                    f"editorial newspaper quality, cinematic composition. "
                    f"{NO_TEXT_SUFFIX}."
                )
        except Exception as e:
            logger.warning(f"LLM scene description failed, using fallback: {e}")

        return self._build_basic_prompt(synthesis, category)

    async def _get_llm_scene_description(self, synthesis: Dict[str, Any]) -> Optional[str]:
        """
        Ask LLM to generate a concrete visual scene description (~80 words).
        Costs ~$0.0003 per call (short prompt + short response).
        """
        try:
            from app.ml.llm import get_llm_service
            llm = get_llm_service()
        except Exception:
            return None

        title = synthesis.get("title", "")
        key_points = synthesis.get("keyPoints", [])
        body = synthesis.get("body", "") or synthesis.get("summary", "")
        analysis = synthesis.get("analysis", "")

        kp_text = "; ".join(kp[:80] for kp in key_points[:4]) if key_points else ""

        prompt = f"""Décris une SCÈNE VISUELLE concrète pour illustrer cet article de presse.

TITRE: {title}
POINTS CLÉS: {kp_text}
EXTRAIT: {body[:800]}
{f"ANALYSE: {analysis[:300]}" if analysis else ""}

Règles:
- Décris une scène CONCRÈTE et RÉALISTE (pas abstraite)
- Base-toi UNIQUEMENT sur le contenu des sources
- Pas de personnes identifiables (pas de visages reconnaissables)
- Inclus: lieu, objets, atmosphère, éclairage, couleurs dominantes
- Maximum 80 mots
- EN ANGLAIS (pour le modèle d'image)

Réponds UNIQUEMENT avec la description de la scène, rien d'autre."""

        try:
            response = await llm.client.chat.completions.create(
                model=llm.model,
                messages=[
                    {"role": "system", "content": "You are an expert editorial photo director. You describe concrete visual scenes for newspaper illustrations."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=150,
            )
            text = response.choices[0].message.content
            if text:
                text = text.strip().strip('"').strip("'").replace("\n", " ")
                logger.info(f"🖼️ LLM scene description: {text[:100]}...")
                return text
        except Exception as e:
            logger.warning(f"LLM scene description generation failed: {e}")

        return None

    def _build_basic_prompt(self, synthesis: Dict[str, Any], category: str) -> str:
        """Fallback: Build a basic prompt from title and entities."""
        title = synthesis.get("title", "")

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

        style = STYLE_PROMPTS.get(category, "professional editorial photography")

        return (
            f"Editorial press photograph for news article: {title}.{entity_text} "
            f"Style: {style}, professional, muted natural colors, "
            f"cinematic composition, newspaper quality. "
            f"{NO_TEXT_SUFFIX}."
        )


# Singleton
_generator: Optional[FalImageGenerator] = None


def get_image_generator() -> FalImageGenerator:
    """Get or create the image generator singleton."""
    global _generator
    if _generator is None:
        _generator = FalImageGenerator()
    return _generator
