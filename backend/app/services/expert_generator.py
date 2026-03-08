"""
NovaPress Talkshow — Dynamic Expert Generator
LLM invents contextual experts (e.g. military analyst for Iran conflict)
instead of using hardcoded personas.
"""
from dataclasses import dataclass
from typing import List

from loguru import logger


@dataclass
class TalkshowExpert:
    """A dynamically-generated talkshow expert."""
    speaker_id: str       # "expert_1", "expert_2", "expert_3"
    name: str             # "Colonel Philippe Moreau"
    title: str            # "Analyste militaire, ancien officier DGSE"
    gender: str           # "male" | "female"
    speaking_style: str   # "Direct, vocabulaire technique"
    catchphrase: str      # "Sur le terrain, ca ne fonctionne pas comme ca"
    voice_slot: str = ""  # Assigned after creation: "voice_m1", "voice_f1", etc.


# Voice pool — extensible by adding entries
VOICE_POOL = [
    {"id": "voice_m1", "file": "expert.wav", "gender": "male"},
    {"id": "voice_f1", "file": "journaliste.wav", "gender": "female"},
    {"id": "voice_m2", "file": "contradicteur.wav", "gender": "male"},
]

# Host is always fixed
HOST_VOICE_SLOT = "host"


def assign_voices(experts: List[TalkshowExpert]) -> List[TalkshowExpert]:
    """Assign voice slots from pool by gender, round-robin.

    Separates pool by gender, assigns by index modulo pool size.
    If 3 male experts and 2 male voices -> expert 3 reuses voice_m1.
    """
    male_pool = [v for v in VOICE_POOL if v["gender"] == "male"]
    female_pool = [v for v in VOICE_POOL if v["gender"] == "female"]

    male_idx = 0
    female_idx = 0

    for expert in experts:
        if expert.gender == "female":
            if female_pool:
                expert.voice_slot = female_pool[female_idx % len(female_pool)]["id"]
                female_idx += 1
            elif male_pool:
                # No female voices left, fall back to male pool
                expert.voice_slot = male_pool[male_idx % len(male_pool)]["id"]
                male_idx += 1
        else:
            if male_pool:
                expert.voice_slot = male_pool[male_idx % len(male_pool)]["id"]
                male_idx += 1
            elif female_pool:
                expert.voice_slot = female_pool[female_idx % len(female_pool)]["id"]
                female_idx += 1

    logger.info(
        f"Voice assignment: "
        + ", ".join(f"{e.name} -> {e.voice_slot}" for e in experts)
    )
    return experts


def parse_experts_from_llm(raw: List[dict]) -> List[TalkshowExpert]:
    """Validate and parse LLM panel output into TalkshowExpert objects.

    Expects list of dicts with keys: speaker_id, name, title, gender,
    speaking_style, catchphrase.
    """
    experts = []
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        speaker_id = item.get("speaker_id", f"expert_{i + 1}")
        name = item.get("name", f"Expert {i + 1}")
        title = item.get("title", "")
        gender = item.get("gender", "male").lower()
        if gender not in ("male", "female"):
            gender = "male"
        speaking_style = item.get("speaking_style", "")
        catchphrase = item.get("catchphrase", "")

        experts.append(TalkshowExpert(
            speaker_id=speaker_id,
            name=name,
            title=title,
            gender=gender,
            speaking_style=speaking_style,
            catchphrase=catchphrase,
        ))

    if not experts:
        logger.warning("No experts parsed from LLM output, creating defaults")
        experts = [
            TalkshowExpert("expert_1", "Expert 1", "Analyste", "male", "", ""),
            TalkshowExpert("expert_2", "Expert 2", "Specialiste", "female", "", ""),
            TalkshowExpert("expert_3", "Expert 3", "Commentateur", "male", "", ""),
        ]

    return assign_voices(experts)
