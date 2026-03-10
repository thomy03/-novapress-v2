"""
NovaPress Talkshow Panel Selector
Automatically selects the best panel of personas for a talkshow topic.
"""
from typing import List, Optional
from loguru import logger

from app.ml.persona import (
    Persona, PERSONAS, PersonaType,
    CATEGORY_COMPATIBLE_PERSONAS, KEYWORD_PERSONA_TRIGGERS,
)


# Debate style contrast map — pairs that create interesting clashes
CONTRAST_PAIRS = {
    "provocateur": ["analytique", "pedagogique"],
    "analytique": ["provocateur", "narratif"],
    "narratif": ["analytique", "provocateur"],
    "pedagogique": ["provocateur", "balanced"],
    "balanced": ["provocateur", "narratif"],
}


def select_panel(
    topic: str,
    category: str = "",
    num_panelists: int = 4,
    forced_personas: Optional[List[str]] = None,
) -> List[Persona]:
    """
    Select the best panel for a talkshow.

    Always includes `neutral` as host/animateur (first in list).
    Then selects up to (num_panelists - 1) personas based on:
    - Topic keyword matching
    - Category compatibility
    - Debate style diversity (at least 1 provocateur + 1 analytique)
    - Voice gender diversity (mix male/female)

    Args:
        topic: The topic to discuss
        category: Optional category (POLITIQUE, TECH, etc.)
        num_panelists: Total panel size including host (default 4)
        forced_personas: Optional list of persona IDs to force-include

    Returns:
        List of Persona objects, host first
    """
    host = PERSONAS[PersonaType.NEUTRAL]
    panel = [host]
    needed = num_panelists - 1  # host already included

    if forced_personas:
        for pid in forced_personas:
            if len(panel) >= num_panelists:
                break
            persona = PERSONAS.get(pid)
            if persona and persona.id != "neutral":
                panel.append(persona)
        needed = num_panelists - len(panel)

    if needed <= 0:
        return panel[:num_panelists]

    # Score candidates
    candidates = _score_candidates(topic, category, panel)

    # Sort by score descending, pick top N with diversity constraints
    candidates.sort(key=lambda x: x[1], reverse=True)

    for persona, score in candidates:
        if len(panel) >= num_panelists:
            break
        if persona.id in {p.id for p in panel}:
            continue
        # Check diversity
        if _check_diversity(panel, persona):
            panel.append(persona)

    # If still not enough, relax constraints
    if len(panel) < num_panelists:
        for persona, score in candidates:
            if len(panel) >= num_panelists:
                break
            if persona.id not in {p.id for p in panel}:
                panel.append(persona)

    logger.info(
        f"Panel selected for '{topic}': "
        + ", ".join(f"{p.name} ({p.debate_style})" for p in panel)
    )
    return panel


def _score_candidates(
    topic: str, category: str, already_selected: List[Persona]
) -> List[tuple]:
    """Score all personas for topic relevance."""
    topic_lower = topic.lower()
    category_upper = category.upper() if category else ""
    already_ids = {p.id for p in already_selected}
    scored = []

    for persona in PERSONAS.values():
        if persona.id in already_ids or persona.id == "neutral":
            continue

        score = 0.0

        # Keyword match (strongest signal)
        for keyword, persona_type in KEYWORD_PERSONA_TRIGGERS.items():
            if keyword in topic_lower:
                if persona.id == persona_type.value if isinstance(persona_type, PersonaType) else persona.id == persona_type:
                    score += 3.0
                    break

        # Category compatibility
        if category_upper and category_upper in CATEGORY_COMPATIBLE_PERSONAS:
            compatible_ids = [
                pt.value if isinstance(pt, PersonaType) else pt
                for pt in CATEGORY_COMPATIBLE_PERSONAS[category_upper]
            ]
            if persona.id in compatible_ids:
                score += 2.0

        # Focus category match
        if category_upper and (
            "all" in persona.focus_categories
            or category_upper in persona.focus_categories
        ):
            score += 1.0

        # Prefer core/intellectual personas over controversial ones
        if persona.id in ("le_cynique", "l_optimiste", "le_conteur", "l_economiste",
                          "l_historien", "le_philosophe", "le_scientifique"):
            score += 0.5

        scored.append((persona, score))

    return scored


def _check_diversity(panel: List[Persona], candidate: Persona) -> bool:
    """Check if adding candidate maintains diversity."""
    existing_styles = [p.debate_style for p in panel if p.id != "neutral"]
    existing_genders = [p.voice_gender for p in panel if p.id != "neutral"]

    # Must have style diversity — avoid 3 of the same debate_style
    if existing_styles.count(candidate.debate_style) >= 2:
        return False

    # Encourage gender diversity — avoid all same gender
    if len(existing_genders) >= 2 and all(g == candidate.voice_gender for g in existing_genders):
        return False

    return True


def get_panel_preview(topic: str, category: str = "") -> List[dict]:
    """Get a panel preview (for API)."""
    panel = select_panel(topic, category)
    return [
        {
            "id": p.id,
            "name": p.name,
            "display_name": p.display_name,
            "role": "animateur" if p.id == "neutral" else p.debate_style,
            "voice_gender": p.voice_gender,
            "debate_style": p.debate_style,
            "catchphrase": p.talkshow_catchphrase,
        }
        for p in panel
    ]
