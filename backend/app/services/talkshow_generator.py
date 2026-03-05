"""
NovaPress Talkshow Generator
Generates multi-panelist debate audio from topic syntheses + causal data.

Uses Gemini Flash 3.1 Preview via OpenRouter for script generation.
Uses Edge TTS (fr-FR native voices) for audio generation.
"""
import asyncio
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger


TALKSHOW_CACHE_DIR = Path("audio_cache/talkshows")

# 5 panelists with distinct French voices and roles
PANELISTS = {
    "moderateur": {
        "name": "Valerie Moreau",
        "role": "Moderatrice",
        "voice": "fr-FR-DeniseNeural",
        "style": "Pose les questions, relance, synthetise. Ton professionnel, neutre.",
        "rate": "-3%",
        "pitch": "+0Hz",
    },
    "expert": {
        "name": "Philippe Renard",
        "role": "Expert geopolitique",
        "voice": "fr-FR-HenriNeural",
        "style": "Analyse en profondeur, cite des precedents historiques. Ton grave, pose.",
        "rate": "-5%",
        "pitch": "-2Hz",
    },
    "journaliste": {
        "name": "Claire Dubois",
        "role": "Grand reporter",
        "voice": "fr-FR-EloiseNeural",
        "style": "Temoignages terrain, vecu, anecdotes. Ton vif, engage.",
        "rate": "+0%",
        "pitch": "+0Hz",
    },
    "contradicteur": {
        "name": "Marc Lefevre",
        "role": "Editorialiste",
        "voice": "fr-FR-AlainNeural",
        "style": "Contradicteur, joue l'avocat du diable, questionne les evidences. Ton incisif.",
        "rate": "+0%",
        "pitch": "-1Hz",
    },
    "prospectiviste": {
        "name": "Sofia Benali",
        "role": "Prospectiviste",
        "voice": "fr-FR-CoralieNeural",
        "style": "Projections futures, scenarios, consequences a long terme. Ton reflechi.",
        "rate": "-2%",
        "pitch": "+1Hz",
    },
}

# LLM model for script generation
TALKSHOW_MODEL = "google/gemini-2.5-flash-preview"


