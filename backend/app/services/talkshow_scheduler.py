"""
Talkshow Scheduler
Automatically generates talkshow episodes:
- Daily for "hot" topics (many nodes, recent activity)
- Weekly for other active topics
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from loguru import logger


# Thresholds for hot vs warm topics
HOT_MIN_SYNTHESES = 5       # At least 5 syntheses
HOT_MIN_NODES = 8           # At least 8 causal nodes
HOT_RECENT_DAYS = 3         # Activity in last 3 days

WARM_MIN_SYNTHESES = 2      # At least 2 syntheses for weekly
WARM_RECENT_DAYS = 14       # Activity in last 14 days

MAX_DAILY_EPISODES = 3      # Max hot episodes per day
MAX_WEEKLY_EPISODES = 5     # Max warm episodes per week


async def run_talkshow_scheduler():
    """
    Main scheduler entry point.
    Called by APScheduler or pipeline hook.
    Generates talkshows for eligible topics.
    """
    from app.ml.topic_tracker import get_topic_tracker
    from app.services.talkshow_generator import get_talkshow_generator
    from app.services.podcast_feed import get_podcast_feed

    tracker = get_topic_tracker()
    generator = get_talkshow_generator()
    feed = get_podcast_feed()

    # Get all active topics
    try:
        all_topics = await tracker.get_all_topics()
    except Exception as e:
        logger.error(f"Talkshow scheduler: failed to get topics: {e}")
        return {"generated": 0, "error": str(e)}

    if not all_topics:
        logger.info("Talkshow scheduler: no topics found")
        return {"generated": 0}

    now = datetime.now(timezone.utc)
    hot_topics: List[Dict[str, Any]] = []
    warm_topics: List[Dict[str, Any]] = []

    for topic_info in all_topics:
        topic_name = topic_info.get("topic", "")
        if not topic_name:
            continue

        synthesis_count = topic_info.get("synthesis_count", 0)
        is_active = topic_info.get("is_active", False)

        if not is_active or synthesis_count < WARM_MIN_SYNTHESES:
            continue

        # Check recency
        last_date_str = topic_info.get("last_date", "")
        try:
            if last_date_str:
                last_date = datetime.fromisoformat(
                    last_date_str.replace("Z", "+00:00")
                )
                days_ago = (now - last_date).days
            else:
                days_ago = 999
        except (ValueError, TypeError):
            days_ago = 999

        # Classify: hot or warm
        node_count = topic_info.get("node_count", 0)

        if (
            synthesis_count >= HOT_MIN_SYNTHESES
            and node_count >= HOT_MIN_NODES
            and days_ago <= HOT_RECENT_DAYS
        ):
            hot_topics.append({
                "topic": topic_name,
                "synthesis_count": synthesis_count,
                "node_count": node_count,
                "days_ago": days_ago,
                "priority": "hot",
            })
        elif days_ago <= WARM_RECENT_DAYS:
            warm_topics.append({
                "topic": topic_name,
                "synthesis_count": synthesis_count,
                "node_count": node_count,
                "days_ago": days_ago,
                "priority": "warm",
            })

    # Sort by relevance (more syntheses + more nodes = higher priority)
    hot_topics.sort(
        key=lambda t: (t["synthesis_count"] * 2 + t["node_count"]),
        reverse=True,
    )
    warm_topics.sort(
        key=lambda t: (t["synthesis_count"] * 2 + t["node_count"]),
        reverse=True,
    )

    # Check which topics already have recent episodes
    existing_episodes = feed.get_episodes(limit=100)
    recent_episode_topics = set()
    for ep in existing_episodes:
        try:
            ep_date = datetime.fromisoformat(
                ep.get("published_at", "").replace("Z", "+00:00")
            )
            age_hours = (now - ep_date).total_seconds() / 3600
            # Hot: skip if episode < 20h old
            # Warm: skip if episode < 6 days old
            if age_hours < 20:
                recent_episode_topics.add(("hot", ep.get("topic", "")))
            if age_hours < 144:  # 6 days
                recent_episode_topics.add(("warm", ep.get("topic", "")))
        except (ValueError, TypeError):
            pass

    generated = []

    # Generate hot episodes (daily)
    for topic_info in hot_topics[:MAX_DAILY_EPISODES]:
        topic_name = topic_info["topic"]
        if ("hot", topic_name) in recent_episode_topics:
            logger.info(f"Talkshow skip (recent): {topic_name}")
            continue

        ep = await _generate_episode(tracker, generator, feed, topic_name)
        if ep:
            generated.append(ep)

    # Generate warm episodes (weekly) — only if it's Monday or if no warm episodes exist
    is_weekly_day = now.weekday() == 0  # Monday
    no_warm_yet = not any(
        ("warm", t["topic"]) in recent_episode_topics
        for t in warm_topics
    )

    if is_weekly_day or no_warm_yet:
        for topic_info in warm_topics[:MAX_WEEKLY_EPISODES]:
            topic_name = topic_info["topic"]
            if ("warm", topic_name) in recent_episode_topics:
                continue

            ep = await _generate_episode(tracker, generator, feed, topic_name)
            if ep:
                generated.append(ep)

    logger.info(
        f"Talkshow scheduler: {len(generated)} episodes generated "
        f"(hot={len(hot_topics)}, warm={len(warm_topics)})"
    )

    return {
        "generated": len(generated),
        "episodes": [e.get("title", "") for e in generated],
        "hot_topics": len(hot_topics),
        "warm_topics": len(warm_topics),
    }


async def _generate_episode(
    tracker, generator, feed, topic_name: str
) -> Optional[Dict[str, Any]]:
    """Generate a single talkshow episode for a topic."""
    try:
        dashboard = await tracker.get_topic_dashboard(topic_name)
        if not dashboard or not dashboard.get("syntheses"):
            return None

        result = await generator.generate_talkshow(
            topic=dashboard["topic"],
            syntheses=dashboard.get("syntheses", []),
            causal_graph=dashboard.get("aggregated_causal_graph"),
            predictions=dashboard.get("predictions_summary", []),
            duration_target=300,
        )

        if not result:
            logger.warning(f"Talkshow generation failed for: {topic_name}")
            return None

        # Auto-publish to podcast feed
        if result.get("has_audio") and result.get("audio_cache_key"):
            episode = feed.publish_episode(
                topic=result["topic"],
                cache_key=result["audio_cache_key"],
                script=result.get("script", []),
                duration_seconds=result.get("duration_target", 300),
                panelists=result.get("panelists", []),
            )
            logger.info(f"Talkshow published: {topic_name}")
            return episode
        else:
            logger.info(f"Talkshow script only (no audio): {topic_name}")
            return result

    except Exception as e:
        logger.error(f"Talkshow episode failed for {topic_name}: {e}")
        return None


async def generate_single_episode(topic_name: str) -> Optional[Dict[str, Any]]:
    """Generate a single episode on demand (for API/admin use)."""
    from app.ml.topic_tracker import get_topic_tracker
    from app.services.talkshow_generator import get_talkshow_generator
    from app.services.podcast_feed import get_podcast_feed

    tracker = get_topic_tracker()
    generator = get_talkshow_generator()
    feed = get_podcast_feed()

    return await _generate_episode(tracker, generator, feed, topic_name)
