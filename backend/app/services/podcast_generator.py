"""
NovaPress Podcast Generator
Generates conversational audio briefings between Henri and Denise.
Uses Edge TTS (free) + LLM for script generation.
"""
import asyncio
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger


PODCAST_CACHE_DIR = Path("audio_cache/podcasts")
PODCAST_VOICES = {
    "host": "fr-FR-HenriNeural",
    "analyst": "fr-FR-DeniseNeural",
}


class PodcastGenerator:
    """Generates 2-5 minute conversational podcasts from syntheses."""

    def __init__(self):
        PODCAST_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    async def generate_podcast(
        self,
        syntheses: List[Dict[str, Any]],
        duration_target: int = 180,
        llm_call=None,
    ) -> Optional[bytes]:
        """
        Generate a podcast audio file from syntheses.

        Args:
            syntheses: List of synthesis dicts
            duration_target: Target duration in seconds (default 3 minutes)
            llm_call: Async callable(messages) -> str

        Returns:
            OGG audio bytes or None if failed
        """
        if not syntheses:
            logger.warning("No syntheses provided for podcast")
            return None

        # Check cache
        cache_key = self._cache_key(syntheses, duration_target)
        cache_path = PODCAST_CACHE_DIR / f"{cache_key}.ogg"
        if cache_path.exists():
            logger.info(f"Podcast cache hit: {cache_key[:8]}")
            return cache_path.read_bytes()

        try:
            # 1. Generate conversational script
            script = await self._generate_script(syntheses, duration_target, llm_call)
            if not script:
                logger.warning("Script generation returned empty result")
                return None

            # 2. TTS for each line
            audio_segments = await self._tts_all_lines(script)
            if not audio_segments:
                logger.warning("TTS produced no audio segments")
                return None

            # 3. Concatenate into OGG
            audio_bytes = await self._concat_segments(audio_segments, cache_path)
            return audio_bytes

        except Exception as e:
            logger.error(f"Podcast generation failed: {e}")
            return None

    async def _generate_script(
        self,
        syntheses: List[Dict],
        duration_target: int,
        llm_call,
    ) -> List[Dict[str, str]]:
        """Generate dialogue script via LLM."""
        n_exchanges = max(4, duration_target // 20)  # ~20s per exchange
        formatted = self._format_syntheses(syntheses)

        prompt_messages = [
            {
                "role": "system",
                "content": (
                    "Tu es un scriptwriter pour un podcast d'actualité français. "
                    "Génère un dialogue naturel et engageant entre Henri (présentateur, "
                    "voix grave, factuel) et Denise (analyste, voix chaleureuse, contextualise). "
                    f"Le podcast doit avoir environ {n_exchanges} échanges. "
                    "Chaque réplique fait 1-3 phrases courtes. "
                    "Style : radio FM professionnelle, pas d'exclamations excessives. "
                    "Commence par Henri qui présente le briefing du jour. "
                    "RETOURNE UNIQUEMENT un JSON array valide. "
                    "Format: [{\"speaker\": \"host\", \"text\": \"...\"}, ...]"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Transforme ces synthèses en dialogue podcast "
                    f"({n_exchanges} échanges) :\n\n{formatted}"
                ),
            },
        ]

        if not llm_call:
            # Fallback static script
            return self._fallback_script(syntheses)

        try:
            response = await llm_call(prompt_messages, max_tokens=1200)
            return self._parse_script(response)
        except Exception as e:
            logger.warning(f"LLM script generation failed: {e}, using fallback")
            return self._fallback_script(syntheses)

    @staticmethod
    def _parse_script(response: str) -> List[Dict[str, str]]:
        """Parse LLM response into script lines."""
        try:
            text = response.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            parsed = json.loads(text)
            if isinstance(parsed, list):
                result = []
                for item in parsed:
                    if isinstance(item, dict):
                        speaker = item.get("speaker", "host")
                        if speaker not in ("host", "analyst"):
                            speaker = "host"
                        text_line = str(item.get("text", "")).strip()
                        if text_line:
                            result.append({"speaker": speaker, "text": text_line})
                return result
        except (json.JSONDecodeError, ValueError):
            pass
        return []

    @staticmethod
    def _fallback_script(syntheses: List[Dict]) -> List[Dict[str, str]]:
        """Simple fallback script without LLM."""
        script = [
            {"speaker": "host", "text": "Bonjour et bienvenue sur NovaPress. Je suis Henri, et voici votre briefing du jour."},
            {"speaker": "analyst", "text": "Et moi c'est Denise. Voyons ensemble les grandes actualités du moment."},
        ]
        for synth in syntheses[:3]:
            title = synth.get("title", "")
            intro = synth.get("introduction", synth.get("summary", ""))[:200]
            if title:
                script.append({"speaker": "host", "text": f"Commençons par : {title}."})
                if intro:
                    script.append({"speaker": "analyst", "text": intro})
        script.append({"speaker": "host", "text": "Voilà pour ce briefing NovaPress. À bientôt !"})
        return script

    async def _tts_all_lines(
        self, script: List[Dict[str, str]]
    ) -> List[bytes]:
        """Generate TTS for each line concurrently."""
        from app.services.tts_service import get_tts_service
        tts = get_tts_service()
        if not tts.is_available():
            logger.warning("TTS not available for podcast generation")
            return []

        tasks = []
        for line in script:
            voice = PODCAST_VOICES.get(line["speaker"], PODCAST_VOICES["host"])
            tasks.append(tts.generate_audio(line["text"], voice=voice, rate="-5%"))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        segments = []
        for r in results:
            if isinstance(r, bytes) and r:
                segments.append(r)
            elif isinstance(r, Exception):
                logger.debug(f"TTS segment failed: {r}")
        return segments

    @staticmethod
    async def _concat_segments(
        segments: List[bytes], output_path: Path
    ) -> Optional[bytes]:
        """Concatenate MP3 segments into a single OGG file."""
        try:
            import pydub  # type: ignore
            from pydub import AudioSegment  # type: ignore

            combined = AudioSegment.empty()
            silence = AudioSegment.silent(duration=400)  # 400ms pause between lines

            for seg_bytes in segments:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                    f.write(seg_bytes)
                    tmp_path = f.name
                try:
                    audio = AudioSegment.from_mp3(tmp_path)
                    combined += audio + silence
                finally:
                    os.unlink(tmp_path)

            # Export as OGG (Telegram voice format)
            with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as f:
                tmp_ogg = f.name
            try:
                combined.export(tmp_ogg, format="ogg", codec="libvorbis")
                ogg_bytes = Path(tmp_ogg).read_bytes()
                output_path.write_bytes(ogg_bytes)
                logger.info(
                    f"Podcast generated: {len(ogg_bytes)//1024}KB, "
                    f"{len(combined)/1000:.1f}s duration"
                )
                return ogg_bytes
            finally:
                if os.path.exists(tmp_ogg):
                    os.unlink(tmp_ogg)

        except ImportError:
            logger.warning("pydub not installed — concatenating MP3 segments naively")
            # Naive fallback: just return first segment as MP3
            if segments:
                mp3_bytes = b"".join(segments)
                output_path.write_bytes(mp3_bytes)
                return mp3_bytes
            return None
        except Exception as e:
            logger.error(f"Audio concatenation failed: {e}")
            return None

    @staticmethod
    def _format_syntheses(syntheses: List[Dict]) -> str:
        parts = []
        for s in syntheses[:4]:
            title = s.get("title", "")
            intro = s.get("introduction", s.get("summary", ""))[:300]
            cat = s.get("category", "")
            parts.append(f"[{cat}] {title}\n{intro}")
        return "\n\n---\n\n".join(parts)

    @staticmethod
    def _cache_key(syntheses: List[Dict], duration: int) -> str:
        ids = "|".join(str(s.get("id", s.get("title", "")[:20])) for s in syntheses[:4])
        content = f"{ids}:{duration}"
        return hashlib.md5(content.encode()).hexdigest()


# Global instance
_podcast_gen: Optional[PodcastGenerator] = None


def get_podcast_generator() -> PodcastGenerator:
    global _podcast_gen
    if _podcast_gen is None:
        _podcast_gen = PodcastGenerator()
    return _podcast_gen
