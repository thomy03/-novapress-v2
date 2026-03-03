"""
Nexus SVG Generator for NovaPress AI v2.
Generates animated editorial infographic SVGs for causal graphs.
Uses Gemini via OpenRouter as a rendering engine — all layout is pre-computed server-side.
Stores results in Redis ZSET for scroll-driven timeline viewer.

Model: google/gemini-3.1-flash-lite-preview via OpenRouter (~$0.002/generation)
Resolution: 1280x720 viewBox (vector, scales to any size)
"""
import json
import math
import re
import time
from collections import deque
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime

import httpx
from loguru import logger

from app.core.config import settings
from app.core.circuit_breaker import get_circuit_breaker, CircuitOpenError
from app.services.svg_sanitizer import sanitize_svg


# ==========================================
# Constants
# ==========================================

MAX_SVGS_PER_TOPIC = 20

# Node type → visual config
NODE_STYLES = {
    "event":    {"color": "#DC2626", "shape": "circle", "radius": 28},
    "entity":   {"color": "#2563EB", "shape": "circle_ring", "radius": 32},
    "decision": {"color": "#F59E0B", "shape": "diamond", "radius": 20},
    "keyword":  {"color": "#10B981", "shape": "rounded_rect", "radius": 18},
}

# Relation type → edge color
EDGE_COLORS = {
    "causes":   "#DC2626",
    "triggers": "#F59E0B",
    "enables":  "#10B981",
    "prevents": "#6B7280",
}

# City coordinates for geo mini-map (lon, lat) — same as MiniGeoWidget.tsx
CITY_COORDS: Dict[str, Tuple[float, float]] = {
    # Middle East
    "teheran": (51.4, 35.7), "tehran": (51.4, 35.7),
    "bagdad": (44.4, 33.3), "baghdad": (44.4, 33.3),
    "riyad": (46.7, 24.7), "riyadh": (46.7, 24.7),
    "doha": (51.5, 25.3), "dubai": (55.3, 25.3), "abu dhabi": (54.4, 24.5),
    "jerusalem": (35.2, 31.8), "tel-aviv": (34.8, 32.1), "tel aviv": (34.8, 32.1),
    "gaza": (34.5, 31.5), "beyrouth": (35.5, 33.9), "beirut": (35.5, 33.9),
    "damas": (36.3, 33.5), "damascus": (36.3, 33.5),
    "amman": (35.9, 31.9),
    # Europe
    "paris": (2.3, 48.9), "lyon": (4.8, 45.8), "marseille": (5.4, 43.3),
    "berlin": (13.4, 52.5), "munich": (11.6, 48.1), "francfort": (8.7, 50.1), "frankfurt": (8.7, 50.1),
    "londres": (-0.1, 51.5), "london": (-0.1, 51.5),
    "rome": (12.5, 41.9), "milan": (9.2, 45.5),
    "madrid": (-3.7, 40.4), "barcelone": (2.2, 41.4), "barcelona": (2.2, 41.4),
    "bruxelles": (4.3, 50.8), "brussels": (4.3, 50.8),
    "amsterdam": (4.9, 52.4),
    "moscou": (37.6, 55.8), "moscow": (37.6, 55.8),
    "kiev": (30.5, 50.5), "kyiv": (30.5, 50.5),
    "varsovie": (21.0, 52.2), "warsaw": (21.0, 52.2),
    "athenes": (23.7, 37.98), "athens": (23.7, 37.98),
    "istanbul": (29.0, 41.0), "ankara": (32.9, 39.9),
    "stockholm": (18.1, 59.3), "oslo": (10.7, 59.9), "helsinki": (24.9, 60.2),
    "geneve": (6.1, 46.2), "geneva": (6.1, 46.2), "zurich": (8.5, 47.4),
    "vienne": (16.4, 48.2), "vienna": (16.4, 48.2),
    "lisbonne": (-9.1, 38.7), "lisbon": (-9.1, 38.7),
    # Americas
    "washington": (-77.0, 38.9), "new york": (-74.0, 40.7), "los angeles": (-118.2, 34.1),
    "chicago": (-87.6, 41.9), "san francisco": (-122.4, 37.8),
    "mexico": (-99.1, 19.4), "bogota": (-74.1, 4.6), "lima": (-77.0, -12.0),
    "buenos aires": (-58.4, -34.6), "sao paulo": (-46.6, -23.6),
    "ottawa": (-75.7, 45.4), "toronto": (-79.4, 43.7),
    # Asia
    "pekin": (116.4, 39.9), "beijing": (116.4, 39.9), "shanghai": (121.5, 31.2),
    "hong kong": (114.2, 22.3), "tokyo": (139.7, 35.7),
    "seoul": (127.0, 37.6), "taipei": (121.5, 25.0),
    "new delhi": (77.2, 28.6), "mumbai": (72.9, 19.1),
    "bangkok": (100.5, 13.8), "singapour": (103.8, 1.4), "singapore": (103.8, 1.4),
    "kaboul": (69.2, 34.5), "kabul": (69.2, 34.5),
    "hanoi": (105.8, 21.0),
    # Africa
    "le caire": (31.2, 30.0), "cairo": (31.2, 30.0),
    "alger": (3.0, 36.8), "algiers": (3.0, 36.8),
    "casablanca": (-7.6, 33.6), "nairobi": (36.8, -1.3),
    "johannesburg": (28.0, -26.2), "le cap": (18.4, -33.9), "cape town": (18.4, -33.9),
    # Oceania
    "sydney": (151.2, -33.9), "melbourne": (144.96, -37.8),
}

