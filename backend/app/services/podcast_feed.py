"""
NovaPress Podcast Feed Service
Generates a standard RSS/XML podcast feed compatible with:
- Spotify for Podcasters
- Apple Podcasts
- Google Podcasts
- Deezer, Amazon Music, Pocket Casts, etc.

All platforms consume the same RSS feed URL.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from xml.sax.saxutils import escape as xml_escape

from loguru import logger


FEED_DIR = Path("audio_cache/talkshows")
EPISODES_REGISTRY = FEED_DIR / "_episodes.json"

# Podcast metadata
PODCAST_META = {
    "title": "NovaPress Talkshow — Le debat IA de l'actualite",
    "description": (
        "Chaque jour, 5 experts IA analysent et debattent les grands dossiers "
        "de l'actualite mondiale. Geopolitique, technologie, economie, sciences : "
        "des perspectives croisees pour comprendre le monde. "
        "Genere par l'intelligence artificielle de NovaPress."
    ),
    "language": "fr",
    "author": "NovaPress AI",
    "email": "contact@novapressai.com",
    "category": "News",
    "subcategory": "Daily News",
    "explicit": "no",
    "image": "/images/podcast-cover.jpg",
    "website": "https://novapressai.com",
}


class PodcastFeedService:
    """Manages podcast episodes and generates RSS feed."""

    def __init__(self):
        FEED_DIR.mkdir(parents=True, exist_ok=True)
        self._episodes: List[Dict[str, Any]] = []
        self._load_registry()

    def _load_registry(self):
        """Load episodes from disk registry."""
        if EPISODES_REGISTRY.exists():
            try:
                self._episodes = json.loads(
                    EPISODES_REGISTRY.read_text(encoding="utf-8")
                )
            except (json.JSONDecodeError, ValueError):
                self._episodes = []
        else:
            self._episodes = []

    def _save_registry(self):
        """Persist episodes to disk."""
        EPISODES_REGISTRY.write_text(
            json.dumps(self._episodes, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def publish_episode(
        self,
        topic: str,
        cache_key: str,
        script: List[Dict[str, str]],
        duration_seconds: int,
        panelists: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """
        Register a talkshow as a podcast episode.
        Called after successful audio generation.
        """
        # Check if already published
        for ep in self._episodes:
            if ep.get("cache_key") == cache_key:
                logger.info(f"Episode already published: {cache_key[:8]}")
                return ep

        # Determine audio file size (MP3 preferred for Spotify/Apple)
        mp3_path = FEED_DIR / f"{cache_key}.mp3"
        ogg_path = FEED_DIR / f"{cache_key}.ogg"
        if mp3_path.exists():
            file_size = mp3_path.stat().st_size
            audio_format = "audio/mpeg"
            audio_file = f"{cache_key}.mp3"
        elif ogg_path.exists():
            file_size = ogg_path.stat().st_size
            audio_format = "audio/ogg"
            audio_file = f"{cache_key}.ogg"
        else:
            logger.warning(f"No audio file for episode {cache_key[:8]}")
            return {}

        # Build description from script
        description_parts = []
        panelist_names = {p["id"]: p["name"] for p in panelists}
        for line in script[:3]:
            speaker = panelist_names.get(line["speaker"], line["speaker"])
            text = line["text"][:150]
            description_parts.append(f"{speaker}: {text}")
        description = " | ".join(description_parts)

        # Build episode number
        episode_number = len(self._episodes) + 1

        episode = {
            "id": str(uuid.uuid4()),
            "episode_number": episode_number,
            "topic": topic,
            "title": f"#{episode_number} — {topic}",
            "description": description,
            "cache_key": cache_key,
            "audio_file": audio_file,
            "audio_format": audio_format,
            "file_size": file_size,
            "duration_seconds": duration_seconds,
            "panelists": [p["name"] for p in panelists],
            "published_at": datetime.now(timezone.utc).isoformat(),
            "script_line_count": len(script),
        }

        self._episodes.append(episode)
        self._save_registry()

        logger.info(
            f"Published episode #{episode_number}: {topic} ({file_size // 1024}KB)"
        )
        return episode

    def get_episodes(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent episodes, newest first."""
        return sorted(
            self._episodes,
            key=lambda e: e.get("published_at", ""),
            reverse=True,
        )[:limit]

    def get_episode_count(self) -> int:
        return len(self._episodes)

    def generate_rss(self, base_url: str) -> str:
        """
        Generate a valid podcast RSS/XML feed.

        Args:
            base_url: Public base URL (e.g. https://novapressai.com)

        Returns:
            XML string conforming to RSS 2.0 + iTunes podcast spec
        """
        episodes = self.get_episodes(limit=100)
        meta = PODCAST_META

        image_url = f"{base_url}{meta['image']}"
        feed_url = f"{base_url}/api/talkshow/feed.xml"
        site_url = meta["website"]

        # Build date strings
        now_rfc822 = _rfc822(datetime.now(timezone.utc))
        last_build = now_rfc822
        if episodes:
            try:
                last_pub = datetime.fromisoformat(
                    episodes[0]["published_at"].replace("Z", "+00:00")
                )
                last_build = _rfc822(last_pub)
            except (ValueError, KeyError):
                pass

        items_xml = []
        for ep in episodes:
            audio_url = f"{base_url}/api/talkshow/audio/{ep['cache_key']}"
            ep_link = f"{site_url}/topics/{_url_encode(ep['topic'])}/talkshow"

            try:
                pub_date = datetime.fromisoformat(
                    ep["published_at"].replace("Z", "+00:00")
                )
                pub_rfc822 = _rfc822(pub_date)
            except (ValueError, KeyError):
                pub_rfc822 = now_rfc822

            duration_str = _format_duration(ep.get("duration_seconds", 300))
            panelists_str = ", ".join(ep.get("panelists", []))

            items_xml.append(f"""    <item>
      <title>{xml_escape(ep.get('title', ep['topic']))}</title>
      <description><![CDATA[{ep.get('description', '')}

Panelistes: {panelists_str}

Ecouter sur NovaPress: {ep_link}]]></description>
      <link>{xml_escape(ep_link)}</link>
      <guid isPermaLink="false">{ep['id']}</guid>
      <pubDate>{pub_rfc822}</pubDate>
      <enclosure url="{xml_escape(audio_url)}" length="{ep.get('file_size', 0)}" type="{ep.get('audio_format', 'audio/ogg')}" />
      <itunes:duration>{duration_str}</itunes:duration>
      <itunes:episode>{ep.get('episode_number', 0)}</itunes:episode>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>{meta['explicit']}</itunes:explicit>
      <itunes:summary>{xml_escape(ep.get('description', '')[:250])}</itunes:summary>
    </item>""")

        items_block = "\n".join(items_xml)

        rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:spotify="http://www.spotify.com/ns/rss"
     xmlns:googleplay="http://www.google.com/schemas/play-podcasts/1.0">
  <channel>
    <title>{xml_escape(meta['title'])}</title>
    <description><![CDATA[{meta['description']}]]></description>
    <link>{xml_escape(site_url)}</link>
    <language>{meta['language']}</language>
    <copyright>NovaPress AI {datetime.now().year}</copyright>
    <lastBuildDate>{last_build}</lastBuildDate>
    <atom:link href="{xml_escape(feed_url)}" rel="self" type="application/rss+xml" />

    <itunes:author>{xml_escape(meta['author'])}</itunes:author>
    <itunes:summary><![CDATA[{meta['description']}]]></itunes:summary>
    <itunes:owner>
      <itunes:name>{xml_escape(meta['author'])}</itunes:name>
      <itunes:email>{xml_escape(meta['email'])}</itunes:email>
    </itunes:owner>
    <itunes:image href="{xml_escape(image_url)}" />
    <itunes:category text="{xml_escape(meta['category'])}">
      <itunes:category text="{xml_escape(meta['subcategory'])}" />
    </itunes:category>
    <itunes:explicit>{meta['explicit']}</itunes:explicit>
    <itunes:type>episodic</itunes:type>

    <image>
      <url>{xml_escape(image_url)}</url>
      <title>{xml_escape(meta['title'])}</title>
      <link>{xml_escape(site_url)}</link>
    </image>

    <googleplay:author>{xml_escape(meta['author'])}</googleplay:author>
    <googleplay:description><![CDATA[{meta['description']}]]></googleplay:description>
    <googleplay:image href="{xml_escape(image_url)}" />
    <googleplay:category text="{xml_escape(meta['category'])}" />

{items_block}
  </channel>
</rss>"""

        return rss


def _rfc822(dt: datetime) -> str:
    """Format datetime as RFC 822 (required by RSS)."""
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (
        f"{days[dt.weekday()]}, {dt.day:02d} {months[dt.month - 1]} "
        f"{dt.year} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d} +0000"
    )


def _format_duration(seconds: int) -> str:
    """Format seconds as HH:MM:SS for iTunes."""
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _url_encode(text: str) -> str:
    """Simple URL encoding for topic names."""
    import urllib.parse
    return urllib.parse.quote(text, safe="")


# Global instance
_feed_service: Optional[PodcastFeedService] = None


def get_podcast_feed() -> PodcastFeedService:
    global _feed_service
    if _feed_service is None:
        _feed_service = PodcastFeedService()
    return _feed_service
