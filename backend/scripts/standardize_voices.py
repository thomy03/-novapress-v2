"""
Standardize voice reference files for TTS.
Converts all voice files to: WAV 24kHz mono 16-bit PCM, trimmed silence, normalized loudness.
Target: 8-15 seconds of clean speech per reference.
"""
import sys
from pathlib import Path

try:
    from pydub import AudioSegment
    from pydub.silence import detect_leading_silence
except ImportError:
    print("ERROR: pydub required. Install with: pip install pydub")
    sys.exit(1)

VOICES_DIR = Path(__file__).parent.parent / "voices"
OUTPUT_DIR = VOICES_DIR / "standardized"

# Target specs
TARGET_SAMPLE_RATE = 24000
TARGET_CHANNELS = 1
TARGET_SAMPLE_WIDTH = 2  # 16-bit
TARGET_LUFS = -20.0  # Slightly quieter than podcast standard for reference audio
MIN_DURATION_S = 5
MAX_DURATION_S = 30
IDEAL_MIN_S = 8
IDEAL_MAX_S = 15


def trim_silence(audio: AudioSegment, silence_thresh: int = -40) -> AudioSegment:
    """Trim leading and trailing silence."""
    leading = detect_leading_silence(audio, silence_threshold=silence_thresh)
    trailing = detect_leading_silence(audio.reverse(), silence_threshold=silence_thresh)

    if leading + trailing >= len(audio):
        return audio

    return audio[leading:len(audio) - trailing]


def normalize_loudness(audio: AudioSegment, target_dbfs: float = -20.0) -> AudioSegment:
    """Normalize to target dBFS (approximate LUFS for speech)."""
    if audio.dBFS == float('-inf'):
        return audio
    change = target_dbfs - audio.dBFS
    change = max(-20.0, min(20.0, change))
    return audio.apply_gain(change)


def standardize_voice(input_path: Path, output_path: Path) -> dict:
    """Standardize a single voice file. Returns stats dict."""
    stats = {
        "input": input_path.name,
        "input_size_kb": input_path.stat().st_size // 1024,
    }

    try:
        audio = AudioSegment.from_file(str(input_path))
    except Exception as e:
        stats["error"] = f"Failed to load: {e}"
        return stats

    stats["original_duration_s"] = len(audio) / 1000
    stats["original_channels"] = audio.channels
    stats["original_sample_rate"] = audio.frame_rate

    # Convert to target format
    audio = audio.set_frame_rate(TARGET_SAMPLE_RATE)
    audio = audio.set_channels(TARGET_CHANNELS)
    audio = audio.set_sample_width(TARGET_SAMPLE_WIDTH)

    # Trim silence
    audio = trim_silence(audio)
    stats["trimmed_duration_s"] = len(audio) / 1000

    # Truncate to ideal duration if too long
    # Pick the loudest 12s segment (most expressive speech)
    duration_s = len(audio) / 1000
    if duration_s > IDEAL_MAX_S:
        target_ms = int(IDEAL_MAX_S * 1000)  # 15s
        best_start = 0
        best_loudness = float('-inf')
        step_ms = 1000  # Check every 1s offset
        for start in range(0, len(audio) - target_ms, step_ms):
            segment = audio[start:start + target_ms]
            if segment.dBFS > best_loudness:
                best_loudness = segment.dBFS
                best_start = start
        audio = audio[best_start:best_start + target_ms]
        stats["truncated_from_s"] = duration_s
        stats["selected_offset_s"] = best_start / 1000

    # Normalize loudness
    audio = normalize_loudness(audio, TARGET_LUFS)

    # Duration warnings
    duration_s = len(audio) / 1000
    if duration_s < MIN_DURATION_S:
        stats["warning"] = f"Too short ({duration_s:.1f}s < {MIN_DURATION_S}s)"

    # Export
    output_path.parent.mkdir(parents=True, exist_ok=True)
    audio.export(str(output_path), format="wav")
    stats["output_size_kb"] = output_path.stat().st_size // 1024
    stats["output_duration_s"] = len(audio) / 1000
    stats["status"] = "OK"

    return stats


def main():
    print(f"Voice Standardization — {VOICES_DIR}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Target: WAV {TARGET_SAMPLE_RATE}Hz mono 16-bit, {TARGET_LUFS} dBFS")
    print("=" * 70)

    if not VOICES_DIR.exists():
        print(f"ERROR: Voices directory not found: {VOICES_DIR}")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    voice_files = []
    for ext in ("*.mp3", "*.wav", "*.m4a", "*.ogg", "*.flac"):
        voice_files.extend(VOICES_DIR.glob(ext))

    if not voice_files:
        print("No voice files found!")
        sys.exit(1)

    print(f"Found {len(voice_files)} voice files\n")

    results = []
    for vf in sorted(voice_files):
        out_name = vf.stem + ".wav"
        out_path = OUTPUT_DIR / out_name
        print(f"Processing: {vf.name} ({vf.stat().st_size // 1024}KB)...")
        stats = standardize_voice(vf, out_path)
        results.append(stats)

        if "error" in stats:
            print(f"  ERROR: {stats['error']}")
        else:
            print(f"  {stats['original_duration_s']:.1f}s -> {stats['output_duration_s']:.1f}s "
                  f"({stats['input_size_kb']}KB -> {stats['output_size_kb']}KB)")
            if "warning" in stats:
                print(f"  WARNING: {stats['warning']}")
            elif "info" in stats:
                print(f"  INFO: {stats['info']}")

    print("\n" + "=" * 70)
    ok_count = sum(1 for r in results if r.get("status") == "OK")
    warn_count = sum(1 for r in results if "warning" in r)
    err_count = sum(1 for r in results if "error" in r)
    print(f"Done: {ok_count} OK, {warn_count} warnings, {err_count} errors")

    if ok_count > 0:
        print(f"\nStandardized files saved to: {OUTPUT_DIR}")
        print("To use them, copy the WAV files to the voices/ directory.")


if __name__ == "__main__":
    main()
