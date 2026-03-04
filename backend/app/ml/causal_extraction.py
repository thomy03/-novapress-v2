"""
Causal Extraction Module for NovaPress AI
Extracts cause-effect relationships from synthesis text.
Pre-computed at pipeline time, 0 LLM calls at display.
"""
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
import re
import json
from loguru import logger


@dataclass
class CausalRelation:
    """Relation causale entre deux evenements/entites"""
    cause_text: str
    effect_text: str
    relation_type: str  # "causes", "triggers", "enables", "prevents"
    confidence: float   # 0-1, base sur fact_density
    evidence: List[str] = field(default_factory=list)  # Citations sources
    source_articles: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CausalNode:
    """Noeud dans le graphe causal (evenement ou entite)"""
    id: str
    label: str
    node_type: str  # "event", "entity", "decision"
    date: Optional[str] = None
    fact_density: float = 0.5

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CausalGraph:
    """Graphe causal complet pour une synthese"""
    nodes: List[CausalNode] = field(default_factory=list)
    edges: List[CausalRelation] = field(default_factory=list)
    central_entity: str = ""
    narrative_flow: str = "linear"  # "linear", "branching", "circular"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
            "central_entity": self.central_entity,
            "narrative_flow": self.narrative_flow
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CausalGraph":
        """Reconstruit un CausalGraph depuis un dict (stockage Qdrant)"""
        if not data:
            return cls()

        nodes = [
            CausalNode(
                id=n.get("id", ""),
                label=n.get("label", ""),
                node_type=n.get("node_type", "event"),
                date=n.get("date"),
                fact_density=n.get("fact_density", 0.5)
            )
            for n in data.get("nodes", [])
        ]

        edges = [
            CausalRelation(
                cause_text=e.get("cause_text", ""),
                effect_text=e.get("effect_text", ""),
                relation_type=e.get("relation_type", "causes"),
                confidence=e.get("confidence", 0.5),
                evidence=e.get("evidence", []),
                source_articles=e.get("source_articles", [])
            )
            for e in data.get("edges", [])
        ]

        return cls(
            nodes=nodes,
            edges=edges,
            central_entity=data.get("central_entity", ""),
            narrative_flow=data.get("narrative_flow", "linear")
        )


