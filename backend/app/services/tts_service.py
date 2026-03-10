"""
Text-to-Speech Service for NovaPress AI
Providers: XTTS (RunPod), OpenAI TTS, Azure AI Speech, ElevenLabs, Edge TTS (fallback).
Selection via TTS_PROVIDER env var or auto-detection.
"""

import hashlib
import re
from typing import Optional, Dict, Any
from pathlib import Path
from loguru import logger

# Try to import edge-tts (optional dependency)
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False

# Try to import elevenlabs
try:
    from elevenlabs import AsyncElevenLabs
    ELEVENLABS_AVAILABLE = True
except ImportError:
    ELEVENLABS_AVAILABLE = False

CACHE_DIR = Path("audio_cache")

# Strip audio tags that TTS can't handle (read literally otherwise)
AUDIO_TAG_PATTERN = re.compile(r'\[(?:soupir|rire|rire leger|pause|murmure|hm|hesitation)\]')


def _strip_audio_tags(text: str) -> str:
    """Remove audio tag markers that would be read literally."""
    return AUDIO_TAG_PATTERN.sub('', text).strip()


def _hash(text: str, voice: str, prefix: str = "") -> str:
    content = f"{prefix}:{text}:{voice}"
    return hashlib.md5(content.encode()).hexdigest()


def _get_cache(text_hash: str) -> Optional[bytes]:
    path = CACHE_DIR / f"{text_hash}.mp3"
    if path.exists():
        return path.read_bytes()
    return None


def _set_cache(text_hash: str, data: bytes) -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    (CACHE_DIR / f"{text_hash}.mp3").write_bytes(data)


# ---------------------------------------------------------------------------
# Edge TTS (free fallback)
# ---------------------------------------------------------------------------
class TTSService:
    """Edge TTS service (free fallback)"""

    VOICES = {
        "fr-FR": {"male": "fr-FR-HenriNeural", "female": "fr-FR-DeniseNeural"},
        "en-US": {"male": "en-US-GuyNeural", "female": "en-US-JennyNeural"},
    }

    def __init__(self):
        self.enabled = EDGE_TTS_AVAILABLE
        CACHE_DIR.mkdir(exist_ok=True)
        if self.enabled:
            logger.info("TTS Service initialized with edge-tts")

    def is_available(self) -> bool:
        return self.enabled

    async def generate_audio(self, text: str, voice: str = "fr-FR-DeniseNeural",
                             rate: str = "+0%", pitch: str = "+0Hz") -> Optional[bytes]:
        if not self.enabled or not text or len(text.strip()) < 10:
            return None
        text = _strip_audio_tags(text)
        h = _hash(text, voice, "edge")
        cached = _get_cache(h)
        if cached:
            return cached
        try:
            communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
            chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])
            if not chunks:
                return None
            data = b"".join(chunks)
            _set_cache(h, data)
            logger.info(f"Edge TTS: {len(text)} chars -> {len(data)//1024}KB")
            return data
        except Exception as e:
            logger.error(f"Edge TTS failed: {e}")
            return None

    async def generate_synthesis_audio(self, synthesis: Dict[str, Any],
                                       voice_gender: str = "female", language: str = "fr-FR") -> Optional[bytes]:
        script = _build_synthesis_script(synthesis)
        if not script:
            return None
        voices = self.VOICES.get(language, self.VOICES["fr-FR"])
        voice = voices.get(voice_gender, voices["female"])
        return await self.generate_audio(text=script, voice=voice, rate="-5%")

    def get_audio_url(self, synthesis_id: str) -> str:
        return f"/api/syntheses/by-id/{synthesis_id}/audio"