class TalkshowGenerator:
    """Generates multi-panelist debate talkshows from topic data."""

    def __init__(self):
        TALKSHOW_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    async def generate_talkshow(
        self,
        topic: str,
        syntheses: List[Dict[str, Any]],
        causal_graph: Optional[Dict[str, Any]] = None,
        predictions: Optional[List[Dict[str, Any]]] = None,
        narrative: Optional[str] = None,
        duration_target: int = 300,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a complete talkshow with script + audio.

        Returns:
            {
                "topic": str,
                "duration_seconds": int,
                "script": [{"speaker": str, "role": str, "text": str}, ...],
                "audio_url": str | None,
                "panelists": [{"id": str, "name": str, "role": str}, ...],
            }
        """
        if not syntheses:
            logger.warning("No syntheses provided for talkshow")
            return None

        cache_key = self._cache_key(topic, syntheses, duration_target)

        # Check for cached script
        script_cache = TALKSHOW_CACHE_DIR / f"{cache_key}_script.json"
        if script_cache.exists():
            try:
                cached = json.loads(script_cache.read_text(encoding="utf-8"))
                logger.info(f"Talkshow script cache hit: {cache_key[:8]}")
                return cached
            except (json.JSONDecodeError, ValueError):
                pass

        try:
            # 1. Generate debate script via Gemini Flash
            script = await self._generate_script(
                topic, syntheses, causal_graph, predictions, narrative, duration_target
            )
            if not script:
                logger.warning("Talkshow script generation failed")
                return None

            # 2. Generate audio segments
            audio_bytes = await self._generate_audio(script, cache_key)

            # 3. Build result
            result = {
                "topic": topic,
                "duration_target": duration_target,
                "script": script,
                "has_audio": audio_bytes is not None,
                "audio_cache_key": cache_key if audio_bytes else None,
                "panelists": [
                    {"id": pid, "name": p["name"], "role": p["role"]}
                    for pid, p in PANELISTS.items()
                ],
            }

            # Cache script
            script_cache.write_text(
                json.dumps(result, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            return result

        except Exception as e:
            logger.error(f"Talkshow generation failed: {e}")
            return None

    async def generate_script_only(
        self,
        topic: str,
        syntheses: List[Dict[str, Any]],
        causal_graph: Optional[Dict[str, Any]] = None,
        predictions: Optional[List[Dict[str, Any]]] = None,
        narrative: Optional[str] = None,
        duration_target: int = 300,
    ) -> Optional[Dict[str, Any]]:
        """Generate only the script (no audio). Faster, cheaper."""
        if not syntheses:
            return None

        cache_key = self._cache_key(topic, syntheses, duration_target)
        script_cache = TALKSHOW_CACHE_DIR / f"{cache_key}_script.json"
        if script_cache.exists():
            try:
                return json.loads(script_cache.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, ValueError):
                pass

        script = await self._generate_script(
            topic, syntheses, causal_graph, predictions, narrative, duration_target
        )
        if not script:
            return None

        result = {
            "topic": topic,
            "duration_target": duration_target,
            "script": script,
            "has_audio": False,
            "audio_cache_key": None,
            "panelists": [
                {"id": pid, "name": p["name"], "role": p["role"]}
                for pid, p in PANELISTS.items()
            ],
        }
        script_cache.write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return result

    async def get_cached_audio(self, cache_key: str) -> Optional[bytes]:
        """Retrieve cached audio file (MP3 preferred for podcast compatibility)."""
        mp3_path = TALKSHOW_CACHE_DIR / f"{cache_key}.mp3"
        if mp3_path.exists():
            return mp3_path.read_bytes()
        ogg_path = TALKSHOW_CACHE_DIR / f"{cache_key}.ogg"
        if ogg_path.exists():
            return ogg_path.read_bytes()
        return None

    def get_audio_format(self, cache_key: str) -> str:
        """Return the MIME type of the cached audio."""
        mp3_path = TALKSHOW_CACHE_DIR / f"{cache_key}.mp3"
        if mp3_path.exists():
            return "audio/mpeg"
        return "audio/ogg"

    async def _generate_script(
        self,
        topic: str,
        syntheses: List[Dict[str, Any]],
        causal_graph: Optional[Dict[str, Any]],
        predictions: Optional[List[Dict[str, Any]]],
        narrative: Optional[str],
        duration_target: int,
    ) -> Optional[List[Dict[str, str]]]:
        """Generate debate script via Gemini Flash 3.1."""
        from openai import AsyncOpenAI
        from app.core.config import settings

        n_exchanges = max(10, duration_target // 15)

        # Build rich context
        context_parts = []

        # Syntheses
        for i, s in enumerate(syntheses[:6], 1):
            title = s.get("title", "")
            summary = s.get("summary", s.get("introduction", ""))
            body = s.get("body", "")[:500]
            date = s.get("date", s.get("created_at", ""))
            sources = s.get("num_sources", 0)
            context_parts.append(
                f"=== SYNTHESE {i} ({date}) — {sources} sources ===\n"
                f"Titre: {title}\n"
                f"Resume: {summary}\n"
                f"{body}\n"
            )

        # Causal relations
        if causal_graph and causal_graph.get("edges"):
            edges_text = []
            for e in causal_graph["edges"][:10]:
                cause = e.get("cause_text", e.get("source", ""))
                effect = e.get("effect_text", e.get("target", ""))
                rel = e.get("relation_type", e.get("type", "causes"))
                edges_text.append(f"  - {cause} → ({rel}) → {effect}")
            context_parts.append(
                "=== RELATIONS CAUSALES ===\n" + "\n".join(edges_text)
            )

        # Predictions
        if predictions:
            pred_text = []
            for p in predictions[:5]:
                prob = int(p.get("probability", 0.5) * 100)
                pred_text.append(
                    f"  - [{prob}%] {p.get('prediction', '')} "
                    f"(horizon: {p.get('timeframe', 'inconnu')})"
                )
            context_parts.append(
                "=== SCENARIOS PROSPECTIFS ===\n" + "\n".join(pred_text)
            )

        # Narrative
        if narrative:
            context_parts.append(f"=== NARRATIF EDITORIAL ===\n{narrative[:500]}")

        full_context = "\n\n".join(context_parts)

        # Panelist descriptions
        panelist_desc = "\n".join(
            f"- {pid}: {p['name']} ({p['role']}) — {p['style']}"
            for pid, p in PANELISTS.items()
        )

        system_prompt = f"""Tu es un scriptwriter d'elite pour une emission de debat televisee francaise de reference (style C dans l'air / 28 Minutes / LCI).

PANELISTES DISPONIBLES:
{panelist_desc}

REGLES DU SCRIPT:
1. Commence par la moderatrice qui presente le sujet et les panelistes (1 replique)
2. Chaque intervenant a un POINT DE VUE DISTINCT — pas de consensus mou
3. Le contradicteur DOIT challenger au moins 2 arguments des autres
4. La prospectiviste DOIT aborder les scenarios futurs et consequences
5. L'expert DOIT citer des faits precis issus des syntheses
6. La journaliste DOIT apporter du concret, du terrain, du vecu
7. La moderatrice relance, reformule, et fait la transition entre les themes
8. Termine par un tour de table final (chacun 1 phrase de conclusion)
9. Environ {n_exchanges} repliques au total
10. Chaque replique fait 2-4 phrases. JAMAIS de repliques d'une seule phrase.
11. Les repliques doivent etre SUBSTANTIELLES — analyses, arguments, pas des platitudes
12. UTILISE les relations causales et predictions pour enrichir le debat
13. Le debat doit ECLAIRER le sujet, pas juste le decrire

RETOURNE UNIQUEMENT un JSON array valide.
Format: [{{"speaker": "moderateur", "text": "..."}}, {{"speaker": "expert", "text": "..."}}, ...]
Les speakers valides sont: moderateur, expert, journaliste, contradicteur, prospectiviste"""

        user_prompt = f"""Genere un debat televise de haute qualite sur le sujet: "{topic}"

