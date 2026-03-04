"""
SVG Template Generator for NovaPress AI v2

Generates newspaper-style SVG illustrations (1280x720) per category.
Used as fallback when no Wikimedia Commons image is found.

Zero external dependencies, deterministic output, instant rendering.
Stored in Redis with same pattern as editorial SVGs.
"""
import html
import logging
from typing import List, Optional

logger = logging.getLogger("novapress.svg_template")

# Category configurations: icon SVG path, accent color, label
CATEGORY_CONFIG = {
    "MONDE": {
        "color": "#DC2626",
        "label": "MONDE",
        "icon": (
            '<circle cx="640" cy="300" r="100" fill="none" stroke="#DC2626" stroke-width="2"/>'
            '<ellipse cx="640" cy="300" rx="100" ry="40" fill="none" stroke="#DC2626" stroke-width="1.5"/>'
            '<ellipse cx="640" cy="300" rx="40" ry="100" fill="none" stroke="#DC2626" stroke-width="1.5"/>'
            '<line x1="540" y1="300" x2="740" y2="300" stroke="#DC2626" stroke-width="1" stroke-dasharray="4,4"/>'
            '<line x1="640" y1="200" x2="640" y2="400" stroke="#DC2626" stroke-width="1" stroke-dasharray="4,4"/>'
        ),
    },
    "POLITIQUE": {
        "color": "#1E3A5F",
        "label": "POLITIQUE",
        "icon": (
            # Balance / columns
            '<rect x="590" y="350" width="100" height="10" rx="2" fill="#1E3A5F"/>'
            '<rect x="635" y="230" width="10" height="120" fill="#1E3A5F"/>'
            '<circle cx="640" cy="225" r="8" fill="#1E3A5F"/>'
            '<line x1="580" y1="250" x2="640" y2="230" stroke="#1E3A5F" stroke-width="2"/>'
            '<line x1="700" y1="250" x2="640" y2="230" stroke="#1E3A5F" stroke-width="2"/>'
            '<rect x="560" y="245" width="40" height="25" rx="3" fill="none" stroke="#1E3A5F" stroke-width="1.5"/>'
            '<rect x="680" y="245" width="40" height="25" rx="3" fill="none" stroke="#1E3A5F" stroke-width="1.5"/>'
        ),
    },
    "ECONOMIE": {
        "color": "#065F46",
        "label": "ECONOMIE",
        "icon": (
            # Bar chart
            '<rect x="570" y="310" width="30" height="90" rx="2" fill="#065F46" opacity="0.3"/>'
            '<rect x="610" y="270" width="30" height="130" rx="2" fill="#065F46" opacity="0.5"/>'
            '<rect x="650" y="240" width="30" height="160" rx="2" fill="#065F46" opacity="0.7"/>'
            '<rect x="690" y="290" width="30" height="110" rx="2" fill="#065F46" opacity="0.9"/>'
            '<line x1="560" y1="400" x2="730" y2="400" stroke="#065F46" stroke-width="2"/>'
            '<polyline points="575,305 625,265 665,235 705,285" fill="none" stroke="#065F46" stroke-width="2" stroke-dasharray="6,3"/>'
        ),
    },
    "TECH": {
        "color": "#2563EB",
        "label": "TECH",
        "icon": (
            # Circuit grid
            '<rect x="590" y="250" width="100" height="100" rx="8" fill="none" stroke="#2563EB" stroke-width="2"/>'
            '<circle cx="640" cy="300" r="15" fill="#2563EB" opacity="0.2"/>'
            '<circle cx="640" cy="300" r="6" fill="#2563EB"/>'
            '<line x1="590" y1="300" x2="624" y2="300" stroke="#2563EB" stroke-width="1.5"/>'
            '<line x1="656" y1="300" x2="690" y2="300" stroke="#2563EB" stroke-width="1.5"/>'
            '<line x1="640" y1="250" x2="640" y2="284" stroke="#2563EB" stroke-width="1.5"/>'
            '<line x1="640" y1="316" x2="640" y2="350" stroke="#2563EB" stroke-width="1.5"/>'
            '<circle cx="590" cy="300" r="3" fill="#2563EB"/>'
            '<circle cx="690" cy="300" r="3" fill="#2563EB"/>'
            '<circle cx="640" cy="250" r="3" fill="#2563EB"/>'
            '<circle cx="640" cy="350" r="3" fill="#2563EB"/>'
        ),
    },
    "SCIENCES": {
        "color": "#7C3AED",
        "label": "SCIENCES",
        "icon": (
            # Atom
            '<circle cx="640" cy="300" r="8" fill="#7C3AED"/>'
            '<ellipse cx="640" cy="300" rx="70" ry="25" fill="none" stroke="#7C3AED" stroke-width="1.5" transform="rotate(0,640,300)"/>'
            '<ellipse cx="640" cy="300" rx="70" ry="25" fill="none" stroke="#7C3AED" stroke-width="1.5" transform="rotate(60,640,300)"/>'
            '<ellipse cx="640" cy="300" rx="70" ry="25" fill="none" stroke="#7C3AED" stroke-width="1.5" transform="rotate(-60,640,300)"/>'
            '<circle cx="710" cy="300" r="4" fill="#7C3AED" opacity="0.6"/>'
            '<circle cx="605" cy="260" r="4" fill="#7C3AED" opacity="0.6"/>'
            '<circle cx="675" cy="340" r="4" fill="#7C3AED" opacity="0.6"/>'
        ),
    },
    "SPORT": {
        "color": "#DC2626",
        "label": "SPORT",
        "icon": (
            # Trophy
            '<rect x="620" y="260" width="40" height="60" rx="4" fill="none" stroke="#DC2626" stroke-width="2"/>'
            '<path d="M620,280 Q600,280 600,300 Q600,320 620,320" fill="none" stroke="#DC2626" stroke-width="1.5"/>'
            '<path d="M660,280 Q680,280 680,300 Q680,320 660,320" fill="none" stroke="#DC2626" stroke-width="1.5"/>'
            '<rect x="630" y="320" width="20" height="20" fill="#DC2626" opacity="0.3"/>'
            '<rect x="615" y="340" width="50" height="8" rx="2" fill="#DC2626" opacity="0.5"/>'
            '<circle cx="640" cy="285" r="5" fill="#DC2626" opacity="0.4"/>'
        ),
    },
    "CULTURE": {
        "color": "#92400E",
        "label": "CULTURE",
        "icon": (
            # Book / open pages
            '<path d="M640,250 L640,370" stroke="#92400E" stroke-width="2"/>'
            '<path d="M640,260 Q610,255 580,265 L580,360 Q610,350 640,355" fill="none" stroke="#92400E" stroke-width="1.5"/>'
            '<path d="M640,260 Q670,255 700,265 L700,360 Q670,350 640,355" fill="none" stroke="#92400E" stroke-width="1.5"/>'
            '<line x1="592" y1="280" x2="630" y2="276" stroke="#92400E" stroke-width="1" opacity="0.4"/>'
            '<line x1="592" y1="300" x2="630" y2="296" stroke="#92400E" stroke-width="1" opacity="0.4"/>'
            '<line x1="592" y1="320" x2="630" y2="316" stroke="#92400E" stroke-width="1" opacity="0.4"/>'
            '<line x1="650" y1="276" x2="688" y2="280" stroke="#92400E" stroke-width="1" opacity="0.4"/>'
            '<line x1="650" y1="296" x2="688" y2="300" stroke="#92400E" stroke-width="1" opacity="0.4"/>'
            '<line x1="650" y1="316" x2="688" y2="320" stroke="#92400E" stroke-width="1" opacity="0.4"/>'
        ),
    },
}

