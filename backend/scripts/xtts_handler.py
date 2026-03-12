"""XTTS French-Optimized RunPod Serverless Handler.
Uses nellaw/xtts-french-voice-cloning-optimized (fine-tuned for French).
No diacritic stripping needed — this model handles French accents natively.
"""
import base64
import io
import os
import re
import tempfile
import urllib.request
from pathlib import Path

import torch
import runpod
from pydub import AudioSegment

_tts_model = None
_tts_config = None
_speaker_cache = {}
VOICES_DIR = Path("/tmp/xtts_voices")
VOICES_DIR.mkdir(exist_ok=True)
MODEL_DIR = Path("/app/model")

# Split on sentence-ending punctuation, keeping the punctuation attached
_SENTENCE_RE = re.compile(r'(?<=[.!?])\s+')


def load_model():
    global _tts_model, _tts_config
    if _tts_model is not None:
        return _tts_model, _tts_config

    from TTS.tts.configs.xtts_config import XttsConfig
    from TTS.tts.models.xtts import Xtts

    config = XttsConfig()
    config.load_json(str(MODEL_DIR / "config.json"))

    model = Xtts.init_from_config(config)
    model.load_checkpoint(
        config,
        checkpoint_dir=str(MODEL_DIR),
        checkpoint_path=str(MODEL_DIR / "best_model.pth"),
        vocab_path=str(MODEL_DIR / "vocab.json"),
        eval=True,
        use_deepspeed=False,
    )
    model.cuda()

    _tts_model = model
    _tts_config = config
    print("XTTS French-optimized model loaded on GPU")
    return model, config


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

    # Preprocess French text (numbers, abbreviations, punctuation)
    try:
        from app.services.french_text_preprocessor import preprocess_french
        text = preprocess_french(text)
    except ImportError:
        pass  # Preprocessor not available in this environment

    if speaker_wav_b64:
        wav_path = str(VOICES_DIR / (speaker_id + ".wav"))
        # Properly decode and convert to WAV 24kHz mono 16-bit
        # (input may be MP3, M4A, or any format — pydub handles conversion)
        raw_bytes = base64.b64decode(speaker_wav_b64)
        try:
            seg = AudioSegment.from_file(io.BytesIO(raw_bytes))
            seg = seg.set_frame_rate(24000).set_channels(1).set_sample_width(2)
            seg.export(wav_path, format="wav")
        except Exception:
            # Fallback: write raw bytes and hope for the best
            with open(wav_path, "wb") as f:
                f.write(raw_bytes)
        _speaker_cache[speaker_id] = wav_path
    elif speaker_wav_url:
        wav_path = download_speaker_wav(speaker_id, speaker_wav_url)
    elif speaker_id in _speaker_cache:
        wav_path = _speaker_cache[speaker_id]
    else:
        return {"error": "No speaker reference audio"}

    model, config = load_model()
    import scipy.io.wavfile as wavfile
    import numpy as np

    # Compute speaker conditioning from reference audio
    # gpt_cond_len=12 captures more speaker characteristics (XTTS docs recommend 6-30)
    gpt_cond_latent, speaker_embedding = model.get_conditioning_latents(
        audio_path=[wav_path],
        gpt_cond_len=12,
    )

    sentences = _split_sentences(text)
    combined = AudioSegment.empty()

    for sentence in sentences:
        outputs = model.inference(
            text=sentence,
            language=language,
            gpt_cond_latent=gpt_cond_latent,
            speaker_embedding=speaker_embedding,
            temperature=0.75,
            speed=speed,
            enable_text_splitting=True,
        )

        # Write wav to temp file
        wav_data = outputs["wav"]
        if isinstance(wav_data, torch.Tensor):
            wav_data = wav_data.cpu().numpy()
        wav_data = (wav_data * 32767).astype(np.int16)

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        wavfile.write(tmp_path, 24000, wav_data)

        seg = AudioSegment.from_wav(tmp_path)
        os.unlink(tmp_path)
        combined += seg

    # Export as WAV to avoid double compression (handler WAV -> client MP3)
    wav_buf = io.BytesIO()
    combined.export(wav_buf, format="wav")
    wav_data = wav_buf.getvalue()
    duration_ms = len(combined)

    return {
        "audio_b64": base64.b64encode(wav_data).decode("ascii"),
        "duration_ms": duration_ms,
        "speaker_id": speaker_id,
        "chars": len(text),
        "format": "wav",
    }


print("Loading XTTS French-optimized model...")
load_model()
print("Ready!")
runpod.serverless.start({"handler": handler})
