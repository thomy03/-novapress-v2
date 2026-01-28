"""
What-If Scenario Engine for NovaPress AI
Generates counterfactual scenarios based on causal graph analysis.
Allows users to explore "what if X didn't happen?" questions.
"""

import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from loguru import logger


@dataclass
class Scenario:
    """A counterfactual scenario"""
    id: str
    hypothesis: str  # "What if X didn't happen?"
    original_event: str
    counterfactual_outcome: str
    affected_events: List[str]
    confidence: float
    reasoning: str
    probability: float  # Estimated probability this could have happened

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "hypothesis": self.hypothesis,
            "original_event": self.original_event,
            "counterfactual_outcome": self.counterfactual_outcome,
            "affected_events": self.affected_events,
            "confidence": round(self.confidence, 2),
            "reasoning": self.reasoning,
            "probability": round(self.probability, 2)
        }


@dataclass
class WhatIfAnalysis:
    """Complete what-if analysis for a synthesis"""
    synthesis_id: str
    title: str
    key_events: List[Dict[str, Any]]
    scenarios: List[Scenario]
    causal_dependencies: List[Dict[str, Any]]
    methodology_note: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "synthesis_id": self.synthesis_id,
            "title": self.title,
            "key_events": self.key_events,
            "scenarios": [s.to_dict() for s in self.scenarios],
            "causal_dependencies": self.causal_dependencies,
            "total_scenarios": len(self.scenarios),
            "methodology_note": self.methodology_note
        }


