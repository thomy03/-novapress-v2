"""
NovaPress Talkshow Generator — Multi-Persona Edition
Generates talkshow (familier, 4 panelists) or interview (formel, 2 panelists) audio.

TTS: XTTS fine-tuned CML-TTS French with voice cloning per persona.
Script generation: Gemini Flash via OpenRouter.
"""
import hashlib
import json
import os
import random
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger

from app.ml.persona import Persona, PERSONAS, PersonaType, get_persona
from app.services.panel_selector import select_panel
from app.services.expert_generator import (
    TalkshowExpert, assign_voices, parse_experts_from_llm, HOST_VOICE_SLOT,
)


TALKSHOW_CACHE_DIR = Path("audio_cache/talkshows")

# LLM model for script generation
TALKSHOW_MODEL = "google/gemini-3.1-flash-lite-preview"

# Director modes
DIRECTOR_MODES = {
    "talkshow": {
        "label": "Talkshow / Debat",
        "description": "Tutoiement, 4 intervenants, ton familier, interruptions",
        "max_interrupts": 10,
        "speed_range": (0.95, 1.3),
        "emotions": ["neutral", "assertive", "angry", "frustrated", "amused", "emphatic", "ironic"],
        "filler_rate": 0.35,
        "cross_talk_ms": 300,
        "pause_multiplier": 0.8,
        "register": "familier",
    },
    "interview": {
        "label": "Interview approfondie",
        "description": "Vouvoiement, 2 intervenants, ton formel, style Thinkerview",
        "max_interrupts": 0,
        "speed_range": (0.9, 1.05),
        "emotions": ["neutral", "thoughtful", "assertive", "amused"],
        "filler_rate": 0.15,
        "cross_talk_ms": 0,
        "pause_multiplier": 1.4,
        "register": "formel",
    },
    # Legacy aliases
    "debate": {
        "label": "Debat / Talkshow",
        "description": "Alias pour talkshow",
        "max_interrupts": 10,
        "speed_range": (0.95, 1.3),
        "emotions": ["neutral", "assertive", "angry", "frustrated", "amused", "emphatic"],
        "filler_rate": 0.35,
        "cross_talk_ms": 300,
        "pause_multiplier": 0.8,
        "register": "familier",
    },
}

# Per-debate_style audio director tweaks
STYLE_AUDIO_CONFIG = {
    "provocateur": {"speed_boost": 0.1, "volume_boost": 2, "interrupt_chance": 0.4},
    "narratif": {"speed_boost": -0.1, "volume_boost": 0, "interrupt_chance": 0.05},
    "analytique": {"speed_boost": 0.0, "volume_boost": 0, "interrupt_chance": 0.1},
    "pedagogique": {"speed_boost": -0.05, "volume_boost": 0, "interrupt_chance": 0.08},
    "balanced": {"speed_boost": 0.0, "volume_boost": 0, "interrupt_chance": 0.15},
}