Voici toute l'intelligence disponible sur ce dossier:

{full_context}

Le debat doit durer environ {duration_target // 60} minutes ({n_exchanges} repliques).
Fais en sorte que chaque intervenant apporte une perspective UNIQUE et SUBSTANTIELLE."""

        try:
            client = AsyncOpenAI(
                api_key=settings.OPENROUTER_API_KEY,
                base_url=settings.OPENROUTER_BASE_URL,
                timeout=120.0,
            )

            response = await client.chat.completions.create(
                model=TALKSHOW_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.8,
                max_tokens=4000,
            )

            raw = response.choices[0].message.content or ""
            return self._parse_script(raw)

        except Exception as e:
            logger.error(f"Talkshow script LLM call failed: {e}")
            return None

    @staticmethod
    def _parse_script(response: str) -> Optional[List[Dict[str, str]]]:
        """Parse LLM JSON response into script lines."""
        try:
            text = response.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            parsed = json.loads(text)
            if not isinstance(parsed, list):
                return None

            valid_speakers = set(PANELISTS.keys())
            result = []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                speaker = item.get("speaker", "").strip()
                if speaker not in valid_speakers:
                    continue
                text_line = str(item.get("text", "")).strip()
                if text_line and len(text_line) > 5:
                    result.append({"speaker": speaker, "text": text_line})

            if len(result) < 5:
                logger.warning(f"Talkshow script too short: {len(result)} lines")
                return None

            return result

        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Talkshow script parse failed: {e}")
            return None

    async def _generate_audio(
        self, script: List[Dict[str, str]], cache_key: str
    ) -> Optional[bytes]:
        """Generate TTS audio for all script lines and concatenate."""
        from app.services.tts_service import get_tts_service

        tts = get_tts_service()
        if not tts.is_available():
            logger.info("TTS not available — talkshow will be text-only")
            return None

        tasks = []
        for line in script:
            panelist = PANELISTS.get(line["speaker"])
            if not panelist:
                continue
            tasks.append(
                tts.generate_audio(
                    line["text"],
                    voice=panelist["voice"],
                    rate=panelist.get("rate", "+0%"),
                    pitch=panelist.get("pitch", "+0Hz"),
                )
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)
        segments = []
        for r in results:
            if isinstance(r, bytes) and r:
                segments.append(r)
            elif isinstance(r, Exception):
                logger.debug(f"TTS segment failed: {r}")

        if not segments:
            return None

        # Concatenate
        return await self._concat_segments(segments, cache_key)

    @staticmethod
    async def _concat_segments(
        segments: List[bytes], cache_key: str
    ) -> Optional[bytes]:
        """Concatenate MP3 segments into a single audio file."""
        try:
            from pydub import AudioSegment  # type: ignore

            combined = AudioSegment.empty()
            pause = AudioSegment.silent(duration=600)  # 600ms between speakers

            for seg_bytes in segments:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                    f.write(seg_bytes)
                    tmp = f.name
                try:
                    audio = AudioSegment.from_mp3(tmp)
                    combined += audio + pause
                finally:
                    os.unlink(tmp)

            # Export as MP3 (required by Spotify/Apple Podcasts)
            output_path = TALKSHOW_CACHE_DIR / f"{cache_key}.mp3"
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                tmp_mp3 = f.name
            try:
                combined.export(
                    tmp_mp3, format="mp3",
                    bitrate="128k",
                    tags={
                        "title": f"NovaPress Talkshow",
                        "artist": "NovaPress AI",
                        "album": "NovaPress Talkshow",
                        "genre": "Podcast",
                    },
                )
                mp3_bytes = Path(tmp_mp3).read_bytes()
                output_path.write_bytes(mp3_bytes)
                duration = len(combined) / 1000
                logger.info(
                    f"Talkshow audio: {len(mp3_bytes)//1024}KB, {duration:.0f}s"
                )
                return mp3_bytes
            finally:
                if os.path.exists(tmp_mp3):
                    os.unlink(tmp_mp3)

        except ImportError:
            # Naive fallback: concatenate raw MP3
            logger.warning("pydub not installed — naive MP3 concat")
            mp3_bytes = b"".join(segments)
            output_path = TALKSHOW_CACHE_DIR / f"{cache_key}.mp3"
            output_path.write_bytes(mp3_bytes)
            return mp3_bytes
        except Exception as e:
            logger.error(f"Audio concatenation failed: {e}")
            return None

    @staticmethod
    def _cache_key(topic: str, syntheses: List[Dict], duration: int) -> str:
        ids = "|".join(
            str(s.get("id", s.get("title", "")[:20])) for s in syntheses[:6]
        )
        content = f"talkshow:{topic}:{ids}:{duration}"
        return hashlib.md5(content.encode()).hexdigest()


# Global instance
_talkshow_gen: Optional[TalkshowGenerator] = None


def get_talkshow_generator() -> TalkshowGenerator:
    global _talkshow_gen
    if _talkshow_gen is None:
        _talkshow_gen = TalkshowGenerator()
    return _talkshow_gen
