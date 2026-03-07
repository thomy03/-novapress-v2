"""
NovaPress Talkshow Generator
Generates interview-format audio from topic syntheses + causal data.

Format: 1 presentatrice + 1 expert, episodes de 12-15 minutes.
The presenter also plays devil's advocate (contradictions, tough questions).
Uses Azure AI Speech (SSML) or Edge TTS (fallback) for audio generation.
Uses Gemini Flash 3.1 Preview via OpenRouter for script generation.
"""
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger


TALKSHOW_CACHE_DIR = Path("audio_cache/talkshows")

# 2 participants: 1 presentatrice (also plays devil's advocate) + 1 expert
PANELISTS = {
    "presentateur": {
        "name": "Valerie Moreau",
        "role": "Presentatrice & contradictrice",
        "voice": "presentateur",
        "style": "Presente, relance, contredit, joue l'avocat du diable. Pose les questions difficiles.",
    },
    "expert": {
        "name": "Philippe Renard",
        "role": "Expert & analyste",
        "voice": "expert",
        "style": "Analyse en profondeur, precedents historiques, scenarios futurs. Ton grave, pose.",
    },
}

# LLM model for script generation
TALKSHOW_MODEL = "google/gemini-3.1-flash-lite-preview"


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
        duration_target: int = 780,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a complete talkshow with script + audio.
        Default duration: 780s (13 minutes).

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
            # 1. Generate debate script via LLM
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
        duration_target: int = 780,
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

    async def _enrich_with_search(self, topic: str) -> Dict[str, str]:
        """Enrich talkshow context with Grok + Perplexity real-time search."""
        from app.core.config import settings

        enrichment: Dict[str, str] = {}

        # Perplexity -- web context + latest developments
        if settings.PERPLEXITY_API_KEY:
            try:
                from openai import AsyncOpenAI

                pplx = AsyncOpenAI(
                    api_key=settings.PERPLEXITY_API_KEY,
                    base_url="https://api.perplexity.ai",
                    timeout=float(settings.PERPLEXITY_TIMEOUT),
                )
                resp = await pplx.chat.completions.create(
                    model="sonar",
                    messages=[
                        {
                            "role": "system",
                            "content": "Tu es un chercheur. Fournis un briefing factuel et concis en francais.",
                        },
                        {
                            "role": "user",
                            "content": (
                                f"Quels sont les derniers developpements et le contexte cle "
                                f"sur le sujet: \"{topic}\"? "
                                f"Inclus les faits recents, les positions des acteurs, "
                                f"et les enjeux principaux. 300 mots max."
                            ),
                        },
                    ],
                    max_tokens=600,
                )
                web_ctx = resp.choices[0].message.content or ""
                if web_ctx:
                    enrichment["web_context"] = web_ctx
                    logger.info(f"Talkshow Perplexity enrichment: {len(web_ctx)} chars")
            except Exception as e:
                logger.debug(f"Talkshow Perplexity enrichment failed: {e}")

        # Grok -- social sentiment + breaking angles
        if settings.XAI_API_KEY:
            try:
                from openai import AsyncOpenAI

                grok = AsyncOpenAI(
                    api_key=settings.XAI_API_KEY,
                    base_url="https://api.x.ai/v1",
                    timeout=float(settings.GROK_TIMEOUT),
                )
                resp = await grok.chat.completions.create(
                    model="grok-3-mini-fast",
                    messages=[
                        {
                            "role": "system",
                            "content": "Tu es un analyste des reseaux sociaux. Reponds en francais.",
                        },
                        {
                            "role": "user",
                            "content": (
                                f"Quel est le sentiment dominant sur les reseaux sociaux "
                                f"concernant \"{topic}\"? "
                                f"Quels sont les angles polemiques, les debats en cours, "
                                f"et les points de friction? 200 mots max."
                            ),
                        },
                    ],
                    max_tokens=400,
                )
                social_ctx = resp.choices[0].message.content or ""
                if social_ctx:
                    enrichment["social_sentiment"] = social_ctx
                    logger.info(f"Talkshow Grok enrichment: {len(social_ctx)} chars")
            except Exception as e:
                logger.debug(f"Talkshow Grok enrichment failed: {e}")

        return enrichment

    def _is_elevenlabs_active(self) -> bool:
        """Check if ElevenLabs is the active TTS provider."""
        from app.services.tts_service import get_tts_service, ElevenLabsTTSService
        tts = get_tts_service()
        return isinstance(tts, ElevenLabsTTSService)

    async def _generate_script(
        self,
        topic: str,
        syntheses: List[Dict[str, Any]],
        causal_graph: Optional[Dict[str, Any]],
        predictions: Optional[List[Dict[str, Any]]],
        narrative: Optional[str],
        duration_target: int,
    ) -> Optional[List[Dict[str, str]]]:
        """Generate debate script via LLM with full intelligence context."""
        from openai import AsyncOpenAI
        from app.core.config import settings

        # ~40-50 exchanges for 12-15 min (each line ~15-20 seconds spoken)
        n_exchanges = max(15, duration_target // 18)

        # Enrich with real-time search (Perplexity + Grok)
        search_enrichment = await self._enrich_with_search(topic)

        # Build rich context
        context_parts = []

        # Syntheses
        for i, s in enumerate(syntheses[:6], 1):
            title = s.get("title", "")
            summary = s.get("summary", s.get("introduction", ""))
            body = s.get("body", "")[:1500]
            date = s.get("date", s.get("created_at", ""))
            sources = s.get("num_sources", 0)
            context_parts.append(
                f"=== SYNTHESE {i} ({date}) -- {sources} sources ===\n"
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
                edges_text.append(f"  - {cause} -> ({rel}) -> {effect}")
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

        # Real-time web context (Perplexity)
        if search_enrichment.get("web_context"):
            context_parts.append(
                f"=== CONTEXTE WEB TEMPS REEL (Perplexity) ===\n"
                f"{search_enrichment['web_context']}"
            )

        # Social sentiment (Grok)
        if search_enrichment.get("social_sentiment"):
            context_parts.append(
                f"=== SENTIMENT RESEAUX SOCIAUX (X/Twitter) ===\n"
                f"{search_enrichment['social_sentiment']}"
            )

        full_context = "\n\n".join(context_parts)

        # Panelist descriptions
        panelist_desc = "\n".join(
            f"- {pid}: {p['name']} ({p['role']}) -- {p['style']}"
            for pid, p in PANELISTS.items()
        )

        # Audio tags instructions (only for ElevenLabs)
        audio_tags_block = ""
        if self._is_elevenlabs_active():
            audio_tags_block = """

INSTRUCTIONS AUDIO (marqueurs naturels):
- Tu peux inserer des marqueurs pour rendre le debat vivant et naturel:
  [soupir] — avant une contradiction ou un constat amer
  [rire] ou [rire leger] — reaction a une ironie ou anecdote
  [pause] — effet dramatique, moment de reflexion
  [murmure] — apartes, confidences
  [hm] — hesitation naturelle
- Le contradicteur peut commencer par [soupir] avant de contredire
- La presentatrice peut dire [pause] pour un effet dramatique
- La journaliste peut [rire leger] en racontant une anecdote
- PARCIMONIE: 4-6 marqueurs maximum par episode. Pas plus."""

        system_prompt = f"""Tu es un scriptwriter d'elite pour une interview d'actualite francaise de reference (style Thinkerview / HardTalk / C dans l'air).

FORMAT: Interview en tete-a-tete entre une presentatrice et un expert.

PARTICIPANTS:
{panelist_desc}

REGLES DU SCRIPT:
1. La presentatrice ouvre en presentant le sujet et l'expert (1 replique d'introduction)
2. L'interview alterne entre presentatrice et expert — c'est un DIALOGUE, pas un monologue
3. La presentatrice DOIT jouer l'avocat du diable: contredire, challenger, poser les questions qui derangent
4. La presentatrice DOIT reformuler les points cles pour l'auditeur ("Si je comprends bien...")
5. L'expert DOIT citer des faits precis, des precedents historiques, des chiffres
6. L'expert DOIT proposer des scenarios futurs avec probabilites et consequences
7. La presentatrice DOIT citer les reactions du public ou des reseaux sociaux pour contrebalancer
8. Environ {n_exchanges} repliques au total (alternance rapide presentatrice/expert)
9. Chaque replique fait 2-4 phrases. Rythme dynamique, pas de longs monologues.
10. Les repliques doivent etre SUBSTANTIELLES — analyses, arguments, pas des platitudes
11. UTILISE les relations causales et predictions pour enrichir l'echange
12. INTEGRE le contexte web temps reel et le sentiment des reseaux sociaux
13. Au moins 3 moments ou la presentatrice CONTREDIT ou CHALLENGE l'expert
14. L'expert doit parfois conceder un point ou nuancer sa position
15. Terminer par une question ouverte de la presentatrice + reponse finale de l'expert

EXIGENCES EDITORIALES (CRITIQUES):
- L'expert DOIT RAISONNER au-dela des faits: expliquer le POURQUOI, les mecanismes sous-jacents
- La presentatrice DOIT poser les questions que le public se pose vraiment
- Au moins 2 scenarios d'avenir doivent etre discutes avec des visions divergentes
- Les auditeurs viennent pour MIEUX COMPRENDRE et ANTICIPER — pas pour un resume des faits
- Privilegier les enchainements logiques: "si X alors Y, mais attention a Z"
- L'interview doit avoir une PROGRESSION: faits -> analyse -> mecanismes -> consequences -> futurs possibles
- La presentatrice doit parfois bousculer l'expert: "Mais n'est-ce pas naif de penser que...?"
- L'expert peut repondre avec assurance mais aussi avec humilite quand il ne sait pas{audio_tags_block}

RETOURNE UNIQUEMENT un JSON array valide.
Format: [{{"speaker": "presentateur", "text": "..."}}, {{"speaker": "expert", "text": "..."}}, ...]
Les speakers valides sont UNIQUEMENT: presentateur, expert"""

        user_prompt = f"""Genere une interview d'actualite de haute qualite sur le sujet: "{topic}"

Voici toute l'intelligence disponible sur ce dossier:

{full_context}

L'interview doit durer environ {duration_target // 60} minutes ({n_exchanges} repliques).
La presentatrice pose les questions, contredit, joue l'avocat du diable.
L'expert analyse, argumente, propose des scenarios.
L'interview doit etre DYNAMIQUE, avec des desaccords, des relances incisives, et du rythme."""

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
                temperature=0.85,
                max_tokens=8000,
            )

            raw = response.choices[0].message.content or ""
            return self._parse_script(raw)

        except Exception as e:
            logger.error(f"Talkshow script LLM call failed: {e}")
            return None

    @staticmethod
    def _parse_script(response: str) -> Optional[List[Dict[str, str]]]:
        """Parse LLM JSON response into script lines with robust fallbacks."""
        try:
            text = response.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            # Try direct parse first
            parsed = None
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                # Try to fix common LLM JSON issues:
                # 1. Find the JSON array boundaries
                start = text.find("[")
                end = text.rfind("]")
                if start >= 0 and end > start:
                    json_text = text[start:end + 1]
                    # 2. Fix unescaped quotes inside strings
                    import re
                    # Try parsing the extracted array
                    try:
                        parsed = json.loads(json_text)
                    except json.JSONDecodeError:
                        # 3. Try fixing trailing commas
                        cleaned = re.sub(r',\s*]', ']', json_text)
                        cleaned = re.sub(r',\s*}', '}', cleaned)
                        try:
                            parsed = json.loads(cleaned)
                        except json.JSONDecodeError:
                            # 4. Extract line by line with regex
                            pattern = r'\{\s*"speaker"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}'
                            matches = re.findall(pattern, json_text, re.DOTALL)
                            if matches:
                                parsed = [{"speaker": m[0], "text": m[1].replace('\\"', '"').replace('\\n', ' ')} for m in matches]
                                logger.info(f"Talkshow script recovered via regex: {len(parsed)} lines")

            if not parsed or not isinstance(parsed, list):
                return None

            valid_speakers = set(PANELISTS.keys())
            result = []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                speaker = item.get("speaker", "").strip()
                # Accept "moderateur" as alias for "presentateur"
                if speaker == "moderateur":
                    speaker = "presentateur"
                if speaker not in valid_speakers:
                    continue
                text_line = str(item.get("text", "")).strip()
                if text_line and len(text_line) > 5:
                    result.append({"speaker": speaker, "text": text_line})

            if len(result) < 8:
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
            logger.info("TTS not available -- talkshow will be text-only")
            return None

        # Generate each line sequentially to respect ElevenLabs rate limits
        segments = []
        for line in script:
            panelist = PANELISTS.get(line["speaker"])
            if not panelist:
                continue
            try:
                audio = await tts.generate_audio(
                    line["text"],
                    voice=panelist["voice"],
                    rate=panelist.get("rate", "+0%"),
                    pitch=panelist.get("pitch", "+0Hz"),
                )
                if audio:
                    segments.append({
                        "audio": audio,
                        "speaker": line["speaker"],
                    })
            except Exception as e:
                logger.debug(f"TTS segment failed: {e}")

        if not segments:
            return None

        # Concatenate with dynamic pauses
        return await self._concat_segments(segments, cache_key)

    @staticmethod
    async def _concat_segments(
        segments: List[Dict[str, Any]], cache_key: str
    ) -> Optional[bytes]:
        """Concatenate MP3 segments with context-aware pauses and cross-talk overlap."""
        try:
            from pydub import AudioSegment  # type: ignore

            combined = AudioSegment.empty()

            for i, seg in enumerate(segments):
                seg_bytes = seg["audio"]
                speaker = seg["speaker"]

                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                    f.write(seg_bytes)
                    tmp = f.name
                try:
                    audio = AudioSegment.from_mp3(tmp)
                finally:
                    os.unlink(tmp)

                # Dynamic pause/overlap before next segment
                if i < len(segments) - 1:
                    next_speaker = segments[i + 1]["speaker"]
                    pause_ms = _compute_pause(speaker, next_speaker)

                    if pause_ms < 0:
                        # Cross-talk: overlap the end of current with start of next
                        overlap_ms = abs(pause_ms)
                        # Don't overlap more than 30% of the segment
                        overlap_ms = min(overlap_ms, len(audio) // 3)
                        combined += audio
                        # Move playhead back by overlap_ms to create overlap effect
                        combined = combined[:len(combined) - overlap_ms]
                        # The next segment will start overlapping here
                    else:
                        combined += audio
                        combined += AudioSegment.silent(duration=pause_ms)
                else:
                    combined += audio

            # Export as MP3
            output_path = TALKSHOW_CACHE_DIR / f"{cache_key}.mp3"
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                tmp_mp3 = f.name
            try:
                combined.export(
                    tmp_mp3, format="mp3",
                    bitrate="128k",
                    tags={
                        "title": "NovaPress Talkshow",
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
            logger.warning("pydub not installed -- naive MP3 concat")
            mp3_bytes = b"".join(s["audio"] for s in segments)
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


def _compute_pause(current_speaker: str, next_speaker: str) -> int:
    """Compute dynamic pause duration (ms) based on speaker transitions.
    Negative values = cross-talk overlap (voices overlap for realism).
    """
    # Same speaker continues (rare)
    if current_speaker == next_speaker:
        return 250

    # Expert finishes -> presenter jumps in with follow-up (slight overlap)
    if current_speaker == "expert" and next_speaker == "presentateur":
        return -150

    # Presenter asks question -> expert takes a beat to respond
    if current_speaker == "presentateur" and next_speaker == "expert":
        return 500

    # Default
    return 350


# Global instance
_talkshow_gen: Optional[TalkshowGenerator] = None


def get_talkshow_generator() -> TalkshowGenerator:
    global _talkshow_gen
    if _talkshow_gen is None:
        _talkshow_gen = TalkshowGenerator()
    return _talkshow_gen