class WhatIfEngine:
    """Generates counterfactual scenarios from causal graphs"""

    # Event importance indicators
    IMPORTANCE_PATTERNS = [
        (r'(décision|vote|accord|traité|loi)', 1.0),
        (r'(annonce|déclaration|conférence)', 0.8),
        (r'(réunion|rencontre|sommet)', 0.7),
        (r'(manifestation|protestation|grève)', 0.9),
        (r'(élection|nomination|démission)', 1.0),
        (r'(crise|conflit|guerre)', 1.0),
        (r'(découverte|innovation|invention)', 0.8),
    ]

    # Counterfactual templates
    COUNTERFACTUAL_TEMPLATES = {
        "negation": "Si {event} n'avait pas eu lieu",
        "delay": "Si {event} avait été retardé(e)",
        "alternative": "Si une autre décision avait été prise concernant {event}",
        "early": "Si {event} avait eu lieu plus tôt",
    }

    def __init__(self):
        self.llm_service = None  # Will be injected if available

    def analyze_whatif(
        self,
        synthesis: Dict[str, Any],
        causal_graph: Optional[Dict[str, Any]] = None,
        max_scenarios: int = 5
    ) -> WhatIfAnalysis:
        """
        Generate what-if scenarios for a synthesis.

        Args:
            synthesis: Synthesis dict with body, keyPoints, causal_graph
            causal_graph: Optional pre-fetched causal graph
            max_scenarios: Maximum scenarios to generate

        Returns:
            WhatIfAnalysis with counterfactual scenarios
        """
        synthesis_id = synthesis.get("id", "unknown")
        title = synthesis.get("title", "")

        # Get causal data
        graph = causal_graph or synthesis.get("causal_graph", {})
        causal_chain = synthesis.get("causal_chain", [])

        # Extract key events
        key_events = self._extract_key_events(synthesis, graph, causal_chain)

        if not key_events:
            return self._empty_result(synthesis_id, title)

        # Build causal dependencies
        dependencies = self._build_dependencies(key_events, graph, causal_chain)

        # Generate scenarios
        scenarios = self._generate_scenarios(key_events, dependencies, max_scenarios)

        return WhatIfAnalysis(
            synthesis_id=synthesis_id,
            title=title,
            key_events=key_events,
            scenarios=scenarios,
            causal_dependencies=dependencies,
            methodology_note=(
                "Scénarios générés automatiquement à partir de l'analyse causale. "
                "Ces hypothèses sont spéculatives et visent à stimuler la réflexion."
            )
        )

    def _extract_key_events(
        self,
        synthesis: Dict[str, Any],
        graph: Dict[str, Any],
        causal_chain: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Extract key events from synthesis and causal data"""
        events = []
        seen_events = set()

        # From causal graph nodes
        nodes = graph.get("nodes", [])
        for node in nodes:
            label = node.get("label", "")
            if label and label not in seen_events:
                importance = self._calculate_importance(label)
                if importance >= 0.5:
                    events.append({
                        "id": node.get("id", f"event_{len(events)}"),
                        "text": label,
                        "type": node.get("type", "event"),
                        "importance": importance,
                        "sources_count": node.get("sources_count", 1)
                    })
                    seen_events.add(label)

        # From causal chain
        for relation in causal_chain:
            cause = relation.get("cause", "")
            effect = relation.get("effect", "")

            for event_text in [cause, effect]:
                if event_text and event_text not in seen_events:
                    importance = self._calculate_importance(event_text)
                    if importance >= 0.5:
                        events.append({
                            "id": f"event_{len(events)}",
                            "text": event_text,
                            "type": "causal",
                            "importance": importance,
                            "sources_count": len(relation.get("sources", []))
                        })
                        seen_events.add(event_text)

        # From key points
        key_points = synthesis.get("keyPoints", synthesis.get("key_points", []))
        if isinstance(key_points, list):
            for idx, point in enumerate(key_points[:5]):
                if isinstance(point, str) and point not in seen_events:
                    importance = self._calculate_importance(point)
                    if importance >= 0.6:
                        events.append({
                            "id": f"kp_{idx}",
                            "text": point[:150],
                            "type": "key_point",
                            "importance": importance,
                            "sources_count": 1
                        })
                        seen_events.add(point)

        # Sort by importance
        events.sort(key=lambda x: x["importance"], reverse=True)

        return events[:10]  # Max 10 key events

    def _calculate_importance(self, text: str) -> float:
        """Calculate importance score for an event"""
        text_lower = text.lower()
        max_score = 0.3  # Base score

        for pattern, score in self.IMPORTANCE_PATTERNS:
            if re.search(pattern, text_lower):
                max_score = max(max_score, score)

        # Boost for longer, more detailed events
        if len(text) > 100:
            max_score = min(max_score + 0.1, 1.0)

        return max_score

    def _build_dependencies(
        self,
        events: List[Dict],
        graph: Dict[str, Any],
        causal_chain: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Build causal dependency map"""
        dependencies = []

        # From graph edges
        edges = graph.get("edges", [])
        for edge in edges:
            source = edge.get("source", "")
            target = edge.get("target", "")
            dependencies.append({
                "cause": source,
                "effect": target,
                "type": edge.get("type", "causes"),
                "confidence": edge.get("confidence", 0.7)
            })

        # From causal chain
        for relation in causal_chain:
            dep = {
                "cause": relation.get("cause", ""),
                "effect": relation.get("effect", ""),
                "type": relation.get("type", "causes"),
                "confidence": relation.get("confidence", 0.7)
            }
            # Avoid duplicates
            if not any(d["cause"] == dep["cause"] and d["effect"] == dep["effect"] for d in dependencies):
                dependencies.append(dep)

        return dependencies

    def _generate_scenarios(
        self,
        events: List[Dict],
        dependencies: List[Dict],
        max_scenarios: int
    ) -> List[Scenario]:
        """Generate counterfactual scenarios"""
        scenarios = []

        # Build effect map: what events are affected by each cause
        effect_map: Dict[str, List[str]] = {}
        for dep in dependencies:
            cause = dep.get("cause", "")
            effect = dep.get("effect", "")
            if cause:
                if cause not in effect_map:
                    effect_map[cause] = []
                if effect and effect not in effect_map[cause]:
                    effect_map[cause].append(effect)

        # Generate scenarios for most important events
        for event in events[:max_scenarios]:
            event_text = event.get("text", "")
            event_id = event.get("id", "")
            importance = event.get("importance", 0.5)

            # Find affected events
            affected = effect_map.get(event_text, [])

            # Also check partial matches
            for cause, effects in effect_map.items():
                if cause != event_text and (
                    cause.lower() in event_text.lower() or
                    event_text.lower() in cause.lower()
                ):
                    for eff in effects:
                        if eff not in affected:
                            affected.append(eff)

            # Generate counterfactual outcome
            outcome, reasoning = self._generate_counterfactual(event_text, affected, dependencies)

            # Calculate probability (how likely alternative was)
            probability = self._estimate_probability(event, dependencies)

            scenario = Scenario(
                id=f"scenario_{event_id}",
                hypothesis=f"Et si \"{event_text[:80]}{'...' if len(event_text) > 80 else ''}\" n'avait pas eu lieu ?",
                original_event=event_text,
                counterfactual_outcome=outcome,
                affected_events=affected[:5],
                confidence=importance,
                reasoning=reasoning,
                probability=probability
            )
            scenarios.append(scenario)

        return scenarios

    def _generate_counterfactual(
        self,
        event: str,
        affected: List[str],
        dependencies: List[Dict]
    ) -> tuple[str, str]:
        """Generate counterfactual outcome and reasoning"""

        if not affected:
            # No clear downstream effects
            outcome = (
                f"Sans cet événement, la situation aurait pu évoluer différemment, "
                f"mais les conséquences exactes restent difficiles à déterminer."
            )
            reasoning = (
                "Aucune relation causale directe n'a été identifiée dans les sources analysées."
            )
        elif len(affected) == 1:
            outcome = f"L'événement suivant aurait probablement été différent : {affected[0][:100]}"
            reasoning = "Une relation causale directe a été identifiée entre ces deux événements."
        else:
            affected_summary = ", ".join([a[:50] for a in affected[:3]])
            outcome = (
                f"Plusieurs événements auraient été impactés : {affected_summary}"
                f"{'...' if len(affected) > 3 else ''}"
            )
            reasoning = f"L'analyse causale révèle {len(affected)} événements dépendants de celui-ci."

        return outcome, reasoning

    def _estimate_probability(
        self,
        event: Dict,
        dependencies: List[Dict]
    ) -> float:
        """Estimate probability that alternative scenario could have happened"""
        base_prob = 0.5

        # Events with many sources are more "certain" - alternatives less likely
        sources_count = event.get("sources_count", 1)
        if sources_count > 3:
            base_prob -= 0.1 * min(sources_count - 3, 3)

        # High importance events are often pivotal - alternatives possible
        importance = event.get("importance", 0.5)
        if importance > 0.8:
            base_prob += 0.1

        # Clamp to valid range
        return max(0.1, min(0.9, base_prob))

    def generate_single_scenario(
        self,
        synthesis: Dict[str, Any],
        event_id: str,
        scenario_type: str = "negation"
    ) -> Optional[Scenario]:
        """Generate a single scenario for a specific event"""
        analysis = self.analyze_whatif(synthesis, max_scenarios=10)

        # Find the event
        target_event = None
        for event in analysis.key_events:
            if event.get("id") == event_id:
                target_event = event
                break

        if not target_event:
            return None

        # Find existing scenario or generate new
        for scenario in analysis.scenarios:
            if scenario.original_event == target_event.get("text"):
                return scenario

        return None

    def _empty_result(self, synthesis_id: str, title: str) -> WhatIfAnalysis:
        """Return empty result when no scenarios can be generated"""
        return WhatIfAnalysis(
            synthesis_id=synthesis_id,
            title=title,
            key_events=[],
            scenarios=[],
            causal_dependencies=[],
            methodology_note=(
                "Impossible de générer des scénarios alternatifs. "
                "L'analyse causale n'a pas identifié suffisamment d'événements clés."
            )
        )


# Global instance
_whatif_engine: Optional[WhatIfEngine] = None


def get_whatif_engine() -> WhatIfEngine:
    """Get or create the global what-if engine instance"""
    global _whatif_engine
    if _whatif_engine is None:
        _whatif_engine = WhatIfEngine()
    return _whatif_engine


def analyze_whatif(synthesis: Dict[str, Any], causal_graph: Optional[Dict] = None) -> Dict[str, Any]:
    """Convenience function to analyze what-if scenarios"""
    engine = get_whatif_engine()
    result = engine.analyze_whatif(synthesis, causal_graph)
    return result.to_dict()