# ---------------------------------------------------------------------------
# OpenAI TTS (cheap, good quality, 6 built-in voices)
# ---------------------------------------------------------------------------
class OpenAITTSService:
    """OpenAI TTS via official API. ~$0.03/episode with tts-1-hd."""

    # Voice mapping: panelist key -> OpenAI voice name
    # Available: alloy, echo, fable, onyx, nova, shimmer
    VOICE_MAP = {}

    def __init__(self):
        from app.core.config import settings
        self.api_key = settings.OPENAI_TTS_API_KEY
        self.model = settings.OPENAI_TTS_MODEL
        self.VOICE_MAP = {
            "presentateur": settings.OPENAI_TTS_VOICE_PRESENTATEUR,
            "expert": settings.OPENAI_TTS_VOICE_EXPERT,
            "fr-FR-DeniseNeural": settings.OPENAI_TTS_VOICE_PRESENTATEUR,
            "fr-FR-HenriNeural": settings.OPENAI_TTS_VOICE_EXPERT,
            "fr-FR-EloiseNeural": settings.OPENAI_TTS_VOICE_PRESENTATEUR,
            "fr-FR-AlainNeural": settings.OPENAI_TTS_VOICE_EXPERT,
            "journaliste": settings.OPENAI_TTS_VOICE_PRESENTATEUR,
            "contradicteur": settings.OPENAI_TTS_VOICE_EXPERT,
        }
        CACHE_DIR.mkdir(exist_ok=True)
        logger.info(f"OpenAI TTS initialized (model={self.model})")

    def is_available(self) -> bool:
        return bool(self.api_key)

    def _resolve_voice(self, voice: str) -> str:
        return self.VOICE_MAP.get(voice, "nova")

    async def generate_audio(self, text: str, voice: str = "presentateur",
                             rate: str = "+0%", pitch: str = "+0Hz") -> Optional[bytes]:
        if not text or len(text.strip()) < 10:
            return None
        text = _strip_audio_tags(text)
        voice_name = self._resolve_voice(voice)
        h = _hash(text, voice_name, f"openai:{self.model}")
        cached = _get_cache(h)
        if cached:
            return cached
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self.api_key, timeout=60.0)
            response = await client.audio.speech.create(
                model=self.model,
                voice=voice_name,
                input=text,
                response_format="mp3",
                speed=0.95,  # Slightly slower for news delivery
            )
            data = response.content
            if not data:
                return None
            _set_cache(h, data)
            logger.info(f"OpenAI TTS: {len(text)} chars -> {len(data)//1024}KB (voice={voice_name})")
            return data
        except Exception as e:
            logger.error(f"OpenAI TTS failed: {e}")
            return None

    async def generate_synthesis_audio(self, synthesis: Dict[str, Any],
                                       voice_gender: str = "female", language: str = "fr-FR") -> Optional[bytes]:
        script = _build_synthesis_script(synthesis)
        if not script:
            return None
        voice = "presentateur" if voice_gender == "female" else "expert"
        return await self.generate_audio(text=script, voice=voice)

    def get_audio_url(self, synthesis_id: str) -> str:
        return f"/api/syntheses/by-id/{synthesis_id}/audio"


# ---------------------------------------------------------------------------
# Google Cloud TTS (Neural2/Studio/Journey voices, SSML, 1M chars free/month)
# ---------------------------------------------------------------------------
class GoogleTTSService:
    """Google Cloud Text-to-Speech via REST API with API key."""

    VOICE_MAP = {}

    def __init__(self):
        from app.core.config import settings
        self.api_key = settings.GOOGLE_TTS_API_KEY
        self.VOICE_MAP = {
            "presentateur": settings.GOOGLE_TTS_VOICE_PRESENTATEUR,
            "expert": settings.GOOGLE_TTS_VOICE_EXPERT,
            "journaliste": settings.GOOGLE_TTS_VOICE_PRESENTATEUR,
            "contradicteur": settings.GOOGLE_TTS_VOICE_EXPERT,
            "fr-FR-DeniseNeural": settings.GOOGLE_TTS_VOICE_PRESENTATEUR,
            "fr-FR-HenriNeural": settings.GOOGLE_TTS_VOICE_EXPERT,
        }
        CACHE_DIR.mkdir(exist_ok=True)
        logger.info(f"Google Cloud TTS initialized")

    def is_available(self) -> bool:
        return bool(self.api_key)

    def _resolve_voice(self, voice: str) -> str:
        return self.VOICE_MAP.get(voice, "fr-FR-Neural2-A")

    def _build_ssml(self, text: str) -> str:
        """Build SSML with natural pauses."""
        ssml_text = text
        # Convert audio tags to SSML breaks
        ssml_text = ssml_text.replace("[pause]", '<break time="600ms"/>')
        ssml_text = ssml_text.replace("[soupir]", '<break time="400ms"/>')
        ssml_text = ssml_text.replace("[hm]", '<break time="250ms"/>')
        ssml_text = ssml_text.replace("[hesitation]", '<break time="250ms"/>')
        ssml_text = re.sub(r'\[(?:rire|rire leger|murmure)\]', '<break time="350ms"/>', ssml_text)
        # Sentence breaks after periods
        ssml_text = re.sub(
            r'\.(\s+)([A-ZÀ-Ü])',
            r'. <break time="200ms"/>\2',
            ssml_text
        )
        # Pause after questions
        ssml_text = re.sub(r'\?(\s*)', r'? <break time="300ms"/>', ssml_text)
        return f'<speak>{ssml_text}</speak>'

    async def generate_audio(self, text: str, voice: str = "presentateur",
                             rate: str = "+0%", pitch: str = "+0Hz") -> Optional[bytes]:
        if not text or len(text.strip()) < 10:
            return None
        voice_name = self._resolve_voice(voice)
        h = _hash(text, voice_name, "google")
        cached = _get_cache(h)
        if cached:
            return cached
        try:
            import aiohttp
            import base64

            ssml = self._build_ssml(text)
            url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.api_key}"
            payload = {
                "input": {"ssml": ssml},
                "voice": {
                    "languageCode": "fr-FR",
                    "name": voice_name,
                },
                "audioConfig": {
                    "audioEncoding": "MP3",
                    "sampleRateHertz": 24000,
                    "speakingRate": 1.0,
                    "pitch": 0.0,
                },
            }
            headers = {"Content-Type": "application/json"}
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error(f"Google TTS HTTP {resp.status}: {body[:300]}")
                        return None
                    result = await resp.json()

            audio_b64 = result.get("audioContent", "")
            if not audio_b64:
                return None
            data = base64.b64decode(audio_b64)
            _set_cache(h, data)
            logger.info(f"Google TTS: {len(text)} chars -> {len(data)//1024}KB (voice={voice_name})")
            return data
        except ImportError:
            logger.error("aiohttp not installed — required for Google TTS")
            return None
        except Exception as e:
            logger.error(f"Google TTS failed: {e}")
            return None

    async def generate_synthesis_audio(self, synthesis: Dict[str, Any],
                                       voice_gender: str = "female", language: str = "fr-FR") -> Optional[bytes]:
        script = _build_synthesis_script(synthesis)
        if not script:
            return None
        voice = "presentateur" if voice_gender == "female" else "expert"
        return await self.generate_audio(text=script, voice=voice)

    def get_audio_url(self, synthesis_id: str) -> str:
        return f"/api/syntheses/by-id/{synthesis_id}/audio"


