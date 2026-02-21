"""
Chart generator for NovaPress Telegram bot.
Generates matplotlib PNG charts from Qdrant synthesis data.
Returns bytes for Telegram sendPhoto.
"""
import io
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

try:
    import matplotlib
    matplotlib.use("Agg")  # Non-interactive backend — no display needed
    import matplotlib.pyplot as plt
    import matplotlib.ticker as ticker

    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False
    logger.warning("matplotlib not installed — charts disabled")

# ─── Colors ───

CATEGORY_COLORS = {
    "TECH": "#2563EB",
    "MONDE": "#DC2626",
    "ECONOMIE": "#16A34A",
    "POLITIQUE": "#9333EA",
    "CULTURE": "#EA580C",
    "SPORT": "#0891B2",
    "SCIENCES": "#CA8A04",
    "AUTRE": "#6B7280",
}

# NovaPress newspaper aesthetic — light theme, clean
BG_COLOR = "#FAFAFA"
BORDER_COLOR = "#E5E5E5"
TEXT_COLOR = "#111111"
SECONDARY_COLOR = "#6B7280"
ACCENT = "#2563EB"


def _apply_newspaper_style(fig: Any, ax: Any, title: str) -> None:
    """Apply clean newspaper style to a matplotlib chart."""
    fig.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)

    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    for spine in ["bottom", "left"]:
        ax.spines[spine].set_color(BORDER_COLOR)
        ax.spines[spine].set_linewidth(0.8)

    ax.tick_params(colors=TEXT_COLOR, labelsize=9)
    ax.yaxis.label.set_color(SECONDARY_COLOR)
    ax.yaxis.label.set_fontsize(9)
    ax.set_title(title, color=TEXT_COLOR, fontsize=11, fontweight="bold", pad=12, loc="left")
    fig.tight_layout(pad=2.5)


def generate_category_chart(syntheses: List[Dict[str, Any]]) -> Optional[bytes]:
    """
    Bar chart: number of syntheses per category.
    Returns PNG bytes or None if matplotlib unavailable / no data.
    """
    if not HAS_MATPLOTLIB or not syntheses:
        return None

    try:
        counts: Dict[str, int] = {}
        for s in syntheses:
            cat = (s.get("category") or "AUTRE").upper()
            counts[cat] = counts.get(cat, 0) + 1

        if not counts:
            return None

        cats = sorted(counts, key=lambda c: counts[c], reverse=True)
        values = [counts[c] for c in cats]
        colors = [CATEGORY_COLORS.get(c, CATEGORY_COLORS["AUTRE"]) for c in cats]

        fig, ax = plt.subplots(figsize=(7, 4))
        bars = ax.bar(cats, values, color=colors, edgecolor="white", linewidth=0.5, width=0.65)

        for bar, val in zip(bars, values):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.15,
                str(val),
                ha="center",
                va="bottom",
                color=TEXT_COLOR,
                fontsize=9,
                fontweight="bold",
            )

        ax.set_ylabel("Nombre de synthèses", color=SECONDARY_COLOR, fontsize=9)
        ax.yaxis.set_major_locator(ticker.MaxNLocator(integer=True))
        ax.set_ylim(bottom=0, top=max(values) * 1.25)
        ax.yaxis.grid(True, color=BORDER_COLOR, linewidth=0.5, linestyle="--")
        ax.set_axisbelow(True)
        _apply_newspaper_style(fig, ax, "Synthèses par catégorie")

        buf = io.BytesIO()
        plt.savefig(buf, format="png", dpi=130, bbox_inches="tight", facecolor=BG_COLOR)
        plt.close(fig)
        buf.seek(0)
        return buf.read()

    except Exception as exc:
        logger.error(f"category_chart failed: {exc}")
        return None


