"""
Text-to-Speech Service for NovaPress AI
Generates audio summaries of syntheses.

Currently uses edge-tts (Microsoft Edge TTS) for high-quality voices.
Can be extended to support ElevenLabs, Azure, or Google Cloud TTS.
"""

import os
import hashlib
import asyncio
from typing import Optional, Dict, Any
from pathlib import Path
from loguru import logger

# Try to import edge-tts (optional dependency)
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    logger.warning("edge-tts not installed. Audio synthesis will be disabled.")


class TTSService:
    """Text-to-Speech service for generating audio summaries"""

    # Available voices (Microsoft Edge TTS)
    VOICES = {
        "fr-FR": {
            "male": "fr-FR-HenriNeural",
            "female": "fr-FR-DeniseNeural"
        },
        "en-US": {
            "male": "en-US-GuyNeural",
            "female": "en-US-JennyNeural"
        }
    }

    # Audio cache directory
    CACHE_DIR = Path("audio_cache")

    def __init__(self):
        """Initialize TTS service"""
        self.enabled = EDGE_TTS_AVAILABLE
        if self.enabled:
            self.CACHE_DIR.mkdir(exist_ok=True)
            logger.info("TTS Service initialized with edge-tts")
        else:
            logger.warning("TTS Service disabled - edge-tts not available")

    def is_available(self) -> bool:
        """Check if TTS is available"""
        return self.enabled

    def _get_cache_path(self, text_hash: str) -> Path:
        """Get path for cached audio file"""
        return self.CACHE_DIR / f"{text_hash}.mp3"

    def _hash_text(self, text: str, voice: str) -> str:
        """Generate hash for cache key"""
        content = f"{text}:{voice}"
        return hashlib.md5(content.encode()).hexdigest()

    async def generate_audio(
        self,
        text: str,
        voice: str = "fr-FR-DeniseNeural",
        rate: str = "+0%",
        pitch: str = "+0Hz"
    ) -> Optional[bytes]:
        """
        Generate audio from text.

        Args:
            text: Text to convert to speech
            voice: Voice name (Microsoft Edge TTS voice)
            rate: Speaking rate (e.g., "+10%", "-20%")
            pitch: Voice pitch (e.g., "+5Hz", "-10Hz")

        Returns:
            Audio bytes (MP3 format) or None if failed
        """
        if not self.enabled:
            return None

        if not text or len(text.strip()) < 10:
            logger.warning("Text too short for TTS")
            return None

        try:
            # Check cache
            text_hash = self._hash_text(text, voice)
            cache_path = self._get_cache_path(text_hash)

            if cache_path.exists():
                logger.info(f"TTS cache hit: {text_hash[:8]}...")
                return cache_path.read_bytes()

            # Generate audio
            logger.info(f"Generating TTS for {len(text)} chars with voice {voice}")

            communicate = edge_tts.Communicate(
                text=text,
                voice=voice,
                rate=rate,
                pitch=pitch
            )

            # Collect audio chunks
            audio_chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_chunks.append(chunk["data"])

            if not audio_chunks:
                logger.error("No audio data received from TTS")
                return None

            audio_data = b"".join(audio_chunks)

            # Cache the result
            cache_path.write_bytes(audio_data)
            logger.info(f"TTS generated and cached: {len(audio_data)} bytes")

            return audio_data

        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            return None

    async def generate_synthesis_audio(
        self,
        synthesis: Dict[str, Any],
        voice_gender: str = "female",
        language: str = "fr-FR"
    ) -> Optional[bytes]:
        """
        Generate audio for a synthesis.

        Args:
            synthesis: Synthesis dict with title, summary, body, keyPoints
            voice_gender: "male" or "female"
            language: Language code (fr-FR, en-US)

        Returns:
            Audio bytes or None
        """
        # Build audio script
        title = synthesis.get("title", "")
        summary = synthesis.get("summary", synthesis.get("introduction", ""))
        key_points = synthesis.get("keyPoints", synthesis.get("key_points", []))

        # Create a natural script for audio
        script_parts = []

        if title:
            script_parts.append(title + ".")

        if summary:
            # Truncate if too long
            if len(summary) > 500:
                summary = summary[:497] + "..."
            script_parts.append(summary)

        if key_points and isinstance(key_points, list):
            script_parts.append("Points clés:")
            for i, point in enumerate(key_points[:5], 1):
                if isinstance(point, str):
                    script_parts.append(f"{i}. {point}")

        if not script_parts:
            return None

        full_script = " ".join(script_parts)

        # Get voice
        voices = self.VOICES.get(language, self.VOICES["fr-FR"])
        voice = voices.get(voice_gender, voices["female"])

        return await self.generate_audio(
            text=full_script,
            voice=voice,
            rate="-5%"  # Slightly slower for news reading
        )

    def get_audio_url(self, synthesis_id: str) -> str:
        """Get the API URL for audio streaming"""
        return f"/api/syntheses/by-id/{synthesis_id}/audio"


# Global instance
_tts_service: Optional[TTSService] = None


def get_tts_service() -> TTSService:
    """Get or create the global TTS service instance"""
    global _tts_service
    if _tts_service is None:
        _tts_service = TTSService()
    return _tts_service


async def generate_synthesis_audio(synthesis: Dict[str, Any]) -> Optional[bytes]:
    """Convenience function to generate audio for a synthesis"""
    service = get_tts_service()
    return await service.generate_synthesis_audio(synthesis)
