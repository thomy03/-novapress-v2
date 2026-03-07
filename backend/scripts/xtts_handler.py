"""XTTS v2 RunPod Serverless Handler.
Deployed as a RunPod serverless endpoint for voice cloning TTS.
Splits long text into sentences to avoid XTTS chunk-boundary artifacts.
"""
import base64
import io
import os
import re
import tempfile
import urllib.request
from pathlib import Path

import TTS.utils.manage as m
m.ModelManager.ask_tos = lambda self, *a, **k: True

import runpod

_tts_model = None
_speaker_cache = {}
VOICES_DIR = Path("/tmp/xtts_voices")
VOICES_DIR.mkdir(exist_ok=True)

# Split on sentence-ending punctuation, keeping the punctuation attached
_SENTENCE_RE = re.compile(r'(?<=[.!?])\s+')


def load_model():
    global _tts_model
    if _tts_model is not None:
        return _tts_model
    from TTS.api import TTS
    _tts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
    _tts_model.to("cuda")
    print("XTTS v2 model loaded on GPU")
    return _tts_model


def download_speaker_wav(speaker_id, url):
    if speaker_id in _speaker_cache and Path(_speaker_cache[speaker_id]).exists():
        return _speaker_cache[speaker_id]
    local_path = str(VOICES_DIR / (speaker_id + ".wav"))
    urllib.request.urlretrieve(url, local_path)
    _speaker_cache[speaker_id] = local_path
    return local_path


def _split_sentences(text):
    """Split text into sentences. Short texts (<200 chars) stay as-is."""
    if len(text) < 200:
        return [text]
    parts = _SENTENCE_RE.split(text)
    return [p.strip() for p in parts if p.strip()]


def handler(event):
    inp = event.get("input", {})
    text = inp.get("text", "")
    speaker_id = inp.get("speaker_id", "default")
    speaker_wav_url = inp.get("speaker_wav_url", "")
    speaker_wav_b64 = inp.get("speaker_wav_b64", "")
    language = inp.get("language", "fr")
    speed = inp.get("speed", 1.0)

    if not text:
        return {"error": "No text provided"}

    if speaker_wav_b64:
        wav_path = str(VOICES_DIR / (speaker_id + ".wav"))
        with open(wav_path, "wb") as f:
            f.write(base64.b64decode(speaker_wav_b64))
        _speaker_cache[speaker_id] = wav_path
    elif speaker_wav_url:
        wav_path = download_speaker_wav(speaker_id, speaker_wav_url)
    elif speaker_id in _speaker_cache:
        wav_path = _speaker_cache[speaker_id]
    else:
        return {"error": "No speaker reference audio"}

    tts = load_model()
    from pydub import AudioSegment

    sentences = _split_sentences(text)
    combined = AudioSegment.empty()

    for sentence in sentences:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        tts.tts_to_file(
            text=sentence, file_path=tmp_path,
            speaker_wav=wav_path, language=language, speed=speed,
        )
        seg = AudioSegment.from_wav(tmp_path)
        os.unlink(tmp_path)
        combined += seg

    mp3_buf = io.BytesIO()
    combined.export(mp3_buf, format="mp3", bitrate="128k")
    mp3_data = mp3_buf.getvalue()
    duration_ms = len(combined)

    return {
        "audio_b64": base64.b64encode(mp3_data).decode("ascii"),
        "duration_ms": duration_ms,
        "speaker_id": speaker_id,
        "chars": len(text),
    }


print("Loading XTTS v2 model...")
load_model()
print("Ready!")
runpod.serverless.start({"handler": handler})