def generate_transparency_chart(syntheses: List[Dict[str, Any]]) -> Optional[bytes]:
    """
    Horizontal bar chart: average transparency score per category.
    Returns PNG bytes or None.
    """
    if not HAS_MATPLOTLIB or not syntheses:
        return None

    try:
        cat_scores: Dict[str, List[float]] = {}
        for s in syntheses:
            cat = (s.get("category") or "AUTRE").upper()
            score = float(s.get("transparency_score") or 0)
            if score > 0:
                cat_scores.setdefault(cat, []).append(score)

        if not cat_scores:
            return None

        cats = list(cat_scores.keys())
        avgs = [sum(v) / len(v) for v in cat_scores.values()]
        colors = [CATEGORY_COLORS.get(c, CATEGORY_COLORS["AUTRE"]) for c in cats]

        # Sort ascending so highest appears on top
        sorted_data = sorted(zip(cats, avgs, colors), key=lambda x: x[1])
        if not sorted_data:
            return None
        cats_s, avgs_s, colors_s = zip(*sorted_data)

        fig, ax = plt.subplots(figsize=(7, 4))
        bars = ax.barh(list(cats_s), list(avgs_s), color=list(colors_s), edgecolor="white", linewidth=0.5, height=0.55)

        for bar, val in zip(bars, avgs_s):
            ax.text(
                val + 0.8,
                bar.get_y() + bar.get_height() / 2,
                f"{val:.0f}/100",
                va="center",
                color=TEXT_COLOR,
                fontsize=9,
                fontweight="bold",
            )

        ax.set_xlim(0, 115)
        ax.set_xlabel("Score de transparence / 100", color=SECONDARY_COLOR, fontsize=9)
        ax.xaxis.grid(True, color=BORDER_COLOR, linewidth=0.5, linestyle="--")
        ax.set_axisbelow(True)
        _apply_newspaper_style(fig, ax, "Fiabilité par catégorie")

        buf = io.BytesIO()
        plt.savefig(buf, format="png", dpi=130, bbox_inches="tight", facecolor=BG_COLOR)
        plt.close(fig)
        buf.seek(0)
        return buf.read()

    except Exception as exc:
        logger.error(f"transparency_chart failed: {exc}")
        return None


def generate_timeline_chart(syntheses: List[Dict[str, Any]]) -> Optional[bytes]:
    """
    Line chart: syntheses published per day over the last 7 days.
    Returns PNG bytes or None.
    """
    if not HAS_MATPLOTLIB or not syntheses:
        return None

    try:
        now = datetime.now(timezone.utc)
        day_labels = [(now - timedelta(days=i)).strftime("%d/%m") for i in range(6, -1, -1)]
        day_keys = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
        counts: Dict[str, int] = {k: 0 for k in day_keys}

        for s in syntheses:
            created = s.get("created_at")
            if not created:
                continue
            try:
                if isinstance(created, (int, float)):
                    dt = datetime.fromtimestamp(float(created), tz=timezone.utc)
                elif isinstance(created, str):
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                else:
                    continue
                key = dt.strftime("%Y-%m-%d")
                if key in counts:
                    counts[key] += 1
            except (ValueError, OSError, TypeError):
                continue

        values = [counts[k] for k in day_keys]

        fig, ax = plt.subplots(figsize=(8, 4))
        ax.fill_between(range(7), values, alpha=0.12, color=ACCENT)
        ax.plot(
            range(7),
            values,
            color=ACCENT,
            linewidth=2.5,
            marker="o",
            markersize=6,
            markerfacecolor="white",
            markeredgecolor=ACCENT,
            markeredgewidth=2,
        )

        for i, v in enumerate(values):
            if v > 0:
                ax.annotate(
                    str(v),
                    (i, v),
                    textcoords="offset points",
                    xytext=(0, 9),
                    ha="center",
                    color=ACCENT,
                    fontsize=9,
                    fontweight="bold",
                )

        ax.set_xticks(range(7))
        ax.set_xticklabels(day_labels, color=TEXT_COLOR, fontsize=9)
        ax.set_ylabel("Synthèses publiées", color=SECONDARY_COLOR, fontsize=9)
        ax.yaxis.set_major_locator(ticker.MaxNLocator(integer=True))
        ax.set_ylim(bottom=0, top=max(max(values, default=1) * 1.3, 2))
        ax.yaxis.grid(True, color=BORDER_COLOR, linewidth=0.5, linestyle="--")
        ax.set_axisbelow(True)
        _apply_newspaper_style(fig, ax, "Volume de synthèses — 7 derniers jours")

        buf = io.BytesIO()
        plt.savefig(buf, format="png", dpi=130, bbox_inches="tight", facecolor=BG_COLOR)
        plt.close(fig)
        buf.seek(0)
        return buf.read()

    except Exception as exc:
        logger.error(f"timeline_chart failed: {exc}")
        return None