# ---------------------------------------------------------------------------
# Azure AI Speech (SSML, newscast styles, prosody control)
# ---------------------------------------------------------------------------
class AzureTTSService:
    """Azure AI Speech with SSML for natural broadcast-quality audio."""

    VOICE_MAP = {}

    # Speaking style config per panelist role — vary intonation, not speed
    STYLE_MAP = {
        "presentateur": {"style": "newscast-casual", "degree": "1.5", "rate": "+0%", "pitch": "+0%"},
        "expert": {"style": "newscast-casual", "degree": "1.4", "rate": "+0%", "pitch": "-3%"},
        "journaliste": {"style": "newscast-casual", "degree": "1.6", "rate": "+0%", "pitch": "+2%"},
        "contradicteur": {"style": "newscast-casual", "degree": "1.5", "rate": "+0%", "pitch": "-1%"},
    }

    def __init__(self):
        from app.core.config import settings
        self.key = settings.AZURE_SPEECH_KEY
        self.region = settings.AZURE_SPEECH_REGION
        self.VOICE_MAP = {
            "presentateur": settings.AZURE_SPEECH_VOICE_PRESENTATEUR,
            "expert": settings.AZURE_SPEECH_VOICE_EXPERT,
            "journaliste": settings.AZURE_SPEECH_VOICE_JOURNALISTE,
            "contradicteur": settings.AZURE_SPEECH_VOICE_CONTRADICTEUR,
            # Legacy Edge TTS voice name mappings
            "fr-FR-DeniseNeural": settings.AZURE_SPEECH_VOICE_PRESENTATEUR,
            "fr-FR-HenriNeural": settings.AZURE_SPEECH_VOICE_EXPERT,
            "fr-FR-EloiseNeural": settings.AZURE_SPEECH_VOICE_JOURNALISTE,
            "fr-FR-AlainNeural": settings.AZURE_SPEECH_VOICE_CONTRADICTEUR,
        }
        CACHE_DIR.mkdir(exist_ok=True)
        logger.info(f"Azure TTS initialized (region={self.region})")

    def is_available(self) -> bool:
        return bool(self.key)

    def _resolve_voice(self, voice: str) -> str:
        return self.VOICE_MAP.get(voice, "fr-FR-VivienneMultilingualNeural")

    def _build_ssml(self, text: str, voice: str, speaker_key: str) -> str:
        """Build SSML with expressive speaking style and dynamic prosody."""
        voice_name = self._resolve_voice(voice)
        cfg = self.STYLE_MAP.get(speaker_key, self.STYLE_MAP["presentateur"])

        # Convert audio tags to SSML equivalents
        ssml_text = text
        ssml_text = ssml_text.replace("[pause]", '<break time="600ms"/>')
        ssml_text = ssml_text.replace("[soupir]", '<break time="400ms"/>')
        ssml_text = ssml_text.replace("[hm]", '<break time="250ms"/>')
        ssml_text = ssml_text.replace("[hesitation]", '<break time="250ms"/>')
        ssml_text = re.sub(r'\[(?:rire|rire leger|murmure)\]', '<break time="350ms"/>', ssml_text)

        # Add natural sentence breaks — insert short pauses after periods
        # but not inside abbreviations or numbers
        ssml_text = re.sub(
            r'\.(\s+)([A-ZÀ-Ü])',
            r'. <break time="250ms"/>\2',
            ssml_text
        )
        # Longer pause after question marks (anticipation)
        ssml_text = re.sub(
            r'\?(\s*)',
            r'? <break time="350ms"/>',
            ssml_text
        )

        return f"""<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
    xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="fr-FR">
  <voice name="{voice_name}">
    <mstts:express-as style="{cfg['style']}" styledegree="{cfg['degree']}">
      <prosody rate="{cfg['rate']}" pitch="{cfg['pitch']}">
        {ssml_text}
      </prosody>
    </mstts:express-as>
  </voice>
</speak>"""

    async def generate_audio(self, text: str, voice: str = "presentateur",
                             rate: str = "+0%", pitch: str = "+0Hz") -> Optional[bytes]:
        if not text or len(text.strip()) < 10:
            return None
        voice_name = self._resolve_voice(voice)
        h = _hash(text, voice_name, "azure")
        cached = _get_cache(h)
        if cached:
            return cached
        try:
            import aiohttp
            ssml = self._build_ssml(text, voice, voice)
            url = f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1"
            headers = {
                "Ocp-Apim-Subscription-Key": self.key,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
            }
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=ssml.encode("utf-8"), headers=headers) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error(f"Azure TTS HTTP {resp.status}: {body[:200]}")
                        return None
                    data = await resp.read()
            if not data:
                return None
            _set_cache(h, data)
            logger.info(f"Azure TTS: {len(text)} chars -> {len(data)//1024}KB (voice={voice_name})")
            return data
        except ImportError:
            logger.error("aiohttp not installed — required for Azure TTS")
            return None
        except Exception as e:
            logger.error(f"Azure TTS failed: {e}")
            return None

    async def generate_synthesis_audio(self, synthesis: Dict[str, Any],
                                       voice_gender: str = "female", language: str = "fr-FR") -> Optional[bytes]:
        script = _build_synthesis_script(synthesis)
        if not script:
            return None
        voice = "presentateur" if voice_gender == "female" else "expert"
        return await self.generate_audio(text=script, voice=voice)

    def get_audio_url(self, synthesis_id: str) -> str:
        return f"/api/syntheses/by-id/{synthesis_id}/audio"