def validate_causal_chain(causal_chain: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Validates and filters causal chain entries.
    Each valid entry must have: cause, effect, and type.

    Args:
        causal_chain: List of causal relations from LLM

    Returns:
        List of validated causal relations (invalid ones removed)
    """
    if not causal_chain or not isinstance(causal_chain, list):
        return []

    VALID_TYPES = {"causes", "triggers", "enables", "prevents"}
    validated = []

    for i, item in enumerate(causal_chain):
        if not isinstance(item, dict):
            logger.warning(f"causal_chain[{i}]: Skipping non-dict item")
            continue

        cause = item.get("cause", "")
        effect = item.get("effect", "")
        rel_type = item.get("type", "")

        # Validate required fields
        errors = []
        if not cause or not isinstance(cause, str) or len(cause.strip()) < 3:
            errors.append("missing/invalid 'cause' (must be string >= 3 chars)")
        if not effect or not isinstance(effect, str) or len(effect.strip()) < 3:
            errors.append("missing/invalid 'effect' (must be string >= 3 chars)")
        if not rel_type or rel_type not in VALID_TYPES:
            if rel_type:
                logger.debug(f"causal_chain[{i}]: Invalid type '{rel_type}', defaulting to 'causes'")
            item["type"] = "causes"  # Default to 'causes'

        if errors:
            logger.warning(f"causal_chain[{i}]: Filtering invalid relation - {', '.join(errors)}")
            continue

        # Normalize sources field
        sources = item.get("sources", [])
        if not isinstance(sources, list):
            item["sources"] = []

        validated.append(item)

    if len(validated) < len(causal_chain):
        logger.info(f"Causal chain validation: {len(validated)}/{len(causal_chain)} relations kept")

    return validated


class CausalExtractor:
    """Extracteur de relations causales depuis le texte LLM"""

    # Patterns pour detecter les relations causales en francais (extended)
    CAUSAL_PATTERNS_FR = [
        # Patterns avec verbes conjugués
        (r"(?P<cause>.+?)\s+a\s+caus[eé]\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?)\s+a\s+entra[îi]n[eé]\s+(?P<effect>.+?)(?:\.|,|;|$)", "triggers"),
        (r"(?P<cause>.+?)\s+a\s+provoqu[eé]\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?)\s+a\s+conduit\s+[àa]\s+(?P<effect>.+?)(?:\.|,|;|$)", "triggers"),
        (r"(?P<cause>.+?)\s+a\s+permis\s+(?P<effect>.+?)(?:\.|,|;|$)", "enables"),
        (r"(?P<cause>.+?)\s+a\s+emp[êe]ch[eé]\s+(?P<effect>.+?)(?:\.|,|;|$)", "prevents"),
        (r"(?P<cause>.+?)\s+a\s+d[ée]clench[eé]\s+(?P<effect>.+?)(?:\.|,|;|$)", "triggers"),
        (r"(?P<cause>.+?)\s+a\s+g[ée]n[eé]r[eé]\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?)\s+a\s+suscit[eé]\s+(?P<effect>.+?)(?:\.|,|;|$)", "triggers"),
        (r"(?P<cause>.+?)\s+a\s+abouti\s+[àa]\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?)\s+a\s+favoris[eé]\s+(?P<effect>.+?)(?:\.|,|;|$)", "enables"),
        (r"(?P<cause>.+?)\s+a\s+bloqu[eé]\s+(?P<effect>.+?)(?:\.|,|;|$)", "prevents"),
        (r"(?P<cause>.+?)\s+a\s+frein[eé]\s+(?P<effect>.+?)(?:\.|,|;|$)", "prevents"),

        # Patterns avec prépositions/locutions
        (r"[Ss]uite\s+[àa]\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "triggers"),
        (r"[Ee]n\s+cons[ée]quence\s+de\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "causes"),
        (r"(?P<effect>.+?)\s+r[ée]sulte\s+de\s+(?P<cause>.+?)(?:\.|,|;|$)", "causes"),
        (r"[Àa]\s+cause\s+de\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "causes"),
        (r"[Gg]r[âa]ce\s+[àa]\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "enables"),
        (r"[Aa]pr[èe]s\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "triggers"),
        (r"[Ee]n\s+raison\s+de\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "causes"),
        (r"[Dd]u\s+fait\s+de\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "causes"),
        (r"[Ff]ace\s+[àa]\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "triggers"),
        (r"[Dd]evant\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "triggers"),

        # Patterns avec "donc", "ainsi", "par conséquent"
        (r"(?P<cause>.+?),?\s+donc\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?),?\s+ainsi\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?),?\s+par\s+cons[ée]quent\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?),?\s+d[èe]s\s+lors\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?),?\s+c'est\s+pourquoi\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?),?\s+ce\s+qui\s+(?P<effect>.+?)(?:\.|,|;|$)", "triggers"),

        # Patterns pour décisions/réactions politiques/économiques
        (r"[Ll]a\s+d[ée]cision\s+de\s+(?P<cause>.+?)\s+a\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"[Ll]'annonce\s+de\s+(?P<cause>.+?)\s+a\s+(?P<effect>.+?)(?:\.|,|;|$)", "triggers"),
        (r"[Ll]a\s+hausse\s+de\s+(?P<cause>.+?)\s+(?:a\s+)?(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"[Ll]a\s+baisse\s+de\s+(?P<cause>.+?)\s+(?:a\s+)?(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"[Ll]a\s+crise\s+(?:de\s+)?(?P<cause>.+?)\s+(?:a\s+)?(?P<effect>.+?)(?:\.|,|;|$)", "causes"),

        # Patterns temporels implicites
        (r"[Dd]epuis\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "triggers"),
        (r"[Ll]orsque\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "triggers"),
        (r"[Qq]uand\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "triggers"),
    ]

    # Patterns en anglais (pour sources anglophones) - extended
    CAUSAL_PATTERNS_EN = [
        (r"(?P<cause>.+?)\s+caused\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?)\s+led\s+to\s+(?P<effect>.+?)(?:\.|,|;|$)", "triggers"),
        (r"(?P<cause>.+?)\s+triggered\s+(?P<effect>.+?)(?:\.|,|;|$)", "triggers"),
        (r"(?P<cause>.+?)\s+resulted\s+in\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?)\s+enabled\s+(?P<effect>.+?)(?:\.|,|;|$)", "enables"),
        (r"(?P<cause>.+?)\s+prevented\s+(?P<effect>.+?)(?:\.|,|;|$)", "prevents"),
        (r"[Dd]ue\s+to\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "causes"),
        (r"[Aa]s\s+a\s+result\s+of\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "causes"),
        (r"[Ff]ollowing\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "triggers"),
        (r"(?P<cause>.+?)\s+prompted\s+(?P<effect>.+?)(?:\.|,|;|$)", "triggers"),
        (r"(?P<cause>.+?)\s+sparked\s+(?P<effect>.+?)(?:\.|,|;|$)", "triggers"),
        (r"(?P<cause>.+?)\s+forced\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?),?\s+therefore\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"(?P<cause>.+?),?\s+consequently\s+(?P<effect>.+?)(?:\.|,|;|$)", "causes"),
        (r"[Bb]ecause\s+of\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "causes"),
        (r"[Ss]ince\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "causes"),
        (r"[Ww]hen\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "triggers"),
        (r"[Aa]fter\s+(?P<cause>.+?),\s+(?P<effect>.+?)(?:\.|;|$)", "triggers"),
    ]

    # Types de relations avec poids de confiance
    RELATION_WEIGHTS = {
        "causes": 1.0,      # Lien causal direct
        "triggers": 0.85,   # Declencheur (temporel)
        "enables": 0.70,    # Condition permissive
        "prevents": 0.75,   # Blocage/prevention
    }

    def __init__(self):
        self.all_patterns = self.CAUSAL_PATTERNS_FR + self.CAUSAL_PATTERNS_EN

    def extract_from_text(
        self,
        text: str,
        base_confidence: float = 0.5
    ) -> List[CausalRelation]:
        """
        Extrait les relations causales depuis du texte brut via regex.
        Methode de fallback si le JSON LLM n'est pas disponible.
        """
        relations = []
        seen_pairs = set()

        for pattern, rel_type in self.all_patterns:
            try:
                for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
                    cause = match.group("cause").strip()
                    effect = match.group("effect").strip()

                    # Nettoyer les textes
                    cause = self._clean_text(cause)
                    effect = self._clean_text(effect)

                    # Eviter les doublons et les relations trop courtes
                    if len(cause) < 10 or len(effect) < 10:
                        continue

                    pair_key = (cause[:50], effect[:50])
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)

                    # Calculer la confiance
                    confidence = base_confidence * self.RELATION_WEIGHTS.get(rel_type, 0.5)

                    relations.append(CausalRelation(
                        cause_text=cause[:200],  # Tronquer si trop long
                        effect_text=effect[:200],
                        relation_type=rel_type,
                        confidence=min(confidence, 1.0),
                        evidence=[match.group(0)[:150]],
                        source_articles=[]
                    ))
            except Exception as e:
                logger.warning(f"Pattern matching error: {e}")
                continue

        return relations

    def extract_from_llm_json(
        self,
        llm_output: Dict[str, Any],
        fact_density: float = 0.5
    ) -> List[CausalRelation]:
        """
        Extrait les relations causales depuis le JSON genere par le LLM.
        Format attendu: {"causal_chain": [{cause, effect, type, sources}, ...]}
        """
        relations = []
        causal_chain = llm_output.get("causal_chain", [])

        if not causal_chain:
            logger.debug("No causal_chain in LLM output")
            return relations

        for item in causal_chain:
            if not isinstance(item, dict):
                continue

            cause = item.get("cause", "")
            effect = item.get("effect", "")
            rel_type = item.get("type", "causes")
            sources = item.get("sources", [])

            if not cause or not effect:
                continue

            # Valider le type de relation
            if rel_type not in self.RELATION_WEIGHTS:
                rel_type = "causes"

            # Calculer la confiance basee sur fact_density + nombre de sources
            source_boost = min(len(sources) * 0.1, 0.3)  # Max +30% pour sources
            confidence = fact_density * self.RELATION_WEIGHTS[rel_type] + source_boost

            relations.append(CausalRelation(
                cause_text=cause[:200],
                effect_text=effect[:200],
                relation_type=rel_type,
                confidence=min(confidence, 1.0),
                evidence=[],
                source_articles=sources if isinstance(sources, list) else []
            ))

        logger.info(f"Extracted {len(relations)} causal relations from LLM JSON")
        return relations

    def extract_from_synthesis(
        self,
        synthesis_text: str,
        entities: List[str],
        fact_density: float,
        llm_causal_output: Optional[Dict[str, Any]] = None,
        key_points: Optional[List[str]] = None,
        title: Optional[str] = None,
        analysis: Optional[str] = None,
        body: Optional[str] = None
    ) -> CausalGraph:
        """
        Methode principale: extrait le graphe causal depuis une synthese.

        Args:
            synthesis_text: Texte de la synthese
            entities: Liste des entites cles
            fact_density: Score de densite factuelle (0-1)
            llm_causal_output: JSON optionnel du LLM contenant causal_chain
            key_points: Points cles de la synthese (pour fallback)
            title: Titre de la synthese (pour fallback)
            analysis: Texte d'analyse (pour fallback enrichi)
            body: Corps de l'article (pour extraction de phrases)

        Returns:
            CausalGraph complet
        """
        # 1. Extraire les relations (priorite au JSON LLM)
        if llm_causal_output:
            relations = self.extract_from_llm_json(llm_causal_output, fact_density)
            if relations:
                logger.info(f"Extracted {len(relations)} relations from LLM causal_chain")
        else:
            relations = []
            logger.debug("No LLM causal output provided")

        # 2. Completer avec extraction regex si peu de relations
        if len(relations) < 3:
            logger.info(f"Only {len(relations)} LLM relations, attempting regex extraction...")
            text_relations = self.extract_from_text(synthesis_text, fact_density)
            # Ajouter seulement les nouvelles relations
            existing_pairs = {(r.cause_text[:30], r.effect_text[:30]) for r in relations}
            added_count = 0
            for rel in text_relations:
                pair = (rel.cause_text[:30], rel.effect_text[:30])
                if pair not in existing_pairs:
                    relations.append(rel)
                    existing_pairs.add(pair)
                    added_count += 1
            if added_count > 0:
                logger.info(f"Added {added_count} relations from regex extraction")

        # 3. FALLBACK: Generate from key points/entities/analysis if still insufficient
        if len(relations) < 3:
            logger.info(f"Only {len(relations)} relations total, using enhanced fallback generation...")
            fallback_relations = self.generate_fallback_relations(
                key_points=key_points or [],
                title=title or "",
                entities=entities,
                fact_density=fact_density,
                analysis=analysis or "",
                body=body or ""
            )
            existing_pairs = {(r.cause_text[:30], r.effect_text[:30]) for r in relations}
            added_count = 0
            for rel in fallback_relations:
                pair = (rel.cause_text[:30], rel.effect_text[:30])
                if pair not in existing_pairs:
                    relations.append(rel)
                    existing_pairs.add(pair)
                    added_count += 1
            if added_count > 0:
                logger.info(f"Added {added_count} relations from fallback generation")

        # 4. Construire les noeuds depuis les relations + entites
        nodes = self._build_nodes(relations, entities, fact_density)

        # 4b. Merge similar nodes (dedup by normalized label)
        nodes, relations = self._merge_similar_nodes(nodes, relations)

        # 4c. Cap at 15 nodes: keep most-connected, prune orphans
        nodes, relations = self._cap_and_prune(nodes, relations, max_nodes=15)

        # 4d. Validate connectivity: remove tiny disconnected components
        nodes, relations = self._validate_connectivity(nodes, relations)

        # 5. Bridge disconnected branches via shared entity mentions
        bridge_edges = self._bridge_disconnected_branches(nodes, relations, entities)
        if bridge_edges:
            relations.extend(bridge_edges)

        # 6. Trouver l'entite centrale
        central_entity = self._find_central_entity(relations, entities)

        # 7. Determiner le type de flux narratif
        narrative_flow = self._determine_narrative_flow(relations)

        graph = CausalGraph(
            nodes=nodes,
            edges=relations,
            central_entity=central_entity,
            narrative_flow=narrative_flow
        )

        logger.info(
            f"Built causal graph: {len(nodes)} nodes, {len(relations)} edges, "
            f"central={central_entity}, flow={narrative_flow}"
        )

        return graph

    def _normalize_for_dedup(self, text: str) -> str:
        """Normalize label for deduplication — ignores articles, case, minor diffs."""
        t = text.lower().strip()
        for article in ['le ', 'la ', 'les ', "l'", 'un ', 'une ', 'des ', 'du ', 'de ',
                         'the ', 'a ', 'an ']:
            if t.startswith(article):
                t = t[len(article):]
        t = re.sub(r'[^\w\s]', '', t)
        t = ' '.join(t.split())
        return t[:50]

    def _classify_node_type(self, label: str, entities: List[str]) -> str:
        """Classify node as event, entity, or decision based on content."""
        label_lower = label.lower()
        for entity in entities:
            if entity.lower() in label_lower and len(entity) > len(label) * 0.3:
                return "entity"
        decision_words = ['décision', 'decision', 'vote', 'accord', 'approbation',
                          'approval', 'loi', 'law', 'règlement', 'regulation']
        if any(w in label_lower for w in decision_words):
            return "decision"
        return "event"

    def _build_nodes(
        self,
        relations: List[CausalRelation],
        entities: List[str],
        fact_density: float
    ) -> List[CausalNode]:
        """Construit les noeuds du graphe depuis les relations.
        Uses normalized dedup to merge similar labels.
        Does NOT add standalone entity nodes (they create floating islands).
        """
        nodes = []
        seen_normalized: Dict[str, CausalNode] = {}  # normalized_label → node
        node_id = 0

        for rel in relations:
            for text, is_cause in [(rel.cause_text, True), (rel.effect_text, False)]:
                label = text[:60]
                normalized = self._normalize_for_dedup(label)

                if normalized not in seen_normalized:
                    node_type = self._classify_node_type(label, entities)
                    node = CausalNode(
                        id=f"node_{node_id}",
                        label=label,
                        node_type=node_type,
                        fact_density=rel.confidence if is_cause else fact_density
                    )
                    seen_normalized[normalized] = node
                    nodes.append(node)
                    node_id += 1

        return nodes

    def _merge_similar_nodes(
        self,
        nodes: List[CausalNode],
        relations: List[CausalRelation],
    ) -> tuple:
        """Merge nodes with identical normalized labels. Keep the shortest label as canonical."""
        norm_to_canonical: Dict[str, str] = {}  # normalized → best raw label
        norm_to_node: Dict[str, CausalNode] = {}

        for node in nodes:
            norm = self._normalize_for_dedup(node.label)
            if norm in norm_to_canonical:
                # Keep the shorter label
                if len(node.label) < len(norm_to_canonical[norm]):
                    norm_to_canonical[norm] = node.label
                    norm_to_node[norm] = node
            else:
                norm_to_canonical[norm] = node.label
                norm_to_node[norm] = node

        # Build remap: old label → canonical label
        label_remap: Dict[str, str] = {}
        for node in nodes:
            norm = self._normalize_for_dedup(node.label)
            canonical = norm_to_canonical[norm]
            if node.label != canonical:
                label_remap[node.label] = canonical

        if not label_remap:
            return nodes, relations

        # Remap edges
        for rel in relations:
            if rel.cause_text in label_remap:
                rel.cause_text = label_remap[rel.cause_text]
            if rel.effect_text in label_remap:
                rel.effect_text = label_remap[rel.effect_text]

        # Deduplicate self-loops created by merging
        relations = [r for r in relations if r.cause_text != r.effect_text]

        # Deduplicate edges with same cause+effect
        seen_pairs: set = set()
        unique_relations = []
        for rel in relations:
            pair = (rel.cause_text[:50], rel.effect_text[:50])
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                unique_relations.append(rel)
        relations = unique_relations

        # Keep only canonical nodes
        merged_nodes = list(norm_to_node.values())
        logger.info(f"Merged {len(nodes)} → {len(merged_nodes)} nodes ({len(label_remap)} duplicates removed)")
        return merged_nodes, relations

    def _cap_and_prune(
        self,
        nodes: List[CausalNode],
        relations: List[CausalRelation],
        max_nodes: int = 15,
    ) -> tuple:
        """Cap nodes at max_nodes by keeping the most connected. Remove orphans."""
        if len(nodes) <= max_nodes:
            # Still remove orphans (nodes with 0 edges)
            connected_labels = set()
            for rel in relations:
                connected_labels.add(rel.cause_text)
                connected_labels.add(rel.effect_text)
            before = len(nodes)
            nodes = [n for n in nodes if n.label in connected_labels]
            if len(nodes) < before:
                logger.info(f"Pruned {before - len(nodes)} orphan nodes")
            return nodes, relations

        # Count degree per node label
        degree: Dict[str, int] = {}
        for rel in relations:
            degree[rel.cause_text] = degree.get(rel.cause_text, 0) + 1
            degree[rel.effect_text] = degree.get(rel.effect_text, 0) + 1

        # Sort nodes by degree (most connected first)
        nodes.sort(key=lambda n: degree.get(n.label, 0), reverse=True)
        kept_nodes = nodes[:max_nodes]
        kept_labels = {n.label for n in kept_nodes}

        # Filter edges to only reference kept nodes
        relations = [
            r for r in relations
            if r.cause_text in kept_labels and r.effect_text in kept_labels
        ]

        logger.info(f"Capped nodes: {len(nodes)} → {len(kept_nodes)}, edges: {len(relations)}")
        return kept_nodes, relations

    def _validate_connectivity(
        self,
        nodes: List[CausalNode],
        relations: List[CausalRelation],
    ) -> tuple:
        """Remove tiny disconnected components (< 3 nodes) when > 2 components exist."""
        if len(nodes) < 4 or not relations:
            return nodes, relations

        # Union-Find
        label_to_idx = {n.label: i for i, n in enumerate(nodes)}
        parent = list(range(len(nodes)))

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a: int, b: int):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        for rel in relations:
            a = label_to_idx.get(rel.cause_text)
            b = label_to_idx.get(rel.effect_text)
            if a is not None and b is not None:
                union(a, b)

        # Group by component
        components: Dict[int, List[int]] = {}
        for i in range(len(nodes)):
            root = find(i)
            components.setdefault(root, []).append(i)

        if len(components) <= 2:
            return nodes, relations

        # Remove components with < 3 nodes
        keep_indices: set = set()
        removed = 0
        for comp_indices in components.values():
            if len(comp_indices) >= 3:
                keep_indices.update(comp_indices)
            else:
                removed += len(comp_indices)

        if removed == 0:
            return nodes, relations

        kept_labels = {nodes[i].label for i in keep_indices}
        nodes = [nodes[i] for i in sorted(keep_indices)]
        relations = [
            r for r in relations
            if r.cause_text in kept_labels and r.effect_text in kept_labels
        ]

        logger.info(f"Connectivity validation: removed {removed} nodes from tiny components")
        return nodes, relations

    def _bridge_disconnected_branches(
        self,
        nodes: List[CausalNode],
        relations: List[CausalRelation],
        entities: List[str],
    ) -> List[CausalRelation]:
        """
        Find disconnected components and create bridge edges between them
        via shared entity mentions. Max 5 bridges to avoid clutter.
        """
        if len(relations) < 2 or not entities:
            return []

        # Build adjacency using normalized labels
        node_labels = {n.id: self._normalize_for_dedup(n.label) for n in nodes}
        label_to_id = {v: k for k, v in node_labels.items()}

        # Union-Find
        parent: Dict[str, str] = {n.id: n.id for n in nodes}

        def find(x: str) -> str:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a: str, b: str):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        # Union nodes connected by existing edges
        for rel in relations:
            cause_norm = self._normalize_for_dedup(rel.cause_text[:60])
            effect_norm = self._normalize_for_dedup(rel.effect_text[:60])
            cause_id = label_to_id.get(cause_norm, "")
            effect_id = label_to_id.get(effect_norm, "")
            if cause_id and effect_id:
                union(cause_id, effect_id)

        # Group nodes by component
        components: Dict[str, List[CausalNode]] = {}
        for n in nodes:
            root = find(n.id)
            components.setdefault(root, []).append(n)

        if len(components) <= 1:
            return []  # Already fully connected

        component_list = list(components.values())
        bridges = []
        seen_bridges: set = set()

        for entity in entities[:8]:
            entity_lower = entity.lower()
            if len(entity_lower) < 3:
                continue

            # Find which components mention this entity
            entity_components: List[tuple] = []  # (component_idx, node)
            for ci, comp in enumerate(component_list):
                for n in comp:
                    if entity_lower in n.label.lower():
                        entity_components.append((ci, n))
                        break  # One match per component is enough

            # Bridge pairs of components that share this entity
            for i in range(len(entity_components)):
                for j in range(i + 1, len(entity_components)):
                    ci, n1 = entity_components[i]
                    cj, n2 = entity_components[j]
                    if ci == cj:
                        continue
                    bridge_key = (min(n1.id, n2.id), max(n1.id, n2.id))
                    if bridge_key in seen_bridges:
                        continue
                    seen_bridges.add(bridge_key)
                    bridges.append(CausalRelation(
                        cause_text=n1.label,
                        effect_text=n2.label,
                        relation_type="enables",
                        confidence=0.4,
                        evidence=[f"Bridge: shared entity '{entity}'"],
                        source_articles=[]
                    ))
                    if len(bridges) >= 5:
                        return bridges

        if bridges:
            logger.info(f"Created {len(bridges)} bridge edges to connect {len(components)} components")
        return bridges

    def _find_central_entity(
        self,
        relations: List[CausalRelation],
        entities: List[str]
    ) -> str:
        """Trouve l'entite la plus connectee dans le graphe"""
        # Compter les mentions dans les relations
        mention_counts: Dict[str, int] = {}

        for entity in entities:
            count = 0
            entity_lower = entity.lower()
            for rel in relations:
                if entity_lower in rel.cause_text.lower():
                    count += 2  # Poids double pour les causes
                if entity_lower in rel.effect_text.lower():
                    count += 1
            mention_counts[entity] = count

        if not mention_counts:
            return entities[0] if entities else ""

        return max(mention_counts, key=mention_counts.get)

    def _determine_narrative_flow(self, relations: List[CausalRelation]) -> str:
        """Determine le type de flux narratif"""
        if not relations:
            return "linear"

        # Analyser la structure des relations
        causes = set(r.cause_text[:50] for r in relations)
        effects = set(r.effect_text[:50] for r in relations)

        # Si un effet est aussi une cause -> branching ou circular
        overlap = causes & effects

        if len(overlap) > len(relations) / 2:
            return "circular"
        elif len(overlap) > 0:
            return "branching"
        else:
            return "linear"

    def _clean_text(self, text: str) -> str:
        """Nettoie le texte extrait"""
        # Supprimer les citations [SOURCE:N]
        text = re.sub(r'\[SOURCE:\d+\]', '', text)
        # Supprimer les espaces multiples
        text = re.sub(r'\s+', ' ', text)
        # Supprimer les guillemets
        text = text.replace('«', '').replace('»', '').replace('"', '')
        return text.strip()

    def generate_fallback_relations(
        self,
        key_points: List[str],
        title: str,
        entities: List[str],
        fact_density: float = 0.5,
        analysis: str = "",
        body: str = ""
    ) -> List[CausalRelation]:
        """
        Generate fallback causal relations from key points if no relations were extracted.
        Creates simple linear cause-effect chains from consecutive key points.

        This is a last-resort method when:
        1. LLM didn't generate causal_chain
        2. Regex extraction found nothing

        Args:
            key_points: List of key points from synthesis
            title: Synthesis title (used as initial cause)
            entities: Key entities from the synthesis
            fact_density: Base confidence score
            analysis: Optional analysis text for additional context
            body: Optional body text for sentence-level extraction

        Returns:
            List of generated CausalRelation objects
        """
        relations = []
        confidence = fact_density * 0.7  # Slightly higher confidence for improved fallback

        # Strategy 1: Title -> First key point (if available)
        if title and key_points:
            clean_title = self._clean_text(title)
            first_point = self._clean_text(key_points[0]) if key_points else ""
            if len(clean_title) > 10 and len(first_point) > 10:
                relations.append(CausalRelation(
                    cause_text=clean_title[:150],
                    effect_text=first_point[:150],
                    relation_type="triggers",
                    confidence=confidence,
                    evidence=["Inferred: title introduces first consequence"],
                    source_articles=[]
                ))

        # Strategy 2: Chain consecutive key points
        if key_points and len(key_points) >= 2:
            for i in range(len(key_points) - 1):
                cause = self._clean_text(key_points[i])
                effect = self._clean_text(key_points[i + 1])

                if len(cause) > 10 and len(effect) > 10:
                    relations.append(CausalRelation(
                        cause_text=cause[:150],
                        effect_text=effect[:150],
                        relation_type="triggers",
                        confidence=confidence * 0.9,
                        evidence=["Inferred: sequential development in key points"],
                        source_articles=[]
                    ))

        # Strategy 3: Entity-based relations (more robust)
        if entities and len(entities) >= 1:
            # Single entity: entity action -> consequences
            if len(entities) == 1:
                relations.append(CausalRelation(
                    cause_text=f"Décision/action de {entities[0]}",
                    effect_text="Réactions et conséquences observées",
                    relation_type="causes",
                    confidence=confidence * 0.7,
                    evidence=["Inferred: main entity action-reaction"],
                    source_articles=[]
                ))
            else:
                # Multiple entities: create interaction relations
                for i in range(min(len(entities) - 1, 3)):  # Max 3 entity relations
                    relations.append(CausalRelation(
                        cause_text=f"Position/action de {entities[i]}",
                        effect_text=f"Réaction de {entities[i + 1]}",
                        relation_type="triggers",
                        confidence=confidence * 0.65,
                        evidence=["Inferred: entity interaction pattern"],
                        source_articles=[]
                    ))

        # Strategy 4: Extract from analysis text if provided
        if analysis and len(analysis) > 50:
            # Look for implication keywords in analysis
            implication_patterns = [
                (r"cela\s+(pourrait|devrait|risque\s+de)\s+(?P<effect>.+?)(?:\.|,|$)", "enables"),
                (r"(impact|conséquence|effet)\s+(?:est|sera)\s+(?P<effect>.+?)(?:\.|,|$)", "causes"),
                (r"(en\s+réaction|face\s+à\s+cela),?\s*(?P<effect>.+?)(?:\.|,|$)", "triggers"),
            ]
            for pattern, rel_type in implication_patterns:
                for match in re.finditer(pattern, analysis, re.IGNORECASE):
                    effect = match.group("effect") if "effect" in match.groupdict() else match.group(0)
                    if effect and len(effect) > 15:
                        relations.append(CausalRelation(
                            cause_text="Situation actuelle analysée",
                            effect_text=self._clean_text(effect)[:150],
                            relation_type=rel_type,
                            confidence=confidence * 0.75,
                            evidence=["Extracted from analysis section"],
                            source_articles=[]
                        ))
                        break  # One per pattern

        # Strategy 5: Generate logical generic relations if still insufficient
        if len(relations) < 3:
            # Add generic but contextually relevant relations
            if title:
                # Title often contains the main event
                title_lower = title.lower()

                # Detect type of news and generate appropriate relation
                if any(word in title_lower for word in ["annonce", "announce", "déclare", "declares", "présente"]):
                    relations.append(CausalRelation(
                        cause_text=f"Annonce: {self._clean_text(title)[:100]}",
                        effect_text="Réactions des acteurs concernés et marchés",
                        relation_type="triggers",
                        confidence=confidence * 0.6,
                        evidence=["Generic: announcement triggers reactions"],
                        source_articles=[]
                    ))
                elif any(word in title_lower for word in ["crise", "crisis", "conflit", "conflict", "guerre", "war"]):
                    relations.append(CausalRelation(
                        cause_text=f"Crise/conflit: {self._clean_text(title)[:100]}",
                        effect_text="Mesures d'urgence et négociations diplomatiques",
                        relation_type="triggers",
                        confidence=confidence * 0.6,
                        evidence=["Generic: crisis triggers emergency response"],
                        source_articles=[]
                    ))
                elif any(word in title_lower for word in ["vote", "élection", "election", "loi", "law"]):
                    relations.append(CausalRelation(
                        cause_text=f"Décision politique: {self._clean_text(title)[:100]}",
                        effect_text="Impact sur la société et réactions politiques",
                        relation_type="causes",
                        confidence=confidence * 0.6,
                        evidence=["Generic: political decision causes societal impact"],
                        source_articles=[]
                    ))
                else:
                    # Default generic
                    relations.append(CausalRelation(
                        cause_text=f"Événement: {self._clean_text(title)[:100]}",
                        effect_text="Développements et réactions attendus",
                        relation_type="triggers",
                        confidence=confidence * 0.5,
                        evidence=["Generic: event triggers developments"],
                        source_articles=[]
                    ))

        # Ensure minimum 3 relations
        while len(relations) < 3 and key_points:
            # Add more from key points if needed
            idx = len(relations) % len(key_points)
            next_idx = (idx + 1) % len(key_points)
            if idx != next_idx:
                relations.append(CausalRelation(
                    cause_text=self._clean_text(key_points[idx])[:120],
                    effect_text=self._clean_text(key_points[next_idx])[:120],
                    relation_type="causes",
                    confidence=confidence * 0.5,
                    evidence=["Fallback: ensure minimum relations"],
                    source_articles=[]
                ))
            else:
                break

        logger.info(f"Generated {len(relations)} fallback causal relations (strategies: title, keypoints, entities, analysis, generic)")
        return relations


# Instance globale
causal_extractor = CausalExtractor()


def get_causal_extractor() -> CausalExtractor:
    """Dependency injection pour FastAPI"""
    return causal_extractor