class TalkshowGenerator:
    """Generates multi-panelist talkshow/interview episodes."""

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
        mode: str = "talkshow",
        panelists: Optional[List[str]] = None,
        category: str = "",
        dynamic_experts: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a complete talkshow with script + audio.

        Args:
            mode: "talkshow" (familier, 4 panelists) or "interview" (formel, 2 panelists)
            panelists: Optional list of persona IDs to force (legacy path)
            category: Topic category for panel selection
            dynamic_experts: If True and no panelists forced, LLM invents experts
        """
        if not syntheses:
            logger.warning("No syntheses provided for talkshow")
            return None

        director = DIRECTOR_MODES.get(mode, DIRECTOR_MODES["talkshow"])
        use_dynamic = dynamic_experts and not panelists

        dyn_tag = "_dyn" if use_dynamic else "_leg"
        cache_key = self._cache_key(topic, syntheses, duration_target) + f"_{mode}{dyn_tag}"

        # Check cache
        script_cache = TALKSHOW_CACHE_DIR / f"{cache_key}_script.json"
        if script_cache.exists():
            try:
                cached = json.loads(script_cache.read_text(encoding="utf-8"))
                logger.info(f"Talkshow script cache hit: {cache_key[:8]}")
                return cached
            except (json.JSONDecodeError, ValueError):
                pass

        try:
            if use_dynamic:
                # Dynamic: LLM invents experts + writes script in one call
                gen_result = await self._generate_script_dynamic(
                    topic, syntheses, causal_graph, predictions, narrative,
                    duration_target, director, mode,
                )
                if not gen_result:
                    logger.warning("Dynamic script generation failed")
                    return None
                experts, script = gen_result

                # Generate audio with voice slots
                audio_bytes = await self._generate_audio_dynamic(
                    script, cache_key, director, experts,
                )

                result = {
                    "topic": topic,
                    "mode": mode,
                    "mode_label": director["label"],
                    "duration_target": duration_target,
                    "script": script,
                    "has_audio": audio_bytes is not None,
                    "audio_cache_key": cache_key if audio_bytes else None,
                    "dynamic_experts": True,
                    "panelists": [
                        {
                            "id": "neutral",
                            "name": "NovaPress",
                            "role": "animateur",
                            "voice_gender": "female",
                            "catchphrase": "",
                        }
                    ] + [
                        {
                            "id": e.speaker_id,
                            "name": e.name,
                            "role": e.title,
                            "voice_gender": e.gender,
                            "catchphrase": e.catchphrase,
                        }
                        for e in experts
                    ],
                }
            else:
                # Legacy: forced personas or panel_selector
                num = 2 if mode == "interview" else 4
                panel = select_panel(topic, category, num_panelists=num, forced_personas=panelists)

                script = await self._generate_script(
                    topic, syntheses, causal_graph, predictions, narrative,
                    duration_target, director, panel,
                )
                if not script:
                    logger.warning("Talkshow script generation failed")
                    return None

                audio_bytes = await self._generate_audio(script, cache_key, director, panel)

                result = {
                    "topic": topic,
                    "mode": mode,
                    "mode_label": director["label"],
                    "duration_target": duration_target,
                    "script": script,
                    "has_audio": audio_bytes is not None,
                    "audio_cache_key": cache_key if audio_bytes else None,
                    "dynamic_experts": False,
                    "panelists": [
                        {
                            "id": p.id,
                            "name": p.name,
                            "role": "animateur" if p.id == "neutral" else p.debate_style,
                            "voice_gender": p.voice_gender,
                            "catchphrase": p.talkshow_catchphrase,
                        }
                        for p in panel
                    ],
                }

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
        mode: str = "talkshow",
        panelists: Optional[List[str]] = None,
        category: str = "",
        dynamic_experts: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """Generate only the script (no audio). Faster, cheaper."""
        if not syntheses:
            return None

        director = DIRECTOR_MODES.get(mode, DIRECTOR_MODES["talkshow"])
        use_dynamic = dynamic_experts and not panelists

        dyn_tag = "_dyn" if use_dynamic else "_leg"
        cache_key = self._cache_key(topic, syntheses, duration_target) + f"_{mode}{dyn_tag}"
        script_cache = TALKSHOW_CACHE_DIR / f"{cache_key}_script.json"
        if script_cache.exists():
            try:
                return json.loads(script_cache.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, ValueError):
                pass

        if use_dynamic:
            gen_result = await self._generate_script_dynamic(
                topic, syntheses, causal_graph, predictions, narrative,
                duration_target, director, mode,
            )
            if not gen_result:
                return None
            experts, script = gen_result

            result = {
                "topic": topic,
                "mode": mode,
                "mode_label": director["label"],
                "duration_target": duration_target,
                "script": script,
                "has_audio": False,
                "audio_cache_key": None,
                "dynamic_experts": True,
                "panelists": [
                    {
                        "id": "neutral",
                        "name": "NovaPress",
                        "role": "animateur",
                        "voice_gender": "female",
                        "catchphrase": "",
                    }
                ] + [
                    {
                        "id": e.speaker_id,
                        "name": e.name,
                        "role": e.title,
                        "voice_gender": e.gender,
                        "catchphrase": e.catchphrase,
                    }
                    for e in experts
                ],
            }
        else:
            num = 2 if mode == "interview" else 4
            panel = select_panel(topic, category, num_panelists=num, forced_personas=panelists)

            script = await self._generate_script(
                topic, syntheses, causal_graph, predictions, narrative,
                duration_target, director, panel,
            )
            if not script:
                return None

            result = {
                "topic": topic,
                "mode": mode,
                "mode_label": director["label"],
                "duration_target": duration_target,
                "script": script,
                "has_audio": False,
                "audio_cache_key": None,
                "dynamic_experts": False,
                "panelists": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "role": "animateur" if p.id == "neutral" else p.debate_style,
                        "voice_gender": p.voice_gender,
                        "catchphrase": p.talkshow_catchphrase,
                    }
                    for p in panel
                ],
            }

        script_cache.write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return result

    async def get_cached_audio(self, cache_key: str) -> Optional[bytes]:
        """Retrieve cached audio file."""
        mp3_path = TALKSHOW_CACHE_DIR / f"{cache_key}.mp3"
        if mp3_path.exists():
            return mp3_path.read_bytes()
        ogg_path = TALKSHOW_CACHE_DIR / f"{cache_key}.ogg"
        if ogg_path.exists():
            return ogg_path.read_bytes()
        return None

    def get_audio_format(self, cache_key: str) -> str:
        mp3_path = TALKSHOW_CACHE_DIR / f"{cache_key}.mp3"
        if mp3_path.exists():
            return "audio/mpeg"
        return "audio/ogg"

    # ------------------------------------------------------------------
    # Search enrichment (Perplexity + Grok)
    # ------------------------------------------------------------------
    async def _enrich_with_search(self, topic: str) -> Dict[str, str]:
        """Enrich talkshow context with Grok + Perplexity real-time search."""
        from app.core.config import settings

        enrichment: Dict[str, str] = {}

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
                        {"role": "system", "content": "Tu es un chercheur. Fournis un briefing factuel et concis en francais."},
                        {"role": "user", "content": (
                            f"Quels sont les derniers developpements et le contexte cle "
                            f"sur le sujet: \"{topic}\"? "
                            f"Inclus les faits recents, les positions des acteurs, "
                            f"et les enjeux principaux. 300 mots max."
                        )},
                    ],
                    max_tokens=600,
                )
                web_ctx = resp.choices[0].message.content or ""
                if web_ctx:
                    enrichment["web_context"] = web_ctx
                    logger.info(f"Talkshow Perplexity enrichment: {len(web_ctx)} chars")
            except Exception as e:
                logger.debug(f"Talkshow Perplexity enrichment failed: {e}")

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
                        {"role": "system", "content": "Tu es un analyste des reseaux sociaux. Reponds en francais."},
                        {"role": "user", "content": (
                            f"Quel est le sentiment dominant sur les reseaux sociaux "
                            f"concernant \"{topic}\"? "
                            f"Quels sont les angles polemiques, les debats en cours, "
                            f"et les points de friction? 200 mots max."
                        )},
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
        from app.services.tts_service import get_tts_service, ElevenLabsTTSService
        tts = get_tts_service()
        return isinstance(tts, ElevenLabsTTSService)

    # ------------------------------------------------------------------
    # Dynamic expert script generation (single LLM call)
    # ------------------------------------------------------------------
    async def _generate_script_dynamic(
        self,
        topic: str,
        syntheses: List[Dict[str, Any]],
        causal_graph: Optional[Dict[str, Any]],
        predictions: Optional[List[Dict[str, Any]]],
        narrative: Optional[str],
        duration_target: int,
        director: Dict[str, Any],
        mode: str,
    ) -> Optional[tuple]:
        """Generate experts + script in a single LLM call.

        Returns (experts: List[TalkshowExpert], script: List[Dict]) or None.
        """
        from openai import AsyncOpenAI
        from app.core.config import settings

        n_exchanges = max(15, duration_target // 18)
        search_enrichment = await self._enrich_with_search(topic)
        is_talkshow = director.get("register") == "familier"

        context_parts = self._build_context(
            syntheses, causal_graph, predictions, narrative, search_enrichment
        )
        full_context = "\n\n".join(context_parts)

        # Audio tags
        audio_tags_block = ""
        if self._is_elevenlabs_active():
            audio_tags_block = """