# ---------------------------------------------------------------------------
# ElevenLabs (premium, expensive)
# ---------------------------------------------------------------------------
class ElevenLabsTTSService:
    """Premium TTS via ElevenLabs API."""

    CACHE_DIR = Path("audio_cache")

    def __init__(self):
        from app.core.config import settings
        self.api_key = settings.ELEVENLABS_API_KEY
        self.model = settings.ELEVENLABS_MODEL
        self.voice_map = {
            "fr-FR-DeniseNeural": settings.ELEVENLABS_VOICE_PRESENTATEUR,
            "fr-FR-HenriNeural": settings.ELEVENLABS_VOICE_EXPERT,
            "fr-FR-EloiseNeural": settings.ELEVENLABS_VOICE_JOURNALISTE,
            "fr-FR-AlainNeural": settings.ELEVENLABS_VOICE_CONTRADICTEUR,
            "presentateur": settings.ELEVENLABS_VOICE_PRESENTATEUR,
            "expert": settings.ELEVENLABS_VOICE_EXPERT,
            "journaliste": settings.ELEVENLABS_VOICE_JOURNALISTE,
            "contradicteur": settings.ELEVENLABS_VOICE_CONTRADICTEUR,
        }
        CACHE_DIR.mkdir(exist_ok=True)
        configured = sum(1 for v in [
            settings.ELEVENLABS_VOICE_PRESENTATEUR, settings.ELEVENLABS_VOICE_EXPERT,
            settings.ELEVENLABS_VOICE_JOURNALISTE, settings.ELEVENLABS_VOICE_CONTRADICTEUR,
        ] if v)
        logger.info(f"ElevenLabs TTS initialized ({configured}/4 voices configured)")

    def is_available(self) -> bool:
        return bool(self.api_key)

    def _resolve_voice(self, voice: str) -> Optional[str]:
        voice_id = self.voice_map.get(voice, "")
        if voice_id:
            return voice_id
        if len(voice) >= 20 and voice.isalnum():
            return voice
        return None

    async def generate_audio(self, text: str, voice: str = "presentateur",
                             rate: str = "+0%", pitch: str = "+0Hz") -> Optional[bytes]:
        if not text or len(text.strip()) < 10:
            return None
        text = _strip_audio_tags(text)
        voice_id = self._resolve_voice(voice)
        if not voice_id:
            return None
        h = _hash(text, voice_id, f"11labs:{self.model}")
        cached = _get_cache(h)
        if cached:
            return cached
        try:
            from elevenlabs.types import VoiceSettings
            client = AsyncElevenLabs(api_key=self.api_key)
            audio_iter = client.text_to_speech.convert(
                voice_id=voice_id, text=text, model_id=self.model,
                output_format="mp3_44100_128",
                voice_settings=VoiceSettings(
                    stability=0.35, similarity_boost=0.75,
                    style=0.4, use_speaker_boost=True,
                ),
            )
            chunks = []
            async for chunk in audio_iter:
                chunks.append(chunk)
            if not chunks:
                return None
            data = b"".join(chunks)
            _set_cache(h, data)
            logger.info(f"ElevenLabs TTS: {len(text)} chars -> {len(data)//1024}KB (voice={voice_id[:8]}...)")
            return data
        except Exception as e:
            logger.error(f"ElevenLabs TTS failed: {e}")
            return None

    async def generate_synthesis_audio(self, synthesis: Dict[str, Any],
                                       voice_gender: str = "female", language: str = "fr-FR") -> Optional[bytes]:
        script = _build_synthesis_script(synthesis)
        if not script:
            return None
        voice = "presentateur" if voice_gender == "female" else "expert"
        return await self.generate_audio(text=script, voice=voice)

    def get_audio_url(self, synthesis_id: str) -> str:
        return f"/api/syntheses/by-id/{synthesis_id}/audio"


