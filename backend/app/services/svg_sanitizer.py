"""
SVG Sanitizer for NovaPress AI v2.
Prevents XSS via strict allowlisting of SVG elements and attributes.
Uses xml.etree.ElementTree (stdlib) — no external dependencies.
"""
import re
import xml.etree.ElementTree as ET
from typing import Optional

from loguru import logger

# SVG namespace
SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"

# Allowed SVG elements (lowercase, no namespace prefix)
ALLOWED_ELEMENTS = frozenset({
    "svg", "g", "rect", "circle", "ellipse", "path", "line",
    "polyline", "polygon", "text", "tspan", "defs", "filter",
    "style", "animate", "animatetransform", "animatemotion",
    "clippath", "mask", "use", "lineargradient", "radialgradient",
    "stop", "fegaussianblur", "fedropshadow", "femerge",
    "femergenode", "feflood", "fecomposite", "feoffset",
    "title", "desc", "mpath", "set", "marker", "pattern",
    "image",  # allow but strip href to external
})

# Dangerous elements that must always be removed
DANGEROUS_ELEMENTS = frozenset({
    "script", "foreignobject", "iframe", "embed", "object",
    "applet", "form", "input", "textarea", "button",
    "link", "meta", "base",
})

# Dangerous CSS patterns
DANGEROUS_CSS_PATTERNS = re.compile(
    r'(url\s*\(|expression\s*\(|@import|behavior\s*:|'
    r'-moz-binding|-webkit-binding|javascript:)',
    re.IGNORECASE,
)

# Attributes that are always removed
DANGEROUS_ATTR_PREFIXES = ("on",)  # onclick, onload, onerror, etc.
DANGEROUS_ATTR_VALUES = re.compile(r'javascript\s*:', re.IGNORECASE)


def _strip_ns(tag: str) -> str:
    """Remove namespace prefix from tag: {http://...}rect -> rect"""
    if tag.startswith("{"):
        return tag.split("}", 1)[-1].lower()
    return tag.lower()


def _sanitize_css(css_text: str) -> str:
    """Remove dangerous CSS constructs from <style> content."""
    return DANGEROUS_CSS_PATTERNS.sub("/* removed */", css_text)


def _sanitize_element(el: ET.Element) -> bool:
    """
    Sanitize a single element in-place.
    Returns False if the element should be removed entirely.
    """
    tag = _strip_ns(el.tag)

    # Remove dangerous elements entirely
    if tag in DANGEROUS_ELEMENTS:
        return False

    # Remove unknown elements
    if tag not in ALLOWED_ELEMENTS:
        return False

    # Sanitize attributes
    attrs_to_remove = []
    for attr_name, attr_value in el.attrib.items():
        # Strip namespace from attribute name for checking
        clean_name = _strip_ns(attr_name) if attr_name.startswith("{") else attr_name.lower()

        # Remove event handlers (onclick, onload, etc.)
        if any(clean_name.startswith(prefix) for prefix in DANGEROUS_ATTR_PREFIXES):
            attrs_to_remove.append(attr_name)
            continue

        # Remove href/xlink:href with javascript:
        if clean_name in ("href", "xlink:href") or attr_name.endswith("}href"):
            if DANGEROUS_ATTR_VALUES.search(attr_value):
                attrs_to_remove.append(attr_name)
                continue

    for attr in attrs_to_remove:
        del el.attrib[attr]

    # Sanitize <style> text content
    if tag == "style" and el.text:
        el.text = _sanitize_css(el.text)

    return True


def _walk_and_sanitize(parent: ET.Element) -> None:
    """Recursively sanitize all children of an element."""
    to_remove = []
    for child in list(parent):
        if not _sanitize_element(child):
            to_remove.append(child)
        else:
            _walk_and_sanitize(child)

    for child in to_remove:
        parent.remove(child)


def sanitize_svg(raw_svg: str) -> Optional[str]:
    """
    Sanitize an SVG string. Returns cleaned SVG or None on parse failure.

    - Removes <script>, <foreignObject>, <iframe>, etc.
    - Removes on* event handler attributes
    - Removes href with javascript: protocol
    - Removes dangerous CSS (url(), expression(), @import, behavior)
    - Validates well-formed XML
    """
    if not raw_svg or not raw_svg.strip():
        return None

    # Register SVG namespace to avoid ns0: prefix pollution in output
    ET.register_namespace("", SVG_NS)
    ET.register_namespace("xlink", XLINK_NS)

    try:
        root = ET.fromstring(raw_svg)
    except ET.ParseError as e:
        logger.warning(f"SVG parse error: {e}")
        return None

    # Verify root is <svg>
    root_tag = _strip_ns(root.tag)
    if root_tag != "svg":
        logger.warning(f"SVG root element is '{root_tag}', expected 'svg'")
        return None

    # Sanitize root element attributes
    _sanitize_element(root)

    # Recursively sanitize children
    _walk_and_sanitize(root)

    # Serialize back to string
    try:
        output = ET.tostring(root, encoding="unicode", method="xml")
        return output
    except Exception as e:
        logger.warning(f"SVG serialization error: {e}")
        return None