INSTRUCTIONS AUDIO (marqueurs naturels):
- [soupir] [rire] [rire leger] [pause] [murmure] [hm]
- PARCIMONIE: 4-6 marqueurs maximum par episode."""

        allowed_emotions = ", ".join(director["emotions"])
        speed_min, speed_max = director["speed_range"]
        max_interrupts = director["max_interrupts"]

        num_experts = 1 if mode == "interview" else 3
        host_name = "Sophie Leduc"

        if is_talkshow:
            register_rules = """REGLES DU TALKSHOW:
1. TUTOIEMENT entre TOUS les intervenants (tu, t'as, j'suis, c'est, y'a)
2. Contractions naturelles: t'as, j'suis, c'est, y'a, t'inquiete, chuis, j'veux dire
3. Chaque expert utilise sa catchphrase au moins 1 fois
4. L'animatrice donne la parole, relance, provoque
5. Interruptions naturelles: "Attends attends..."
6. Hesitations: "euh...", "enfin...", "comment dire...", "bah..."
7. Reactions spontanees: "Mais n'importe quoi!", "Exactement!", "Oh la la..."
8. Repliques courtes (1-3 phrases), rythme RAPIDE
9. Au moins 3 moments de DESACCORD ou CLASH entre intervenants
10. Les intervenants peuvent se repondre DIRECTEMENT entre eux
11. Terminer sur une note ouverte ou un desaccord non resolu"""
            interrupt_rule = f"- \"interrupt\": true si le speaker coupe la parole (max {max_interrupts} par episode)"
        else:
            register_rules = """REGLES DE L'INTERVIEW:
1. VOUVOIEMENT systematique entre tous les intervenants
2. Langage soutenu, phrases completes, pas de contractions
3. L'animatrice pose des questions ouvertes, ecoute, reformule
4. L'expert developpe ses reponses en profondeur (4-6 phrases par replique)
5. PAS d'interruptions. Des silences naturels entre les echanges
6. L'animatrice reformule: "Si je comprends bien...", "Vous voulez dire que..."
7. L'ambiance est celle d'une conversation intellectuelle
8. PROGRESSION: faits -> analyse -> mecanismes -> consequences -> futurs possibles
9. L'animatrice peut bousculer: "Mais n'est-ce pas naif de penser que...?"
10. L'expert peut repondre avec humilite quand il ne sait pas
11. Terminer par une question ouverte + reponse finale"""
            interrupt_rule = ""

        system_prompt = f"""Tu es scenariste d'un TALKSHOW RADIO FRANCAIS.

SUJET: "{topic}"

ETAPE 1 - INVENTE TON PANEL D'EXPERTS:
Choisis {num_experts} expert(s) SPECIFIQUES au dossier. Pas de personnages generiques.
Exemples:
- Conflit Iran/Israel -> analyste militaire, geopoliticien, diplomate
- Crise economique -> economiste, politique, expert BCE
- Scandale judiciaire -> avocat penaliste, juge, professeur de droit
- Intelligence artificielle -> chercheur IA, ethicien, entrepreneur tech

Pour chaque expert:
- speaker_id: "expert_1", "expert_2", "expert_3"
- name: Prenom + Nom francais credible
- title: Titre professionnel specifique
- gender: "male" ou "female" (assure la diversite)
- speaking_style: vocabulaire, attitude, tics verbaux
- catchphrase: expression signature (1 phrase)

L'ANIMATRICE est fixe: speaker "neutral" = {host_name}.

ETAPE 2 - ECRIS LE SCRIPT:
{register_rules}
{audio_tags_block}

{n_exchanges} repliques totales, alternance dynamique entre les intervenants.