# Country center coordinates (lon, lat)
COUNTRY_CENTERS: Dict[str, Tuple[float, float]] = {
    "france": (2, 47), "allemagne": (10, 51), "germany": (10, 51),
    "italie": (12, 42), "italy": (12, 42), "espagne": (-4, 40), "spain": (-4, 40),
    "royaume-uni": (-2, 54), "united kingdom": (-2, 54), "uk": (-2, 54),
    "etats-unis": (-98, 39), "united states": (-98, 39), "usa": (-98, 39),
    "russie": (60, 60), "russia": (60, 60), "chine": (105, 35), "china": (105, 35),
    "japon": (138, 36), "japan": (138, 36), "inde": (78, 22), "india": (78, 22),
    "bresil": (-50, -14), "brazil": (-50, -14), "canada": (-100, 56),
    "ukraine": (32, 49), "turquie": (32, 39), "turkey": (32, 39),
    "iran": (53, 32), "irak": (44, 33), "iraq": (44, 33),
    "israel": (35, 31), "palestine": (35, 32),
    "syrie": (38, 35), "syria": (38, 35), "liban": (36, 34), "lebanon": (36, 34),
    "egypte": (30, 26), "egypt": (30, 26), "maroc": (-6, 32), "morocco": (-6, 32),
    "arabie saoudite": (45, 24), "saudi arabia": (45, 24),
    "coree du sud": (127, 37), "south korea": (127, 37),
    "coree du nord": (127, 40), "north korea": (127, 40),
    "australie": (135, -25), "australia": (135, -25),
    "afrique du sud": (25, -29), "south africa": (25, -29),
    "pologne": (20, 52), "poland": (20, 52),
    "mexique": (-102, 23), "mexico country": (-102, 23),
}


# ==========================================
# Layout Engine (pure Python, 0 LLM)
# ==========================================

