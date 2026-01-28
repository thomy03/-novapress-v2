"""
Social Triggers Service - NovaPress AI v2
Detects emerging topics from social media that don't yet exist in our clusters.
Creates "avant-garde" syntheses for trending topics.

Phase 6.2 - Scraping Improvement Plan
"""
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from loguru import logger
import asyncio

from app.core.config import settings
from app.services.social_scraper import social_scraper
from app.services.news_apis import get_news_apis


class SocialTriggerService:
    """
    Detects emerging/trending topics from social media.
    Creates avant-garde syntheses for topics not yet covered by mainstream news.

    Flow:
    1. Fetch trending topics from Reddit/Bluesky
    2. Check if topic already exists in our clusters
    3. If new: fetch related articles from GDELT
    4. Generate avant-garde synthesis

    Avant-garde = We cover it BEFORE mainstream media clusters form
    """

    # Minimum virality score to consider a topic "trending"
    MIN_VIRALITY_SCORE = 100

    # Topics we've already processed (prevent duplicates)
    _processed_topics: Set[str] = set()

    def __init__(self):
        self.social = social_scraper
        self.news_apis = get_news_apis()
        self._enabled = getattr(settings, 'ENABLE_SOCIAL_TRIGGERS', True)

    async def detect_emerging_topics(
        self,
        check_against_clusters: bool = True,
        max_topics: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Detect trending topics that aren't yet covered by our clusters.

        Args:
            check_against_clusters: If True, filter out topics already in clusters
            max_topics: Maximum number of topics to return

        Returns:
            List of emerging topic dicts with metadata
        """
        if not self._enabled:
            logger.info("Social triggers disabled")
            return []

        emerging = []

        # 1. Get trending from Reddit
        try:
            reddit_trending = await self._get_reddit_trends()
            emerging.extend(reddit_trending)
        except Exception as e:
            logger.error(f"Reddit trending failed: {e}")

        # 2. Get trending from Bluesky
        try:
            bluesky_trending = await self._get_bluesky_trends()
            emerging.extend(bluesky_trending)
        except Exception as e:
            logger.error(f"Bluesky trending failed: {e}")

        # 3. Get trending from Hacker News (tech-specific)
        try:
            hn_trending = await self._get_hackernews_trends()
            emerging.extend(hn_trending)
        except Exception as e:
            logger.error(f"HackerNews trending failed: {e}")

        # Filter duplicates and already processed
        unique_topics = self._dedupe_topics(emerging)

        # Check against existing clusters if enabled
        if check_against_clusters:
            unique_topics = await self._filter_existing_topics(unique_topics)

        # Sort by virality and limit
        sorted_topics = sorted(
            unique_topics,
            key=lambda t: t.get("virality_score", 0),
            reverse=True
        )[:max_topics]

        logger.info(f"🔮 Found {len(sorted_topics)} emerging topics from social")
        return sorted_topics

    async def _get_reddit_trends(self) -> List[Dict[str, Any]]:
        """Get trending topics from Reddit"""
        trends = []

        try:
            # Scrape from trending subreddits
            posts = await self.social.scrape_reddit(limit_per_sub=10)

            # Aggregate by topic/title keywords
            for post in posts:
                title = post.get("raw_title", "")
                score = post.get("reddit_score", 0)
                comments = post.get("reddit_comments", 0)

                if score >= self.MIN_VIRALITY_SCORE:
                    trends.append({
                        "title": title,
                        "keywords": self._extract_keywords(title),
                        "platform": "reddit",
                        "virality_score": score + comments,
                        "url": post.get("url", ""),
                        "source_data": {
                            "subreddit": post.get("reddit_subreddit", ""),
                            "score": score,
                            "comments": comments
                        },
                        "detected_at": datetime.now().isoformat()
                    })
        except Exception as e:
            logger.warning(f"Reddit trend extraction failed: {e}")

        return trends

    async def _get_bluesky_trends(self) -> List[Dict[str, Any]]:
        """Get trending topics from Bluesky"""
        trends = []

        try:
            posts = await self.social.scrape_bluesky(limit=50)

            for post in posts:
                title = post.get("raw_title", "")
                likes = post.get("bluesky_likes", 0)
                reposts = post.get("bluesky_reposts", 0)

                virality = likes + (reposts * 2)  # Reposts weighted higher

                if virality >= self.MIN_VIRALITY_SCORE // 2:  # Lower threshold for Bluesky
                    trends.append({
                        "title": title,
                        "keywords": self._extract_keywords(title),
                        "platform": "bluesky",
                        "virality_score": virality,
                        "url": post.get("url", ""),
                        "source_data": {
                            "likes": likes,
                            "reposts": reposts,
                            "author": post.get("bluesky_author", "")
                        },
                        "detected_at": datetime.now().isoformat()
                    })
        except Exception as e:
            logger.warning(f"Bluesky trend extraction failed: {e}")

        return trends

    async def _get_hackernews_trends(self) -> List[Dict[str, Any]]:
        """Get trending topics from Hacker News"""
        trends = []

        try:
            posts = await self.social.scrape_hackernews(limit=30)

            for post in posts:
                title = post.get("raw_title", "")
                score = post.get("hn_score", 0)
                comments = post.get("hn_comments", 0)

                if score >= 50:  # HN scale is different
                    trends.append({
                        "title": title,
                        "keywords": self._extract_keywords(title),
                        "platform": "hackernews",
                        "virality_score": score + (comments * 2),
                        "url": post.get("url", ""),
                        "source_data": {
                            "score": score,
                            "comments": comments
                        },
                        "detected_at": datetime.now().isoformat(),
                        "category_hint": "TECH"  # HN is tech-focused
                    })
        except Exception as e:
            logger.warning(f"HN trend extraction failed: {e}")

        return trends

    def _extract_keywords(self, text: str) -> List[str]:
        """Extract key words/phrases from text for matching"""
        # Simple keyword extraction - could be enhanced with NLP
        import re

        # Remove common words
        stop_words = {
            "the", "a", "an", "is", "are", "was", "were", "be", "been",
            "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "may", "might", "must", "shall",
            "can", "need", "dare", "ought", "used", "to", "of", "in",
            "for", "on", "with", "at", "by", "from", "as", "into", "through",
            "le", "la", "les", "un", "une", "des", "de", "du", "est", "sont",
            "et", "ou", "mais", "donc", "car", "ni", "que", "qui", "quoi"
        }

        # Extract words (3+ chars)
        words = re.findall(r'\b[a-zA-ZÀ-ÿ]{3,}\b', text.lower())
        keywords = [w for w in words if w not in stop_words]

        # Return unique keywords
        return list(dict.fromkeys(keywords))[:10]

    def _dedupe_topics(self, topics: List[Dict]) -> List[Dict]:
        """Remove duplicate topics based on keyword overlap"""
        unique = []
        seen_keywords: Set[str] = set()

        for topic in topics:
            keywords = set(topic.get("keywords", []))
            title_key = topic.get("title", "").lower()[:50]

            # Skip if already processed
            if title_key in self._processed_topics:
                continue

            # Check for significant overlap with existing
            overlap = keywords & seen_keywords
            if len(overlap) > len(keywords) * 0.5:  # 50% overlap = duplicate
                continue

            unique.append(topic)
            seen_keywords.update(keywords)

        return unique

    async def _filter_existing_topics(
        self,
        topics: List[Dict]
    ) -> List[Dict]:
        """Filter out topics that already exist in our clusters"""
        from app.db.qdrant_client import get_qdrant_service
        from app.ml.embeddings import get_embedding_service

        try:
            qdrant = get_qdrant_service()
            embedding_service = get_embedding_service()

            filtered = []
            for topic in topics:
                title = topic.get("title", "")
                if not title:
                    continue

                # Search for similar syntheses
                embedding = embedding_service.encode([title])[0]
                similar = qdrant.search_similar_syntheses(embedding, limit=3, threshold=0.75)

                if not similar:
                    # No existing coverage = avant-garde opportunity!
                    filtered.append(topic)
                else:
                    logger.debug(f"Topic already covered: {title[:50]}...")

            return filtered

        except Exception as e:
            logger.warning(f"Cluster check failed (returning all topics): {e}")
            return topics

    async def enrich_emerging_topic(
        self,
        topic: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Enrich an emerging topic with additional context.
        Fetches related articles from GDELT and adds web context.

        Args:
            topic: Emerging topic dict from detect_emerging_topics

        Returns:
            Enriched topic with articles and context
        """
        title = topic.get("title", "")
        keywords = topic.get("keywords", [])

        # Build search query
        query = " OR ".join(keywords[:5]) if keywords else title

        # Fetch from GDELT
        async with self.news_apis as apis:
            gdelt_articles = await apis.fetch_all(
                query=query,
                languages=["fr", "en"],
                limit=10
            )

        topic["articles"] = gdelt_articles
        topic["articles_count"] = len(gdelt_articles)
        topic["is_avant_garde"] = True
        topic["enriched_at"] = datetime.now().isoformat()

        # Add Perplexity context if breaking/hot
        if topic.get("virality_score", 0) > self.MIN_VIRALITY_SCORE * 2:
            from app.ml.search_enrichment import get_search_enrichment_engine
            enrichment = get_search_enrichment_engine()
            context = await enrichment.enrich_cluster(
                cluster_topic=title,
                key_entities=keywords[:3],
                use_perplexity=True,
                use_grok=True
            )
            topic["enrichment"] = context.to_dict()

        # Mark as processed
        self._processed_topics.add(title.lower()[:50])

        logger.info(f"🔮 Enriched avant-garde topic: {title[:50]}... ({len(gdelt_articles)} articles)")
        return topic

    def clear_processed_cache(self):
        """Clear the processed topics cache"""
        self._processed_topics.clear()
        logger.info("Cleared social triggers cache")


# Singleton instance
_social_trigger_service: Optional[SocialTriggerService] = None


def get_social_trigger_service() -> SocialTriggerService:
    """Get or create social trigger service singleton"""
    global _social_trigger_service
    if _social_trigger_service is None:
        _social_trigger_service = SocialTriggerService()
    return _social_trigger_service


async def detect_and_enrich_emerging_topics(
    max_topics: int = 3
) -> List[Dict[str, Any]]:
    """
    Convenience function to detect and enrich emerging topics.

    Args:
        max_topics: Maximum number of topics to process

    Returns:
        List of enriched avant-garde topic dicts
    """
    service = get_social_trigger_service()

    # Detect emerging
    emerging = await service.detect_emerging_topics(
        check_against_clusters=True,
        max_topics=max_topics
    )

    # Enrich each
    enriched = []
    for topic in emerging:
        try:
            enriched_topic = await service.enrich_emerging_topic(topic)
            enriched.append(enriched_topic)
        except Exception as e:
            logger.error(f"Failed to enrich topic: {e}")

    return enriched