# ---------------------------------------------------------------------------
# Chatterbox Multilingual via RunPod Serverless (voice cloning + emotion)
# ---------------------------------------------------------------------------
class ChatterboxTTSService:
    """Chatterbox Multilingual TTS via RunPod Serverless endpoint.
    Zero-shot voice cloning, 23 languages, emotion control.

    Requires:
      - RUNPOD_API_KEY: RunPod API key
      - RUNPOD_CHATTERBOX_ENDPOINT_ID: Serverless endpoint ID
      - Voice reference files in backend/voices/ (5s WAV/MP3 per speaker)
    """

    VOICE_MAP = {}

    def __init__(self):
        from app.core.config import settings
        self.api_key = settings.RUNPOD_API_KEY
        self.endpoint_id = settings.RUNPOD_CHATTERBOX_ENDPOINT_ID
        self.timeout = getattr(settings, "RUNPOD_CHATTERBOX_TIMEOUT", 120)
        # Map panelist roles to voice reference file paths
        voices_dir = Path(__file__).parent.parent.parent / "voices"
        self.VOICE_MAP = {
            "presentateur": voices_dir / "presentateur.wav",
            "expert": voices_dir / "expert.wav",
            "journaliste": voices_dir / "journaliste.wav",
            "contradicteur": voices_dir / "contradicteur.wav",
            # Legacy Edge TTS voice name mappings
            "fr-FR-DeniseNeural": voices_dir / "presentateur.wav",
            "fr-FR-HenriNeural": voices_dir / "expert.wav",
            "fr-FR-EloiseNeural": voices_dir / "journaliste.wav",
            "fr-FR-AlainNeural": voices_dir / "contradicteur.wav",
        }
        # Emotion presets per panelist role
        self.EMOTION_MAP = {
            "presentateur": {"exaggeration": 0.5, "cfg_weight": 0.5},
            "expert": {"exaggeration": 0.3, "cfg_weight": 0.6},
            "journaliste": {"exaggeration": 0.6, "cfg_weight": 0.4},
            "contradicteur": {"exaggeration": 0.7, "cfg_weight": 0.4},
        }
        # Voice pool slots for dynamic experts
        self.VOICE_MAP["host"] = voices_dir / "presentateur.wav"
        self.VOICE_MAP["voice_m1"] = voices_dir / "expert.wav"
        self.VOICE_MAP["voice_f1"] = voices_dir / "journaliste.wav"
        self.VOICE_MAP["voice_m2"] = voices_dir / "contradicteur.wav"
        # Extended pool from LibriVox candidates
        for slot_id in ("voice_m3", "voice_m4", "voice_m5", "voice_m6", "voice_m7",
                         "voice_f2", "voice_f3", "voice_f4", "voice_f5", "voice_f6"):
            path = voices_dir / "pool" / f"{slot_id}.wav"
            if path.exists():
                self.VOICE_MAP[slot_id] = path
        # Add persona voice mappings (fallback to presentateur/expert based on gender)
        self._load_persona_voices(voices_dir)
        CACHE_DIR.mkdir(exist_ok=True)
        logger.info(f"Chatterbox RunPod TTS initialized (endpoint={self.endpoint_id})")

    def _load_persona_voices(self, voices_dir: Path) -> None:
        """Map all personas to voice reference files."""
        try:
            from app.ml.persona import PERSONAS
            for persona in PERSONAS.values():
                if persona.id not in self.VOICE_MAP:
                    # Check for persona-specific voice file
                    persona_voice = voices_dir / f"{persona.id}.wav"
                    if persona_voice.exists():
                        self.VOICE_MAP[persona.id] = persona_voice
                    else:
                        # Fallback by gender
                        fallback = "presentateur" if persona.voice_gender == "female" else "expert"
                        self.VOICE_MAP[persona.id] = self.VOICE_MAP.get(fallback, voices_dir / f"{fallback}.wav")
                    # Emotion preset by debate style
                    if persona.id not in self.EMOTION_MAP:
                        style_emotion = {
                            "provocateur": {"exaggeration": 0.7, "cfg_weight": 0.4},
                            "narratif": {"exaggeration": 0.5, "cfg_weight": 0.5},
                            "analytique": {"exaggeration": 0.3, "cfg_weight": 0.6},
                            "pedagogique": {"exaggeration": 0.4, "cfg_weight": 0.5},
                            "balanced": {"exaggeration": 0.5, "cfg_weight": 0.5},
                        }
                        self.EMOTION_MAP[persona.id] = style_emotion.get(
                            persona.debate_style, {"exaggeration": 0.5, "cfg_weight": 0.5}
                        )
        except Exception as e:
            logger.debug(f"Could not load persona voices for Chatterbox: {e}")

    def is_available(self) -> bool:
        return bool(self.api_key and self.endpoint_id)

    def _get_voice_b64(self, voice: str) -> Optional[str]:
        """Load voice reference file and return as base64."""
        import base64 as b64mod
        voice_path = self.VOICE_MAP.get(voice)
        if voice_path and Path(voice_path).exists():
            return b64mod.b64encode(Path(voice_path).read_bytes()).decode("ascii")
        # Try presentateur as fallback
        fallback = self.VOICE_MAP.get("presentateur")
        if fallback and Path(fallback).exists():
            return b64mod.b64encode(Path(fallback).read_bytes()).decode("ascii")
        return None

    async def generate_audio(self, text: str, voice: str = "presentateur",
                             rate: str = "+0%", pitch: str = "+0Hz") -> Optional[bytes]:
        if not text or len(text.strip()) < 10:
            return None
        text = _strip_audio_tags(text)
        h = _hash(text, voice, "chatterbox")
        cached = _get_cache(h)
        if cached:
            return cached

        try:
            import aiohttp
            import base64 as b64mod

            audio_ref_b64 = self._get_voice_b64(voice)
            emotion = self.EMOTION_MAP.get(voice, self.EMOTION_MAP["presentateur"])

            url = f"https://api.runpod.ai/v2/{self.endpoint_id}/runsync"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "input": {
                    "text": text,
                    "language": "fr",
                    "format": "mp3",
                    "exaggeration": emotion["exaggeration"],
                    "cfg_weight": emotion["cfg_weight"],
                }
            }
            if audio_ref_b64:
                payload["input"]["audio_ref_base64"] = audio_ref_b64

            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers,
                                       timeout=aiohttp.ClientTimeout(total=self.timeout)) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error(f"Chatterbox RunPod HTTP {resp.status}: {body[:300]}")
                        return None
                    result = await resp.json()

            output = result.get("output", {})
            if isinstance(output, dict) and "error" in output:
                logger.error(f"Chatterbox RunPod error: {output['error']}")
                return None

            audio_b64 = output.get("audio_base64", "")
            if not audio_b64:
                logger.error("Chatterbox RunPod: empty audio response")
                return None

            data = b64mod.b64decode(audio_b64)
            _set_cache(h, data)
            duration = output.get("duration_seconds", 0)
            logger.info(f"Chatterbox: {len(text)} chars -> {len(data)//1024}KB "
                        f"({duration}s, voice={voice})")
            return data

        except ImportError:
            logger.error("aiohttp not installed — required for Chatterbox RunPod")
            return None
        except Exception as e:
            logger.error(f"Chatterbox RunPod failed: {e}")
            return None

    async def generate_synthesis_audio(self, synthesis: Dict[str, Any],
                                       voice_gender: str = "female", language: str = "fr-FR") -> Optional[bytes]:
        script = _build_synthesis_script(synthesis)
        if not script:
            return None
        voice = "presentateur" if voice_gender == "female" else "expert"
        return await self.generate_audio(text=script, voice=voice)

    def get_audio_url(self, synthesis_id: str) -> str:
        return f"/api/syntheses/by-id/{synthesis_id}/audio"


