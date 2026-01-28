"""
Qdrant Vector Database Client
For storing and searching article embeddings
"""
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient, models
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
        # Intelligence Hub collections
        self.entities_collection = "novapress_entities"
        self.topics_collection = "novapress_topics"

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

            # Intelligence Hub: Entities collection
            if self.entities_collection not in collection_names:
                logger.info(f"Creating collection: {self.entities_collection}")
                self.client.create_collection(
                    collection_name=self.entities_collection,
                    vectors_config=VectorParams(
                        size=settings.EMBEDDING_DIMENSION,
                        distance=Distance.COSINE
                    )
                )
                logger.success(f"✅ Collection '{self.entities_collection}' created")
            else:
                logger.info(f"Collection '{self.entities_collection}' already exists")

            # Intelligence Hub: Topics collection
            if self.topics_collection not in collection_names:
                logger.info(f"Creating collection: {self.topics_collection}")
                self.client.create_collection(
                    collection_name=self.topics_collection,
                    vectors_config=VectorParams(
                        size=settings.EMBEDDING_DIMENSION,
                        distance=Distance.COSINE
                    )
                )
                logger.success(f"✅ Collection '{self.topics_collection}' created")
            else:
                logger.info(f"Collection '{self.topics_collection}' already exists")

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
                    "image_url": safe_str(article.get("image_url"), "", 400),
                    # Phase 6: Article exclusivity tracking
                    "used_in_synthesis_id": safe_str(article.get("used_in_synthesis_id"), "", 50),
                    "used_at": float(article.get("used_at", 0)) if article.get("used_at") else 0.0
                }
            ))

        try:
            self.client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            # Log sample URLs being stored for debugging
            sample_urls = [p.payload.get("url", "N/A")[:60] for p in points[:3]]
            logger.success(f"✅ Upserted {len(points)} articles to Qdrant (collection: {self.collection_name})")
            logger.debug(f"   Sample stored URLs: {sample_urls}")
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
            # Use query_points (qdrant-client >= 1.12.0)
            results = self.client.query_points(
                collection_name=self.collection_name,
                query=query_embedding,
                limit=limit,
                query_filter=query_filter,
                with_payload=True
            )

            articles = []
            for point in results.points:
                article = point.payload
                article["similarity_score"] = point.score
                article["id"] = point.id
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

    def get_articles_by_ids(self, article_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Batch retrieve multiple articles by IDs in a single Qdrant call.

        This is much more efficient than calling get_article_by_id() in a loop.
        N articles = 1 Qdrant call instead of N calls.

        Args:
            article_ids: List of article UUIDs to retrieve

        Returns:
            List of article payloads (may be shorter than input if some IDs not found)
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        if not article_ids:
            return []

        try:
            result = self.client.retrieve(
                collection_name=self.collection_name,
                ids=article_ids
            )

            # Extract payloads from results
            articles = [point.payload for point in result if point and point.payload]
            logger.debug(f"Batch retrieved {len(articles)}/{len(article_ids)} articles")
            return articles

        except Exception as e:
            logger.error(f"Failed to batch retrieve articles: {e}")
            return []

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

    def get_collection_stats(self, collection_name: Optional[str] = None) -> Dict[str, Any]:
        """Get collection statistics

        Args:
            collection_name: Optional collection name. Defaults to articles collection.
                            Use 'syntheses' for syntheses collection.
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        # Determine which collection to query
        if collection_name == "syntheses" or collection_name == self.syntheses_collection:
            target_collection = self.syntheses_collection
        elif collection_name is None or collection_name == "articles":
            target_collection = self.collection_name
        else:
            target_collection = collection_name

        try:
            info = self.client.get_collection(target_collection)
            # Handle different qdrant-client versions (vectors_count location changed)
            vectors_count = getattr(info, 'vectors_count', None)
            if vectors_count is None:
                # Fallback: try to get from config or use points_count
                vectors_count = getattr(info, 'points_count', 0)
            points_count = getattr(info, 'points_count', 0)
            status = getattr(info, 'status', 'unknown')
            return {
                "collection": target_collection,
                "vectors_count": vectors_count,
                "points_count": points_count,
                "status": str(status) if status else "unknown"
            }
        except Exception as e:
            logger.error(f"Failed to get stats for {target_collection}: {e}")
            return {"collection": target_collection, "error": str(e)}

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

    # =========================================================================
    # PHASE 6: ARTICLE EXCLUSIVITY TRACKING
    # =========================================================================

    def update_article_synthesis_link(
        self,
        article_url: str,
        synthesis_id: str
    ) -> bool:
        """
        Mark an article as used by a synthesis.

        Once an article is used in Synthesis A:
        - It CAN be reused to UPDATE Synthesis A
        - It CANNOT be used to create a NEW Synthesis B

        Args:
            article_url: The URL of the article to mark
            synthesis_id: The ID of the synthesis that used this article

        Returns:
            Success status
        """
        if not self.client or not article_url:
            return False

        try:
            from datetime import datetime, timedelta
            from urllib.parse import urlparse, unquote

            # Normalize URL for matching (multiple formats)
            normalized_url = article_url.lower().rstrip('/')
            decoded_url = unquote(article_url)  # Decode %XX

            # Extract URL path for partial matching
            parsed = urlparse(article_url)
            url_path = parsed.path.rstrip('/').lower()
            url_domain = parsed.netloc.lower()

            # NOTE: These are DEBUG because articles are not stored (copyright compliance)
            logger.debug(f"🔍 Searching for article URL: {article_url[:80]}...")
            logger.debug(f"   Collection: {self.collection_name}")

            result = None

            # Strategy 1: Exact URL match via filter
            url_filter = Filter(
                must=[
                    FieldCondition(
                        key="url",
                        match=MatchValue(value=article_url)
                    )
                ]
            )
            result, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=url_filter,
                limit=5,
                with_payload=True,
                with_vectors=False
            )
            if result:
                logger.debug(f"✅ Found by exact URL match")

            # Strategy 2: Normalized URL match
            if not result:
                url_filter = Filter(
                    must=[
                        FieldCondition(
                            key="url",
                            match=MatchValue(value=normalized_url)
                        )
                    ]
                )
                result, _ = self.client.scroll(
                    collection_name=self.collection_name,
                    scroll_filter=url_filter,
                    limit=5,
                    with_payload=True,
                    with_vectors=False
                )
                if result:
                    logger.debug(f"✅ Found by normalized URL match")

            # Strategy 3: Scroll ALL articles and match by URL path + domain
            # Note: published_at is stored as ISO string, not timestamp, so we can't filter by time
            if not result:
                # Scroll without time filter since published_at is ISO string
                all_recent, _ = self.client.scroll(
                    collection_name=self.collection_name,
                    limit=3000,  # Increased limit to cover recent articles
                    with_payload=True,
                    with_vectors=False
                )

                logger.debug(f"📊 Strategy 3: Scrolled {len(all_recent)} articles in collection")

                # Log first 3 URLs in collection for comparison (debug)
                if all_recent:
                    sample_urls = [p.payload.get("url", "N/A")[:60] for p in all_recent[:3]]
                    logger.debug(f"📋 Sample URLs in Qdrant: {sample_urls}")
                    logger.debug(f"🔎 Searching for: {article_url[:60]}...")

                for point in all_recent:
                    stored_url = point.payload.get("url", "")
                    if not stored_url:
                        continue

                    stored_normalized = stored_url.lower().rstrip('/')
                    stored_parsed = urlparse(stored_url)
                    stored_path = stored_parsed.path.rstrip('/').lower()
                    stored_domain = stored_parsed.netloc.lower()

                    # Match by: exact, normalized, decoded, path+domain, or partial
                    if (stored_url == article_url or
                        stored_normalized == normalized_url or
                        stored_url == decoded_url or
                        (stored_path == url_path and stored_domain == url_domain) or
                        article_url in stored_url or
                        stored_url in article_url):
                        result = [point]
                        logger.info(f"✅ Found by scroll matching: {stored_url[:60]}...")
                        break

            if result:
                point = result[0]
                self.client.set_payload(
                    collection_name=self.collection_name,
                    payload={
                        "used_in_synthesis_id": synthesis_id,
                        "used_at": datetime.now().timestamp()
                    },
                    points=[point.id]
                )
                logger.info(f"📌 Article marked as used: {article_url[:60]}...")
                return True

            # NOTE: This is expected when articles are not stored (copyright compliance mode)
            # Changed from WARNING to DEBUG to avoid log spam
            logger.debug(f"Article not found in Qdrant (expected - articles not stored): {article_url[:80]}...")
            return False

        except Exception as e:
            logger.error(f"Failed to update article synthesis link: {e}")
            import traceback
            traceback.print_exc()
            return False

    def get_articles_excluding_used(
        self,
        hours: int = 24,
        limit: int = 100,
        allowed_synthesis_ids: List[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get recent articles that are NOT already used in other syntheses.

        This enforces the exclusivity rule:
        - Articles with no used_in_synthesis_id are available
        - Articles with used_in_synthesis_id matching allowed_synthesis_ids are available (for updates)
        - Articles used in OTHER syntheses are excluded

        Args:
            hours: Number of hours to look back
            limit: Maximum number of articles
            allowed_synthesis_ids: List of synthesis IDs that can reuse their own articles

        Returns:
            List of available articles (not used elsewhere)
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        allowed_ids = set(allowed_synthesis_ids) if allowed_synthesis_ids else set()

        try:
            from datetime import datetime, timedelta

            # Calculate cutoff time
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
                limit=limit * 2,  # Fetch more to account for filtering
                with_payload=True,
                with_vectors=False
            )

            available_articles = []
            excluded_count = 0

            for point in result:
                article = point.payload
                article["id"] = point.id

                # Check if article is already used
                used_in = article.get("used_in_synthesis_id", "")

                if not used_in:
                    # Not used - available
                    available_articles.append(article)
                elif used_in in allowed_ids:
                    # Used by an allowed synthesis (update case) - available
                    available_articles.append(article)
                else:
                    # Used by another synthesis - excluded
                    excluded_count += 1

                if len(available_articles) >= limit:
                    break

            if excluded_count > 0:
                logger.info(f"📊 Article exclusivity: {len(available_articles)} available, {excluded_count} excluded (used elsewhere)")
            else:
                logger.info(f"Fetched {len(available_articles)} available articles (last {hours}h)")

            return available_articles

        except Exception as e:
            logger.error(f"Failed to get articles excluding used: {e}")
            return []

    def get_articles_with_vectors_excluding_used(
        self,
        hours: int = 24,
        limit: int = 100,
        allowed_synthesis_ids: List[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get recent articles WITH vectors, excluding those already used elsewhere.

        This is used during clustering to ensure only available articles are clustered.

        Args:
            hours: Number of hours to look back
            limit: Maximum number of articles
            allowed_synthesis_ids: List of synthesis IDs that can reuse their own articles

        Returns:
            List of available articles with 'payload' and 'vector' keys
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        allowed_ids = set(allowed_synthesis_ids) if allowed_synthesis_ids else set()

        try:
            from datetime import datetime, timedelta

            cutoff_time = (datetime.now() - timedelta(hours=hours)).timestamp()

            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="published_at",
                        range=Range(gte=cutoff_time)
                    )
                ]
            )

            result, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=query_filter,
                limit=limit * 2,
                with_payload=True,
                with_vectors=True  # Include vectors for clustering
            )

            available_articles = []
            excluded_count = 0

            for point in result:
                payload = point.payload
                used_in = payload.get("used_in_synthesis_id", "")

                if not used_in or used_in in allowed_ids:
                    available_articles.append({
                        "id": point.id,
                        "payload": payload,
                        "vector": point.vector,
                        "type": "article"
                    })
                else:
                    excluded_count += 1

                if len(available_articles) >= limit:
                    break

            if excluded_count > 0:
                logger.info(f"📊 Clustering: {len(available_articles)} articles available, {excluded_count} excluded")

            return available_articles

        except Exception as e:
            logger.error(f"Failed to get articles with vectors: {e}")
            return []

    def mark_articles_as_used(
        self,
        article_urls: List[str],
        synthesis_id: str
    ) -> int:
        """
        Mark multiple articles as used by a synthesis (batch operation).

        Args:
            article_urls: List of article URLs to mark
            synthesis_id: The synthesis ID that used these articles

        Returns:
            Number of articles successfully marked
        """
        if not self.client or not article_urls:
            return 0

        marked_count = 0
        for url in article_urls:
            if self.update_article_synthesis_link(url, synthesis_id):
                marked_count += 1

        logger.info(f"📌 Marked {marked_count}/{len(article_urls)} articles as used by synthesis {synthesis_id[:8]}...")
        return marked_count

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

        # FALLBACK: Extract from text if LLM didn't generate causal_chain
        if (not causal_chain or len(causal_chain) < 2) and not causal_graph.get("edges"):
            try:
                from app.ml.causal_extraction import get_causal_extractor
                extractor = get_causal_extractor()

                # Get text content for extraction
                synthesis_text = f"{synthesis.get('body', '')} {synthesis.get('analysis', '')}"
                key_points = synthesis.get("keyPoints", [])
                title = synthesis.get("title", "")
                entities = synthesis.get("key_entities", [])
                if isinstance(entities, str):
                    entities = [e.strip() for e in entities.split(",") if e.strip()]

                # Extract causal relations from text
                extracted_graph = extractor.extract_from_synthesis(
                    synthesis_text=synthesis_text,
                    entities=entities[:10],
                    fact_density=0.6,
                    llm_causal_output={"causal_chain": causal_chain} if causal_chain else None,
                    key_points=key_points,
                    title=title
                )

                # Convert to causal_chain format for processing below
                if extracted_graph.edges:
                    logger.info(f"📊 Causal fallback: extracted {len(extracted_graph.edges)} relations from text")
                    causal_chain = [
                        {
                            "cause": e.cause_text,
                            "effect": e.effect_text,
                            "type": e.relation_type,
                            "sources": e.source_articles
                        }
                        for e in extracted_graph.edges
                    ]
            except Exception as e:
                logger.warning(f"Causal extraction fallback failed: {e}")

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
                        "prediction": pred.get("prediction", "")[:1000],
                        "probability": float(pred.get("probability", 0.5)),
                        "type": pred.get("type", "general"),
                        "timeframe": pred.get("timeframe", "moyen_terme"),
                        "rationale": pred.get("rationale", "")[:1000]
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
                "summary": str(synthesis.get("summary", ""))[:15000],
                "introduction": str(synthesis.get("introduction", ""))[:3000],
                "body": str(synthesis.get("body", ""))[:20000],
                "analysis": str(synthesis.get("analysis", ""))[:5000],
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
                "story_id": str(synthesis.get("story_id", "")) if synthesis.get("story_id") else "",  # Unique story identifier
                # Phase 2.5: Kill Switch & Cost Tracker
                "is_published": bool(synthesis.get("is_published", True)),  # Kill Switch - dépublier instantanément
                "moderation_flag": str(synthesis.get("moderation_flag", "safe"))[:20],  # "safe", "warning", "blocked"
                "generation_cost_usd": float(synthesis.get("generation_cost_usd", 0.0))  # Coût LLM de génération
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

    def get_latest_syntheses(self, limit: int = 10, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get the latest syntheses using pagination to ensure we get the most recent

        Args:
            limit: Maximum number of syntheses to return
            offset: Number of syntheses to skip (for pagination)

        Returns:
            List of syntheses ordered by creation time (most recent first)
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            # Use pagination to fetch ALL syntheses, then sort and limit
            # This ensures we always get the most recent ones
            all_syntheses = []
            scroll_offset = None
            batch_size = 100

            while True:
                result, next_offset = self.client.scroll(
                    collection_name=self.syntheses_collection,
                    limit=batch_size,
                    offset=scroll_offset,
                    with_payload=True,
                    with_vectors=False
                )

                if not result:
                    break

                for point in result:
                    synthesis = dict(point.payload)
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

                    all_syntheses.append(synthesis)

                # Check if we have more pages
                if next_offset is None or len(result) < batch_size:
                    break
                scroll_offset = next_offset

            # Sort by created_at descending (most recent first)
            all_syntheses.sort(key=lambda x: x.get("created_at", 0), reverse=True)

            # Apply offset and limit after sorting (for API pagination)
            syntheses = all_syntheses[offset:offset + limit]

            logger.info(f"Fetched {len(syntheses)} syntheses (offset={offset}, limit={limit}) from {len(all_syntheses)} total")
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

    def find_duplicate_synthesis(
        self,
        article_urls: List[str],
        hours_lookback: int = 24,
        overlap_threshold: float = 0.7
    ) -> Optional[Dict[str, Any]]:
        """
        Find an existing synthesis that uses the same (or very similar) articles.

        Deduplication strategy:
        1. Get recent syntheses from the last N hours
        2. Compare article URLs with new cluster's URLs
        3. If overlap > threshold (70%), consider it a duplicate

        Args:
            article_urls: List of URLs from the new cluster's articles
            hours_lookback: Only check syntheses from the last N hours (default: 24)
            overlap_threshold: Minimum overlap ratio to consider duplicate (default: 0.7 = 70%)

        Returns:
            Existing synthesis dict if duplicate found, None otherwise
        """
        if not self.client or not article_urls:
            return None

        from datetime import datetime, timedelta

        try:
            # Get syntheses from the last N hours
            cutoff_time = (datetime.now() - timedelta(hours=hours_lookback)).timestamp()

            result, _ = self.client.scroll(
                collection_name=self.syntheses_collection,
                scroll_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="created_at",
                            range=models.Range(gte=cutoff_time)
                        ),
                        # Only check base syntheses, not persona versions
                        models.FieldCondition(
                            key="is_persona_version",
                            match=models.MatchValue(value=False)
                        )
                    ]
                ),
                limit=200,
                with_payload=True,
                with_vectors=False
            )

            if not result:
                return None

            # Normalize URLs for comparison (remove trailing slashes, lowercase)
            new_urls = set(url.lower().rstrip('/') for url in article_urls if url)

            for point in result:
                synthesis = point.payload

                # Get article URLs from source_articles
                source_articles = synthesis.get("source_articles", [])
                if isinstance(source_articles, list):
                    existing_urls = set()
                    for sa in source_articles:
                        if isinstance(sa, dict) and sa.get("url"):
                            existing_urls.add(sa["url"].lower().rstrip('/'))
                        elif isinstance(sa, str):
                            existing_urls.add(sa.lower().rstrip('/'))
                else:
                    continue

                if not existing_urls:
                    continue

                # Calculate overlap ratio
                overlap = len(new_urls & existing_urls)
                total = len(new_urls | existing_urls)
                overlap_ratio = overlap / total if total > 0 else 0

                if overlap_ratio >= overlap_threshold:
                    synthesis["id"] = point.id
                    logger.info(f"🔄 Duplicate synthesis found: {synthesis.get('title', '')[:50]}... "
                              f"(overlap: {overlap_ratio:.0%}, {overlap}/{total} URLs)")
                    return synthesis

            return None

        except Exception as e:
            logger.error(f"Error finding duplicate synthesis: {e}")
            return None

    def find_similar_synthesis_by_embedding(
        self,
        embedding: List[float],
        hours_lookback: int = 24,
        similarity_threshold: float = 0.92
    ) -> Optional[Dict[str, Any]]:
        """
        Find an existing synthesis with very similar content using embedding similarity.

        This is a secondary check after URL-based deduplication.
        Used to catch cases where different URLs point to the same story.

        Args:
            embedding: Embedding vector of the new cluster
            hours_lookback: Only check syntheses from the last N hours
            similarity_threshold: Minimum similarity to consider duplicate (default: 0.92 = 92%)

        Returns:
            Existing synthesis if very similar one found, None otherwise
        """
        if not self.client or not embedding:
            return None

        from datetime import datetime, timedelta

        try:
            cutoff_time = (datetime.now() - timedelta(hours=hours_lookback)).timestamp()

            # Use query_points (qdrant-client >= 1.12.0)
            results = self.client.query_points(
                collection_name=self.syntheses_collection,
                query=embedding if isinstance(embedding, list) else embedding.tolist(),
                query_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="created_at",
                            range=models.Range(gte=cutoff_time)
                        ),
                        models.FieldCondition(
                            key="is_persona_version",
                            match=models.MatchValue(value=False)
                        )
                    ]
                ),
                limit=5,
                with_payload=True
            )

            for point in results.points:
                if point.score >= similarity_threshold:
                    synthesis = point.payload
                    synthesis["id"] = point.id
                    logger.info(f"🔄 Similar synthesis found by embedding: {synthesis.get('title', '')[:50]}... "
                              f"(similarity: {point.score:.0%})")
                    return synthesis

            return None

        except Exception as e:
            logger.error(f"Error finding similar synthesis by embedding: {e}")
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
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get syntheses from the last X hours (for EN DIRECT page) with pagination.

        Args:
            hours: Number of hours to look back (default 24)
            limit: Maximum number of syntheses to return
            offset: Number of syntheses to skip (for pagination)

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

            # Fetch more to handle pagination (we need all to sort, then slice)
            # For efficiency with large datasets, fetch a reasonable batch
            fetch_limit = max(limit + offset + 10, 200)  # Ensure we get enough

            result, _ = self.client.scroll(
                collection_name=self.syntheses_collection,
                scroll_filter=query_filter,
                limit=fetch_limit,
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

            # Apply pagination offset and limit
            paginated = syntheses[offset:offset + limit]

            logger.info(f"Fetched {len(paginated)} live syntheses (last {hours}h, offset={offset}, limit={limit})")
            return paginated

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

    # =========================================================================
    # INTELLIGENCE HUB: ENTITIES
    # =========================================================================

    def upsert_entity(
        self,
        entity: Dict[str, Any],
        embedding: List[float]
    ) -> bool:
        """
        Insert or update an entity in the Intelligence Hub.

        Args:
            entity: Entity dictionary with canonical_name, entity_type, aliases, etc.
            embedding: Embedding vector for semantic search

        Returns:
            Success status
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        from datetime import datetime
        import json

        point_id = entity.get("id") or str(uuid.uuid4())

        # Convert lists to JSON strings for storage
        aliases = entity.get("aliases", [])
        aliases_str = json.dumps(aliases) if isinstance(aliases, list) else "[]"

        synthesis_ids = entity.get("synthesis_ids", [])
        synthesis_ids_str = json.dumps(synthesis_ids) if isinstance(synthesis_ids, list) else "[]"

        related_entities = entity.get("related_entities", [])
        related_entities_str = json.dumps(related_entities) if isinstance(related_entities, list) else "[]"

        topics = entity.get("topics", [])
        topics_str = json.dumps(topics) if isinstance(topics, list) else "[]"

        point = PointStruct(
            id=point_id,
            vector=embedding.tolist() if hasattr(embedding, 'tolist') else embedding,
            payload={
                "canonical_name": str(entity.get("canonical_name", ""))[:200],
                "aliases": aliases_str[:2000],
                "entity_type": str(entity.get("entity_type", "UNKNOWN"))[:20],
                "description": str(entity.get("description", ""))[:1000],
                "first_seen": float(entity.get("first_seen", datetime.now().timestamp())),
                "last_seen": float(entity.get("last_seen", datetime.now().timestamp())),
                "mention_count": int(entity.get("mention_count", 1)),
                "synthesis_ids": synthesis_ids_str[:5000],
                "as_cause_count": int(entity.get("as_cause_count", 0)),
                "as_effect_count": int(entity.get("as_effect_count", 0)),
                "related_entities": related_entities_str[:2000],
                "topics": topics_str[:1000],
                "created_at": datetime.now().timestamp()
            }
        )

        try:
            self.client.upsert(
                collection_name=self.entities_collection,
                points=[point]
            )
            logger.debug(f"✅ Upserted entity '{entity.get('canonical_name', '')}'")
            return True
        except Exception as e:
            logger.error(f"Failed to upsert entity: {e}")
            return False

    def get_entity_by_id(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """Get entity by ID"""
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json

            result = self.client.retrieve(
                collection_name=self.entities_collection,
                ids=[entity_id]
            )

            if result:
                entity = result[0].payload
                entity["id"] = entity_id

                # Parse JSON fields back to lists
                for field in ["aliases", "synthesis_ids", "related_entities", "topics"]:
                    field_str = entity.get(field, "[]")
                    if isinstance(field_str, str):
                        try:
                            entity[field] = json.loads(field_str)
                        except json.JSONDecodeError:
                            entity[field] = []

                return entity
            return None

        except Exception as e:
            logger.error(f"Failed to retrieve entity {entity_id}: {e}")
            return None

    def search_entities_by_name(
        self,
        name: str,
        entity_type: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search entities by name (partial match).

        Args:
            name: Name or alias to search for
            entity_type: Optional filter by entity type
            limit: Maximum results

        Returns:
            List of matching entities
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json

            # Build filter conditions
            conditions = []
            if entity_type:
                conditions.append(
                    FieldCondition(
                        key="entity_type",
                        match=MatchValue(value=entity_type.upper())
                    )
                )

            query_filter = Filter(must=conditions) if conditions else None

            # Scroll through entities and filter by name
            result, _ = self.client.scroll(
                collection_name=self.entities_collection,
                scroll_filter=query_filter,
                limit=500,  # Fetch more, filter by name
                with_payload=True,
                with_vectors=False
            )

            name_lower = name.lower()
            entities = []

            for point in result:
                entity = point.payload
                entity["id"] = point.id

                # Check if name matches canonical_name or any alias
                canonical = entity.get("canonical_name", "").lower()
                aliases_str = entity.get("aliases", "[]")
                try:
                    aliases = json.loads(aliases_str) if isinstance(aliases_str, str) else []
                except json.JSONDecodeError:
                    aliases = []

                aliases_lower = [a.lower() for a in aliases if a]

                if name_lower in canonical or any(name_lower in a for a in aliases_lower):
                    # Parse JSON fields
                    for field in ["aliases", "synthesis_ids", "related_entities", "topics"]:
                        field_str = entity.get(field, "[]")
                        if isinstance(field_str, str):
                            try:
                                entity[field] = json.loads(field_str)
                            except json.JSONDecodeError:
                                entity[field] = []

                    entities.append(entity)

                    if len(entities) >= limit:
                        break

            # Sort by mention_count (most mentioned first)
            entities.sort(key=lambda x: x.get("mention_count", 0), reverse=True)

            return entities

        except Exception as e:
            logger.error(f"Failed to search entities: {e}")
            return []

    def search_entities_by_embedding(
        self,
        query_embedding: List[float],
        entity_type: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search entities by semantic similarity.

        Args:
            query_embedding: Query embedding vector
            entity_type: Optional filter by entity type
            limit: Maximum results

        Returns:
            List of similar entities with scores
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json

            # Build filter
            query_filter = None
            if entity_type:
                query_filter = Filter(
                    must=[
                        FieldCondition(
                            key="entity_type",
                            match=MatchValue(value=entity_type.upper())
                        )
                    ]
                )

            results = self.client.query_points(
                collection_name=self.entities_collection,
                query=query_embedding,
                limit=limit,
                query_filter=query_filter,
                with_payload=True
            )

            entities = []
            for point in results.points:
                entity = point.payload
                entity["id"] = point.id
                entity["similarity_score"] = point.score

                # Parse JSON fields
                for field in ["aliases", "synthesis_ids", "related_entities", "topics"]:
                    field_str = entity.get(field, "[]")
                    if isinstance(field_str, str):
                        try:
                            entity[field] = json.loads(field_str)
                        except json.JSONDecodeError:
                            entity[field] = []

                entities.append(entity)

            return entities

        except Exception as e:
            logger.error(f"Failed to search entities by embedding: {e}")
            return []

    def get_top_entities(
        self,
        entity_type: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get top entities by mention count.

        Args:
            entity_type: Optional filter by entity type
            limit: Maximum results

        Returns:
            List of entities sorted by mention_count
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json

            # Build filter
            query_filter = None
            if entity_type:
                query_filter = Filter(
                    must=[
                        FieldCondition(
                            key="entity_type",
                            match=MatchValue(value=entity_type.upper())
                        )
                    ]
                )

            result, _ = self.client.scroll(
                collection_name=self.entities_collection,
                scroll_filter=query_filter,
                limit=500,  # Fetch more, sort and limit
                with_payload=True,
                with_vectors=False
            )

            entities = []
            for point in result:
                entity = point.payload
                entity["id"] = point.id

                # Parse JSON fields
                for field in ["aliases", "synthesis_ids", "related_entities", "topics"]:
                    field_str = entity.get(field, "[]")
                    if isinstance(field_str, str):
                        try:
                            entity[field] = json.loads(field_str)
                        except json.JSONDecodeError:
                            entity[field] = []

                entities.append(entity)

            # Sort by mention_count
            entities.sort(key=lambda x: x.get("mention_count", 0), reverse=True)

            return entities[:limit]

        except Exception as e:
            logger.error(f"Failed to get top entities: {e}")
            return []

    def update_entity_mentions(
        self,
        entity_id: str,
        synthesis_id: str,
        as_cause: bool = False,
        as_effect: bool = False
    ) -> bool:
        """
        Update entity mention stats when referenced in a synthesis.

        Args:
            entity_id: The entity ID
            synthesis_id: The synthesis ID that mentions this entity
            as_cause: Whether entity appears as cause in causal relation
            as_effect: Whether entity appears as effect in causal relation

        Returns:
            Success status
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json
            from datetime import datetime

            # Get current entity
            entity = self.get_entity_by_id(entity_id)
            if not entity:
                return False

            # Update fields
            synthesis_ids = entity.get("synthesis_ids", [])
            if synthesis_id not in synthesis_ids:
                synthesis_ids.append(synthesis_id)

            entity["synthesis_ids"] = synthesis_ids
            entity["mention_count"] = len(synthesis_ids)
            entity["last_seen"] = datetime.now().timestamp()

            if as_cause:
                entity["as_cause_count"] = entity.get("as_cause_count", 0) + 1
            if as_effect:
                entity["as_effect_count"] = entity.get("as_effect_count", 0) + 1

            # Re-upsert (we need the embedding, fetch it)
            result = self.client.retrieve(
                collection_name=self.entities_collection,
                ids=[entity_id],
                with_vectors=True
            )

            if result and result[0].vector:
                return self.upsert_entity(entity, result[0].vector)

            return False

        except Exception as e:
            logger.error(f"Failed to update entity mentions: {e}")
            return False

    # =========================================================================
    # INTELLIGENCE HUB: TOPICS
    # =========================================================================

    def upsert_topic(
        self,
        topic: Dict[str, Any],
        embedding: List[float]
    ) -> bool:
        """
        Insert or update a topic in the Intelligence Hub.

        Args:
            topic: Topic dictionary with name, description, synthesis_ids, etc.
            embedding: Embedding vector for semantic search

        Returns:
            Success status
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        from datetime import datetime
        import json

        point_id = topic.get("id") or str(uuid.uuid4())

        # Convert lists to JSON strings
        keywords = topic.get("keywords", [])
        keywords_str = json.dumps(keywords) if isinstance(keywords, list) else "[]"

        synthesis_ids = topic.get("synthesis_ids", [])
        synthesis_ids_str = json.dumps(synthesis_ids) if isinstance(synthesis_ids, list) else "[]"

        entity_ids = topic.get("entity_ids", [])
        entity_ids_str = json.dumps(entity_ids) if isinstance(entity_ids, list) else "[]"

        # Store merged causal graph as JSON
        merged_causal_graph = topic.get("merged_causal_graph", {})
        causal_graph_str = json.dumps(merged_causal_graph) if isinstance(merged_causal_graph, dict) else "{}"

        point = PointStruct(
            id=point_id,
            vector=embedding.tolist() if hasattr(embedding, 'tolist') else embedding,
            payload={
                "name": str(topic.get("name", ""))[:200],
                "description": str(topic.get("description", ""))[:2000],
                "keywords": keywords_str[:1000],
                "category": str(topic.get("category", "MONDE"))[:50],
                "first_seen": float(topic.get("first_seen", datetime.now().timestamp())),
                "last_updated": float(topic.get("last_updated", datetime.now().timestamp())),
                "synthesis_ids": synthesis_ids_str[:10000],
                "entity_ids": entity_ids_str[:5000],
                "narrative_arc": str(topic.get("narrative_arc", "emerging"))[:20],
                "merged_causal_graph": causal_graph_str[:20000],
                "mention_count": int(topic.get("mention_count", 1)),
                "is_active": bool(topic.get("is_active", True)),
                "created_at": datetime.now().timestamp()
            }
        )

        try:
            self.client.upsert(
                collection_name=self.topics_collection,
                points=[point]
            )
            logger.debug(f"✅ Upserted topic '{topic.get('name', '')}'")
            return True
        except Exception as e:
            logger.error(f"Failed to upsert topic: {e}")
            return False

    def get_topic_by_id(self, topic_id: str) -> Optional[Dict[str, Any]]:
        """Get topic by ID"""
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json

            result = self.client.retrieve(
                collection_name=self.topics_collection,
                ids=[topic_id]
            )

            if result:
                topic = result[0].payload
                topic["id"] = topic_id

                # Parse JSON fields back to lists/dicts
                for field in ["keywords", "synthesis_ids", "entity_ids"]:
                    field_str = topic.get(field, "[]")
                    if isinstance(field_str, str):
                        try:
                            topic[field] = json.loads(field_str)
                        except json.JSONDecodeError:
                            topic[field] = []

                # Parse causal graph
                causal_str = topic.get("merged_causal_graph", "{}")
                if isinstance(causal_str, str):
                    try:
                        topic["merged_causal_graph"] = json.loads(causal_str)
                    except json.JSONDecodeError:
                        topic["merged_causal_graph"] = {"nodes": [], "edges": []}

                return topic
            return None

        except Exception as e:
            logger.error(f"Failed to retrieve topic {topic_id}: {e}")
            return None

    def get_topics(
        self,
        active_only: bool = True,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get topics with optional filtering.

        Args:
            active_only: Only return active topics
            category: Optional category filter
            limit: Maximum results

        Returns:
            List of topics sorted by last_updated
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json

            # Build filter conditions
            conditions = []
            if active_only:
                conditions.append(
                    FieldCondition(
                        key="is_active",
                        match=MatchValue(value=True)
                    )
                )
            if category:
                conditions.append(
                    FieldCondition(
                        key="category",
                        match=MatchValue(value=category.upper())
                    )
                )

            query_filter = Filter(must=conditions) if conditions else None

            result, _ = self.client.scroll(
                collection_name=self.topics_collection,
                scroll_filter=query_filter,
                limit=500,  # Fetch more, sort and limit
                with_payload=True,
                with_vectors=False
            )

            topics = []
            for point in result:
                topic = point.payload
                topic["id"] = point.id

                # Parse JSON fields
                for field in ["keywords", "synthesis_ids", "entity_ids"]:
                    field_str = topic.get(field, "[]")
                    if isinstance(field_str, str):
                        try:
                            topic[field] = json.loads(field_str)
                        except json.JSONDecodeError:
                            topic[field] = []

                topics.append(topic)

            # Sort by last_updated descending
            topics.sort(key=lambda x: x.get("last_updated", 0), reverse=True)

            return topics[:limit]

        except Exception as e:
            logger.error(f"Failed to get topics: {e}")
            return []

    def search_topics_by_embedding(
        self,
        query_embedding: List[float],
        active_only: bool = True,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search topics by semantic similarity.

        Args:
            query_embedding: Query embedding vector
            active_only: Only return active topics
            limit: Maximum results

        Returns:
            List of similar topics with scores
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json

            # Build filter
            query_filter = None
            if active_only:
                query_filter = Filter(
                    must=[
                        FieldCondition(
                            key="is_active",
                            match=MatchValue(value=True)
                        )
                    ]
                )

            results = self.client.query_points(
                collection_name=self.topics_collection,
                query=query_embedding,
                limit=limit,
                query_filter=query_filter,
                with_payload=True
            )

            topics = []
            for point in results.points:
                topic = point.payload
                topic["id"] = point.id
                topic["similarity_score"] = point.score

                # Parse JSON fields
                for field in ["keywords", "synthesis_ids", "entity_ids"]:
                    field_str = topic.get(field, "[]")
                    if isinstance(field_str, str):
                        try:
                            topic[field] = json.loads(field_str)
                        except json.JSONDecodeError:
                            topic[field] = []

                topics.append(topic)

            return topics

        except Exception as e:
            logger.error(f"Failed to search topics by embedding: {e}")
            return []

    def add_synthesis_to_topic(
        self,
        topic_id: str,
        synthesis_id: str
    ) -> bool:
        """
        Add a synthesis to an existing topic.

        Args:
            topic_id: The topic ID
            synthesis_id: The synthesis ID to add

        Returns:
            Success status
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json
            from datetime import datetime

            # Get current topic
            topic = self.get_topic_by_id(topic_id)
            if not topic:
                return False

            # Update fields
            synthesis_ids = topic.get("synthesis_ids", [])
            if synthesis_id not in synthesis_ids:
                synthesis_ids.append(synthesis_id)

            topic["synthesis_ids"] = synthesis_ids
            topic["mention_count"] = len(synthesis_ids)
            topic["last_updated"] = datetime.now().timestamp()

            # Re-upsert (we need the embedding, fetch it)
            result = self.client.retrieve(
                collection_name=self.topics_collection,
                ids=[topic_id],
                with_vectors=True
            )

            if result and result[0].vector:
                return self.upsert_topic(topic, result[0].vector)

            return False

        except Exception as e:
            logger.error(f"Failed to add synthesis to topic: {e}")
            return False

    def update_topic_causal_graph(
        self,
        topic_id: str,
        causal_graph: Dict[str, Any]
    ) -> bool:
        """
        Update the merged causal graph for a topic.

        Args:
            topic_id: The topic ID
            causal_graph: The aggregated causal graph

        Returns:
            Success status
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            from datetime import datetime

            # Get current topic
            topic = self.get_topic_by_id(topic_id)
            if not topic:
                return False

            topic["merged_causal_graph"] = causal_graph
            topic["last_updated"] = datetime.now().timestamp()

            # Re-upsert
            result = self.client.retrieve(
                collection_name=self.topics_collection,
                ids=[topic_id],
                with_vectors=True
            )

            if result and result[0].vector:
                return self.upsert_topic(topic, result[0].vector)

            return False

        except Exception as e:
            logger.error(f"Failed to update topic causal graph: {e}")
            return False

    def get_topics_with_embeddings(
        self,
        active_only: bool = True,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get topics WITH their embedding vectors for similarity calculation.
        Used by the Cortex Thématique visualization.

        Args:
            active_only: Only return active topics
            category: Optional category filter
            limit: Maximum results

        Returns:
            List of topics with 'embedding' field containing the vector
        """
        if not self.client:
            raise RuntimeError("Qdrant not initialized")

        try:
            import json

            # Build filter conditions
            conditions = []
            if active_only:
                conditions.append(
                    FieldCondition(
                        key="is_active",
                        match=MatchValue(value=True)
                    )
                )
            if category:
                conditions.append(
                    FieldCondition(
                        key="category",
                        match=MatchValue(value=category.upper())
                    )
                )

            query_filter = Filter(must=conditions) if conditions else None

            # Scroll with vectors=True to get embeddings
            result, _ = self.client.scroll(
                collection_name=self.topics_collection,
                scroll_filter=query_filter,
                limit=500,  # Fetch more, sort and limit
                with_payload=True,
                with_vectors=True  # Include embedding vectors
            )

            topics = []
            for point in result:
                topic = point.payload
                topic["id"] = point.id

                # Include the embedding vector
                topic["embedding"] = point.vector if point.vector else []

                # Parse JSON fields
                for field in ["keywords", "synthesis_ids", "entity_ids"]:
                    field_str = topic.get(field, "[]")
                    if isinstance(field_str, str):
                        try:
                            topic[field] = json.loads(field_str)
                        except json.JSONDecodeError:
                            topic[field] = []

                # Calculate hot_score based on synthesis count and recency
                synthesis_count = len(topic.get("synthesis_ids", []))
                last_updated = topic.get("last_updated", 0)
                from datetime import datetime
                recency_score = max(0, 1 - (datetime.now().timestamp() - last_updated) / (7 * 24 * 3600))  # Decay over 7 days
                topic["hot_score"] = min(1.0, (synthesis_count * 0.3 + recency_score * 0.7))

                topics.append(topic)

            # Sort by synthesis count (more connected = more important)
            topics.sort(key=lambda x: len(x.get("synthesis_ids", [])), reverse=True)

            logger.info(f"📊 Cortex: Retrieved {len(topics[:limit])} topics with embeddings")
            return topics[:limit]

        except Exception as e:
            logger.error(f"Failed to get topics with embeddings: {e}")
            return []


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