# Default fallback for unknown categories
DEFAULT_CONFIG = CATEGORY_CONFIG["MONDE"]


class SvgTemplateGenerator:
    """Generates newspaper-style SVG templates by category."""

    def generate(
        self,
        category: str,
        title: str,
        entities: List[str],
    ) -> Optional[str]:
        """
        Generate a 1280x720 SVG template for a synthesis.

        Returns SVG string or None on error.
        """
        try:
            config = CATEGORY_CONFIG.get(category.upper(), DEFAULT_CONFIG)
            color = config["color"]
            label = config["label"]
            icon_svg = config["icon"]

            # Escape HTML entities in text
            safe_title = html.escape(title or "Synthese NovaPress")
            safe_entities = [html.escape(e) for e in entities[:5] if e]

            # Truncate title for display (max ~60 chars)
            display_title = safe_title[:60] + "..." if len(safe_title) > 60 else safe_title

            # Build entity tags
            entity_tags = ""
            if safe_entities:
                x_start = 640 - (len(safe_entities) * 50)
                for i, ent in enumerate(safe_entities[:4]):
                    x = x_start + i * 120
                    ent_display = ent[:18] + "..." if len(ent) > 18 else ent
                    entity_tags += (
                        f'<rect x="{x}" y="430" width="{len(ent_display) * 8 + 16}" height="26" rx="3" '
                        f'fill="{color}" opacity="0.08"/>'
                        f'<text x="{x + 8}" y="448" font-family="Georgia, serif" font-size="12" '
                        f'fill="{color}" opacity="0.7">{ent_display}</text>'
                    )

            svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
  <!-- Background -->
  <rect width="1280" height="720" fill="#FFFFFF"/>

  <!-- Subtle grid lines (newspaper style) -->
  <line x1="0" y1="1" x2="1280" y2="1" stroke="#E5E5E5" stroke-width="2"/>
  <line x1="0" y1="719" x2="1280" y2="719" stroke="#E5E5E5" stroke-width="2"/>
  <line x1="100" y1="0" x2="100" y2="720" stroke="#F3F4F6" stroke-width="0.5"/>
  <line x1="1180" y1="0" x2="1180" y2="720" stroke="#F3F4F6" stroke-width="0.5"/>

  <!-- Category badge (top-left) -->
  <rect x="40" y="30" width="{len(label) * 11 + 24}" height="32" rx="2" fill="{color}"/>
  <text x="52" y="51" font-family="Arial, sans-serif" font-size="13" font-weight="700"
        fill="#FFFFFF" letter-spacing="1.5">{label}</text>

  <!-- NovaPress watermark (top-right) -->
  <text x="1240" y="52" font-family="Georgia, serif" font-size="14" fill="#D1D5DB"
        text-anchor="end" font-style="italic">NovaPress AI</text>

  <!-- Central icon -->
  <g opacity="0.9">
    {icon_svg}
  </g>

  <!-- Title (below icon) -->
  <text x="640" y="500" font-family="Georgia, serif" font-size="22" font-weight="700"
        fill="#000000" text-anchor="middle" letter-spacing="0.3">{display_title}</text>

  <!-- Entities -->
  <g>
    {entity_tags}
  </g>

  <!-- Bottom decorative line -->
  <line x1="440" y1="680" x2="840" y2="680" stroke="{color}" stroke-width="1" opacity="0.3"/>

  <!-- Bottom-right credit -->
  <text x="1240" y="700" font-family="Arial, sans-serif" font-size="10" fill="#D1D5DB"
        text-anchor="end">Illustration NovaPress</text>
</svg>'''

            return svg

        except Exception as e:
            logger.error(f"SVG template generation failed: {e}")
            return None


# Singleton
_generator: Optional[SvgTemplateGenerator] = None


def get_svg_template_generator() -> SvgTemplateGenerator:
    global _generator
    if _generator is None:
        _generator = SvgTemplateGenerator()
    return _generator
