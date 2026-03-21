"""
TTS Benchmark Script for NovaPress.
Tests French text-to-speech across configured providers.
Generates WAV files for A/B comparison and measures latency/size.
"""
import asyncio
import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.tts_service import get_tts_service, reset_tts_service
from app.services.french_text_preprocessor import preprocess_french
from loguru import logger

OUTPUT_DIR = Path("benchmark_output")

# 10 test phrases covering key French TTS challenges
TEST_PHRASES = [
    # 1. Numbers and currency
    "Le PIB français a augmenté de 2,5% pour atteindre 2 500 milliards d'euros en 2025.",
    # 2. Abbreviations and titles
    "M. Dupont, PDG de la BCE, a rencontré Mme Lagarde au siège de l'ONU à New York.",
    # 3. Question with emotion
    "Mais comment peut-on accepter une telle situation ? C'est absolument scandaleux !",
    # 4. Liaisons and nasal vowels
    "Les enfants ont été enchantés par les interventions des anciens combattants.",
    # 5. E muets and flow
    "Le gouvernement a décidé de mettre en place une nouvelle politique de développement durable.",
    # 6. Proper nouns (international)
    "Emmanuel Macron s'est entretenu avec Volodymyr Zelensky et Ursula von der Leyen.",
    # 7. Technical/scientific
    "L'intelligence artificielle générative consomme 3,5 kWh par requête complexe.",
    # 8. Emotional/debate tone
    "Non mais attendez, c'est complètement faux ! Les chiffres montrent exactement le contraire.",
    # 9. Long journalistic sentence
    "Selon les dernières estimations de l'INSEE, le taux de chômage devrait baisser de 0,3 point au 1er trimestre, une tendance confirmée par les analystes du FMI.",
    # 10. Guillemets and citations
    "Le ministre a déclaré : « Nous ne céderons pas face aux pressions internationales », avant de quitter la salle.",
]


async def benchmark_provider(provider_name: str):
    """Benchmark a single TTS provider."""
    import os
    os.environ["TTS_PROVIDER"] = provider_name
    reset_tts_service()

    service = get_tts_service()
    if not service.is_available():
        logger.warning(f"Provider '{provider_name}' not available (missing config)")
        return None

    provider_dir = OUTPUT_DIR / provider_name
    provider_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for i, phrase in enumerate(TEST_PHRASES, 1):
        preprocessed = preprocess_french(phrase)
        logger.info(f"[{provider_name}] Test {i}/10: {phrase[:60]}...")
        logger.debug(f"  Preprocessed: {preprocessed[:80]}...")

        start = time.time()
        try:
            audio = await service.generate_audio(text=phrase, voice="presentateur")
            elapsed = time.time() - start

            if audio:
                out_path = provider_dir / f"test_{i:02d}.mp3"
                out_path.write_bytes(audio)
                result = {
                    "test": i,
                    "phrase_len": len(phrase),
                    "preprocessed_len": len(preprocessed),
                    "audio_size_kb": len(audio) // 1024,
                    "latency_s": round(elapsed, 2),
                    "status": "OK",
                }
            else:
                result = {
                    "test": i,
                    "phrase_len": len(phrase),
                    "latency_s": round(elapsed, 2),
                    "status": "EMPTY",
                }
        except Exception as e:
            elapsed = time.time() - start
            result = {
                "test": i,
                "phrase_len": len(phrase),
                "latency_s": round(elapsed, 2),
                "status": f"ERROR: {str(e)[:100]}",
            }

        results.append(result)
        logger.info(f"  -> {result['status']} ({result['latency_s']}s)")

    return results


async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Detect available providers
    providers_to_test = []
    from app.core.config import settings

    if settings.RUNPOD_API_KEY:
        if settings.RUNPOD_XTTS_ENDPOINT_ID:
            providers_to_test.append("xtts")
        if settings.RUNPOD_CHATTERBOX_ENDPOINT_ID:
            providers_to_test.append("chatterbox")
    if settings.GOOGLE_TTS_API_KEY:
        providers_to_test.append("google")
    if settings.OPENAI_TTS_API_KEY:
        providers_to_test.append("openai")
    if settings.AZURE_SPEECH_KEY:
        providers_to_test.append("azure")

    if not providers_to_test:
        logger.error("No TTS providers configured! Set API keys in .env")
        return

    logger.info(f"Benchmarking {len(providers_to_test)} providers: {', '.join(providers_to_test)}")
    logger.info(f"Test phrases: {len(TEST_PHRASES)}")
    print("=" * 70)

    all_results = {}
    for provider in providers_to_test:
        print(f"\n--- {provider.upper()} ---")
        results = await benchmark_provider(provider)
        if results:
            all_results[provider] = results

    # Summary
    print("\n" + "=" * 70)
    print("BENCHMARK SUMMARY")
    print("=" * 70)
    print(f"{'Provider':<15} {'OK':>4} {'Fail':>5} {'Avg Latency':>12} {'Avg Size':>10}")
    print("-" * 50)

    for provider, results in all_results.items():
        ok = sum(1 for r in results if r["status"] == "OK")
        fail = len(results) - ok
        avg_lat = sum(r["latency_s"] for r in results) / len(results)
        sizes = [r.get("audio_size_kb", 0) for r in results if r["status"] == "OK"]
        avg_size = sum(sizes) / len(sizes) if sizes else 0
        print(f"{provider:<15} {ok:>4} {fail:>5} {avg_lat:>10.2f}s {avg_size:>8.0f}KB")

    print(f"\nOutput saved to: {OUTPUT_DIR.absolute()}")
    print("Listen to the files for subjective quality comparison.")


if __name__ == "__main__":
    asyncio.run(main())
