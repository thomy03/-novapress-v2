"""
Fish Speech OpenAudio S1-mini — RunPod Serverless Handler.
Uses the official Fish Speech inference pipeline (tools.api_server compatible).

Model: fishaudio/openaudio-s1-mini (0.5B params, Apache 2.0)
Requires: GPU with 24GB+ VRAM (RTX 4090, A100, etc.)
"""
import base64
import io
import os
import subprocess
import time
from pathlib import Path

import runpod

_api_ready = False
_speaker_cache = {}
VOICES_DIR = Path("/tmp/fish_voices")
VOICES_DIR.mkdir(exist_ok=True)
CHECKPOINTS_DIR = Path("/app/checkpoints/openaudio-s1-mini")
API_PORT = 8080
API_URL = f"http://127.0.0.1:{API_PORT}"


def start_api_server():
    """Start Fish Speech API server as background process."""
    global _api_ready
    if _api_ready:
        return

    print("Starting Fish Speech API server...")

    # Download model if not present
    if not (CHECKPOINTS_DIR / "codec.pth").exists():
        print("Downloading openaudio-s1-mini from HuggingFace...")
        subprocess.run([
            "huggingface-cli", "download",
            "fishaudio/openaudio-s1-mini",
            "--local-dir", str(CHECKPOINTS_DIR),
        ], check=True, timeout=600)
        print("Model downloaded!")

    # Start API server in background
    cmd = [
        "python", "-m", "tools.api_server",
        "--listen", f"0.0.0.0:{API_PORT}",
        "--llama-checkpoint-path", str(CHECKPOINTS_DIR),
        "--decoder-checkpoint-path", str(CHECKPOINTS_DIR / "codec.pth"),
        "--decoder-config-name", "modded_dac_vq",
    ]
    subprocess.Popen(cmd, cwd="/app/fish-speech")
    print(f"API server starting on port {API_PORT}...")

    # Wait for server to be ready
    import urllib.request
    for i in range(120):  # 2 min max
        time.sleep(1)
        try:
            urllib.request.urlopen(f"{API_URL}/docs", timeout=2)
            print(f"API server ready after {i+1}s!")
            _api_ready = True
            return
        except Exception:
            if i % 10 == 9:
                print(f"  Waiting for API server... ({i+1}s)")
    raise RuntimeError("Fish Speech API server failed to start")


def _get_speaker_path(speaker_id: str, speaker_wav_b64: str = "") -> str:
    """Get or create speaker reference WAV path."""
    if speaker_id in _speaker_cache and Path(_speaker_cache[speaker_id]).exists():
        return _speaker_cache[speaker_id]

    if not speaker_wav_b64:
        return ""

    wav_path = str(VOICES_DIR / f"{speaker_id}.wav")
    raw_bytes = base64.b64decode(speaker_wav_b64)

    # Convert to WAV if needed (input may be MP3)
    try:
        from pydub import AudioSegment
        seg = AudioSegment.from_file(io.BytesIO(raw_bytes))
        seg = seg.set_frame_rate(44100).set_channels(1).set_sample_width(2)
        seg.export(wav_path, format="wav")
    except Exception:
        with open(wav_path, "wb") as f:
            f.write(raw_bytes)

    _speaker_cache[speaker_id] = wav_path
    return wav_path


def handler(event):
    import requests

    start_api_server()

    inp = event.get("input", {})
    text = inp.get("text", "")
    speaker_id = inp.get("speaker_id", "default")
    speaker_wav_b64 = inp.get("speaker_wav_b64", "")
    reference_text = inp.get("reference_text", "")
    language = inp.get("language", "fr")
    speed = inp.get("speed", 1.0)
    emotion = inp.get("emotion_tag", "")

    if not text:
        return {"error": "No text provided"}

    # French text preprocessing
    try:
        from french_text_preprocessor import preprocess_french
        text = preprocess_french(text)
    except ImportError:
        pass

    # Get speaker reference
    speaker_path = _get_speaker_path(speaker_id, speaker_wav_b64)

    # Build API request
    payload = {
        "text": text,
    }

    # Add reference audio for voice cloning
    if speaker_path and os.path.exists(speaker_path):
        with open(speaker_path, "rb") as f:
            ref_b64 = base64.b64encode(f.read()).decode("ascii")
        payload["reference_audio"] = ref_b64
        if reference_text:
            payload["reference_text"] = reference_text

    try:
        t0 = time.time()
        resp = requests.post(
            f"{API_URL}/v1/tts",
            json=payload,
            timeout=120,
        )

        if resp.status_code != 200:
            return {"error": f"API returned {resp.status_code}: {resp.text[:200]}"}

        # Response is audio bytes directly
        audio_bytes = resp.content
        elapsed = time.time() - t0

        # Determine format from content-type
        content_type = resp.headers.get("content-type", "audio/wav")
        audio_format = "wav" if "wav" in content_type else "mp3"

        return {
            "audio_b64": base64.b64encode(audio_bytes).decode("ascii"),
            "duration_ms": int(elapsed * 1000),  # Approximate
            "speaker_id": speaker_id,
            "chars": len(text),
            "format": audio_format,
            "inference_time_s": round(elapsed, 2),
        }

    except requests.Timeout:
        return {"error": "Fish Speech inference timed out (120s)"}
    except Exception as e:
        return {"error": f"Fish Speech failed: {str(e)[:200]}"}


# Pre-start: download model during container init (not per-request)
print("Fish Speech handler initializing...")
start_api_server()
print("Ready!")
runpod.serverless.start({"handler": handler})
