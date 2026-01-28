"""
Topic Detection Service for Intelligence Hub
Detects and manages dynamic topics from synthesis clusters.
Uses HDBSCAN on synthesis embeddings to find natural topic groupings.
"""
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from datetime import datetime, timedelta
import numpy as np
from loguru import logger
import uuid

from app.core.config import settings


class TopicDetectionService:
    """
    Detects and manages dynamic topics from synthesis clusters.
    Uses HDBSCAN clustering + LLM for topic naming.
    """

    def __init__(self):
        self.embedding_service = None
        self.qdrant_service = None
        self.llm_service = None

        # Clustering parameters (different from article clustering)
        self.min_cluster_size = 2  # Minimum syntheses to form a topic
        self.min_samples = 1
        self.cluster_selection_epsilon = 0.15  # More lenient for topic grouping
        self.similarity_threshold = 0.70  # Similarity to assign to existing topic

    async def initialize(self):
        """Initialize services"""
        try:
            from app.ml.embeddings import embedding_service
            from app.db.qdrant_client import qdrant_service
            from app.ml.llm import llm_service

            self.embedding_service = embedding_service
            self.qdrant_service = qdrant_service
            self.llm_service = llm_service

            logger.success("✅ Topic Detection Service initialized")

        except Exception as e:
            logger.error(f"Failed to initialize Topic Detection Service: {e}")
            raise

    async def detect_topics(
        self,
        time_window_days: int = 30,
        min_syntheses: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Run topic detection on recent syntheses.
        Creates/updates topics in novapress_topics collection.

        Args:
            time_window_days: Number of days to look back
            min_syntheses: Minimum syntheses to form a topic

        Returns:
            List of detected/updated topics
        """
        if not self.qdrant_service:
            logger.warning("Qdrant service not initialized")
            return []

        logger.info(f"🔍 Running topic detection (last {time_window_days} days)")

        # 1. Fetch syntheses with vectors
        syntheses_with_vectors = self.qdrant_service.get_syntheses_with_vectors(
            days=time_window_days,
            limit=500
        )

        if len(syntheses_with_vectors) < min_syntheses:
            logger.info(f"Not enough syntheses ({len(syntheses_with_vectors)}) for topic detection")
            return []

        # 2. Prepare data for clustering
        vectors = []
        synthesis_data = []

        for item in syntheses_with_vectors:
            if item.get("vector"):
                vectors.append(item["vector"])
                synthesis_data.append({
                    "id": item["id"],
                    "payload": item["payload"]
                })

        if len(vectors) < min_syntheses:
            return []

        vectors_array = np.array(vectors)

        # 3. Run HDBSCAN clustering
        try:
            from hdbscan import HDBSCAN

            clusterer = HDBSCAN(
                min_cluster_size=self.min_cluster_size,
                min_samples=self.min_samples,
                cluster_selection_epsilon=self.cluster_selection_epsilon,
                metric='euclidean',
                cluster_selection_method='eom'
            )

            labels = clusterer.fit_predict(vectors_array)
            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)

            logger.info(f"📊 HDBSCAN found {n_clusters} topic clusters")

        except ImportError:
            logger.warning("HDBSCAN not available, using simple clustering")
            labels = self._simple_clustering(vectors_array, min_syntheses)
            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)

        # 4. Process each cluster into a topic
        topics = []
        cluster_syntheses = defaultdict(list)

        for i, label in enumerate(labels):
            if label >= 0:  # Ignore noise (-1)
                cluster_syntheses[label].append({
                    "synthesis": synthesis_data[i],
                    "vector": vectors[i]
                })

        for cluster_id, items in cluster_syntheses.items():
            if len(items) >= min_syntheses:
                topic = await self._create_or_update_topic(items)
                if topic:
                    topics.append(topic)

        logger.info(f"✅ Topic detection complete: {len(topics)} topics created/updated")
        return topics

    def _simple_clustering(
        self,
        vectors: np.ndarray,
        min_cluster_size: int
    ) -> np.ndarray:
        """
        Simple fallback clustering when HDBSCAN is not available.
        Uses cosine similarity and greedy clustering.
        """
        from sklearn.metrics.pairwise import cosine_similarity

        n_samples = len(vectors)
        labels = np.full(n_samples, -1)
        current_cluster = 0

        # Calculate similarity matrix
        sim_matrix = cosine_similarity(vectors)

        # Greedy clustering
        for i in range(n_samples):
            if labels[i] == -1:  # Not yet assigned
                # Find all similar items
                similar_indices = np.where(sim_matrix[i] >= self.similarity_threshold)[0]

                if len(similar_indices) >= min_cluster_size:
                    for idx in similar_indices:
                        if labels[idx] == -1:
                            labels[idx] = current_cluster
                    current_cluster += 1

        return labels

    async def _create_or_update_topic(
        self,
        cluster_items: List[Dict]
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new topic or update existing one for a cluster.

        Args:
            cluster_items: List of syntheses in this cluster

        Returns:
            Topic dictionary
        """
        if not cluster_items:
            return None

        # Extract synthesis IDs and titles
        synthesis_ids = [item["synthesis"]["id"] for item in cluster_items]
        titles = [item["synthesis"]["payload"].get("title", "") for item in cluster_items]
        categories = [item["synthesis"]["payload"].get("category", "MONDE") for item in cluster_items]

        # Calculate centroid embedding
        vectors = [item["vector"] for item in cluster_items]
        centroid = np.mean(vectors, axis=0)

        # Check if a similar topic already exists
        existing_topics = self.qdrant_service.search_topics_by_embedding(
            query_embedding=centroid.tolist(),
            active_only=True,
            limit=3
        )

        for existing in existing_topics:
            if existing.get("similarity_score", 0) >= 0.85:
                # Update existing topic
                return await self._update_topic(existing, synthesis_ids)

        # Generate topic name and description
        topic_name, topic_description = await self._generate_topic_metadata(titles)

        # Determine primary category (most common)
        from collections import Counter
        category_counts = Counter(categories)
        primary_category = category_counts.most_common(1)[0][0] if category_counts else "MONDE"

        # Extract keywords from titles
        keywords = self._extract_keywords(titles)

        # Create new topic
        topic_id = str(uuid.uuid4())
        now = datetime.now().timestamp()

        topic = {
            "id": topic_id,
            "name": topic_name,
            "description": topic_description,
            "keywords": keywords[:20],
            "category": primary_category,
            "first_seen": now,
            "last_updated": now,
            "synthesis_ids": synthesis_ids,
            "entity_ids": [],
            "narrative_arc": self._determine_narrative_arc(cluster_items),
            "merged_causal_graph": {"nodes": [], "edges": []},
            "mention_count": len(synthesis_ids),
            "is_active": True
        }

        self.qdrant_service.upsert_topic(topic, centroid.tolist())
        logger.debug(f"✅ Created topic: '{topic_name}' ({len(synthesis_ids)} syntheses)")

        return topic

    async def _update_topic(
        self,
        existing_topic: Dict[str, Any],
        new_synthesis_ids: List[str]
    ) -> Dict[str, Any]:
        """Update an existing topic with new syntheses."""
        topic_id = existing_topic["id"]

        # Get current synthesis IDs
        current_ids = existing_topic.get("synthesis_ids", [])

        # Add new IDs
        updated_ids = list(set(current_ids + new_synthesis_ids))

        existing_topic["synthesis_ids"] = updated_ids
        existing_topic["mention_count"] = len(updated_ids)
        existing_topic["last_updated"] = datetime.now().timestamp()

        # Re-upsert
        result = self.qdrant_service.client.retrieve(
            collection_name=self.qdrant_service.topics_collection,
            ids=[topic_id],
            with_vectors=True
        )

        if result and result[0].vector:
            self.qdrant_service.upsert_topic(existing_topic, result[0].vector)
            logger.debug(f"✅ Updated topic: '{existing_topic['name']}' ({len(updated_ids)} syntheses)")

        return existing_topic

    async def _generate_topic_metadata(
        self,
        titles: List[str]
    ) -> Tuple[str, str]:
        """
        Generate topic name and description from synthesis titles.
        Uses LLM if available, otherwise extracts common terms.

        Returns:
            (topic_name, topic_description)
        """
        if self.llm_service:
            try:
                titles_text = "\n".join(f"- {t}" for t in titles[:10])
                prompt = f"""Analyse ces titres d'articles et génère:
1. Un nom de topic court (3-5 mots) qui résume le sujet principal
2. Une description en 1-2 phrases

Titres:
{titles_text}

Réponds en JSON:
{{"name": "...", "description": "..."}}"""

                import json
                response = await self.llm_service.generate_raw(prompt, max_tokens=200)
                if response:
                    # Extract JSON from response
                    json_match = response.find('{')
                    json_end = response.rfind('}')
                    if json_match >= 0 and json_end > json_match:
                        data = json.loads(response[json_match:json_end+1])
                        return data.get("name", "Topic sans nom"), data.get("description", "")

            except Exception as e:
                logger.debug(f"LLM topic generation failed: {e}")

        # Fallback: Extract common words
        from collections import Counter
        import re

        all_words = []
        stop_words = {'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'au', 'aux',
                      'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'qui', 'que', 'ce', 'cette',
                      'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'are'}

        for title in titles:
            words = re.findall(r'\b[a-zA-ZÀ-ÿ]{3,}\b', title.lower())
            all_words.extend([w for w in words if w not in stop_words])

        word_counts = Counter(all_words)
        top_words = [w for w, c in word_counts.most_common(5)]

        topic_name = " ".join(top_words[:3]).title() if top_words else "Topic"
        description = f"Topic regroupant {len(titles)} synthèses"

        return topic_name, description

    def _extract_keywords(self, titles: List[str]) -> List[str]:
        """Extract keywords from titles."""
        import re
        from collections import Counter

        stop_words = {'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'au', 'aux',
                      'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'qui', 'que', 'ce', 'cette',
                      'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'are'}

        all_words = []
        for title in titles:
            words = re.findall(r'\b[a-zA-ZÀ-ÿ]{4,}\b', title.lower())
            all_words.extend([w for w in words if w not in stop_words])

        word_counts = Counter(all_words)
        return [w for w, c in word_counts.most_common(20)]

    def _determine_narrative_arc(self, cluster_items: List[Dict]) -> str:
        """
        Determine narrative arc based on synthesis timestamps and update patterns.

        Arc types:
        - emerging: New topic, few syntheses
        - developing: Growing topic with recent activity
        - peak: High activity, many syntheses
        - declining: Activity slowing down
        - resolved: No recent activity
        """
        if not cluster_items:
            return "emerging"

        # Get timestamps
        timestamps = []
        for item in cluster_items:
            ts = item["synthesis"]["payload"].get("created_at", 0)
            if ts:
                timestamps.append(ts)

        if not timestamps:
            return "emerging"

        timestamps.sort()
        now = datetime.now().timestamp()
        oldest = timestamps[0]
        newest = timestamps[-1]
        count = len(timestamps)

        # Calculate metrics
        age_days = (now - oldest) / 86400
        recency_hours = (now - newest) / 3600

        # Determine arc
        if count <= 2:
            return "emerging"
        elif recency_hours > 72:  # No activity in 3 days
            return "resolved"
        elif age_days < 2 and count >= 3:
            return "developing"
        elif count >= 5 and recency_hours < 24:
            return "peak"
        elif age_days > 7 and recency_hours > 48:
            return "declining"
        else:
            return "developing"

    async def assign_synthesis_to_topic(
        self,
        synthesis_id: str,
        synthesis_embedding: List[float],
        synthesis_metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Assign a new synthesis to an existing topic or create new.
        Called during pipeline after synthesis generation.

        Args:
            synthesis_id: The synthesis ID
            synthesis_embedding: The synthesis embedding vector
            synthesis_metadata: Optional metadata (title, category, key_entities)

        Returns:
            Topic ID if assigned/created, None otherwise
        """
        if not self.qdrant_service:
            return None

        # Search for similar topics
        similar_topics = self.qdrant_service.search_topics_by_embedding(
            query_embedding=synthesis_embedding,
            active_only=True,
            limit=5
        )

        for topic in similar_topics:
            similarity = topic.get("similarity_score", 0)
            if similarity >= self.similarity_threshold:
                # Assign to existing topic
                topic_id = topic["id"]
                self.qdrant_service.add_synthesis_to_topic(topic_id, synthesis_id)
                logger.debug(f"Synthesis assigned to topic '{topic['name']}' (similarity: {similarity:.2f})")
                return topic_id

        # No matching topic - could create a new one or leave unassigned
        # For now, leave unassigned (will be grouped in next batch detection)
        logger.debug(f"Synthesis {synthesis_id[:8]}... not matched to any topic")
        return None

    async def update_topic_narrative_arc(self, topic_id: str):
        """Update the narrative arc of a topic based on current state."""
        topic = self.qdrant_service.get_topic_by_id(topic_id)
        if not topic:
            return

        # Get syntheses for this topic
        synthesis_ids = topic.get("synthesis_ids", [])
        if not synthesis_ids:
            return

        # Fetch synthesis timestamps
        timestamps = []
        for syn_id in synthesis_ids[-20:]:  # Check last 20
            syn = self.qdrant_service.get_synthesis_by_id(syn_id)
            if syn:
                ts = syn.get("created_at", 0)
                if ts:
                    timestamps.append(ts)

        if not timestamps:
            return

        timestamps.sort()
        now = datetime.now().timestamp()
        oldest = timestamps[0]
        newest = timestamps[-1]
        count = len(timestamps)

        # Calculate new arc
        age_days = (now - oldest) / 86400
        recency_hours = (now - newest) / 3600

        if count <= 2:
            new_arc = "emerging"
        elif recency_hours > 72:
            new_arc = "resolved"
        elif age_days < 2 and count >= 3:
            new_arc = "developing"
        elif count >= 5 and recency_hours < 24:
            new_arc = "peak"
        elif age_days > 7 and recency_hours > 48:
            new_arc = "declining"
        else:
            new_arc = "developing"

        if topic.get("narrative_arc") != new_arc:
            topic["narrative_arc"] = new_arc
            topic["last_updated"] = now

            result = self.qdrant_service.client.retrieve(
                collection_name=self.qdrant_service.topics_collection,
                ids=[topic_id],
                with_vectors=True
            )
            if result and result[0].vector:
                self.qdrant_service.upsert_topic(topic, result[0].vector)

    async def get_hot_topics(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get trending/hot topics based on activity and recency.

        Args:
            limit: Maximum topics to return

        Returns:
            List of hot topics sorted by activity
        """
        topics = self.qdrant_service.get_topics(active_only=True, limit=100)

        # Score topics by activity
        now = datetime.now().timestamp()
        scored_topics = []

        for topic in topics:
            synthesis_count = len(topic.get("synthesis_ids", []))
            last_updated = topic.get("last_updated", 0)
            first_seen = topic.get("first_seen", now)

            # Activity score
            recency_hours = (now - last_updated) / 3600
            recency_score = max(0, 1 - (recency_hours / 72))  # Decay over 3 days

            # Growth score
            age_days = max(1, (now - first_seen) / 86400)
            growth_score = synthesis_count / age_days

            # Combined score
            hot_score = (synthesis_count * 0.4) + (recency_score * 10 * 0.3) + (growth_score * 0.3)

            topic["hot_score"] = hot_score
            scored_topics.append(topic)

        # Sort by hot score
        scored_topics.sort(key=lambda x: x.get("hot_score", 0), reverse=True)

        return scored_topics[:limit]


# Global instance
topic_detection_service = TopicDetectionService()


async def init_topic_detection():
    """Initialize topic detection service"""
    await topic_detection_service.initialize()


def get_topic_detection_service() -> TopicDetectionService:
    """Dependency injection for FastAPI"""
    return topic_detection_service
