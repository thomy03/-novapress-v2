"""
Nexus Image Generator for NovaPress AI v2.
Generates cosmic data visualization images for causal graphs using fal.ai.
Stores results in Redis ZSET for scroll-driven timeline viewer.

Model: fal-ai/nano-banana-2 via fal.ai (~$0.02-0.04/image)
Resolution: 1280x720 (landscape, optimized for viewer)
"""
import json
import re
import time
from typing import Optional, Dict, Any, List

import httpx
from loguru import logger

from app.core.config import settings
from app.core.circuit_breaker import get_circuit_breaker, CircuitOpenError


# Relation type → visual color mapping for prompt
RELATION_COLORS = {
    "causes": "red",
    "triggers": "amber-gold",
    "enables": "emerald-green",
    "prevents": "grey",
}

# Max images per topic in Redis
MAX_IMAGES_PER_TOPIC = 20


class NexusImageGenerator:
    """Generate cosmic nexus visualization images via fal.ai."""

    def __init__(self):
        self.api_key = settings.FAL_API_KEY
        self.base_url = "https://fal.run"
        self.model = "fal-ai/nano-banana-2"
        self.circuit_breaker = get_circuit_breaker("fal_nexus")
        self.enabled = bool(self.api_key)
        # Track which topics got images this pipeline run
        self._generated_this_run: set = set()

        if self.enabled:
            logger.info("Nexus image generator enabled (fal.ai nano-banana-2)")
        else:
            logger.info("Nexus image generator disabled (no FAL_API_KEY)")

    def reset_run_tracker(self):
        """Reset the per-run rate limit tracker. Call at start of each pipeline run."""
        self._generated_this_run.clear()

    def _build_topic_slug(self, topic: str) -> str:
        """Convert topic name to a Redis-safe slug."""
        slug = topic.lower().strip()
        slug = re.sub(r'[^a-z0-9\-]', '-', slug)
        slug = re.sub(r'-+', '-', slug).strip('-')
        return slug[:80]

    def _build_nexus_prompt(
        self,
        topic: str,
        causal_graph: Dict[str, Any],
        synthesis_title: str,
    ) -> str:
        """Build a visual prompt describing the causal graph as cosmic art."""
        nodes = causal_graph.get("nodes", [])
        edges = causal_graph.get("edges", [])
        central = causal_graph.get("central_entity", topic)

        # Build causal branch descriptions
        branch_parts = []
        for edge in edges[:6]:  # Max 6 branches in prompt
            cause = edge.get("cause_text", "")[:60]
            effect = edge.get("effect_text", "")[:60]
            rel_type = edge.get("relation_type", "causes")
            color = RELATION_COLORS.get(rel_type, "white")
            if cause and effect:
                branch_parts.append(f"{cause} -> {effect} ({color} energy flow)")

        branches_text = ". ".join(branch_parts) if branch_parts else "interconnected concepts flowing"

        # Count node types for visual variety
        node_types = {}
        for n in nodes:
            nt = n.get("node_type", "event")
            node_types[nt] = node_types.get(nt, 0) + 1

        node_desc_parts = []
        if node_types.get("event", 0):
            node_desc_parts.append(f"{node_types['event']} red event nodes")
        if node_types.get("entity", 0):
            node_desc_parts.append(f"{node_types['entity']} blue entity nodes")
        if node_types.get("decision", 0):
            node_desc_parts.append(f"{node_types['decision']} gold decision nodes")
        node_desc = ", ".join(node_desc_parts) if node_desc_parts else "glowing data nodes"

        prompt = (
            f"Dark cosmic data visualization of a causal nexus about {topic}. "
            f"Central theme: {central}. "
            f"Graph structure: {node_desc} connected by luminous flowing energy lines. "
            f"Causal branches: {branches_text}. "
            f"Style: deep space background dark navy #0A0A1A, neon glowing nodes, "
            f"organic tree-like neural network structure, "
            f"flowing light particles along connections, "
            f"red for conflicts, blue for entities, gold for decisions, green for enablers. "
            f"Abstract infographic art, no text labels, no words, no letters, "
            f"no numbers, no logos, no watermarks. "
            f"Cinematic wide angle, 4K quality, dark atmospheric mood."
        )

        return prompt

    async def generate_nexus_image(
        self,
        topic: str,
        causal_graph: Dict[str, Any],
        synthesis_title: str,
        synthesis_id: str,
    ) -> Optional[str]:
        """
        Generate a nexus visualization image for a topic's causal graph.

        Returns the image URL or None on failure.
        Rate-limited: 1 image per topic per pipeline run.
        """
        if not self.enabled:
            return None

        topic_slug = self._build_topic_slug(topic)

        # Rate limit: 1 per topic per run
        if topic_slug in self._generated_this_run:
            logger.debug(f"Nexus image already generated for topic '{topic}' this run, skipping")
            return None

        # Check minimum node count
        nodes = causal_graph.get("nodes", [])
        if len(nodes) < 3:
            logger.debug(f"Causal graph for '{topic}' has <3 nodes, skipping nexus image")
            return None

        prompt = self._build_nexus_prompt(topic, causal_graph, synthesis_title)

        params = {
            "prompt": prompt,
            "negative_prompt": "text, words, letters, numbers, logos, watermarks, blurry, low quality",
            "image_size": {"width": 1280, "height": 720},
            "num_images": 1,
            "enable_safety_checker": True,
        }

        async def _do_call() -> Optional[str]:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/{self.model}",
                    headers={
                        "Authorization": f"Key {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=params,
                )

                if response.status_code == 200:
                    data = response.json()
                    images = data.get("images", [])
                    if images:
                        url = images[0].get("url", "")
                        if url:
                            logger.info(f"[nexus] Generated image for topic '{topic}' ({len(nodes)} nodes)")
                            return url
                    raise ValueError(f"fal.ai returned no images: {data}")
                else:
                    raise ValueError(f"fal.ai error {response.status_code}: {response.text[:200]}")

        try:
            url = await self.circuit_breaker.call(_do_call)
            if url:
                self._generated_this_run.add(topic_slug)
                # Store in Redis
                await self._store_in_redis(
                    topic_slug=topic_slug,
                    topic=topic,
                    url=url,
                    synthesis_id=synthesis_id,
                    synthesis_title=synthesis_title,
                    node_count=len(nodes),
                )
            return url
        except CircuitOpenError:
            logger.warning("Nexus image circuit breaker is open, skipping")
            return None
        except Exception as e:
            logger.error(f"[nexus] Image generation failed for topic '{topic}': {e}")
            return None

    async def _store_in_redis(
        self,
        topic_slug: str,
        topic: str,
        url: str,
        synthesis_id: str,
        synthesis_title: str,
        node_count: int,
    ):
        """Store nexus image metadata in Redis ZSET (score = unix timestamp)."""
        try:
            import aioredis
            redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

            key = f"novapress:nexus:{topic_slug}:images"
            now = time.time()

            entry = json.dumps({
                "url": url,
                "timestamp": now,
                "synthesis_id": synthesis_id,
                "synthesis_title": synthesis_title,
                "node_count": node_count,
                "topic": topic,
            })

            # Add to sorted set (score = timestamp)
            await redis.zadd(key, {entry: now})

            # Trim to keep only the latest MAX_IMAGES_PER_TOPIC
            count = await redis.zcard(key)
            if count > MAX_IMAGES_PER_TOPIC:
                await redis.zremrangebyrank(key, 0, count - MAX_IMAGES_PER_TOPIC - 1)

            # Set TTL of 90 days on the key
            await redis.expire(key, 90 * 24 * 3600)

            await redis.aclose()
            logger.debug(f"[nexus] Stored image for '{topic}' in Redis ({count} total)")

        except Exception as e:
            logger.warning(f"[nexus] Failed to store in Redis: {e}")

    async def get_timeline_images(self, topic_slug: str) -> List[Dict[str, Any]]:
        """Retrieve all nexus images for a topic, ordered by timestamp (oldest first)."""
        try:
            import aioredis
            redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

            key = f"novapress:nexus:{topic_slug}:images"
            entries = await redis.zrangebyscore(key, "-inf", "+inf")

            await redis.aclose()

            images = []
            for entry in entries:
                try:
                    data = json.loads(entry)
                    images.append(data)
                except json.JSONDecodeError:
                    continue

            return images

        except Exception as e:
            logger.warning(f"[nexus] Failed to read from Redis for '{topic_slug}': {e}")
            return []


# Singleton
_generator: Optional[NexusImageGenerator] = None


def get_nexus_image_generator() -> NexusImageGenerator:
    """Get or create the nexus image generator singleton."""
    global _generator
    if _generator is None:
        _generator = NexusImageGenerator()
    return _generator