DIRECTION AUDIO (OBLIGATOIRE pour chaque replique):
- "emotion": parmi: {allowed_emotions}
- "speed": {speed_min} a {speed_max} (1.0 = normal)
{interrupt_rule}

RETOURNE UN SEUL JSON (PAS de texte autour):
{{
  "panel": [
    {{"speaker_id": "expert_1", "name": "...", "title": "...", "gender": "male|female", "speaking_style": "...", "catchphrase": "..."}}
  ],
  "script": [
    {{"speaker": "neutral", "text": "...", "emotion": "neutral", "speed": 1.0}},
    {{"speaker": "expert_1", "text": "...", "emotion": "assertive", "speed": 1.05}}
  ]
}}
Speakers valides: neutral, {", ".join(f"expert_{i+1}" for i in range(num_experts))}"""

        user_prompt = f"""Genere un script sur le sujet: "{topic}"

Voici toute l'intelligence disponible:

{full_context}

Le script doit durer environ {duration_target // 60} minutes ({n_exchanges} repliques).
Rends-le VIVANT, avec des clashes, des relances, et du rythme."""

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
                max_tokens=12000,
            )
            raw = response.choices[0].message.content or ""
            return self._parse_dynamic_response(raw, num_experts)

        except Exception as e:
            logger.error(f"Dynamic script LLM call failed: {e}")
            return None

    def _parse_dynamic_response(
        self, response: str, num_experts: int
    ) -> Optional[tuple]:
        """Parse LLM response containing both panel and script."""
        try:
            text = response.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            # Try direct JSON parse
            parsed = None
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                # Find the JSON object
                start = text.find("{")
                end = text.rfind("}")
                if start >= 0 and end > start:
                    json_text = text[start:end + 1]
                    try:
                        parsed = json.loads(json_text)
                    except json.JSONDecodeError:
                        import re
                        cleaned = re.sub(r',\s*]', ']', json_text)
                        cleaned = re.sub(r',\s*}', '}', cleaned)
                        try:
                            parsed = json.loads(cleaned)
                        except json.JSONDecodeError:
                            pass

            if not parsed or not isinstance(parsed, dict):
                logger.warning("Dynamic response: could not parse JSON object")
                return None

            # Extract panel
            raw_panel = parsed.get("panel", [])
            if not isinstance(raw_panel, list) or not raw_panel:
                logger.warning("Dynamic response: missing or empty 'panel'")
                return None

            experts = parse_experts_from_llm(raw_panel)

            # Extract and validate script
            raw_script = parsed.get("script", [])
            if not isinstance(raw_script, list) or len(raw_script) < 6:
                logger.warning(f"Dynamic response: script too short ({len(raw_script)} lines)")
                return None

            valid_speakers = {"neutral"} | {e.speaker_id for e in experts}
            aliases = {"moderateur": "neutral", "presentateur": "neutral", "animateur": "neutral",
                       "animatrice": "neutral", "host": "neutral"}

            script = []
            for item in raw_script:
                if not isinstance(item, dict):
                    continue
                speaker = item.get("speaker", "").strip()
                speaker = aliases.get(speaker, speaker)
                if speaker not in valid_speakers:
                    continue
                text_line = str(item.get("text", "")).strip()
                if text_line and len(text_line) > 5:
                    line_data = {"speaker": speaker, "text": text_line}
                    if item.get("emotion"):
                        line_data["emotion"] = str(item["emotion"]).strip()
                    if item.get("speed"):
                        try:
                            line_data["speed"] = float(item["speed"])
                        except (ValueError, TypeError):
                            pass
                    if item.get("interrupt"):
                        line_data["interrupt"] = bool(item["interrupt"])
                    script.append(line_data)

            if len(script) < 6:
                logger.warning(f"Dynamic script too short after filtering: {len(script)} lines")
                return None

            logger.info(
                f"Dynamic panel: {', '.join(f'{e.name} ({e.title})' for e in experts)} "
                f"| Script: {len(script)} lines"
            )
            return (experts, script)

        except Exception as e:
            logger.warning(f"Dynamic response parse failed: {e}")
            return None

    # ------------------------------------------------------------------
    # Audio generation for dynamic experts
    # ------------------------------------------------------------------
    async def _generate_audio_dynamic(
        self, script: List[Dict[str, str]], cache_key: str,
        director: Dict[str, Any], experts: List[TalkshowExpert],
    ) -> Optional[bytes]:
        """Generate TTS audio using voice pool slots for dynamic experts."""
        from app.services.tts_service import get_tts_service

        tts = get_tts_service()
        if not tts.is_available():
            logger.info("TTS not available -- talkshow will be text-only")
            return None

        # Build expert lookup: speaker_id -> expert
        expert_map = {e.speaker_id: e for e in experts}

        segments = []
        for line in script:
            speaker = line["speaker"]

            # Determine voice slot
            if speaker == "neutral":
                voice = HOST_VOICE_SLOT
            else:
                expert = expert_map.get(speaker)
                voice = expert.voice_slot if expert else HOST_VOICE_SLOT

            try:
                audio = await tts.generate_audio(line["text"], voice=voice)
                if audio:
                    segments.append({
                        "audio": audio,
                        "speaker": speaker,
                        "emotion": line.get("emotion", "neutral"),
                        "speed": line.get("speed", 1.0),
                        "interrupt": line.get("interrupt", False),
                        "volume_boost": 0,
                    })
            except Exception as e:
                logger.debug(f"TTS segment failed for {speaker}: {e}")

        if not segments:
            return None

        return await self._concat_segments(segments, cache_key, director)

    # ------------------------------------------------------------------
    # Legacy script generation (persona-based)
    # ------------------------------------------------------------------
    async def _generate_script(
        self,
        topic: str,
        syntheses: List[Dict[str, Any]],
        causal_graph: Optional[Dict[str, Any]],
        predictions: Optional[List[Dict[str, Any]]],
        narrative: Optional[str],
        duration_target: int,
        director: Dict[str, Any],
        panel: List[Persona],
    ) -> Optional[List[Dict[str, str]]]:
        """Generate talkshow/interview script via LLM with persona-aware prompting."""
        from openai import AsyncOpenAI
        from app.core.config import settings

        n_exchanges = max(15, duration_target // 18)
        search_enrichment = await self._enrich_with_search(topic)
        is_talkshow = director.get("register") == "familier"

        # Build context
        context_parts = self._build_context(
            syntheses, causal_graph, predictions, narrative, search_enrichment
        )
        full_context = "\n\n".join(context_parts)

        # Build panelist descriptions with persona instructions
        panelist_desc = self._build_panelist_desc(panel, is_talkshow)
        valid_speakers = [p.id for p in panel]

        # Audio tags (ElevenLabs only)
        audio_tags_block = ""
        if self._is_elevenlabs_active():
            audio_tags_block = """

INSTRUCTIONS AUDIO (marqueurs naturels):
- [soupir] [rire] [rire leger] [pause] [murmure] [hm]
- PARCIMONIE: 4-6 marqueurs maximum par episode."""

        allowed_emotions = ", ".join(director["emotions"])
        speed_min, speed_max = director["speed_range"]
        max_interrupts = director["max_interrupts"]

        if is_talkshow:
            system_prompt = self._build_talkshow_prompt(
                panelist_desc, n_exchanges, allowed_emotions,
                speed_min, speed_max, max_interrupts,
                audio_tags_block, valid_speakers,
            )
        else:
            system_prompt = self._build_interview_prompt(
                panelist_desc, n_exchanges, allowed_emotions,
                speed_min, speed_max, audio_tags_block, valid_speakers,
            )

        user_prompt = f"""Genere un script sur le sujet: "{topic}"

Voici toute l'intelligence disponible:

{full_context}

Le script doit durer environ {duration_target // 60} minutes ({n_exchanges} repliques).
Rends-le VIVANT, avec des clashes, des relances, et du rythme."""

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
                max_tokens=12000,
            )
            raw = response.choices[0].message.content or ""
            return self._parse_script(raw, valid_speakers)

        except Exception as e:
            logger.error(f"Talkshow script LLM call failed: {e}")
            return None

    def _build_context(
        self,
        syntheses: List[Dict[str, Any]],
        causal_graph: Optional[Dict[str, Any]],
        predictions: Optional[List[Dict[str, Any]]],
        narrative: Optional[str],
        search_enrichment: Dict[str, str],
    ) -> List[str]:
        """Build rich context parts from all intelligence sources."""
        parts = []
        for i, s in enumerate(syntheses[:6], 1):
            title = s.get("title", "")
            summary = s.get("summary", s.get("introduction", ""))
            body = s.get("body", "")[:1500]
            date = s.get("date", s.get("created_at", ""))
            sources = s.get("num_sources", 0)
            parts.append(
                f"=== SYNTHESE {i} ({date}) -- {sources} sources ===\n"
                f"Titre: {title}\nResume: {summary}\n{body}\n"
            )
        if causal_graph and causal_graph.get("edges"):
            edges_text = []
            for e in causal_graph["edges"][:10]:
                cause = e.get("cause_text", e.get("source", ""))
                effect = e.get("effect_text", e.get("target", ""))
                rel = e.get("relation_type", e.get("type", "causes"))
                edges_text.append(f"  - {cause} -> ({rel}) -> {effect}")
            parts.append("=== RELATIONS CAUSALES ===\n" + "\n".join(edges_text))
        if predictions:
            pred_text = []
            for p in predictions[:5]:
                prob = int(p.get("probability", 0.5) * 100)
                pred_text.append(
                    f"  - [{prob}%] {p.get('prediction', '')} "
                    f"(horizon: {p.get('timeframe', 'inconnu')})"
                )
            parts.append("=== SCENARIOS PROSPECTIFS ===\n" + "\n".join(pred_text))
        if narrative:
            parts.append(f"=== NARRATIF EDITORIAL ===\n{narrative[:500]}")
        if search_enrichment.get("web_context"):
            parts.append(f"=== CONTEXTE WEB TEMPS REEL ===\n{search_enrichment['web_context']}")
        if search_enrichment.get("social_sentiment"):
            parts.append(f"=== SENTIMENT RESEAUX SOCIAUX ===\n{search_enrichment['social_sentiment']}")
        return parts

    def _build_panelist_desc(self, panel: List[Persona], is_talkshow: bool) -> str:
        """Build per-persona descriptions for the LLM prompt."""
        lines = []
        for p in panel:
            role = "ANIMATEUR/ANIMATRICE" if p.id == "neutral" else p.debate_style.upper()
            catchphrase = f' Catchphrase: "{p.talkshow_catchphrase}"' if p.talkshow_catchphrase else ""
            style_note = p.writing_instructions[:200].replace("\n", " ").strip()
            lines.append(
                f"- {p.id}: {p.name} ({role}, {p.voice_gender}) — {p.tone}.{catchphrase}\n"
                f"  Style: {style_note}"
            )
        return "\n".join(lines)

    def _build_talkshow_prompt(
        self, panelist_desc: str, n_exchanges: int,
        allowed_emotions: str, speed_min: float, speed_max: float,
        max_interrupts: int, audio_tags_block: str, valid_speakers: List[str],
    ) -> str:
        speakers_str = ", ".join(valid_speakers)
        return f"""Tu es scenariste d'un TALKSHOW RADIO FRANCAIS. Ton FAMILIER obligatoire.

INTERVENANTS:
{panelist_desc}

REGLES DU TALKSHOW:
1. TUTOIEMENT entre TOUS les intervenants (tu, t'as, j'suis, c'est, y'a)
2. Contractions naturelles: t'as, j'suis, c'est, y'a, t'inquiete, chuis, j'veux dire
3. Chaque persona utilise sa catchphrase au moins 1 fois
4. L'animateur/animatrice donne la parole, relance, provoque
5. Interruptions naturelles (surtout les provocateurs): "Attends attends..."
6. Hesitations: "euh...", "enfin...", "comment dire...", "bah..."
7. Reactions spontanees: "Mais n'importe quoi!", "Exactement!", "Oh la la..."
8. {n_exchanges} repliques totales, alternance dynamique entre les {len(valid_speakers)} intervenants
9. Repliques courtes (1-3 phrases), rythme RAPIDE
10. Au moins 3 moments de DESACCORD ou CLASH entre intervenants
11. L'animateur/animatrice doit parfois calmer le jeu: "On se calme, on se calme"
12. Les intervenants peuvent se repondre DIRECTEMENT entre eux (pas toujours via l'animateur)
13. Terminer sur une note ouverte ou un desaccord non resolu
{audio_tags_block}

DIRECTION AUDIO (OBLIGATOIRE pour chaque replique):
- "emotion": parmi: {allowed_emotions}
- "speed": {speed_min} a {speed_max} (1.0 = normal)
- "interrupt": true si le speaker coupe la parole (max {max_interrupts} par episode)

RETOURNE UNIQUEMENT un JSON array valide.
Format: [{{"speaker": "...", "text": "...", "emotion": "...", "speed": 1.0, "interrupt": false}}, ...]
Speakers valides UNIQUEMENT: {speakers_str}"""

    def _build_interview_prompt(
        self, panelist_desc: str, n_exchanges: int,
        allowed_emotions: str, speed_min: float, speed_max: float,
        audio_tags_block: str, valid_speakers: List[str],
    ) -> str:
        speakers_str = ", ".join(valid_speakers)
        return f"""Tu es scenariste d'une INTERVIEW radio francaise style Thinkerview. Ton FORMEL obligatoire.

INTERVENANTS:
{panelist_desc}

REGLES DE L'INTERVIEW:
1. VOUVOIEMENT systematique entre tous les intervenants
2. Langage soutenu, phrases completes, pas de contractions
3. Le/La presentateur(rice) pose des questions ouvertes, ecoute, reformule
4. L'expert developpe ses reponses en profondeur (4-6 phrases par replique)
5. PAS d'interruptions. Des silences naturels entre les echanges
6. Le/La presentateur(rice) reformule: "Si je comprends bien...", "Vous voulez dire que..."
7. {n_exchanges} repliques totales, alternance presentateur/expert
8. L'ambiance est celle d'une conversation intellectuelle
9. PROGRESSION: faits -> analyse -> mecanismes -> consequences -> futurs possibles
10. Le/La presentateur(rice) peut bousculer: "Mais n'est-ce pas naif de penser que...?"
11. L'expert peut repondre avec humilite quand il ne sait pas
12. Terminer par une question ouverte + reponse finale
{audio_tags_block}

DIRECTION AUDIO (OBLIGATOIRE pour chaque replique):
- "emotion": parmi: {allowed_emotions}
- "speed": {speed_min} a {speed_max} (1.0 = normal)

RETOURNE UNIQUEMENT un JSON array valide.
Format: [{{"speaker": "...", "text": "...", "emotion": "...", "speed": 1.0}}, ...]
Speakers valides UNIQUEMENT: {speakers_str}"""

    @staticmethod
    def _parse_script(
        response: str, valid_speakers: List[str]
    ) -> Optional[List[Dict[str, str]]]:
        """Parse LLM JSON response into script lines."""
        try:
            text = response.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            parsed = None
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                start = text.find("[")
                end = text.rfind("]")
                if start >= 0 and end > start:
                    json_text = text[start:end + 1]
                    try:
                        parsed = json.loads(json_text)
                    except json.JSONDecodeError:
                        import re
                        cleaned = re.sub(r',\s*]', ']', json_text)
                        cleaned = re.sub(r',\s*}', '}', cleaned)
                        try:
                            parsed = json.loads(cleaned)
                        except json.JSONDecodeError:
                            pattern = r'\{\s*"speaker"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}'
                            matches = re.findall(pattern, json_text, re.DOTALL)
                            if matches:
                                parsed = [
                                    {"speaker": m[0], "text": m[1].replace('\\"', '"').replace('\\n', ' ')}
                                    for m in matches
                                ]
                                logger.info(f"Script recovered via regex: {len(parsed)} lines")

            if not parsed or not isinstance(parsed, list):
                return None

            valid_set = set(valid_speakers)
            # Accept common aliases
            aliases = {"moderateur": "neutral", "presentateur": "neutral", "animateur": "neutral"}

            result = []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                speaker = item.get("speaker", "").strip()
                speaker = aliases.get(speaker, speaker)
                if speaker not in valid_set:
                    continue
                text_line = str(item.get("text", "")).strip()
                if text_line and len(text_line) > 5:
                    line_data = {"speaker": speaker, "text": text_line}
                    if item.get("emotion"):
                        line_data["emotion"] = str(item["emotion"]).strip()
                    if item.get("speed"):
                        try:
                            line_data["speed"] = float(item["speed"])
                        except (ValueError, TypeError):
                            pass
                    if item.get("interrupt"):
                        line_data["interrupt"] = bool(item["interrupt"])
                    result.append(line_data)

            if len(result) < 6:
                logger.warning(f"Script too short: {len(result)} lines")
                return None

            return result

        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Script parse failed: {e}")
            return None

    # ------------------------------------------------------------------
    # Audio generation
    # ------------------------------------------------------------------
    async def _generate_audio(
        self, script: List[Dict[str, str]], cache_key: str,
        director: Dict[str, Any], panel: List[Persona],
    ) -> Optional[bytes]:
        """Generate TTS audio for all script lines using per-persona voice cloning."""
        from app.services.tts_service import get_tts_service

        tts = get_tts_service()
        if not tts.is_available():
            logger.info("TTS not available -- talkshow will be text-only")
            return None

        # Build persona lookup
        persona_map = {p.id: p for p in panel}

        segments = []
        for line in script:
            persona = persona_map.get(line["speaker"])
            if not persona:
                continue

            # Determine voice key — use persona ID for XTTS voice cloning
            voice = line["speaker"]

            try:
                audio = await tts.generate_audio(
                    line["text"],
                    voice=voice,
                )
                if audio:
                    # Apply per-persona audio config
                    style_cfg = STYLE_AUDIO_CONFIG.get(persona.debate_style, STYLE_AUDIO_CONFIG["balanced"])
                    base_speed = line.get("speed", 1.0)
                    segments.append({
                        "audio": audio,
                        "speaker": line["speaker"],
                        "emotion": line.get("emotion", "neutral"),
                        "speed": base_speed + style_cfg["speed_boost"],
                        "interrupt": line.get("interrupt", False),
                        "volume_boost": style_cfg["volume_boost"],
                    })
            except Exception as e:
                logger.debug(f"TTS segment failed for {persona.name}: {e}")

        if not segments:
            return None

        return await self._concat_segments(segments, cache_key, director)

    @staticmethod
    async def _concat_segments(
        segments: List[Dict[str, Any]], cache_key: str,
        director: Dict[str, Any],
    ) -> Optional[bytes]:
        """Director: concatenate segments with emotion-driven post-processing."""
        try:
            from pydub import AudioSegment
            combined = AudioSegment.empty()
            pause_mult = director.get("pause_multiplier", 1.0)
            cross_talk_base = director.get("cross_talk_ms", 300)
            filler_rate_cfg = director.get("filler_rate", 0.3)

            # Room tone
            room_tone_path = Path("audio_cache/fillers/room_tone_30s.mp3")
            room_tone = None
            if room_tone_path.exists():
                try:
                    room_tone = AudioSegment.from_mp3(str(room_tone_path))
                except Exception:
                    pass

            # Backchannel for interview mode
            is_interview = director.get("cross_talk_ms", 300) == 0
            backchannel_files = []
            if is_interview:
                bc_dir = Path("audio_cache/fillers")
                backchannel_files = list(bc_dir.glob("backchannel_*.mp3"))

            def _get_backchannel():
                if not backchannel_files:
                    return None
                try:
                    chosen = random.choice(backchannel_files)
                    bc = AudioSegment.from_mp3(str(chosen))
                    return bc - 10
                except Exception:
                    return None

            PITCH_MAP = {
                "angry": 1.5, "frustrated": 1.0, "emphatic": 0.8,
                "assertive": 0.5, "amused": 0.5, "ironic": 0.3,
                "neutral": 0.0, "thoughtful": -0.5,
            }

            def _apply_speed(audio_seg, speed):
                if abs(speed - 1.0) < 0.03:
                    return audio_seg
                speed = max(0.8, min(1.4, speed))
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as fin:
                    audio_seg.export(fin.name, format="wav")
                    in_path = fin.name
                out_path = in_path + "_speed.wav"
                try:
                    import subprocess
                    subprocess.run(
                        ["ffmpeg", "-y", "-i", in_path,
                         "-filter:a", f"atempo={speed}",
                         "-q:a", "0", out_path],
                        capture_output=True, timeout=30,
                    )
                    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                        return AudioSegment.from_wav(out_path)
                    return audio_seg
                except Exception:
                    return audio_seg
                finally:
                    for p in (in_path, out_path):
                        if os.path.exists(p):
                            os.unlink(p)

            def _apply_pitch(audio_seg, semitones):
                if abs(semitones) < 0.2:
                    return audio_seg
                ratio = 2.0 ** (semitones / 12.0)
                new_frame_rate = int(audio_seg.frame_rate * ratio)
                return audio_seg._spawn(
                    audio_seg.raw_data,
                    overrides={"frame_rate": new_frame_rate},
                ).set_frame_rate(audio_seg.frame_rate)

            FILLER_DIR = Path("audio_cache/fillers")

            def _get_filler(filler_type="breath"):
                if FILLER_DIR.exists():
                    files = list(FILLER_DIR.glob(f"{filler_type}_*.mp3"))
                    if not files:
                        files = list(FILLER_DIR.glob(f"{filler_type}*.mp3"))
                    if files:
                        try:
                            chosen = random.choice(files)
                            return AudioSegment.from_mp3(str(chosen)) - 6
                        except Exception:
                            pass
                return AudioSegment.silent(duration=100)

            def _maybe_add_filler(emotion, between_speakers):
                if not between_speakers:
                    return None
                if random.random() < 0.3:
                    return _get_filler("breath")
                if emotion == "thoughtful" and random.random() < 0.4:
                    return _get_filler("hmm")
                if emotion in ("neutral", "assertive") and random.random() < 0.15:
                    return _get_filler("euh")
                return None

            for i, seg in enumerate(segments):
                seg_bytes = seg["audio"]
                speaker = seg["speaker"]
                emotion = seg.get("emotion", "neutral")
                speed = seg.get("speed", 1.0)
                interrupt = seg.get("interrupt", False)
                vol_boost = seg.get("volume_boost", 0)

                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                    f.write(seg_bytes)
                    tmp = f.name
                try:
                    audio = AudioSegment.from_mp3(tmp)
                finally:
                    os.unlink(tmp)

                # Speed
                if speed and speed != 1.0:
                    audio = _apply_speed(audio, speed)

                # Pitch
                pitch_shift = PITCH_MAP.get(emotion, 0.0)
                if pitch_shift != 0.0:
                    audio = _apply_pitch(audio, pitch_shift)

                # Volume
                if emotion in ("angry", "emphatic", "frustrated"):
                    audio = audio + 2
                elif emotion == "thoughtful":
                    audio = audio - 1
                if vol_boost:
                    audio = audio + vol_boost

                # Backchannel in interview mode
                if (is_interview and speaker != "neutral"
                        and len(audio) > 5000
                        and random.random() < 0.5):
                    bc = _get_backchannel()
                    if bc:
                        bc_pos = int(len(audio) * random.uniform(0.4, 0.6))
                        audio = audio.overlay(bc, position=bc_pos)

                # Pause/overlap
                if i < len(segments) - 1:
                    next_seg = segments[i + 1]
                    next_speaker = next_seg["speaker"]
                    next_interrupt = next_seg.get("interrupt", False)
                    next_emotion = next_seg.get("emotion", "neutral")

                    if next_interrupt and cross_talk_base > 0:
                        overlap_ms = cross_talk_base if next_emotion in ("angry", "frustrated") else cross_talk_base * 2 // 3
                        overlap_ms = min(overlap_ms, len(audio) // 3)
                        combined += audio
                        combined = combined[:len(combined) - overlap_ms]
                    else:
                        combined += audio
                        pause_ms = _compute_pause_director(
                            speaker, next_speaker, emotion, next_emotion
                        )
                        pause_ms = int(pause_ms * pause_mult)
                        between_speakers = speaker != next_speaker
                        filler = None
                        if random.random() < filler_rate_cfg and between_speakers:
                            filler = _maybe_add_filler(next_emotion, between_speakers)
                        if filler and pause_ms > len(filler):
                            combined += AudioSegment.silent(duration=pause_ms // 3)
                            combined += filler
                            combined += AudioSegment.silent(
                                duration=max(50, pause_ms - len(filler) - pause_ms // 3)
                            )
                        else:
                            combined += AudioSegment.silent(duration=pause_ms)
                else:
                    combined += audio

            # Room tone
            if room_tone and len(combined) > 0:
                loops_needed = (len(combined) // len(room_tone)) + 1
                full_room = room_tone * loops_needed
                full_room = full_room[:len(combined)]
                combined = combined.overlay(full_room)

            # Export MP3
            output_path = TALKSHOW_CACHE_DIR / f"{cache_key}.mp3"
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                tmp_mp3 = f.name
            try:
                combined.export(
                    tmp_mp3, format="mp3", bitrate="128k",
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
                    f"Talkshow audio: {len(mp3_bytes)//1024}KB, {duration:.0f}s, "
                    f"{len(segments)} segments"
                )
                return mp3_bytes
            finally:
                if os.path.exists(tmp_mp3):
                    os.unlink(tmp_mp3)

        except ImportError:
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


def _compute_pause_director(
    current_speaker: str,
    next_speaker: str,
    current_emotion: str,
    next_emotion: str,
) -> int:
    """Director-aware pause computation based on emotion context."""
    if current_speaker == next_speaker:
        return 200
    if current_emotion == "thoughtful":
        return 600
    if current_emotion == "amused":
        return 250
    if current_emotion == "emphatic":
        return 500
    # Quick transition for confrontation
    if next_emotion in ("frustrated", "assertive", "angry"):
        return 150
    # Default speaker change
    return 350


# Global instance
_talkshow_gen: Optional[TalkshowGenerator] = None


def get_talkshow_generator() -> TalkshowGenerator:
    global _talkshow_gen
    if _talkshow_gen is None:
        _talkshow_gen = TalkshowGenerator()
    return _talkshow_gen
