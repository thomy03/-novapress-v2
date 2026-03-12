"""
Fish Speech S1-mini RunPod Serverless Handler.
High-quality multilingual TTS with native emotion tags and zero-shot voice cloning.
Apache 2.0 licensed, 0.5B parameters.
"""
import base64
import io
import os
import tempfile
from pathlib import Path

import torch
import runpod

_model = None
_speaker_cache = {}
VOICES_DIR = Path("/tmp/fish_voices")
VOICES_DIR.mkdir(exist_ok=True)

# Emotion tag mapping: script emotions -> Fish Speech native tags
EMOTION_TAGS = {
    "neutral": "",
    "assertive": "[serious]",
    "angry": "[angry]",
    "frustrated": "[annoyed]",
    "amused": "[happy]",
    "emphatic": "[emphatic]",
    "ironic": "[sarcastic]",
    "thoughtful": "[contemplative]",
    "happy": "[happy]",
    "sad": "[sad]",
    "excited": "[excited]",
    "calm": "[calm]",
}


def load_model():
    """Load Fish Speech S1-mini model."""
    global _model
    if _model is not None:
        return _model

    from fish_speech.inference import TTSInference

    _model = TTSInference(
        model_name="fishaudio/fish-speech-1.5",
        device="cuda" if torch.cuda.is_available() else "cpu",
    )
    print("Fish Speech S1-mini loaded on GPU")
    return _model


def _get_speaker_path(speaker_id: str, speaker_wav_b64: str = "") -> str:
    """Get or create speaker reference WAV path."""
    if speaker_id in _speaker_cache and Path(_speaker_cache[speaker_id]).exists():
        return _speaker_cache[speaker_id]

    if not speaker_wav_b64:
        return ""

    wav_path = str(VOICES_DIR / f"{speaker_id}.wav")

    # Convert input audio to WAV (input may be MP3 or other format)
    try:
        from pydub import AudioSegment
        raw_bytes = base64.b64decode(speaker_wav_b64)
        seg = AudioSegment.from_file(io.BytesIO(raw_bytes))
        seg = seg.set_frame_rate(24000).set_channels(1).set_sample_width(2)
        seg.export(wav_path, format="wav")
    except Exception:
        # Fallback: write raw bytes
        with open(wav_path, "wb") as f:
            f.write(base64.b64decode(speaker_wav_b64))

    _speaker_cache[speaker_id] = wav_path
    return wav_path


def handler(event):
    inp = event.get("input", {})
    text = inp.get("text", "")
    speaker_id = inp.get("speaker_id", "default")
    speaker_wav_b64 = inp.get("speaker_wav_b64", "")
    language = inp.get("language", "fr")
    speed = inp.get("speed", 1.0)
    emotion = inp.get("emotion_tag", "neutral")

    if not text:
        return {"error": "No text provided"}

    # Preprocess French text
    try:
        from app.services.french_text_preprocessor import preprocess_french
        text = preprocess_french(text)
    except ImportError:
        pass

    # Add emotion tag if applicable
    emotion_prefix = EMOTION_TAGS.get(emotion, "")
    if emotion_prefix:
        text = f"{emotion_prefix} {text}"

    # Get speaker reference
    speaker_path = _get_speaker_path(speaker_id, speaker_wav_b64)

    model = load_model()

    try:
        # Generate audio
        kwargs = {
            "text": text,
            "language": language,
            "speed": speed,
        }
        if speaker_path:
            kwargs["reference_audio"] = speaker_path

        audio_data = model.generate(**kwargs)

        # Export as WAV (avoid double compression)
        wav_buf = io.BytesIO()
        import soundfile as sf
        sf.write(wav_buf, audio_data, 24000, format="WAV", subtype="PCM_16")
        wav_bytes = wav_buf.getvalue()

        return {
            "audio_b64": base64.b64encode(wav_bytes).decode("ascii"),
            "duration_ms": int(len(audio_data) / 24000 * 1000),
            "speaker_id": speaker_id,
            "chars": len(text),
            "format": "wav",
        }

    except Exception as e:
        return {"error": f"Fish Speech inference failed: {str(e)[:200]}"}


print("Loading Fish Speech S1-mini...")
load_model()
print("Ready!")
runpod.serverless.start({"handler": handler})
