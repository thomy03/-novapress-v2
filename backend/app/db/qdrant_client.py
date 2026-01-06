"""
Qdrant Vector Database Client
For storing and searching article embeddings
"""
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams,
    Distance,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    SearchRequest,
    Range
)
from loguru import logger
import uuid

from app.core.config import settings


class QdrantService:
    """Qdrant Vector Database Service"""

    def __init__(self):
        self.client: Optional[QdrantClient] = None
        self.collection_name = settings.QDRANT_COLLECTION
        self.syntheses_collection = "novapress_syntheses"

    async def initialize(self):
        """Initialize Qdrant client and create collections"""
        try:
            logger.info(f"Connecting to Qdrant at {settings.QDRANT_URL}")
            self.client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None
            )

            # Create collections if they don't exist
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]

            # Articles collection
            if self.collection_name not in collection_names:
                logger.info(f"Creating collection: {self.collection_name}")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=settings.EMBEDDING_DIMENSION,
                        distance=Distance.COSINE
                    )
                )
                logger.success(f"✅ Collection '{self.collection_name}' created")
            else:
                logger.info(f"Collection '{self.collection_name}' already exists")

            # Syntheses collection
            if self.syntheses_collection not in collection_names:
                logger.info(f"Creating collection: {self.syntheses_collection}")
                self.client.create_collection(
                    collection_name=self.syntheses_collection,
                    vectors_config=VectorParams(
                        size=settings.EMBEDDING_DIMENSION,
                        distance=Distance.COSINE
                    )
                )
                logger.success(f"✅ Collection '{self.syntheses_collection}' created")
            else:
                logger.info(f"Collection '{self.syntheses_collection}' already exists")

            logger.success("✅ Qdrant connected")

        except Exception as e:
            logger.error(f"Failed to initialize Qdrant: {e}")
            raise

    def upsert_articles(
        self,
        articles: List[Dict[str, Any]],
        embeddings: List[List[float]]
    ) -> bool:
        """
        Insert or update articles in Qdrant

        Args:
            articles: List of article dictionaries
            embeddings: List of embeddings (same length as articles)

        Returns:
            Success status
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        if len(articles) != len(embeddings):
            raise ValueError("Articles and embeddings must have same length")

        points = []
        for article, embedding in zip(articles, embeddings):
            point_id = str(uuid.uuid4())  # Always generate new UUID

            # Helper function to safely get string values
            def safe_str(value, default="", max_len=None):
                if value is None:
                    return default
                result = str(value)
                if max_len and len(result) > max_len:
                    return result[:max_len]
                return result

            # Convert published_at to timestamp if it's ISO string
            published_at = article.get("published_at", "")
            if isinstance(published_at, str) and published_at:
                try:
                    from datetime import datetime
                    published_at = datetime.fromisoformat(published_at.replace('Z', '+00:00')).timestamp()
                except:
                    published_at = 0.0
            else:
                published_at = 0.0

            # Convert lists to comma-separated strings
            authors = article.get("authors", [])
            if isinstance(authors, list):
                authors = ", ".join(str(a) for a in authors if a) if authors else ""
            else:
                authors = safe_str(authors, "", 200)

            keywords = article.get("keywords", [])
            if isinstance(keywords, list):
                keywords = ", ".join(str(k) for k in keywords if k) if keywords else ""
            else:
                keywords = safe_str(keywords, "", 200)

            points.append(PointStruct(
                id=point_id,
                vector=embedding.tolist() if hasattr(embedding, 'tolist') else embedding,
                payload={
                    "title": safe_str(article.get("raw_title") or article.get("title"), "", 300),
                    "summary": safe_str(article.get("summary"), "", 500),
                    "content": safe_str(article.get("raw_text") or article.get("content"), "", 5000),
                    "source": safe_str(article.get("source_name") or article.get("source"), "unknown", 100),
                    "source_domain": safe_str(article.get("source_domain"), "", 100),
                    "category": safe_str(article.get("category"), "general", 50),
                    "published_at": float(published_at),
                    "url": safe_str(article.get("url"), "", 400),
                    "language": safe_str(article.get("language"), "unknown", 10),
                    "authors": authors[:200],
                    "keywords": keywords[:200],
                    "image_url": safe_str(article.get("image_url"), "", 400)
                }
            ))

        try:
            self.client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            logger.success(f"✅ Upserted {len(points)} articles to Qdrant")
            return True
        except Exception as e:
            logger.error(f"Failed to upsert articles: {e}")
            return False

    def search_similar(
        self,
        query_embedding: List[float],
        limit: int = 10,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for similar articles

        Args:
            query_embedding: Query embedding vector
            limit: Maximum results
            category: Optional category filter

        Returns:
            List of similar articles with scores
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        # Build filter
        query_filter = None
        if category:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="category",
                        match=MatchValue(value=category)
                    )
                ]
            )

        try:
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=limit,
                query_filter=query_filter
            )

            articles = []
            for result in results:
                article = result.payload
                article["similarity_score"] = result.score
                article["id"] = result.id
                articles.append(article)

            return articles

        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []

    def get_article_by_id(self, article_id: str) -> Optional[Dict[str, Any]]:
        """Get article by ID"""
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            result = self.client.retrieve(
                collection_name=self.collection_name,
                ids=[article_id]
            )

            if result:
                return result[0].payload
            return None

        except Exception as e:
            logger.error(f"Failed to retrieve article {article_id}: {e}")
            return None

    def delete_article(self, article_id: str) -> bool:
        """Delete article by ID"""
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=[article_id]
            )
            logger.info(f"Deleted article {article_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete article: {e}")
            return False

    def get_collection_stats(self) -> Dict[str, Any]:
        """Get collection statistics"""
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "vectors_count": info.vectors_count,
                "points_count": info.points_count,
                "status": info.status
            }
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {}

    def get_latest_articles(
        self,
        limit: int = 20,
        offset: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get latest articles (using scroll)
        
        Args:
            limit: Number of articles to return
            offset: Offset ID for pagination
            category: Optional category filter
            
        Returns:
            Dictionary with articles and next_offset
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        # Build filter
        query_filter = None
        if category:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="category",
                        match=MatchValue(value=category)
                    )
                ]
            )

        try:
            # Use scroll to get points
            result, next_offset = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=query_filter,
                limit=limit,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )

            articles = []
            for point in result:
                article = point.payload
                article["id"] = point.id
                articles.append(article)

            return {
                "articles": articles,
                "next_offset": next_offset
            }

        except Exception as e:
            logger.error(f"Failed to scroll articles: {e}")
            return {"articles": [], "next_offset": None}

    def get_recent_articles(self, hours: int = 24, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get articles from the last X hours
        
        Args:
            hours: Number of hours to look back
            limit: Maximum number of articles
            
        Returns:
            List of recent articles
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            from datetime import datetime, timedelta
            
            # Calculate cutoff time (Unix timestamp for Qdrant Range filter)
            cutoff_time = (datetime.now() - timedelta(hours=hours)).timestamp()

            # Filter by published_at
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="published_at",
                        range=Range(gte=cutoff_time)
                    )
                ]
            )
            
            # Scroll to get articles
            result, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=query_filter,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )
            
            articles = []
            for point in result:
                article = point.payload
                article["id"] = point.id
                articles.append(article)
                
            logger.info(f"Fetched {len(articles)} recent articles (last {hours}h)")
            return articles

        except Exception as e:
            logger.error(f"Failed to get recent articles: {e}")
            return []

    def upsert_synthesis(
        self,
        synthesis: Dict[str, Any],
        embedding: List[float]
    ) -> bool:
        """
        Insert or update a synthesis in Qdrant

        Args:
            synthesis: Synthesis dictionary with title, summary, keyPoints, sources
            embedding: Embedding vector for the synthesis

        Returns:
            Success status
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        from datetime import datetime

        # Use provided ID if available (for pre-generated persona versions)
        # Otherwise generate a new UUID
        point_id = synthesis.get("id") or str(uuid.uuid4())

        # Convert sources list to string
        sources = synthesis.get("sources", [])
        if isinstance(sources, list):
            sources_str = ", ".join(str(s) for s in sources if s)
        else:
            sources_str = str(sources)

        # Convert keyPoints list to string
        key_points = synthesis.get("keyPoints", [])
        if isinstance(key_points, list):
            key_points_str = " | ".join(str(k) for k in key_points if k)
        else:
            key_points_str = str(key_points)

        # Get article IDs from the cluster
        article_ids = synthesis.get("article_ids", [])
        if isinstance(article_ids, list):
            article_ids_str = ",".join(str(a) for a in article_ids if a)
        else:
            article_ids_str = str(article_ids)

        # Convert timeline to string
        timeline = synthesis.get("timeline", [])
        if isinstance(timeline, list):
            timeline_str = " | ".join(str(t) for t in timeline if t)
        else:
            timeline_str = str(timeline)

        # Convert key_entities to string
        key_entities = synthesis.get("key_entities", [])
        if isinstance(key_entities, list):
            key_entities_str = ", ".join(str(e) for e in key_entities if e)
        else:
            key_entities_str = str(key_entities)

        # Convert causal_graph to JSON string for storage
        import json
        causal_graph = synthesis.get("causal_graph", {})
        if isinstance(causal_graph, dict):
            causal_graph_str = json.dumps(causal_graph)
        else:
            causal_graph_str = "{}"

        # Convert causal_chain from LLM output to causal_graph format
        causal_chain = synthesis.get("causal_chain", [])
        if causal_chain and not causal_graph.get("edges"):
            # Build causal_graph from causal_chain
            nodes = []
            edges = []
            node_id = 0
            seen_labels = set()

            for item in causal_chain:
                if isinstance(item, dict):
                    cause = item.get("cause", "")
                    effect = item.get("effect", "")
                    rel_type = item.get("type", "causes")
                    sources = item.get("sources", [])

                    # Add cause node if not seen
                    if cause and cause not in seen_labels:
                        nodes.append({
                            "id": f"node_{node_id}",
                            "label": cause[:80],
                            "node_type": "event",
                            "fact_density": 0.7
                        })
                        seen_labels.add(cause)
                        node_id += 1

                    # Add effect node if not seen
                    if effect and effect not in seen_labels:
                        nodes.append({
                            "id": f"node_{node_id}",
                            "label": effect[:80],
                            "node_type": "event",
                            "fact_density": 0.6
                        })
                        seen_labels.add(effect)
                        node_id += 1

                    # Add edge
                    if cause and effect:
                        edges.append({
                            "cause_text": cause,
                            "effect_text": effect,
                            "relation_type": rel_type,
                            "confidence": 0.75,
                            "evidence": [],
                            "source_articles": sources if isinstance(sources, list) else []
                        })

            # Determine central entity (most mentioned)
            central_entity = ""
            if key_entities:
                central_entity = key_entities[0] if isinstance(key_entities, list) else key_entities.split(",")[0].strip()

            # Determine narrative flow
            narrative_flow = "linear"
            if len(edges) > 3:
                causes = set(e["cause_text"][:30] for e in edges)
                effects = set(e["effect_text"][:30] for e in edges)
                if causes & effects:
                    narrative_flow = "branching"

            # Get predictions from synthesis (generated by LLM)
            predictions = synthesis.get("predictions", [])
            formatted_predictions = []
            for pred in predictions:
                if isinstance(pred, dict):
                    formatted_predictions.append({
                        "prediction": pred.get("prediction", "")[:200],
                        "probability": float(pred.get("probability", 0.5)),
                        "type": pred.get("type", "general"),
                        "timeframe": pred.get("timeframe", "moyen_terme"),
                        "rationale": pred.get("rationale", "")[:200]
                    })

            causal_graph = {
                "nodes": nodes,
                "edges": edges,
                "central_entity": central_entity,
                "narrative_flow": narrative_flow,
                "predictions": formatted_predictions  # Future predictions
            }
            causal_graph_str = json.dumps(causal_graph)

        point = PointStruct(
            id=point_id,
            vector=embedding.tolist() if hasattr(embedding, 'tolist') else embedding,
            payload={
                "title": str(synthesis.get("title", ""))[:300],
                "summary": str(synthesis.get("summary", ""))[:10000],
                "introduction": str(synthesis.get("introduction", ""))[:1000],
                "body": str(synthesis.get("body", ""))[:8000],
                "analysis": str(synthesis.get("analysis", ""))[:1000],
                "key_points": key_points_str[:2000],
                "sources": sources_str[:500],
                "source_articles": synthesis.get("source_articles", []),
                "num_sources": int(synthesis.get("num_sources", 0)),
                "cluster_id": int(synthesis.get("cluster_id", 0)),
                "article_ids": article_ids_str[:1000],
                "compliance_score": float(synthesis.get("complianceScore", 90)),
                "reading_time": int(synthesis.get("readingTime", 3)),
                "created_at": datetime.now().timestamp(),
                # TNA (Temporal Narrative Arc) metadata
                "narrative_arc": str(synthesis.get("narrativeArc", synthesis.get("narrative_arc", "emerging")))[:20],
                "timeline": timeline_str[:2000],
                "days_tracked": int(synthesis.get("days_tracked", 0)),
                "is_enriched": bool(synthesis.get("isEnriched", False)),
                "has_contradictions": bool(synthesis.get("hasContradictions", False)),
                "contradictions_count": int(synthesis.get("contradictions_count", 0)),
                "key_entities": key_entities_str[:500],
                "related_synthesis_count": int(synthesis.get("related_synthesis_count", 0)),
                # Nexus Causal - Pre-computed causal graph (JSON string)
                "causal_graph": causal_graph_str[:15000],  # Max 15KB for causal graph
                # Category classification
                "category": str(synthesis.get("category", "MONDE"))[:50],
                "category_confidence": float(synthesis.get("category_confidence", 0.5)),
                # Persona rotation system
                "persona_id": str(synthesis.get("persona_id", "neutral"))[:30],
                "persona_name": str(synthesis.get("persona_name", "NovaPress"))[:50],
                "persona_signature": str(synthesis.get("persona_signature", ""))[:200],
                "is_persona_version": bool(synthesis.get("is_persona_version", False)),
                # Link to base synthesis (for pre-generated persona versions)
                "base_synthesis_id": str(synthesis.get("base_synthesis_id", "")) if synthesis.get("base_synthesis_id") else "",
                # Story persistence tracking
                "update_count": int(synthesis.get("update_count", 0)),  # How many times this story was updated
                "first_seen": float(synthesis.get("first_seen", datetime.now().timestamp())),  # When story first appeared
                "parent_synthesis_id": str(synthesis.get("parent_synthesis_id", "")) if synthesis.get("parent_synthesis_id") else "",  # Previous synthesis in story chain
                "story_id": str(synthesis.get("story_id", "")) if synthesis.get("story_id") else ""  # Unique story identifier
            }
        )

        try:
            self.client.upsert(
                collection_name=self.syntheses_collection,
                points=[point]
            )
            logger.success(f"✅ Upserted synthesis '{synthesis.get('title', '')[:50]}...'")
            return True
        except Exception as e:
            logger.error(f"Failed to upsert synthesis: {e}")
            return False

    def upsert_syntheses(
        self,
        syntheses: List[Dict[str, Any]],
        embeddings: List[List[float]]
    ) -> bool:
        """
        Insert or update multiple syntheses in Qdrant

        Args:
            syntheses: List of synthesis dictionaries
            embeddings: List of embeddings (same length as syntheses)

        Returns:
            Success status
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        if len(syntheses) != len(embeddings):
            raise ValueError("Syntheses and embeddings must have same length")

        success = True
        for synthesis, embedding in zip(syntheses, embeddings):
            if not self.upsert_synthesis(synthesis, embedding):
                success = False

        return success

    def get_latest_syntheses(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get the latest syntheses

        Args:
            limit: Maximum number of syntheses to return

        Returns:
            List of syntheses ordered by creation time
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            # Fetch more than limit to ensure we get the latest after sorting
            # Scroll returns results in arbitrary order, so we need to fetch all
            # and sort by created_at before limiting
            result, _ = self.client.scroll(
                collection_name=self.syntheses_collection,
                limit=100,  # Fetch up to 100 to ensure we get latest
                with_payload=True,
                with_vectors=False
            )

            syntheses = []
            for point in result:
                synthesis = point.payload
                synthesis["id"] = point.id

                # Parse key_points back to list
                key_points_str = synthesis.get("key_points", "")
                if key_points_str:
                    synthesis["keyPoints"] = [k.strip() for k in key_points_str.split("|") if k.strip()]
                else:
                    synthesis["keyPoints"] = []

                # Parse sources back to list
                sources_str = synthesis.get("sources", "")
                if sources_str:
                    synthesis["sourcesList"] = [s.strip() for s in sources_str.split(",") if s.strip()]
                else:
                    synthesis["sourcesList"] = []

                syntheses.append(synthesis)

            # Sort by created_at descending
            syntheses.sort(key=lambda x: x.get("created_at", 0), reverse=True)

            # Apply limit after sorting
            syntheses = syntheses[:limit]

            logger.info(f"Fetched {len(syntheses)} syntheses (limited to {limit})")
            return syntheses

        except Exception as e:
            logger.error(f"Failed to get syntheses: {e}")
            return []

    def get_synthesis_by_id(self, synthesis_id: str) -> Optional[Dict[str, Any]]:
        """Get synthesis by ID"""
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            result = self.client.retrieve(
                collection_name=self.syntheses_collection,
                ids=[synthesis_id]
            )

            if result:
                synthesis = result[0].payload
                synthesis["id"] = synthesis_id

                # Parse key_points back to list
                key_points_str = synthesis.get("key_points", "")
                if key_points_str:
                    synthesis["keyPoints"] = [k.strip() for k in key_points_str.split("|") if k.strip()]
                else:
                    synthesis["keyPoints"] = []

                # Parse causal_graph back from JSON
                import json
                causal_graph_str = synthesis.get("causal_graph", "{}")
                if causal_graph_str and isinstance(causal_graph_str, str):
                    try:
                        synthesis["causal_graph"] = json.loads(causal_graph_str)
                    except json.JSONDecodeError:
                        synthesis["causal_graph"] = {"nodes": [], "edges": [], "central_entity": "", "narrative_flow": "linear"}
                else:
                    synthesis["causal_graph"] = {"nodes": [], "edges": [], "central_entity": "", "narrative_flow": "linear"}

                return synthesis
            return None

        except Exception as e:
            logger.error(f"Failed to retrieve synthesis {synthesis_id}: {e}")
            return None

    def get_recent_syntheses(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get recent syntheses for analysis (used by causal stats)

        Args:
            limit: Maximum number of syntheses to return

        Returns:
            List of syntheses with causal_graph parsed
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json

            result, _ = self.client.scroll(
                collection_name=self.syntheses_collection,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )

            syntheses = []
            for point in result:
                synthesis = point.payload
                synthesis["id"] = point.id

                # Parse causal_graph from JSON
                causal_graph_str = synthesis.get("causal_graph", "{}")
                if causal_graph_str and isinstance(causal_graph_str, str):
                    try:
                        synthesis["causal_graph"] = json.loads(causal_graph_str)
                    except json.JSONDecodeError:
                        synthesis["causal_graph"] = {"nodes": [], "edges": []}
                else:
                    synthesis["causal_graph"] = {"nodes": [], "edges": []}

                syntheses.append(synthesis)

            return syntheses

        except Exception as e:
            logger.error(f"Failed to get recent syntheses: {e}")
            return []

    def get_syntheses_with_vectors(self, days: int = 7, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get recent syntheses WITH their embedding vectors for hybrid clustering.

        Args:
            days: Number of days to look back (default 7)
            limit: Maximum number of syntheses to return

        Returns:
            List of dicts with 'payload' and 'vector' keys
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            from datetime import datetime, timedelta
            from qdrant_client.models import Filter, FieldCondition, Range

            # Calculate cutoff timestamp
            cutoff = (datetime.now() - timedelta(days=days)).timestamp()

            # Filter for recent syntheses only
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="created_at",
                        range=Range(gte=cutoff)
                    )
                ]
            )

            result, _ = self.client.scroll(
                collection_name=self.syntheses_collection,
                scroll_filter=query_filter,
                limit=limit,
                with_payload=True,
                with_vectors=True  # ← Include embeddings!
            )

            syntheses_with_vectors = []
            for point in result:
                syntheses_with_vectors.append({
                    "id": point.id,
                    "payload": point.payload,
                    "vector": point.vector,
                    "type": "synthesis"  # Mark as synthesis for clustering
                })

            logger.info(f"📚 Fetched {len(syntheses_with_vectors)} syntheses with vectors (last {days} days)")
            return syntheses_with_vectors

        except Exception as e:
            logger.error(f"Failed to get syntheses with vectors: {e}")
            return []

    def get_persistent_syntheses_with_vectors(
        self,
        max_days: int = 90,
        recent_days: int = 3,
        min_persistence_score: float = 3.0,
        limit: int = 150
    ) -> List[Dict[str, Any]]:
        """
        Get syntheses for hybrid clustering using SMART persistence scoring.

        Includes:
        - ALL syntheses from last `recent_days` (always fresh news)
        - Older syntheses with high persistence score (recurring stories)

        Persistence Score = (update_count × 2) + recency_bonus + span_bonus
        - update_count: How many times story was updated
        - recency_bonus: +5 if updated in last 3 days
        - span_bonus: +3 if story spans > 7 days

        Args:
            max_days: Maximum age of syntheses to consider (default 90)
            recent_days: Always include syntheses from last N days (default 3)
            min_persistence_score: Minimum score for older syntheses (default 3.0)
            limit: Maximum total syntheses to return

        Returns:
            List of syntheses with vectors, sorted by relevance
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            from datetime import datetime, timedelta

            now = datetime.now()
            max_cutoff = (now - timedelta(days=max_days)).timestamp()
            recent_cutoff = (now - timedelta(days=recent_days)).timestamp()

            # Fetch all syntheses within max_days window
            from qdrant_client.models import Filter, FieldCondition, Range

            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="created_at",
                        range=Range(gte=max_cutoff)
                    )
                ]
            )

            result, _ = self.client.scroll(
                collection_name=self.syntheses_collection,
                scroll_filter=query_filter,
                limit=500,  # Fetch more, filter later
                with_payload=True,
                with_vectors=True
            )

            # Calculate persistence score for each synthesis
            scored_syntheses = []
            for point in result:
                payload = point.payload
                created_at = payload.get("created_at", 0)
                update_count = payload.get("update_count", 0)
                first_seen = payload.get("first_seen", created_at)

                # Calculate components
                is_recent = created_at >= recent_cutoff
                days_since_first = (now.timestamp() - first_seen) / 86400 if first_seen else 0

                # Persistence score calculation
                score = update_count * 2.0  # Each update adds 2 points
                if is_recent:
                    score += 5.0  # Recent bonus
                if days_since_first > 7:
                    score += 3.0  # Long-running story bonus

                # Include if: recent OR high persistence score
                if is_recent or score >= min_persistence_score:
                    scored_syntheses.append({
                        "id": point.id,
                        "payload": payload,
                        "vector": point.vector,
                        "type": "synthesis",
                        "persistence_score": score,
                        "is_recent": is_recent,
                        "update_count": update_count
                    })

            # Sort by persistence score (highest first)
            scored_syntheses.sort(key=lambda x: x["persistence_score"], reverse=True)

            # Limit results
            result_syntheses = scored_syntheses[:limit]

            # Log statistics
            recent_count = sum(1 for s in result_syntheses if s["is_recent"])
            persistent_count = len(result_syntheses) - recent_count
            logger.info(
                f"📊 Smart persistence: {len(result_syntheses)} syntheses "
                f"({recent_count} recent + {persistent_count} persistent stories)"
            )

            return result_syntheses

        except Exception as e:
            logger.error(f"Failed to get persistent syntheses: {e}")
            return []

    def get_syntheses_by_category(
        self,
        category: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get syntheses filtered by category.

        Args:
            category: Category name (MONDE, TECH, ECONOMIE, etc.)
            limit: Maximum number of syntheses to return

        Returns:
            List of syntheses in that category, ordered by creation time
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue

            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="category",
                        match=MatchValue(value=category.upper())
                    )
                ]
            )

            result, _ = self.client.scroll(
                collection_name=self.syntheses_collection,
                scroll_filter=query_filter,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )

            syntheses = []
            for point in result:
                synthesis = point.payload
                synthesis["id"] = point.id

                # Parse key_points back to list
                key_points_str = synthesis.get("key_points", "")
                if key_points_str:
                    synthesis["keyPoints"] = [k.strip() for k in key_points_str.split("|") if k.strip()]
                else:
                    synthesis["keyPoints"] = []

                syntheses.append(synthesis)

            # Sort by created_at descending
            syntheses.sort(key=lambda x: x.get("created_at", 0), reverse=True)

            logger.info(f"Fetched {len(syntheses)} syntheses for category '{category}'")
            return syntheses

        except Exception as e:
            logger.error(f"Failed to get syntheses by category {category}: {e}")
            return []

    def get_breaking_syntheses(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Get the most recent syntheses for the news ticker (breaking news).

        Args:
            limit: Maximum number of syntheses to return (default 5)

        Returns:
            List of most recent syntheses
        """
        return self.get_latest_syntheses(limit=limit)

    def get_live_syntheses(
        self,
        hours: int = 24,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get syntheses from the last X hours (for EN DIRECT page).

        Args:
            hours: Number of hours to look back (default 24)
            limit: Maximum number of syntheses to return

        Returns:
            List of syntheses created within the time window
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            from datetime import datetime, timedelta
            from qdrant_client.models import Filter, FieldCondition, Range

            cutoff_time = (datetime.now() - timedelta(hours=hours)).timestamp()

            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="created_at",
                        range=Range(gte=cutoff_time)
                    )
                ]
            )

            result, _ = self.client.scroll(
                collection_name=self.syntheses_collection,
                scroll_filter=query_filter,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )

            syntheses = []
            for point in result:
                synthesis = point.payload
                synthesis["id"] = point.id

                # Parse key_points back to list
                key_points_str = synthesis.get("key_points", "")
                if key_points_str:
                    synthesis["keyPoints"] = [k.strip() for k in key_points_str.split("|") if k.strip()]
                else:
                    synthesis["keyPoints"] = []

                syntheses.append(synthesis)

            # Sort by created_at descending (most recent first)
            syntheses.sort(key=lambda x: x.get("created_at", 0), reverse=True)

            logger.info(f"Fetched {len(syntheses)} live syntheses (last {hours}h)")
            return syntheses

        except Exception as e:
            logger.error(f"Failed to get live syntheses: {e}")
            return []

    def get_persona_versions_by_base_id(
        self,
        base_synthesis_id: str,
        persona_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all pre-generated persona versions for a base synthesis.

        Args:
            base_synthesis_id: The ID of the base (neutral) synthesis
            persona_id: Optional - filter by specific persona

        Returns:
            List of persona versions linked to this base synthesis
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue

            conditions = [
                FieldCondition(
                    key="base_synthesis_id",
                    match=MatchValue(value=base_synthesis_id)
                )
            ]

            # Add persona filter if specified
            if persona_id:
                conditions.append(
                    FieldCondition(
                        key="persona_id",
                        match=MatchValue(value=persona_id)
                    )
                )

            query_filter = Filter(must=conditions)

            result, _ = self.client.scroll(
                collection_name=self.syntheses_collection,
                scroll_filter=query_filter,
                limit=10,  # Max 5 personas + buffer
                with_payload=True,
                with_vectors=False
            )

            syntheses = []
            for point in result:
                synthesis = point.payload
                synthesis["id"] = point.id

                # Parse key_points back to list
                key_points_str = synthesis.get("key_points", "")
                if key_points_str:
                    synthesis["keyPoints"] = [k.strip() for k in key_points_str.split("|") if k.strip()]
                else:
                    synthesis["keyPoints"] = []

                # Parse causal_graph back from JSON
                import json
                causal_graph_str = synthesis.get("causal_graph", "{}")
                if causal_graph_str and isinstance(causal_graph_str, str):
                    try:
                        synthesis["causal_graph"] = json.loads(causal_graph_str)
                    except json.JSONDecodeError:
                        synthesis["causal_graph"] = {"nodes": [], "edges": []}

                syntheses.append(synthesis)

            logger.info(f"Found {len(syntheses)} persona versions for base synthesis {base_synthesis_id[:8]}...")
            return syntheses

        except Exception as e:
            logger.error(f"Failed to get persona versions for {base_synthesis_id}: {e}")
            return []

    def get_base_synthesis_for_persona(
        self,
        synthesis_id: str
    ) -> Optional[str]:
        """
        Get the base synthesis ID for a persona version.

        Args:
            synthesis_id: The ID of a persona version

        Returns:
            The base_synthesis_id if this is a persona version, None otherwise
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            result = self.client.retrieve(
                collection_name=self.syntheses_collection,
                ids=[synthesis_id]
            )

            if result:
                return result[0].payload.get("base_synthesis_id") or None
            return None

        except Exception as e:
            logger.error(f"Failed to get base synthesis for {synthesis_id}: {e}")
            return None


# Global instance
qdrant_service = QdrantService()


async def init_qdrant():
    """Initialize Qdrant service"""
    await qdrant_service.initialize()


def get_qdrant_service() -> QdrantService:
    """Dependency injection for FastAPI"""
    if not qdrant_service.client:
        raise RuntimeError("Qdrant service not initialized")
    return qdrant_service