def _topological_sort(nodes: List[Dict], edges: List[Dict]) -> List[List[str]]:
    """
    Kahn's algorithm: assign nodes to depth layers.
    Returns list of layers, each containing node IDs.
    Handles cycles by placing cyclic nodes in the middle layer.
    """
    node_ids = {n.get("id", f"n{i}") for i, n in enumerate(nodes)}
    id_to_node = {n.get("id", f"n{i}"): n for i, n in enumerate(nodes)}

    # Build adjacency
    in_degree: Dict[str, int] = {nid: 0 for nid in node_ids}
    adj: Dict[str, List[str]] = {nid: [] for nid in node_ids}

    for edge in edges:
        cause = edge.get("cause_id", "")
        effect = edge.get("effect_id", "")
        # Try to match by text if IDs missing
        if not cause or cause not in node_ids:
            cause = _find_node_id_by_text(edge.get("cause_text", ""), id_to_node)
        if not effect or effect not in node_ids:
            effect = _find_node_id_by_text(edge.get("effect_text", ""), id_to_node)
        if cause in node_ids and effect in node_ids and cause != effect:
            adj[cause].append(effect)
            in_degree[effect] = in_degree.get(effect, 0) + 1

    # BFS layers
    queue = deque([nid for nid, deg in in_degree.items() if deg == 0])
    layers: List[List[str]] = []
    visited = set()

    while queue:
        layer = []
        for _ in range(len(queue)):
            nid = queue.popleft()
            if nid in visited:
                continue
            visited.add(nid)
            layer.append(nid)
            for neighbor in adj.get(nid, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        if layer:
            layers.append(layer)

    # Add cyclic / orphan nodes to middle layer
    remaining = node_ids - visited
    if remaining:
        mid = max(0, len(layers) // 2)
        if layers:
            layers[mid] = layers[mid] + list(remaining)
        else:
            layers.append(list(remaining))

    return layers


def _find_node_id_by_text(text: str, id_to_node: Dict[str, Dict]) -> str:
    """Find a node ID by matching cause/effect text to node labels."""
    text_lower = text.lower().strip()
    if not text_lower:
        return ""
    for nid, node in id_to_node.items():
        label = node.get("label", "").lower().strip()
        if label and (text_lower in label or label in text_lower):
            return nid
    return ""


def _compute_node_positions(
    layers: List[List[str]],
    nodes: List[Dict],
    has_geo: bool,
) -> Dict[str, Dict[str, Any]]:
    """
    Assign x,y coordinates to each node based on topological layers.
    Graph zone: x=[340..1240] if geo, x=[40..1240] if no geo. y=[110..570].
    """
    x_min = 360 if has_geo else 60
    x_max = 1220
    y_min = 120
    y_max = 560

    id_to_node = {n.get("id", f"n{i}"): n for i, n in enumerate(nodes)}
    positions: Dict[str, Dict[str, Any]] = {}

    num_layers = len(layers)
    if num_layers == 0:
        return positions

    for layer_idx, layer in enumerate(layers):
        # X: distribute layers left to right
        x = x_min + (x_max - x_min) * layer_idx / max(num_layers - 1, 1)

        num_in_layer = len(layer)
        for node_idx, nid in enumerate(layer):
            # Y: distribute nodes top to bottom within layer
            y = y_min + (y_max - y_min) * node_idx / max(num_in_layer - 1, 1)

            node = id_to_node.get(nid, {})
            node_type = node.get("node_type", "event")
            style = NODE_STYLES.get(node_type, NODE_STYLES["event"])

            positions[nid] = {
                "x": round(x),
                "y": round(y),
                "label": node.get("label", nid)[:50],
                "node_type": node_type,
                "color": style["color"],
                "shape": style["shape"],
                "radius": style["radius"],
                "depth": layer_idx,
                "mention_count": node.get("mention_count", 1),
            }

    return positions


def _compute_edge_paths(
    edges: List[Dict],
    positions: Dict[str, Dict[str, Any]],
    nodes: List[Dict],
) -> List[Dict[str, Any]]:
    """Compute quadratic bezier paths for edges between positioned nodes."""
    id_to_node = {n.get("id", f"n{i}"): n for i, n in enumerate(nodes)}
    paths = []

    for edge in edges:
        cause_id = edge.get("cause_id", "")
        effect_id = edge.get("effect_id", "")

        # Resolve by text if needed
        if cause_id not in positions:
            cause_id = _find_node_id_by_text(edge.get("cause_text", ""), id_to_node)
        if effect_id not in positions:
            effect_id = _find_node_id_by_text(edge.get("effect_text", ""), id_to_node)

        if cause_id not in positions or effect_id not in positions:
            continue
        if cause_id == effect_id:
            continue

        p1 = positions[cause_id]
        p2 = positions[effect_id]

        # Quadratic bezier control point (offset perpendicular to midpoint)
        mx = (p1["x"] + p2["x"]) / 2
        my = (p1["y"] + p2["y"]) / 2
        dx = p2["x"] - p1["x"]
        dy = p2["y"] - p1["y"]
        dist = math.sqrt(dx * dx + dy * dy) or 1
        # Offset perpendicular, proportional to distance
        offset = min(40, dist * 0.15)
        cx = mx - (dy / dist) * offset
        cy = my + (dx / dist) * offset

        rel_type = edge.get("relation_type", "causes")
        confidence = edge.get("confidence", 0.5)
        depth_cause = p1.get("depth", 0)
        depth_effect = p2.get("depth", 0)

        paths.append({
            "path": f"M {p1['x']},{p1['y']} Q {round(cx)},{round(cy)} {p2['x']},{p2['y']}",
            "color": EDGE_COLORS.get(rel_type, "#6B7280"),
            "width": max(1, min(4, round(confidence * 4))),
            "relation_type": rel_type,
            "confidence": confidence,
            "animation_delay": round(max(depth_cause, depth_effect) * 0.4 + 0.2, 2),
            "cause_label": edge.get("cause_text", "")[:40],
            "effect_label": edge.get("effect_text", "")[:40],
        })

    return paths


# ==========================================
# Geographic Mini-Map
# ==========================================

def _resolve_geo_points(
    geographic_context: List[Dict],
) -> List[Dict[str, Any]]:
    """Resolve geographic locations to coordinates."""
    points = []
    seen = set()

    for loc in geographic_context:
        place = loc.get("place", "").strip()
        place_type = loc.get("type", "city")
        if not place:
            continue

        place_lower = place.lower()
        if place_lower in seen:
            continue
        seen.add(place_lower)

        # Try city lookup first
        coords = CITY_COORDS.get(place_lower)
        if not coords:
            # Try country lookup
            coords = COUNTRY_CENTERS.get(place_lower)
            if coords:
                place_type = "country"

        if coords:
            points.append({
                "name": place,
                "lon": coords[0],
                "lat": coords[1],
                "type": place_type,
                "role": loc.get("role", ""),
            })

    return points


def _mercator_project(
    points: List[Dict[str, Any]],
    x_min: float = 30, x_max: float = 310,
    y_min: float = 100, y_max: float = 370,
) -> List[Dict[str, Any]]:
    """Simple Mercator projection of lon/lat to SVG coordinates."""
    if not points:
        return []

    lons = [p["lon"] for p in points]
    lats = [p["lat"] for p in points]

    lon_min, lon_max = min(lons), max(lons)
    lat_min, lat_max = min(lats), max(lats)

    # Add padding
    lon_range = max(lon_max - lon_min, 10)
    lat_range = max(lat_max - lat_min, 5)
    lon_min -= lon_range * 0.1
    lon_max += lon_range * 0.1
    lat_min -= lat_range * 0.1
    lat_max += lat_range * 0.1
    lon_range = lon_max - lon_min
    lat_range = lat_max - lat_min

    projected = []
    for p in points:
        px = x_min + (p["lon"] - lon_min) / lon_range * (x_max - x_min)
        # Invert Y for Mercator (higher lat = lower Y)
        py = y_max - (p["lat"] - lat_min) / lat_range * (y_max - y_min)
        projected.append({
            **p,
            "px": round(px),
            "py": round(py),
        })

    return projected


# ==========================================
# Prompt Builder
# ==========================================

def _build_svg_prompt(
    title: str,
    category: str,
    date_str: str,
    node_specs: List[Dict[str, Any]],
    edge_specs: List[Dict[str, Any]],
    geo_points: List[Dict[str, Any]],
    metrics: List[Dict[str, Any]],
    central_entity: str,
    has_geo: bool,
) -> str:
    """Build the exhaustive SVG prompt. LLM is a rendering engine, not a designer."""

    # --- Nodes section ---
    nodes_text = ""
    for n in node_specs:
        delay = round(n["depth"] * 0.4, 2)
        if n["shape"] == "circle":
            nodes_text += (
                f'  - Circle: cx={n["x"]}, cy={n["y"]}, r={n["radius"]}, '
                f'fill="{n["color"]}", label="{n["label"]}", animation-delay={delay}s\n'
            )
        elif n["shape"] == "circle_ring":
            nodes_text += (
                f'  - Circle with ring: cx={n["x"]}, cy={n["y"]}, r={n["radius"]}, '
                f'fill="{n["color"]}", stroke="{n["color"]}" stroke-width=2 stroke-opacity=0.3 (outer ring r={n["radius"]+6}), '
                f'label="{n["label"]}", animation-delay={delay}s\n'
            )
        elif n["shape"] == "diamond":
            nodes_text += (
                f'  - Diamond: center=({n["x"]},{n["y"]}), size={n["radius"]*2}px, '
                f'fill="{n["color"]}", label="{n["label"]}", animation-delay={delay}s\n'
            )
        elif n["shape"] == "rounded_rect":
            nodes_text += (
                f'  - Rounded rect: x={n["x"]-30}, y={n["y"]-14}, width=60, height=28, rx=8, '
                f'fill="{n["color"]}", label="{n["label"]}", animation-delay={delay}s\n'
            )

    # Mark central entity
    central_note = ""
    if central_entity:
        central_note = f'\nCentral entity (pulse animation): "{central_entity}"\n'

    # --- Edges section ---
    edges_text = ""
    for e in edge_specs:
        edges_text += (
            f'  - Path: d="{e["path"]}", stroke="{e["color"]}", '
            f'stroke-width={e["width"]}, fill=none, '
            f'marker-end=arrowhead, animation-delay={e["animation_delay"]}s, '
            f'type={e["relation_type"]}\n'
        )

    # --- Geo section ---
    geo_text = ""
    if has_geo and geo_points:
        geo_text = "\n=== MINI-MAP GEO (x=20..320, y=90..380) ===\n"
        geo_text += "Background: rect x=20, y=90, width=300, height=290, rx=8, fill=\"#111122\", stroke=\"#1E293B\"\n"
        geo_text += "Title: \"GEOGRAPHIE\" 9px uppercase #666, x=30, y=108\n"
        for gp in geo_points:
            marker = "circle r=4, fill=#DC2626" if gp["type"] == "city" else "circle r=6, fill=none, stroke=#2563EB"
            geo_text += (
                f'  - Marker at ({gp["px"]},{gp["py"]}): {marker}, '
                f'label="{gp["name"]}" 9px #AAA, ping animation\n'
            )
        # Connection lines between co-mentioned places
        if len(geo_points) >= 2:
            geo_text += "  - Dashed lines (stroke=#1E293B, dasharray=4,4) between all markers\n"

    # --- Metrics section ---
    metrics_text = ""
    if metrics:
        metrics_text = "\n=== FOOTER METRIQUES (y=600..700) ===\n"
        metrics_text += "Background: rect x=0, y=590, width=1280, height=130, fill=\"#0D0D20\"\n"
        num_metrics = min(3, len(metrics))
        for i, m in enumerate(metrics[:3]):
            mx = 80 + i * (1100 // num_metrics)
            metrics_text += (
                f'  - Metric {i+1}: value="{m.get("value", "")}" in Georgia 28px bold #FFFFFF at ({mx}, 640), '
                f'label="{m.get("label", "")}" in 11px #888 at ({mx}, 665), '
                f'animation-delay={1.5 + i * 0.3}s\n'
            )

    # --- Legend ---
    present_types = list({n["node_type"] for n in node_specs})
    legend_items = []
    for nt in present_types:
        style = NODE_STYLES.get(nt, NODE_STYLES["event"])
        legend_items.append(f'{nt}: {style["color"]}')
    legend_text = ", ".join(legend_items) if legend_items else "event: #DC2626"

    # --- CSS animations ---
    css_block = """
=== ANIMATIONS (in <style> inside the SVG) ===
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes drawLine {
  from { stroke-dashoffset: 1000; }
  to { stroke-dashoffset: 0; }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
@keyframes ping {
  0% { r: 4; opacity: 0.8; }
  100% { r: 16; opacity: 0; }
}
Each node: opacity: 0, animation: fadeIn 0.5s ease forwards, animation-delay = depth * 0.4s
Each edge: stroke-dasharray: 1000, stroke-dashoffset: 1000, animation: drawLine 1s ease forwards, animation-delay provided above
Central entity node: animation: pulse 2s ease-in-out infinite (in addition to fadeIn)
Geo markers: additional circle with animation: ping 2s ease-out infinite
"""

    prompt = f"""You are an SVG code generator. Generate ONE valid SVG element.
Viewport: width="1280" height="720" viewBox="0 0 1280 720"

=== BACKGROUND ===
Full background: rect 0,0 1280x720 fill="#0A0A1A"
Subtle radial gradient at center: radialGradient from rgba(37,99,235,0.04) to transparent

=== HEADER (y=0..80) ===
- Title: "{title}" in Georgia 20px bold fill="#FFFFFF", x=40, y=42
- Category badge: rect rx=4 fill="{NODE_STYLES.get('event', {}).get('color', '#DC2626')}22" + text "{category}" 10px uppercase fill="#999", positioned right of title
- Date: "{date_str}" 11px fill="#555", x=40, y=64
- Horizontal separator: line y=80, stroke="#1E293B", stroke-width=1

=== CAUSAL GRAPH (y=90..580) ===
{central_note}
Nodes (EXACT positions — do not move):
{nodes_text}
IMPORTANT: Each node MUST have a label. Place label text in a dark pill background (rect rx=6 fill="#0A0A1A" opacity=0.85) behind white text 11px, centered below the node (y+radius+16).

Edges (EXACT paths — do not change):
{edges_text}
Each edge path must end with a small arrowhead (marker-end). Define a reusable <marker> in <defs>.
{geo_text}
{metrics_text}

=== LEGEND (x=1060..1240, y=610..690) ===
Legend box: rect rx=6 fill="#111122" stroke="#1E293B"
Items: {legend_text}
Each: small circle/square of color + label text 10px #888

{css_block}

=== ABSOLUTE RULES ===
1. Output ONLY the SVG code. No markdown fences, no explanation, no comments outside SVG.
2. Start with <svg and end with </svg>.
3. All labels must be readable: white text on dark pill backgrounds.
4. Font: Georgia for title, system-ui for labels.
5. Keep total output under 10000 characters.
6. Use <style> inside the SVG for all animations — no inline animation attributes.
7. The SVG must be self-contained (no external resources).
"""

    return prompt


# ==========================================
# NexusSvgGenerator Class
# ==========================================

class NexusSvgGenerator:
    """Generate animated editorial SVG infographics for causal graphs via Gemini/OpenRouter."""

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL
        self.model = settings.NEXUS_SVG_MODEL
        self.circuit_breaker = get_circuit_breaker("nexus_svg")
        self.enabled = bool(self.api_key)
        self._generated_this_run: set = set()

        if self.enabled:
            logger.info(f"Nexus SVG generator enabled ({self.model})")
        else:
            logger.info("Nexus SVG generator disabled (no OPENROUTER_API_KEY)")

    def reset_run_tracker(self):
        """Reset per-run rate limit tracker."""
        self._generated_this_run.clear()

    def _build_topic_slug(self, topic: str) -> str:
        """Convert topic name to a Redis-safe slug."""
        slug = topic.lower().strip()
        slug = re.sub(r'[^a-z0-9\-]', '-', slug)
        slug = re.sub(r'-+', '-', slug).strip('-')
        return slug[:80]

    async def generate_nexus_svg(
        self,
        topic: str,
        causal_graph: Dict[str, Any],
        synthesis_title: str,
        synthesis_id: str,
        geographic_context: Optional[List[Dict]] = None,
        key_metrics: Optional[List[Dict]] = None,
    ) -> Optional[str]:
        """
        Generate an animated SVG infographic for a topic's causal graph.
        Returns the SVG content string or None on failure.
        Rate-limited: 1 SVG per topic per pipeline run.
        """
        if not self.enabled:
            return None

        topic_slug = self._build_topic_slug(topic)

        # Rate limit: 1 per topic per run
        if topic_slug in self._generated_this_run:
            logger.debug(f"Nexus SVG already generated for '{topic}' this run, skipping")
            return None

        nodes = causal_graph.get("nodes", [])
        if len(nodes) < 3:
            logger.debug(f"Causal graph for '{topic}' has <3 nodes, skipping SVG")
            return None

        edges = causal_graph.get("edges", [])
        central_entity = causal_graph.get("central_entity", topic)

        # --- Layout engine ---
        geo_context = geographic_context or []
        metrics = key_metrics or []
        geo_points_raw = _resolve_geo_points(geo_context)
        has_geo = len(geo_points_raw) >= 2
        geo_points = _mercator_project(geo_points_raw) if has_geo else []

        # Assign IDs to nodes if missing
        for i, n in enumerate(nodes):
            if not n.get("id"):
                n["id"] = f"n{i}"

        layers = _topological_sort(nodes, edges)
        positions = _compute_node_positions(layers, nodes, has_geo)
        edge_paths = _compute_edge_paths(edges, positions, nodes)

        # Build node specs from positions
        node_specs = list(positions.values())

        # Date string
        date_str = datetime.now().strftime("%d %b %Y").upper()

        # Category
        category = topic.upper()[:20] if topic else "NEXUS"

        prompt = _build_svg_prompt(
            title=synthesis_title[:80],
            category=category,
            date_str=date_str,
            node_specs=node_specs,
            edge_specs=edge_paths,
            geo_points=geo_points,
            metrics=metrics[:3],
            central_entity=central_entity,
            has_geo=has_geo,
        )

        # --- Call OpenRouter ---
        async def _do_call() -> Optional[str]:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://novapressai.com",
                        "X-Title": "NovaPress AI",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are an SVG code generator. Output ONLY valid SVG code, nothing else. No markdown, no explanation."
                            },
                            {
                                "role": "user",
                                "content": prompt,
                            }
                        ],
                        "temperature": 0.2,
                        "max_tokens": 12000,
                    },
                )

                if response.status_code != 200:
                    raise ValueError(f"OpenRouter error {response.status_code}: {response.text[:300]}")

                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if not content:
                    raise ValueError("OpenRouter returned empty content")
                return content

        try:
            raw_svg = await self.circuit_breaker.call(_do_call)
            if not raw_svg:
                return None

            # Post-process
            svg_content = self._post_process_svg(raw_svg)
            if not svg_content:
                logger.warning(f"[nexus] SVG post-processing failed for '{topic}'")
                return None

            # Check size limit (50KB)
            if len(svg_content.encode('utf-8')) > 50_000:
                logger.warning(f"[nexus] SVG too large ({len(svg_content.encode('utf-8'))} bytes) for '{topic}', truncating")
                # Try to simplify by removing animation styles
                svg_content = re.sub(r'@keyframes\s+\w+\s*\{[^}]*\}', '', svg_content)
                svg_content = sanitize_svg(svg_content) or svg_content

            self._generated_this_run.add(topic_slug)

            # Store in Redis
            await self._store_in_redis(
                topic_slug=topic_slug,
                topic=topic,
                svg_content=svg_content,
                synthesis_id=synthesis_id,
                synthesis_title=synthesis_title,
                node_count=len(nodes),
                has_geo=has_geo,
                has_metrics=len(metrics) > 0,
            )

            logger.info(
                f"[nexus] Generated SVG for '{topic}' "
                f"({len(nodes)} nodes, {len(edge_paths)} edges, "
                f"geo={'yes' if has_geo else 'no'}, "
                f"{len(svg_content)} chars)"
            )
            return svg_content

        except CircuitOpenError:
            logger.warning("Nexus SVG circuit breaker is open, skipping")
            return None
        except Exception as e:
            logger.error(f"[nexus] SVG generation failed for '{topic}': {e}")
            return None

    def _post_process_svg(self, raw: str, default_viewbox: str = "0 0 1280 720") -> Optional[str]:
        """Clean up LLM output and sanitize."""
        content = raw.strip()

        # Strip markdown fences
        if content.startswith("```"):
            # Remove first line (```svg or ```)
            lines = content.split("\n", 1)
            content = lines[1] if len(lines) > 1 else content
        if content.endswith("```"):
            content = content[:-3].strip()

        # Find <svg ... </svg>
        svg_start = content.find("<svg")
        svg_end = content.rfind("</svg>")
        if svg_start == -1 or svg_end == -1:
            logger.warning("[nexus] No valid <svg>...</svg> found in LLM output")
            return None

        content = content[svg_start:svg_end + 6]  # 6 = len("</svg>")

        # Ensure viewBox is present
        if "viewBox" not in content:
            content = content.replace("<svg", f'<svg viewBox="{default_viewbox}"', 1)

        # Ensure preserveAspectRatio
        if "preserveAspectRatio" not in content:
            content = content.replace("<svg", '<svg preserveAspectRatio="xMidYMid meet"', 1)

        # Sanitize
        sanitized = sanitize_svg(content)
        return sanitized

    async def _store_in_redis(
        self,
        topic_slug: str,
        topic: str,
        svg_content: str,
        synthesis_id: str,
        synthesis_title: str,
        node_count: int,
        has_geo: bool,
        has_metrics: bool,
    ):
        """Store nexus SVG in Redis ZSET (score = unix timestamp)."""
        try:
            import aioredis
            redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

            key = f"novapress:nexus:{topic_slug}:svgs"
            now = time.time()

            entry = json.dumps({
                "svg_content": svg_content,
                "timestamp": now,
                "synthesis_id": synthesis_id,
                "synthesis_title": synthesis_title,
                "node_count": node_count,
                "topic": topic,
                "has_geo": has_geo,
                "has_metrics": has_metrics,
            })

            await redis.zadd(key, {entry: now})

            # Trim to keep only latest
            count = await redis.zcard(key)
            if count > MAX_SVGS_PER_TOPIC:
                await redis.zremrangebyrank(key, 0, count - MAX_SVGS_PER_TOPIC - 1)

            # TTL 90 days
            await redis.expire(key, 90 * 24 * 3600)

            await redis.aclose()
            logger.debug(f"[nexus] Stored SVG for '{topic}' in Redis ({count} total)")

        except Exception as e:
            logger.warning(f"[nexus] Failed to store SVG in Redis: {e}")

    async def get_timeline_svgs(self, topic_slug: str) -> List[Dict[str, Any]]:
        """Retrieve all nexus SVGs for a topic, ordered by timestamp (oldest first)."""
        try:
            import aioredis
            redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

            key = f"novapress:nexus:{topic_slug}:svgs"
            entries = await redis.zrangebyscore(key, "-inf", "+inf")

            await redis.aclose()

            svgs = []
            for entry in entries:
                try:
                    data = json.loads(entry)
                    svgs.append(data)
                except json.JSONDecodeError:
                    continue

            return svgs

        except Exception as e:
            logger.warning(f"[nexus] Failed to read SVGs from Redis for '{topic_slug}': {e}")
            return []

    # Legacy compatibility: also check old :images key
    async def get_timeline_images(self, topic_slug: str) -> List[Dict[str, Any]]:
        """Legacy method — returns SVGs (backward compat for API)."""
        return await self.get_timeline_svgs(topic_slug)

    # ==========================================
    # Editorial Geo SVG Maps
    # ==========================================

    def _build_geo_svg_prompt(
        self,
        title: str,
        category: str,
        projected_points: List[Dict[str, Any]],
    ) -> str:
        """Build prompt for editorial geo SVG map. LLM is a rendering engine."""

        # Markers section
        markers_text = ""
        for i, pt in enumerate(projected_points):
            markers_text += (
                f'  - Marker {i+1}: circle cx={pt["px"]}, cy={pt["py"]}, r=5, fill="#DC2626"\n'
                f'    Ping ring: circle cx={pt["px"]}, cy={pt["py"]}, r=5, fill="none", stroke="#DC2626", animation: ping 2s infinite, delay={i*0.3}s\n'
                f'    Label: "{pt["name"]}" in Georgia 11px bold fill="#FFFFFF", x={pt["px"]+10}, y={pt["py"]-8}\n'
                f'    Role: "{pt.get("role", "")}" in 9px fill="#888888", x={pt["px"]+10}, y={pt["py"]+6}\n'
            )

        # Dashed connections between points
        connections_text = ""
        if len(projected_points) >= 2:
            connections_text = "\nConnections (dashed lines between markers):\n"
            for i in range(len(projected_points) - 1):
                p1 = projected_points[i]
                p2 = projected_points[i + 1]
                connections_text += (
                    f'  - Line: x1={p1["px"]}, y1={p1["py"]}, x2={p2["px"]}, y2={p2["py"]}, '
                    f'stroke="#DC2626", stroke-opacity=0.3, stroke-dasharray="4,4", '
                    f'animation: drawLine 1s ease forwards, delay={0.5 + i * 0.3}s\n'
                )

        prompt = f"""You are an SVG code generator. Generate ONE valid SVG element.
Viewport: width="640" height="400" viewBox="0 0 640 400"

=== BACKGROUND ===
Full background: rect 0,0 640x400 fill="#0F1118"

=== GRID (subtle latitude/longitude lines) ===
- 5 horizontal lines across full width, stroke="#FFFFFF" stroke-opacity=0.04, stroke-width=0.5
- 5 vertical lines across full height, stroke="#FFFFFF" stroke-opacity=0.04, stroke-width=0.5

=== HEADER ===
- "GEOGRAPHIE" in 9px uppercase tracking=2px fill="#555555", x=20, y=24
- "{title[:60]}" in Georgia 13px bold fill="#FFFFFF", x=20, y=44
- Category badge: small rect rx=3 fill="#DC262622" + text "{category}" 8px uppercase fill="#DC2626", top-right
- Horizontal separator: line y=56, stroke="#1E293B", stroke-width=0.5

=== MAP MARKERS (y=70..370) ===
{markers_text}
{connections_text}

=== ANIMATIONS (in <style> inside the SVG) ===
@keyframes fadeIn {{
  from {{ opacity: 0; transform: translateY(4px); }}
  to {{ opacity: 1; transform: translateY(0); }}
}}
@keyframes ping {{
  0% {{ r: 5; opacity: 0.6; }}
  100% {{ r: 20; opacity: 0; }}
}}
@keyframes drawLine {{
  from {{ stroke-dashoffset: 200; }}
  to {{ stroke-dashoffset: 0; }}
}}
Each marker group: opacity: 0, animation: fadeIn 0.4s ease forwards, animation-delay provided above
Each connection line: stroke-dashoffset: 200, animation: drawLine 1s ease forwards

=== ABSOLUTE RULES ===
1. Output ONLY the SVG code. No markdown fences, no explanation.
2. Start with <svg and end with </svg>.
3. All labels must be readable: white text, dark backgrounds not needed (bg is already dark).
4. Font: Georgia for title/labels, system-ui for small text.
5. Keep total output under 6000 characters.
6. Use <style> inside the SVG for all animations.
7. The SVG must be self-contained (no external resources).
8. Do NOT draw a world map outline — only markers, grid, labels, and connections.
"""
        return prompt

    async def generate_geo_svg(
        self,
        synthesis_id: str,
        synthesis_title: str,
        geographic_context: List[Dict],
        geo_relevance: str,
        category: str = "",
    ) -> Optional[str]:
        """
        Generate an editorial geo SVG map for a synthesis.
        Returns SVG content string or None.
        """
        if not self.enabled:
            return None

        # Guard: skip if not relevant
        if geo_relevance == "none":
            return None

        # Guard: skip if already generated this run
        geo_key = f"geo:{synthesis_id}"
        if geo_key in self._generated_this_run:
            return None

        # Resolve and project geographic points
        geo_points = _resolve_geo_points(geographic_context)
        if len(geo_points) < 1:
            return None

        # Project to SVG coordinates (geo map viewport)
        projected = _mercator_project(
            geo_points,
            x_min=40, x_max=600,
            y_min=80, y_max=360,
        )

        if not projected:
            return None

        prompt = self._build_geo_svg_prompt(
            title=synthesis_title[:80],
            category=category.upper()[:20] if category else "MONDE",
            projected_points=projected,
        )

        # Call OpenRouter (same model as Nexus)
        async def _do_call() -> Optional[str]:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://novapressai.com",
                        "X-Title": "NovaPress AI",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are an SVG code generator. Output ONLY valid SVG code, nothing else. No markdown, no explanation."
                            },
                            {
                                "role": "user",
                                "content": prompt,
                            }
                        ],
                        "temperature": 0.2,
                        "max_tokens": 6000,
                    },
                )

                if response.status_code != 200:
                    raise ValueError(f"OpenRouter error {response.status_code}: {response.text[:300]}")

                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if not content:
                    raise ValueError("OpenRouter returned empty content")
                return content

        try:
            raw_svg = await self.circuit_breaker.call(_do_call)
            if not raw_svg:
                return None

            svg_content = self._post_process_svg(raw_svg, default_viewbox="0 0 640 400")
            if not svg_content:
                logger.warning(f"[geo] SVG post-processing failed for '{synthesis_id}'")
                return None

            # Size limit (30KB for geo maps)
            if len(svg_content.encode('utf-8')) > 30_000:
                svg_content = re.sub(r'@keyframes\s+\w+\s*\{[^}]*\}', '', svg_content)
                svg_content = sanitize_svg(svg_content) or svg_content

            self._generated_this_run.add(geo_key)

            # Store in Redis (simple string, not ZSET)
            await self._store_geo_svg(synthesis_id, svg_content)

            logger.info(
                f"[geo] Generated editorial map for '{synthesis_id}' "
                f"({len(projected)} markers, {len(svg_content)} chars)"
            )
            return svg_content

        except CircuitOpenError:
            logger.warning("[geo] Circuit breaker is open, skipping geo SVG")
            return None
        except Exception as e:
            logger.error(f"[geo] SVG generation failed for '{synthesis_id}': {e}")
            return None

    async def _store_geo_svg(self, synthesis_id: str, svg_content: str):
        """Store geo SVG in Redis as a simple string key."""
        try:
            import aioredis
            redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

            key = f"novapress:geo:{synthesis_id}:svg"
            await redis.set(key, svg_content, ex=90 * 24 * 3600)  # TTL 90 days

            await redis.aclose()
            logger.debug(f"[geo] Stored geo SVG for '{synthesis_id}' in Redis")

        except Exception as e:
            logger.warning(f"[geo] Failed to store geo SVG in Redis: {e}")

    async def get_geo_svg(self, synthesis_id: str) -> Optional[str]:
        """Retrieve geo SVG from Redis."""
        try:
            import aioredis
            redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

            key = f"novapress:geo:{synthesis_id}:svg"
            svg_content = await redis.get(key)

            await redis.aclose()
            return svg_content

        except Exception as e:
            logger.warning(f"[geo] Failed to read geo SVG from Redis: {e}")
            return None


# ==========================================
# Singleton
# ==========================================

_generator: Optional[NexusSvgGenerator] = None


def get_nexus_image_generator() -> NexusSvgGenerator:
    """Get or create the nexus SVG generator singleton."""
    global _generator
    if _generator is None:
        _generator = NexusSvgGenerator()
    return _generator