# ---------------------------------------------------------------------------
# XTTS v2 via RunPod Serverless (legacy — voice cloning)
# ---------------------------------------------------------------------------
class XttsTTSService:
    """XTTS v2 voice cloning via RunPod Serverless endpoint.

    Supports both URL-based and local file-based voice references.
    Local files are sent as base64 via speaker_wav_b64.

    Requires:
      - RUNPOD_API_KEY: RunPod API key
      - RUNPOD_XTTS_ENDPOINT_ID: Serverless endpoint ID
      - XTTS_VOICE_*: URLs to speaker reference WAV files (or local paths)
    """

    VOICE_MAP = {}  # str -> URL or Path

    def __init__(self):
        from app.core.config import settings
        self.api_key = settings.RUNPOD_API_KEY
        self.endpoint_id = settings.RUNPOD_XTTS_ENDPOINT_ID
        self.timeout = settings.RUNPOD_XTTS_TIMEOUT
        voices_dir = Path(__file__).parent.parent.parent / "voices"
        self.VOICE_MAP = {
            # Host / presentateur
            "host": voices_dir / "host.mp3",
            "presentateur": voices_dir / "host.mp3",
            "neutral": voices_dir / "host.mp3",
            # Legacy Edge TTS voice name mappings
            "fr-FR-DeniseNeural": voices_dir / "host.mp3",
            "fr-FR-HenriNeural": voices_dir / "voice_m1.mp3",
        }
        # Voice pool slots for dynamic experts
        for slot_id in ("voice_m1", "voice_m2", "voice_m3", "voice_m4", "voice_m5",
                         "voice_f1", "voice_f2", "voice_f3", "voice_f4"):
            path = voices_dir / f"{slot_id}.mp3"
            if path.exists():
                self.VOICE_MAP[slot_id] = path
        # Dynamic persona voice URLs from settings
        self._load_persona_voices(settings)
        CACHE_DIR.mkdir(exist_ok=True)
        logger.info(f"XTTS RunPod TTS initialized (endpoint={self.endpoint_id})")

    def _load_persona_voices(self, settings) -> None:
        """Load persona voice reference URLs from settings or persona config."""
        try:
            from app.ml.persona import PERSONAS
            for persona in PERSONAS.values():
                if persona.id not in self.VOICE_MAP and persona.voice_ref_file:
                    # Check if there's a settings-based URL override
                    env_key = f"XTTS_VOICE_{persona.id.upper()}_URL"
                    url = getattr(settings, env_key, "")
                    if url:
                        self.VOICE_MAP[persona.id] = url
                    else:
                        # Use presentateur URL as fallback for all personas
                        self.VOICE_MAP[persona.id] = settings.XTTS_VOICE_PRESENTATEUR_URL
        except Exception as e:
            logger.debug(f"Could not load persona voices: {e}")

    def is_available(self) -> bool:
        return bool(self.api_key and self.endpoint_id)

    def _resolve_voice(self, voice: str):
        """Resolve voice to URL string or local Path."""
        return self.VOICE_MAP.get(voice)

    async def generate_audio(self, text: str, voice: str = "presentateur",
                             rate: str = "+0%", pitch: str = "+0Hz") -> Optional[bytes]:
        if not text or len(text.strip()) < 10:
            return None
        text = _strip_audio_tags(text)
        voice_ref = self._resolve_voice(voice)
        if not voice_ref:
            logger.warning(f"XTTS: No voice configured for '{voice}'")
            return None

        # Speaker ID for RunPod-side caching
        speaker_id = voice
        h = _hash(text, speaker_id, "xtts")
        cached = _get_cache(h)
        if cached:
            return cached

        try:
            import aiohttp
            import base64 as b64mod

            url = f"https://api.runpod.ai/v2/{self.endpoint_id}/runsync"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "input": {
                    "text": text,
                    "speaker_id": speaker_id,
                    "language": "fr",
                    "speed": 1.1,
                }
            }

            # Local file -> send as base64, URL string -> send as URL
            if isinstance(voice_ref, Path) or (isinstance(voice_ref, str) and not voice_ref.startswith("http")):
                voice_path = Path(voice_ref)
                if voice_path.exists():
                    payload["input"]["speaker_wav_b64"] = b64mod.b64encode(
                        voice_path.read_bytes()
                    ).decode("ascii")
                else:
                    logger.warning(f"XTTS: Voice file not found: {voice_path}")
                    return None
            else:
                payload["input"]["speaker_wav_url"] = str(voice_ref)

            async with aiohttp.ClientSession() as session:
                # Try runsync first (fast path, <90s jobs)
                async with session.post(url, json=payload, headers=headers,
                                       timeout=aiohttp.ClientTimeout(total=self.timeout)) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error(f"XTTS RunPod HTTP {resp.status}: {body[:300]}")
                        return None
                    result = await resp.json()

                # Check if runsync completed or timed out (returns IN_QUEUE/IN_PROGRESS)
                status = result.get("status", "")
                if status in ("IN_QUEUE", "IN_PROGRESS"):
                    # runsync timed out — poll for result
                    job_id = result.get("id", "")
                    if job_id:
                        logger.info(f"XTTS: runsync timeout, polling job {job_id}...")
                        result = await self._poll_job(session, job_id, headers)
                        if not result:
                            return None

            # RunPod returns: {"output": {"audio_b64": "...", "duration_ms": ..., ...}}
            output = result.get("output", {})
            if isinstance(output, dict) and "error" in output:
                logger.error(f"XTTS RunPod error: {output['error']}")
                return None

            audio_b64 = output.get("audio_b64", "")
            if not audio_b64:
                logger.error(f"XTTS RunPod: empty audio response (status={result.get('status', '?')})")
                return None

            import base64
            data = base64.b64decode(audio_b64)
            _set_cache(h, data)
            duration_ms = output.get("duration_ms", 0)
            logger.info(f"XTTS: {len(text)} chars -> {len(data)//1024}KB "
                        f"({duration_ms}ms, voice={speaker_id})")
            return data

        except ImportError:
            logger.error("aiohttp not installed — required for XTTS RunPod")
            return None
        except Exception as e:
            logger.error(f"XTTS RunPod failed: {e}")
            return None

    async def _poll_job(self, session, job_id: str, headers: dict,
                        max_wait: int = 180, interval: int = 5) -> Optional[dict]:
        """Poll a RunPod async job until completion."""
        import asyncio as _asyncio
        import aiohttp
        status_url = f"https://api.runpod.ai/v2/{self.endpoint_id}/status/{job_id}"
        elapsed = 0
        while elapsed < max_wait:
            await _asyncio.sleep(interval)
            elapsed += interval
            try:
                async with session.get(status_url, headers=headers,
                                       timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status != 200:
                        continue
                    result = await resp.json()
                    status = result.get("status", "")
                    if status == "COMPLETED":
                        logger.info(f"XTTS: job {job_id} completed after {elapsed}s")
                        return result
                    elif status == "FAILED":
                        logger.error(f"XTTS: job {job_id} failed: {result.get('error', '?')[:200]}")
                        return None
            except Exception:
                continue
        logger.error(f"XTTS: job {job_id} timed out after {max_wait}s")
        return None

    async def generate_synthesis_audio(self, synthesis: Dict[str, Any],
                                       voice_gender: str = "female", language: str = "fr-FR") -> Optional[bytes]:
        script = _build_synthesis_script(synthesis)
        if not script:
            return None
        voice = "presentateur" if voice_gender == "female" else "expert"
        return await self.generate_audio(text=script, voice=voice)

    def get_audio_url(self, synthesis_id: str) -> str:
        return f"/api/syntheses/by-id/{synthesis_id}/audio"


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
def _build_synthesis_script(synthesis: Dict[str, Any]) -> Optional[str]:
    parts = []
    title = synthesis.get("title", "")
    summary = synthesis.get("summary", synthesis.get("introduction", ""))
    key_points = synthesis.get("keyPoints", synthesis.get("key_points", []))
    if title:
        parts.append(title + ".")
    if summary:
        parts.append(summary[:500])
    if key_points and isinstance(key_points, list):
        parts.append("Points cles:")
        for i, p in enumerate(key_points[:5], 1):
            if isinstance(p, str):
                parts.append(f"{i}. {p}")
    return " ".join(parts) if parts else None


# ---------------------------------------------------------------------------
# Provider selection
# ---------------------------------------------------------------------------
_tts_service = None


def get_tts_service():
    """Get or create the global TTS service.
    Priority controlled by TTS_PROVIDER env var, or auto-detect.
    """
    global _tts_service
    if _tts_service is not None:
        return _tts_service

    from app.core.config import settings
    provider = settings.TTS_PROVIDER.lower().strip()

    if provider == "chatterbox" and settings.RUNPOD_API_KEY and settings.RUNPOD_CHATTERBOX_ENDPOINT_ID:
        _tts_service = ChatterboxTTSService()
        logger.info("Using Chatterbox Multilingual via RunPod")
    elif provider == "xtts" and settings.RUNPOD_API_KEY and settings.RUNPOD_XTTS_ENDPOINT_ID:
        _tts_service = XttsTTSService()
        logger.info("Using XTTS v2 via RunPod (legacy)")
    elif provider == "google" and settings.GOOGLE_TTS_API_KEY:
        _tts_service = GoogleTTSService()
        logger.info("Using Google Cloud TTS")
    elif provider == "openai" and settings.OPENAI_TTS_API_KEY:
        _tts_service = OpenAITTSService()
        logger.info("Using OpenAI TTS")
    elif provider == "azure" and settings.AZURE_SPEECH_KEY:
        _tts_service = AzureTTSService()
        logger.info("Using Azure AI Speech TTS")
    elif provider == "elevenlabs" and settings.ELEVENLABS_API_KEY and ELEVENLABS_AVAILABLE:
        _tts_service = ElevenLabsTTSService()
        logger.info("Using ElevenLabs TTS")
    elif provider == "edge" and EDGE_TTS_AVAILABLE:
        _tts_service = TTSService()
        logger.info("Using Edge TTS")
    elif not provider:
        # Auto-detect: first configured wins
        if settings.RUNPOD_API_KEY and getattr(settings, 'RUNPOD_CHATTERBOX_ENDPOINT_ID', ''):
            _tts_service = ChatterboxTTSService()
            logger.info("Auto-selected: Chatterbox Multilingual via RunPod")
        elif settings.RUNPOD_API_KEY and settings.RUNPOD_XTTS_ENDPOINT_ID:
            _tts_service = XttsTTSService()
            logger.info("Auto-selected: XTTS v2 via RunPod (legacy)")
        elif settings.GOOGLE_TTS_API_KEY:
            _tts_service = GoogleTTSService()
            logger.info("Auto-selected: Google Cloud TTS")
        elif settings.OPENAI_TTS_API_KEY:
            _tts_service = OpenAITTSService()
            logger.info("Auto-selected: OpenAI TTS")
        elif settings.AZURE_SPEECH_KEY:
            _tts_service = AzureTTSService()
            logger.info("Auto-selected: Azure AI Speech TTS")
        elif settings.ELEVENLABS_API_KEY and ELEVENLABS_AVAILABLE:
            _tts_service = ElevenLabsTTSService()
            logger.info("Auto-selected: ElevenLabs TTS")
        elif EDGE_TTS_AVAILABLE:
            _tts_service = TTSService()
            logger.info("Auto-selected: Edge TTS")
        else:
            _tts_service = TTSService()
            logger.warning("No TTS provider available")
    else:
        _tts_service = TTSService()
        logger.warning(f"TTS provider '{provider}' not available, falling back to Edge TTS")

    return _tts_service


def reset_tts_service():
    """Reset the global TTS service (for testing different providers)."""
    global _tts_service
    _tts_service = None


async def generate_synthesis_audio(synthesis: Dict[str, Any]) -> Optional[bytes]:
    """Convenience function to generate audio for a synthesis"""
    service = get_tts_service()
    return await service.generate_synthesis_audio(synthesis)
