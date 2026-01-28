"""
NovaPress Pipeline Engine V5 ULTIMATE
100% Open Source - MULTI-SOURCE SCRAPING
Stack: BGE-M3, HDBSCAN, spaCy, Ollama
Sources: News, Reddit, Hacker News, Bluesky, ArXiv, Wikipedia
"""
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime
from loguru import logger

from app.services.advanced_scraper import get_advanced_scraper
from app.services.social_scraper import social_scraper
from app.services.rss_scraper import get_rss_scraper
from app.services.news_apis import get_news_apis
from app.services.deduplication import get_deduplication_engine
from app.ml.embeddings import get_embedding_service
from app.ml.clustering import get_clustering_engine
from app.ml.knowledge_graph import get_kg_extractor
from app.ml.llm import get_llm_service
from app.ml.advanced_rag import get_advanced_rag
from app.ml.temporal_narrative import get_temporal_narrative_engine
from app.ml.search_enrichment import get_search_enrichment_engine
from app.ml.category_classifier import classify_synthesis
from app.ml.persona import (
    get_rotating_persona_for_category,
    get_intelligent_persona,
    get_persona_author_display,
    PersonaType,
    load_dynamic_keywords,
)
from app.ml.causal_extraction import validate_causal_chain
from app.ml.persona_quality import evaluate_persona_synthesis, PersonaQualityReviewer
from app.ml.keyword_learner import get_keyword_learner
# Intelligence Hub services
from app.ml.entity_resolution import get_entity_resolution_service, init_entity_resolution
from app.ml.topic_detection import get_topic_detection_service, init_topic_detection
from app.ml.causal_aggregator import get_causal_aggregator
from app.db.qdrant_client import get_qdrant_service
from app.core.config import settings


class PipelineEngine:
    """
    NovaPress V5 Pipeline ULTIMATE - MULTI-SOURCE
    1. Scraping Avancé (59+ journaux mondiaux + Respect robots.txt)
    2. Social Media (Reddit, Bluesky, Hacker News via APIs)
    3. Academic (ArXiv papers, Wikipedia)
    4. Déduplication Intelligente (Embeddings BGE-M3)
    5. Clustering (HDBSCAN avec validation cohérence)
    6. Knowledge Graph (spaCy + NetworkX)
    7. Synthesis (LLM - toujours en FRANÇAIS)
    8. Storage (Qdrant + PostgreSQL)
    """

    def __init__(self):
        self.advanced_scraper = None
        self.social_scraper = social_scraper
        self.rss_scraper = None  # RSS scraper for official feeds
        self.news_apis = None  # GDELT and other news APIs
        self.dedup_engine = None
        self.embedding_service = None
        self.clustering_engine = get_clustering_engine()
        self.kg_extractor = None
        self.llm_service = None
        self.advanced_rag = get_advanced_rag()
        self.temporal_narrative = get_temporal_narrative_engine()
        self.search_enrichment = get_search_enrichment_engine()
        self.qdrant = None
        self.keyword_learner = None  # Dynamic keyword learning
        # Intelligence Hub services
        self.entity_resolver = None
        self.topic_detector = None
        self.causal_aggregator = None

    async def initialize(self):
        """Initialize all services"""
        self.advanced_scraper = await get_advanced_scraper()
        self.rss_scraper = get_rss_scraper()  # Initialize RSS scraper
        self.news_apis = get_news_apis()  # Initialize GDELT and other APIs
        self.dedup_engine = get_deduplication_engine()
        self.embedding_service = get_embedding_service()

        # Initialize dependencies
        self.dedup_engine.initialize()

        self.kg_extractor = get_kg_extractor()
        self.llm_service = get_llm_service()
        self.qdrant = get_qdrant_service()

        # Initialize TNA with services
        self.temporal_narrative.set_services(self.embedding_service, self.qdrant)

        # Initialize keyword learner for dynamic persona selection
        try:
            self.keyword_learner = await get_keyword_learner()
            # Load cached dynamic keywords for persona selection
            await load_dynamic_keywords()
            logger.info("✅ KeywordLearner initialized - dynamic keywords loaded")
        except Exception as e:
            logger.warning(f"⚠️ KeywordLearner init failed (non-critical): {e}")

        # Initialize Intelligence Hub services
        try:
            await init_entity_resolution()
            self.entity_resolver = get_entity_resolution_service()
            logger.info("✅ Entity Resolution Service initialized")
        except Exception as e:
            logger.warning(f"⚠️ Entity Resolution init failed (non-critical): {e}")

        try:
            await init_topic_detection()
            self.topic_detector = get_topic_detection_service()
            logger.info("✅ Topic Detection Service initialized")
        except Exception as e:
            logger.warning(f"⚠️ Topic Detection init failed (non-critical): {e}")

        try:
            self.causal_aggregator = get_causal_aggregator()
            logger.info("✅ Causal Aggregator initialized")
        except Exception as e:
            logger.warning(f"⚠️ Causal Aggregator init failed (non-critical): {e}")

    async def run_full_pipeline(
        self,
        sources: Optional[List[str]] = None,
        topics: Optional[List[str]] = None,
        mode: str = "SCRAPE",
        max_articles_per_source: int = 20
    ) -> Dict[str, Any]:
        """
        Run complete pipeline with advanced scraping

        Args:
            sources: List of source domains to scrape
                     None = scrape all configured sources
            topics: List of topics to search for (TOPIC mode)
            mode: Pipeline mode:
                  - "SCRAPE": Scrape multiple news sources
                  - "TOPIC": Search specific topics
                  - "SIMULATION": Testing mode
            max_articles_per_source: Max articles per source

        Returns:
            Pipeline results with articles, clusters, graphs, syntheses
        """
        logger.info(f"🚀 NovaPress Pipeline V4 ULTIMATE (Mode: {mode})")
        results = {
            "mode": mode,
            "started_at": datetime.now().isoformat(),
            "raw_articles": [],
            "unique_articles": [],
            "duplicate_report": {},
            "embeddings_shape": None,
            "clusters": [],
            "knowledge_graph": {},
            "syntheses": [],
            "stats": {}
        }

        # === 1. SCRAPING AVANCÉ ===
        logger.info("📡 Step 1: Advanced Web Scraping...")
        raw_articles = await self._collect_articles(sources, topics, mode, max_articles_per_source)
        results["raw_articles"] = len(raw_articles)

        # === 1.5 RAG: FETCH HISTORICAL DATA ===
        logger.info("🕰️ Step 1.5: Fetching recent articles for RAG...")
        recent_articles = self.qdrant.get_recent_articles(hours=24, limit=100)
        
        # Combine new and recent articles
        combined_articles = raw_articles + recent_articles
        logger.info(f"📚 Total articles for processing: {len(combined_articles)} ({len(raw_articles)} new + {len(recent_articles)} recent)")

        if len(combined_articles) == 0:
            logger.warning("❌ No articles (new or recent) to process. Aborting pipeline.")
            return results

        logger.success(f"✅ Processing {len(combined_articles)} articles")

        # === 2. EMBEDDINGS (pour déduplication) ===
        logger.info("🧮 Step 2: Computing embeddings for deduplication...")
        # Only compute embeddings for NEW articles if possible, but for simplicity and deduplication we might need all
        # Optimization: Check if recent articles already have embeddings? 
        # For now, we re-compute to ensure consistency or use cache if implemented. 
        # Actually, Qdrant has vectors. We should ideally retrieve them.
        # But to keep it simple and robust for now, we re-encode texts.
        # TODO: Optimize by retrieving vectors from Qdrant for recent articles.
        
        texts = [f"{a.get('raw_title', a.get('raw_title', a.get('title', '')))} {a.get('raw_text', a.get('raw_text', a.get('content', '')))[:500]}" for a in combined_articles]
        embeddings = self.embedding_service.encode(texts)
        logger.success(f"✅ Generated {len(embeddings)} embeddings (1024-dim)")

        # === 3. DÉDUPLICATION INTELLIGENTE ===
        logger.info("🔍 Step 3: Intelligent deduplication...")
        # We want to deduplicate the COMBINED list
        unique_articles, removed = self.dedup_engine.deduplicate_articles(combined_articles, embeddings)
        results["unique_articles"] = len(unique_articles)
        results["duplicates_removed"] = len(removed)

        if len(unique_articles) == 0:
            logger.warning("❌ No unique articles after deduplication. Aborting.")
            return results

        logger.success(f"✅ {len(unique_articles)} unique articles ({len(removed)} duplicates removed)")

        # Régénérer embeddings pour articles uniques (truncate to 500 chars for memory efficiency)
        unique_texts = [f"{a.get('raw_title', '')} {a.get('raw_text', '')[:500]}" for a in unique_articles]
        unique_embeddings = self.embedding_service.encode(unique_texts)
        results["embeddings_shape"] = unique_embeddings.shape

        # === 3.5 SMART PERSISTENCE: Fetch past syntheses for hybrid clustering ===
        logger.info("📚 Step 3.5: Fetching persistent stories for narrative continuity...")
        from app.db.qdrant_client import qdrant_service
        past_syntheses = qdrant_service.get_persistent_syntheses_with_vectors(
            max_days=90,           # Look back up to 90 days
            recent_days=3,         # Always include last 3 days
            min_persistence_score=3.0,  # Older stories need score >= 3
            limit=150              # Max syntheses to include
        )
        results["past_syntheses_used"] = len(past_syntheses)
        logger.info(f"📚 Found {len(past_syntheses)} syntheses (recent + persistent stories)")

        # === 4. HYBRID CLUSTERING ===
        logger.info("🔗 Step 4: Hybrid Clustering (articles + past syntheses)...")

        # Build unified list: [articles..., syntheses...]
        all_items = []
        for i, article in enumerate(unique_articles):
            all_items.append({
                "type": "article",
                "index": i,
                "data": article
            })

        synthesis_vectors = []
        for synth in past_syntheses:
            all_items.append({
                "type": "synthesis",
                "id": synth["id"],
                "data": synth["payload"]
            })
            synthesis_vectors.append(synth["vector"])

        # Combine embeddings: articles first, then syntheses
        import numpy as np
        if synthesis_vectors:
            synthesis_embeddings = np.array(synthesis_vectors)
            combined_embeddings = np.vstack([unique_embeddings, synthesis_embeddings])
            logger.info(f"🔗 Combined {len(unique_articles)} articles + {len(past_syntheses)} syntheses for clustering")
        else:
            combined_embeddings = unique_embeddings
            logger.info(f"🔗 Clustering {len(unique_articles)} articles (no past syntheses)")

        # Run HDBSCAN on combined data
        cluster_labels, cluster_stats = self.clustering_engine.cluster_articles(combined_embeddings)

        # Group items by cluster, tracking types
        from collections import defaultdict
        cluster_groups = defaultdict(lambda: {"articles": [], "syntheses": []})

        for idx, label in enumerate(cluster_labels):
            if label == -1:  # Noise
                continue
            item = all_items[idx]
            if item["type"] == "article":
                cluster_groups[label]["articles"].append(item["data"])
            else:
                cluster_groups[label]["syntheses"].append(item["data"])

        # Build clusters with type: "new" or "update"
        clusters = []
        updates_count = 0
        new_topics_count = 0

        for label, group in cluster_groups.items():
            if not group["articles"]:
                # Only syntheses, no new articles = skip (no new info)
                continue

            cluster_type = "update" if group["syntheses"] else "new"
            if cluster_type == "update":
                updates_count += 1
            else:
                new_topics_count += 1

            clusters.append({
                "cluster_id": label,
                "articles": group["articles"],
                "size": len(group["articles"]),
                "past_syntheses": group["syntheses"],
                "cluster_type": cluster_type
            })

        results["updates"] = updates_count
        results["new_topics"] = new_topics_count
        results["clusters"] = len(clusters)
        results["cluster_stats"] = cluster_stats
        logger.success(f"✅ Found {len(clusters)} clusters: {new_topics_count} new topics, {updates_count} story updates")

        # === 5. KNOWLEDGE GRAPH ===
        logger.info("🕸️ Step 5: Building Knowledge Graph...")
        knowledge_graph = self.kg_extractor.build_knowledge_graph(unique_articles)
        results["knowledge_graph"] = {
            "nodes": len(knowledge_graph['nodes']),
            "edges": len(knowledge_graph['edges'])
        }
        logger.success(f"✅ Graph: {len(knowledge_graph['nodes'])} entities, {len(knowledge_graph['edges'])} relations")

        # === 6. STORAGE ARTICLES (MOVED BEFORE SYNTHESIS) ===
        # Phase 6 Fix: Articles must be stored BEFORE synthesis generation
        # so that mark_articles_as_used() can find them in Qdrant
        logger.info("💾 Step 6: Storing articles in Qdrant...")
        await self._store_articles(unique_articles, unique_embeddings.tolist())
        logger.success("✅ Articles stored in vector database")

        # === 7. SYNTHESIS ===
        logger.info("✍️ Step 7: Generating syntheses with Ollama...")
        syntheses = await self._generate_syntheses(clusters[:10])  # Top 10 clusters
        results["syntheses"] = len(syntheses)
        logger.success(f"✅ Generated {len(syntheses)} AI syntheses")

        # === 7.5 STORE SYNTHESES (already saved incrementally in _generate_syntheses) ===
        # Note: Syntheses are now saved immediately after generation in _generate_syntheses
        # This step is kept for any remaining syntheses not saved yet
        if syntheses:
            logger.info("💾 Step 7.5: Verifying syntheses storage...")
            await self._store_syntheses(syntheses)
            logger.success(f"✅ {len(syntheses)} syntheses verified in vector database")

        # === STATS ===
        results["stats"] = {
            "total_scraped": len(raw_articles),
            "unique_articles": len(unique_articles),
            "deduplication_rate": len(removed) / len(raw_articles) if raw_articles else 0,
            "clusters_found": len(clusters),
            "syntheses_generated": len(syntheses),
            "sources_used": len(set(a.get("source_domain", "") for a in unique_articles)),
            "languages": list(set(a.get("language", "unknown") for a in unique_articles))
        }

        results["completed_at"] = datetime.now().isoformat()
        duration = (datetime.fromisoformat(results["completed_at"]) -
                   datetime.fromisoformat(results["started_at"])).total_seconds()

        logger.success(f"🎉 Pipeline completed in {duration:.1f}s!")
        logger.info(f"📊 Stats: {results['stats']}")

        return results

    async def _collect_articles(
        self,
        sources: Optional[List[str]],
        topics: Optional[List[str]],
        mode: str,
        max_articles_per_source: int,
        include_social: bool = True,
        include_academic: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Collect articles from ALL sources:
        - News websites (59+ sources)
        - Social media (Reddit, Bluesky, Hacker News)
        - Academic (ArXiv, Wikipedia)
        """
        all_articles = []

        if mode == "SCRAPE":
            # === 1. NEWS WEBSITES (Journaux mondiaux) ===
            logger.info("📰 Scraping world news sources...")
            async with self.advanced_scraper as scraper:
                news_articles = await scraper.scrape_multiple_sources(
                    sources=sources,
                    max_articles_per_source=max_articles_per_source
                )
                all_articles.extend(news_articles)
                logger.success(f"📰 News: {len(news_articles)} articles")

            # === 1.5. RSS FEEDS (100% legal - official syndication) ===
            if getattr(settings, 'ENABLE_RSS_SCRAPING', True):
                logger.info("📡 Scraping RSS feeds (official syndication)...")
                try:
                    async with self.rss_scraper as rss:
                        rss_articles = await rss.scrape_all_feeds()
                        all_articles.extend(rss_articles)
                        logger.success(f"📡 RSS Feeds: {len(rss_articles)} articles")
                except Exception as e:
                    logger.error(f"❌ RSS scraping failed: {e}")

            # === 1.6. GDELT API (100% free, global news monitoring) ===
            if getattr(settings, 'GDELT_ENABLED', True):
                logger.info("🌍 Fetching from GDELT API...")
                try:
                    async with self.news_apis as apis:
                        gdelt_articles = await apis.fetch_all(
                            languages=["fr", "en"],
                            limit=50
                        )
                        all_articles.extend(gdelt_articles)
                        logger.success(f"🌍 GDELT API: {len(gdelt_articles)} articles")
                except Exception as e:
                    logger.error(f"❌ GDELT API failed: {e}")

            # === 2. SOCIAL MEDIA & ALTERNATIVE SOURCES ===
            if include_social:
                logger.info("📱 Scraping social & alternative sources...")

                # Reddit (discussions, tendances)
                try:
                    reddit_articles = await self.social_scraper.scrape_reddit(
                        limit_per_sub=max_articles_per_source // 2
                    )
                    all_articles.extend(reddit_articles)
                    logger.success(f"🤖 Reddit: {len(reddit_articles)} posts")
                except Exception as e:
                    logger.error(f"❌ Reddit failed: {e}")

                # Hacker News (tech news)
                try:
                    hn_articles = await self.social_scraper.scrape_hackernews(
                        limit=max_articles_per_source
                    )
                    all_articles.extend(hn_articles)
                    logger.success(f"🔶 Hacker News: {len(hn_articles)} stories")
                except Exception as e:
                    logger.error(f"❌ Hacker News failed: {e}")

                # Bluesky (social media décentralisé)
                try:
                    bluesky_articles = await self.social_scraper.scrape_bluesky(
                        limit=max_articles_per_source // 2
                    )
                    all_articles.extend(bluesky_articles)
                    logger.success(f"🦋 Bluesky: {len(bluesky_articles)} posts")
                except Exception as e:
                    logger.error(f"❌ Bluesky failed: {e}")

            # === 3. ACADEMIC SOURCES ===
            if include_academic:
                logger.info("📚 Scraping academic sources...")

                # ArXiv (papers scientifiques)
                try:
                    arxiv_articles = await self.social_scraper.scrape_arxiv(
                        max_results=max_articles_per_source
                    )
                    all_articles.extend(arxiv_articles)
                    logger.success(f"📚 ArXiv: {len(arxiv_articles)} papers")
                except Exception as e:
                    logger.error(f"❌ ArXiv failed: {e}")

                # Wikipedia Current Events
                try:
                    wiki_articles = await self.social_scraper.scrape_wikipedia_news()
                    all_articles.extend(wiki_articles)
                    logger.success(f"📖 Wikipedia: {len(wiki_articles)} events")
                except Exception as e:
                    logger.error(f"❌ Wikipedia failed: {e}")

            logger.success(f"🎉 Total collected: {len(all_articles)} articles from all sources")
            return all_articles

        elif mode == "TOPIC" and topics:
            # Rechercher par topic
            logger.info(f"🔍 Searching for topics: {topics}")
            async with self.advanced_scraper as scraper:
                for topic in topics:
                    articles = await scraper.scrape_by_topic(topic, sources, max_results=50)
                    all_articles.extend(articles)
            return all_articles

        elif mode == "SIMULATION":
            # Mode test avec données simulées
            logger.info("🧪 Generating simulated articles...")
            from app.services.scraper import get_scraper_service
            scraper = get_scraper_service()
            for topic in topics or ["IA", "Économie", "Géopolitique"]:
                articles = await scraper.generate_simulated_articles(topic, count=10)
                all_articles.extend(articles)
            return all_articles

        return []

    async def _generate_syntheses(
        self,
        clusters: List[Dict[str, Any]],
        use_advanced_rag: bool = True,
        use_temporal_narrative: bool = True,
        use_search_enrichment: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Generate AI syntheses for top clusters with:
        - Advanced RAG (chunking, contradictions, fact density)
        - Temporal Narrative Arc (historical context, story evolution)
        - Search Enrichment (Perplexity + Grok for web/social context)
        """
        syntheses = []
        import numpy as np

        for cluster in clusters:
            if cluster["size"] < 2:
                continue

            try:
                articles = cluster["articles"]
                logger.info(f"✍️ Generating synthesis for cluster {cluster['cluster_id']} ({cluster['size']} articles)")

                # === 0. DEDUPLICATION CHECK & UPDATE MODE ===
                # Check if a similar synthesis exists - if so, UPDATE it instead of creating new
                existing_synthesis = None
                is_update_mode = False
                new_articles_for_update = []

                if getattr(settings, 'ENABLE_SYNTHESIS_DEDUP', True):
                    article_urls = [a.get("url", "") for a in articles if a.get("url")]
                    if article_urls:
                        existing_synthesis = self.qdrant.find_duplicate_synthesis(
                            article_urls=article_urls,
                            hours_lookback=getattr(settings, 'DEDUP_HOURS_LOOKBACK', 24),
                            overlap_threshold=getattr(settings, 'DEDUP_URL_OVERLAP_THRESHOLD', 0.7)
                        )
                        if existing_synthesis:
                            # Extract URLs from existing synthesis
                            existing_urls = set()
                            source_articles = existing_synthesis.get("source_articles", [])
                            if isinstance(source_articles, list):
                                for sa in source_articles:
                                    if isinstance(sa, dict) and sa.get("url"):
                                        existing_urls.add(sa["url"].lower().rstrip('/'))

                            # Find NEW articles not in existing synthesis
                            new_article_urls = set(url.lower().rstrip('/') for url in article_urls) - existing_urls
                            new_articles_for_update = [
                                a for a in articles
                                if a.get("url", "").lower().rstrip('/') in new_article_urls
                            ]

                            if new_articles_for_update:
                                # UPDATE MODE: We have new articles to add
                                if getattr(settings, 'ENABLE_SYNTHESIS_UPDATE', True):
                                    is_update_mode = True
                                    logger.info(f"🔄 UPDATE MODE for cluster {cluster['cluster_id']}: "
                                              f"{len(new_articles_for_update)} new articles to add to synthesis "
                                              f"'{existing_synthesis.get('title', '')[:40]}...' (ID: {existing_synthesis.get('id')})")
                                else:
                                    # Update disabled, skip duplicate
                                    logger.info(f"⏭️ Skipping cluster {cluster['cluster_id']}: has new articles but ENABLE_SYNTHESIS_UPDATE=False")
                                    continue
                            else:
                                # SKIP: No new articles, truly duplicate
                                logger.info(f"⏭️ Skipping cluster {cluster['cluster_id']}: duplicate of existing synthesis "
                                          f"'{existing_synthesis.get('title', '')[:50]}...' (ID: {existing_synthesis.get('id')})")
                                continue

                # === 1. COMPUTE EMBEDDINGS ===
                cluster_texts = [
                    f"{a.get('raw_title', '')} {a.get('raw_text', '')[:500]}"
                    for a in articles
                ]
                cluster_embeddings = self.embedding_service.encode(cluster_texts)

                # === 1.5 EMBEDDING-BASED DEDUPLICATION (secondary check) ===
                # Only check if not already in update mode from URL check
                if getattr(settings, 'ENABLE_SYNTHESIS_DEDUP', True) and not is_update_mode:
                    cluster_mean_embedding = np.mean(cluster_embeddings, axis=0)
                    similar_synthesis = self.qdrant.find_similar_synthesis_by_embedding(
                        embedding=cluster_mean_embedding.tolist(),
                        hours_lookback=getattr(settings, 'DEDUP_HOURS_LOOKBACK', 24),
                        similarity_threshold=getattr(settings, 'DEDUP_EMBEDDING_THRESHOLD', 0.92)
                    )
                    if similar_synthesis and similar_synthesis.get('id') != (existing_synthesis or {}).get('id'):
                        # Similar synthesis found - check for new articles
                        existing_urls = set()
                        source_articles = similar_synthesis.get("source_articles", [])
                        if isinstance(source_articles, list):
                            for sa in source_articles:
                                if isinstance(sa, dict) and sa.get("url"):
                                    existing_urls.add(sa["url"].lower().rstrip('/'))

                        article_urls = [a.get("url", "") for a in articles if a.get("url")]
                        new_article_urls = set(url.lower().rstrip('/') for url in article_urls) - existing_urls
                        new_articles_for_update = [
                            a for a in articles
                            if a.get("url", "").lower().rstrip('/') in new_article_urls
                        ]

                        if new_articles_for_update:
                            # UPDATE MODE: We have new articles to add
                            if getattr(settings, 'ENABLE_SYNTHESIS_UPDATE', True):
                                is_update_mode = True
                                existing_synthesis = similar_synthesis
                                logger.info(f"🔄 UPDATE MODE (embedding) for cluster {cluster['cluster_id']}: "
                                          f"{len(new_articles_for_update)} new articles to add")
                            else:
                                # Update disabled, skip duplicate
                                logger.info(f"⏭️ Skipping cluster {cluster['cluster_id']}: has new articles but ENABLE_SYNTHESIS_UPDATE=False")
                                continue
                        else:
                            # SKIP: No new articles, truly duplicate
                            logger.info(f"⏭️ Skipping cluster {cluster['cluster_id']}: similar to existing synthesis "
                                      f"'{similar_synthesis.get('title', '')[:50]}...' (by embedding)")
                            continue

                # === 2. ADVANCED RAG CONTEXT ===
                enhanced_context = {}
                if use_advanced_rag:
                    enhanced_context = self.advanced_rag.prepare_synthesis_context(
                        articles,
                        cluster_embeddings,
                        max_chunks=10
                    )

                    # Log detected contradictions
                    contradictions = enhanced_context.get('contradictions', [])
                    if contradictions:
                        logger.warning(f"⚠️ {len(contradictions)} contradiction(s) detected in cluster {cluster['cluster_id']}")
                        for c in contradictions:
                            logger.info(f"   - {c['type']}: {c['source1']} vs {c['source2']}")

                # === 3. TEMPORAL NARRATIVE ARC (TNA) + HYBRID CLUSTERING CONTEXT ===
                historical_context = None
                historical_context_text = ""
                narrative_arc = "emerging"
                cluster_type = cluster.get("cluster_type", "new")

                # Check if we have past_syntheses from hybrid clustering (priority)
                past_syntheses = cluster.get("past_syntheses", [])
                if past_syntheses:
                    # Use past syntheses from clustering directly
                    narrative_arc = "developing" if cluster_type == "update" else "emerging"
                    logger.info(f"🔄 Update cluster: {len(past_syntheses)} past synthesis(es) from clustering")

                    # Format past syntheses as context
                    past_context_parts = []
                    for ps in past_syntheses[:3]:  # Limit to 3 most relevant
                        ps_title = ps.get("title", "Sans titre")
                        ps_summary = ps.get("summary", "")[:500]
                        ps_date = ps.get("created_at", "")
                        past_context_parts.append(
                            f"[SYNTHÈSE PRÉCÉDENTE - {ps_date}]\n"
                            f"Titre: {ps_title}\n"
                            f"Résumé: {ps_summary}\n"
                        )

                    historical_context_text = "\n---\n".join(past_context_parts)
                    historical_context_text = f"=== CONTEXTE HISTORIQUE (MISE À JOUR) ===\n\n{historical_context_text}\n\n"
                    historical_context_text += "⚠️ IMPORTANT: Cette synthèse est une MISE À JOUR. Fais référence aux développements précédents et souligne les nouvelles informations.\n"

                elif use_temporal_narrative:
                    # Fallback to TNA search (for new clusters)
                    current_entities = enhanced_context.get('key_entities', [])

                    # Build historical context
                    historical_context = self.temporal_narrative.build_historical_context(
                        articles,
                        current_entities
                    )

                    narrative_arc = historical_context.narrative_arc
                    days_tracked = historical_context.days_tracked

                    if historical_context.related_syntheses:
                        logger.info(f"📜 Found {len(historical_context.related_syntheses)} related syntheses "
                                   f"(story: {narrative_arc}, {days_tracked} days tracked)")
                        historical_context_text = self.temporal_narrative.format_context_for_llm(
                            historical_context
                        )
                    else:
                        logger.info(f"🆕 New story thread (no historical context)")

                # === 3.5 SEARCH ENRICHMENT (Perplexity + Grok) - MANDATORY ===
                search_context_text = ""
                search_enriched_data = None
                enrichment_status = "pending"

                # Build topic from cluster for search
                representative_title = articles[0].get('raw_title', '') if articles else ''
                current_entities = enhanced_context.get('key_entities', [])[:3]
                search_topic = representative_title or " ".join(current_entities)

                if search_topic and use_search_enrichment:
                    # Get claims for fact-checking (from contradictions)
                    claims_to_verify = []
                    for c in enhanced_context.get('contradictions', [])[:settings.MAX_FACT_CHECK_CLAIMS]:
                        claims_to_verify.append(c.get('claim1', ''))

                    try:
                        search_enriched_data = await self.search_enrichment.enrich_cluster(
                            cluster_topic=search_topic[:200],  # Limit topic length
                            key_entities=current_entities,
                            claims_to_verify=claims_to_verify
                        )

                        if search_enriched_data:
                            if search_enriched_data.perplexity_context or search_enriched_data.grok_context:
                                search_context_text = self.search_enrichment.format_for_llm_prompt(search_enriched_data)
                                enrichment_status = "complete"
                                logger.success(f"🌐 Enrichment COMPLETE: Perplexity={bool(search_enriched_data.perplexity_context)}, "
                                           f"Grok={bool(search_enriched_data.grok_context)}, "
                                           f"Sentiment={search_enriched_data.social_sentiment or 'N/A'}, "
                                           f"Facts={len(search_enriched_data.fact_check_notes)}")
                            else:
                                enrichment_status = "partial_no_results"
                                logger.warning(f"🌐 Enrichment returned no data for cluster {cluster['cluster_id']}")
                        else:
                            enrichment_status = "failed_null_response"
                            logger.warning(f"🌐 Enrichment returned null for cluster {cluster['cluster_id']}")

                    except Exception as e:
                        enrichment_status = f"failed_{type(e).__name__}"
                        logger.error(f"🌐 Enrichment FAILED (continuing anyway): {e}")
                elif not search_topic:
                    enrichment_status = "skipped_no_topic"
                    logger.warning(f"🌐 No search topic for cluster {cluster['cluster_id']}")
                else:
                    enrichment_status = "disabled"
                    logger.debug(f"🌐 Enrichment disabled for cluster {cluster['cluster_id']}")

                # === 4. GENERATE SYNTHESIS ===
                # Combine all context sources
                full_context_text = ""
                if historical_context_text:
                    full_context_text += historical_context_text
                if search_context_text:
                    full_context_text += "\n" + search_context_text

                # === UPDATE MODE: Add existing synthesis as context ===
                existing_synthesis_context = ""
                original_created_at = None
                original_created_at_display = None
                if is_update_mode and existing_synthesis:
                    # Get original creation date
                    original_created_at = existing_synthesis.get("created_at") or existing_synthesis.get("first_seen")
                    if isinstance(original_created_at, (int, float)):
                        original_created_at_display = datetime.fromtimestamp(original_created_at).strftime("%d/%m/%Y à %H:%M")
                    elif original_created_at:
                        try:
                            parsed = datetime.fromisoformat(str(original_created_at).replace('Z', '+00:00'))
                            original_created_at_display = parsed.strftime("%d/%m/%Y à %H:%M")
                        except:
                            original_created_at_display = str(original_created_at)

                    # Build context from existing synthesis
                    existing_title = existing_synthesis.get("title", "")
                    existing_summary = existing_synthesis.get("summary", "")
                    existing_body = existing_synthesis.get("body", "")[:2000]

                    existing_synthesis_context = f"""
═══════════════════════════════════════
📝 SYNTHÈSE EXISTANTE À METTRE À JOUR
═══════════════════════════════════════
Titre original: {existing_title}
Date de création originale: {original_created_at_display or 'Inconnue'}

Résumé existant:
{existing_summary}

Contenu existant (extrait):
{existing_body}

⚠️ INSTRUCTIONS DE MISE À JOUR:
- RÉÉCRIS cette synthèse en INTÉGRANT les nouvelles informations
- Garde la structure et le ton de l'original
- Ajoute les nouveaux faits et sources
- Le titre peut être modifié si les nouveaux éléments le justifient
- MENTIONNE dans l'introduction: "Mise à jour le {datetime.now().strftime('%d/%m/%Y à %H:%M')} (synthèse originale du {original_created_at_display})"
"""
                    full_context_text = existing_synthesis_context + "\n" + full_context_text
                    logger.info(f"📝 UPDATE: Passing existing synthesis as context (created: {original_created_at_display})")

                if use_temporal_narrative and full_context_text:
                    # ULTIMATE synthesis: Advanced RAG + TNA + Search
                    logger.info(f"🚀 Using ULTIMATE synthesis (RAG + TNA + Search) for cluster {cluster['cluster_id']}")
                    # Phase 6: Pass search_context_text separately to be properly injected in prompt
                    synthesis = await self.llm_service.synthesize_with_history(
                        articles,
                        enhanced_context,
                        historical_context_text,  # Only historical, not combined
                        narrative_arc,
                        search_context_text=search_context_text  # Phase 6 fix: Pass enrichment separately
                    )
                elif use_advanced_rag:
                    # Advanced RAG only (+ search if available)
                    if search_context_text:
                        enhanced_context['search_context'] = search_context_text
                    synthesis = await self.llm_service.synthesize_articles_advanced(
                        articles,
                        enhanced_context
                    )
                else:
                    # Standard synthesis (fallback)
                    synthesis = await self.llm_service.synthesize_articles(articles)

                synthesis["cluster_id"] = cluster["cluster_id"]

                # Extract unique sources with URLs (filter empty source names)
                source_articles = []
                seen_sources = set()

                # In UPDATE MODE: Merge existing synthesis sources first
                if is_update_mode and existing_synthesis:
                    for sa in existing_synthesis.get("source_articles", []):
                        if isinstance(sa, dict):
                            source_name = sa.get("name", "")
                            if source_name and source_name not in seen_sources:
                                seen_sources.add(source_name)
                                source_articles.append(sa)

                # Merge sources from PAST SYNTHESES (hybrid clustering context)
                # These are syntheses that provided historical context to the LLM
                past_syntheses = cluster.get("past_syntheses", [])
                for ps in past_syntheses:
                    ps_sources = ps.get("source_articles", [])
                    if not ps_sources:
                        # Fallback to sources list if source_articles not available
                        ps_sources = [{"name": s, "url": "", "title": ""} for s in ps.get("sources", [])]
                    for sa in ps_sources:
                        if isinstance(sa, dict):
                            source_name = sa.get("name", "")
                            if source_name and source_name not in seen_sources:
                                seen_sources.add(source_name)
                                # Mark as from historical synthesis
                                sa_copy = dict(sa)
                                sa_copy["from_historical"] = True
                                sa_copy["historical_synthesis_id"] = ps.get("id", "")
                                source_articles.append(sa_copy)

                # Add sources from current articles
                for a in articles:
                    source_name = a.get("source_name", "") or a.get("source_domain", "")
                    source_url = a.get("url", "")
                    article_title = a.get("raw_title", a.get("title", ""))

                    if source_name and source_name not in seen_sources:
                        seen_sources.add(source_name)
                        source_articles.append({
                            "name": source_name,
                            "url": source_url,
                            "title": article_title
                        })

                synthesis["num_sources"] = len(source_articles)
                synthesis["sources"] = [s["name"] for s in source_articles]
                synthesis["source_articles"] = source_articles

                # UPDATE MODE: Track this as an update with dates
                if is_update_mode and existing_synthesis:
                    synthesis["is_update"] = True
                    synthesis["updated_from_synthesis_id"] = existing_synthesis.get("id", "")
                    synthesis["new_articles_count"] = len(new_articles_for_update)
                    # Phase 6: Add update notice with dates
                    synthesis["original_created_at"] = original_created_at  # Original timestamp
                    synthesis["original_created_at_display"] = original_created_at_display  # Formatted date
                    synthesis["last_updated_at"] = datetime.now().isoformat()
                    synthesis["last_updated_at_display"] = datetime.now().strftime("%d/%m/%Y à %H:%M")
                    synthesis["update_notice"] = f"Mise à jour le {datetime.now().strftime('%d/%m/%Y à %H:%M')} (synthèse originale du {original_created_at_display})"
                    logger.info(f"📝 UPDATE NOTICE: {synthesis['update_notice']}")

                # Add metadata
                if use_advanced_rag:
                    synthesis["advanced_rag"] = True
                    synthesis["contradictions_count"] = len(enhanced_context.get('contradictions', []))
                    synthesis["key_entities"] = enhanced_context.get('key_entities', [])[:5]

                if use_temporal_narrative and historical_context:
                    synthesis["temporal_narrative"] = True
                    synthesis["narrative_arc"] = narrative_arc
                    synthesis["days_tracked"] = historical_context.days_tracked
                    synthesis["related_synthesis_count"] = len(historical_context.related_syntheses)

                # Add search enrichment metadata (COMPREHENSIVE)
                synthesis["enrichment_status"] = enrichment_status
                synthesis["search_enriched"] = enrichment_status == "complete"

                if search_enriched_data:
                    synthesis["has_perplexity"] = bool(search_enriched_data.perplexity_context)
                    synthesis["has_grok"] = bool(search_enriched_data.grok_context)
                    synthesis["social_sentiment"] = search_enriched_data.social_sentiment or ""
                    # Store full context for display in frontend
                    synthesis["perplexity_context"] = (search_enriched_data.perplexity_context or "")[:2000]
                    synthesis["grok_context"] = (search_enriched_data.grok_context or "")[:2000]
                    # Store fact-check notes
                    synthesis["fact_check_notes"] = search_enriched_data.fact_check_notes[:5] if search_enriched_data.fact_check_notes else []
                    # Store trending reactions
                    synthesis["trending_reactions"] = search_enriched_data.trending_reactions[:5] if search_enriched_data.trending_reactions else []
                    # Store web sources with full metadata
                    synthesis["web_sources"] = [s.get('url', '') for s in search_enriched_data.perplexity_sources[:5]] if search_enriched_data.perplexity_sources else []
                    synthesis["web_sources_full"] = search_enriched_data.perplexity_sources[:10] if search_enriched_data.perplexity_sources else []
                    synthesis["enrichment_timestamp"] = search_enriched_data.enrichment_timestamp or ""
                else:
                    # Default empty values for non-enriched syntheses
                    synthesis["has_perplexity"] = False
                    synthesis["has_grok"] = False
                    synthesis["social_sentiment"] = ""
                    synthesis["perplexity_context"] = ""
                    synthesis["grok_context"] = ""
                    synthesis["fact_check_notes"] = []
                    synthesis["trending_reactions"] = []
                    synthesis["web_sources"] = []
                    synthesis["web_sources_full"] = []
                    synthesis["enrichment_timestamp"] = ""

                # === CATEGORY CLASSIFICATION ===
                key_entities = synthesis.get("key_entities", [])
                category, category_confidence = classify_synthesis(
                    synthesis.get("title", ""),
                    synthesis.get("summary", ""),
                    key_entities
                )
                synthesis["category"] = category
                synthesis["category_confidence"] = category_confidence
                logger.info(f"   Category: {category} (confidence: {category_confidence:.2f})")

                # === CAUSAL CHAIN VALIDATION & FALLBACK ===
                raw_causal_chain = synthesis.get("causal_chain", [])
                validated_causal_chain = validate_causal_chain(raw_causal_chain)

                # Diagnostic logging
                if raw_causal_chain:
                    logger.debug(f"   Raw causal_chain from LLM: {len(raw_causal_chain)} relations")
                    for i, rel in enumerate(raw_causal_chain[:3]):  # Log first 3
                        logger.debug(f"     [{i}] {rel.get('cause', 'N/A')[:50]}... → {rel.get('effect', 'N/A')[:50]}...")
                else:
                    logger.warning(f"⚠️ LLM did not generate causal_chain for cluster {cluster['cluster_id']}")

                # If validation removed relations, try fallback via causal extractor
                if len(validated_causal_chain) < 3:
                    logger.info(f"   Attempting causal extraction fallback (only {len(validated_causal_chain)} valid relations)...")
                    from app.ml.causal_extraction import causal_extractor

                    # Build LLM output dict for extraction
                    llm_output = {"causal_chain": validated_causal_chain}

                    # Extract with all available context
                    causal_graph = causal_extractor.extract_from_synthesis(
                        synthesis_text=synthesis.get("body", "") or synthesis.get("summary", ""),
                        entities=synthesis.get("key_entities", []),
                        fact_density=0.6,  # Default fact density
                        llm_causal_output=llm_output,
                        key_points=synthesis.get("keyPoints", []),
                        title=synthesis.get("title", ""),
                        analysis=synthesis.get("analysis", ""),
                        body=synthesis.get("body", "")
                    )

                    # Convert CausalRelation objects back to dict format
                    if causal_graph.edges:
                        validated_causal_chain = [
                            {
                                "cause": edge.cause_text,
                                "effect": edge.effect_text,
                                "type": edge.relation_type,
                                "sources": edge.source_articles
                            }
                            for edge in causal_graph.edges
                        ]
                        logger.info(f"   Fallback generated {len(validated_causal_chain)} causal relations")

                synthesis["causal_chain"] = validated_causal_chain  # Replace with validated/fallback version

                if not validated_causal_chain:
                    logger.warning(f"⚠️ Cluster {cluster['cluster_id']}: No causal relations even after fallback")
                else:
                    logger.info(f"✅ Cluster {cluster['cluster_id']}: {len(validated_causal_chain)} causal relations (final)")

                # === GENERATE BASE SYNTHESIS ID ===
                import uuid
                from datetime import datetime

                # In UPDATE MODE: Reuse existing synthesis ID (this will UPDATE in Qdrant via upsert)
                if is_update_mode and existing_synthesis:
                    base_synthesis_id = existing_synthesis.get("id", str(uuid.uuid4()))
                    logger.info(f"🔄 UPDATE: Reusing existing synthesis ID {base_synthesis_id[:8]}...")
                else:
                    base_synthesis_id = str(uuid.uuid4())

                synthesis["id"] = base_synthesis_id
                synthesis["base_synthesis_id"] = None  # This IS the base
                synthesis["persona_id"] = "neutral"
                synthesis["persona_name"] = "NovaPress"
                synthesis["persona_signature"] = ""
                synthesis["is_persona_version"] = False

                # === STORY PERSISTENCE TRACKING ===
                # Priority: is_update_mode from dedup > past_syntheses from clustering

                if is_update_mode and existing_synthesis:
                    # UPDATE MODE: Inherit from existing synthesis we're updating
                    parent_update_count = existing_synthesis.get("update_count", 0)
                    parent_first_seen = existing_synthesis.get("first_seen", datetime.now().timestamp())
                    parent_story_id = existing_synthesis.get("story_id", "")

                    synthesis["update_count"] = parent_update_count + 1
                    synthesis["first_seen"] = parent_first_seen  # Inherit original timestamp
                    synthesis["parent_synthesis_id"] = existing_synthesis.get("id", "")
                    synthesis["story_id"] = parent_story_id or str(uuid.uuid4())[:8]
                    synthesis["last_updated"] = datetime.now().isoformat()

                    logger.info(f"🔄 UPDATE #{synthesis['update_count']} with {len(new_articles_for_update)} new articles (story {synthesis['story_id']})")

                elif past_syntheses and len(past_syntheses) > 0:
                    # Hybrid clustering update: Inherit from parent synthesis
                    parent = past_syntheses[0]
                    parent_update_count = parent.get("update_count", 0)
                    parent_first_seen = parent.get("first_seen", datetime.now().timestamp())
                    parent_story_id = parent.get("story_id", "")
                    parent_id = parent.get("id", "")

                    synthesis["update_count"] = parent_update_count + 1
                    synthesis["first_seen"] = parent_first_seen
                    synthesis["parent_synthesis_id"] = parent_id
                    synthesis["story_id"] = parent_story_id or str(uuid.uuid4())[:8]

                    logger.info(f"📈 Story update #{synthesis['update_count']} (story {synthesis['story_id'][:8]}...)")
                else:
                    # New story
                    synthesis["update_count"] = 0
                    synthesis["first_seen"] = datetime.now().timestamp()
                    synthesis["parent_synthesis_id"] = ""
                    synthesis["story_id"] = str(uuid.uuid4())[:8]

                    logger.info(f"🆕 New story created: {synthesis['story_id']}")

                # Add the neutral/base synthesis
                syntheses.append(synthesis)
                logger.info(f"📝 Base synthesis generated: {base_synthesis_id[:8]}...")

                # === INCREMENTAL SAVE: Store synthesis immediately to prevent data loss ===
                try:
                    await self._store_syntheses([synthesis])
                    logger.success(f"💾 Synthesis saved immediately: {base_synthesis_id[:8]}...")

                    # === PHASE 6: MARK ARTICLES AS USED ===
                    # After successful save, mark all articles used in this synthesis
                    # This prevents them from being reused in other syntheses
                    article_urls = [a.get("url", "") for a in articles if a.get("url")]
                    if article_urls:
                        marked_count = self.qdrant.mark_articles_as_used(
                            article_urls=article_urls,
                            synthesis_id=base_synthesis_id
                        )
                        logger.info(f"📌 Phase 6: Marked {marked_count} articles as used by synthesis {base_synthesis_id[:8]}...")

                except Exception as save_error:
                    logger.warning(f"⚠️ Failed to save synthesis immediately: {save_error}")

                # === INTELLIGENCE HUB: Entity Resolution + Topic Assignment ===
                await self._process_intelligence_hub(synthesis, articles, cluster_embeddings)

                # === KEYWORD LEARNING: Extract entities for dynamic persona selection ===
                if self.keyword_learner:
                    try:
                        extracted_keywords = await self.keyword_learner.process_synthesis(
                            synthesis,
                            trigger_llm=True  # Trigger LLM when threshold reached
                        )
                        if extracted_keywords:
                            logger.debug(f"🎓 Extracted {len(extracted_keywords)} keywords for learning")
                    except Exception as kl_error:
                        logger.debug(f"Keyword learning skipped: {kl_error}")

                # === PERSONA APPLICATION ===
                # Two modes:
                # 1. SINGLE_PERSONA_MODE (recommended): Use category rotation to pick ONE persona
                # 2. Legacy mode: Pre-generate ALL persona versions (expensive)

                SINGLE_PERSONA_MODE = getattr(settings, 'SINGLE_PERSONA_MODE', True)
                # REF-004: Use effective_pregeneration_enabled to prevent flag conflicts
                # FIX-001: Changed to method call for Pydantic v2 compatibility
                ENABLE_PERSONA_PREGENERATION = settings.get_effective_pregeneration_enabled()

                if SINGLE_PERSONA_MODE:
                    # === SINGLE PERSONA MODE ===
                    # Use intelligent selection: 70% category/sentiment-based + 30% random for variety

                    category = synthesis.get("category", "MONDE")
                    title = synthesis.get("title", "")
                    sentiment = synthesis.get("sentiment", "neutral")
                    topic_intensity = synthesis.get("topic_intensity", "standard")

                    # Extract tags and entities for keyword-based selection
                    tags = synthesis.get("tags", [])
                    key_entities = synthesis.get("key_entities", [])
                    # Extract entity names if they are dicts
                    entity_names = [
                        e.get("name", e) if isinstance(e, dict) else str(e)
                        for e in key_entities
                    ] if key_entities else []

                    # Intelligent selection with keywords, tags, and randomness
                    selected_persona = get_intelligent_persona(
                        category=category,
                        title=title,
                        sentiment=sentiment,
                        topic_intensity=topic_intensity,
                        randomness=0.3,  # 30% chance of random persona for variety
                        tags=tags,
                        entities=entity_names,
                    )

                    if selected_persona.id != "neutral":
                        logger.info(f"🎭 INTELLIGENT PERSONA: Selected '{selected_persona.name}' for category '{category}' (sentiment: {sentiment}, intensity: {topic_intensity})")

                        try:
                            persona_synthesis = await self.llm_service.synthesize_with_persona(
                                base_synthesis=synthesis,
                                articles=articles,
                                persona_id=selected_persona.id
                            )

                            # === QUALITY EVALUATION ===
                            quality_result = evaluate_persona_synthesis(persona_synthesis, selected_persona.id)
                            quality_score = quality_result.get("overall_score", 0.0)
                            quality_tier = quality_result.get("quality_tier", "unknown")

                            logger.info(f"📊 Quality check for '{selected_persona.id}': score={quality_score:.2f} ({quality_tier})")

                            if not quality_result.get("should_fallback", False):
                                # Apply persona content to the base synthesis (in-place update)
                                synthesis["title"] = persona_synthesis.get("title", synthesis["title"])
                                synthesis["introduction"] = persona_synthesis.get("introduction", synthesis.get("introduction", ""))
                                synthesis["body"] = persona_synthesis.get("body", synthesis.get("body", ""))
                                synthesis["summary"] = persona_synthesis.get("body", synthesis.get("summary", ""))
                                synthesis["keyPoints"] = persona_synthesis.get("keyPoints", synthesis.get("keyPoints", []))
                                synthesis["analysis"] = persona_synthesis.get("analysis", synthesis.get("analysis", ""))
                                synthesis["signature"] = persona_synthesis.get("signature", "")

                                # Update persona metadata
                                synthesis["persona_id"] = selected_persona.id
                                synthesis["persona_name"] = selected_persona.name
                                synthesis["persona_signature"] = persona_synthesis.get("signature", "")
                                synthesis["quality_score"] = quality_score
                                synthesis["quality_tier"] = quality_tier

                                # Add author display info for frontend (par X › Y)
                                author_display = get_persona_author_display(selected_persona)
                                synthesis["author_display"] = author_display

                                # Re-save the updated synthesis
                                try:
                                    await self._store_syntheses([synthesis])
                                    logger.success(f"💾 Synthesis updated with persona '{selected_persona.name}': {base_synthesis_id[:8]}...")
                                except Exception as save_error:
                                    logger.warning(f"⚠️ Failed to update synthesis with persona: {save_error}")

                                logger.success(f"🎉 Cluster {cluster['cluster_id']}: Single synthesis with '{selected_persona.name}' persona")
                            else:
                                logger.warning(f"⚠️ Persona '{selected_persona.id}' quality too low, keeping neutral version")
                                logger.success(f"🎉 Cluster {cluster['cluster_id']}: Neutral synthesis (persona quality too low)")

                        except Exception as persona_error:
                            logger.warning(f"⚠️ Persona application failed: {persona_error}, keeping neutral version")
                            logger.success(f"🎉 Cluster {cluster['cluster_id']}: Neutral synthesis (persona error)")
                    else:
                        logger.info(f"🎭 Category '{category}' uses neutral persona this period")
                        logger.success(f"🎉 Cluster {cluster['cluster_id']}: Neutral synthesis")

                elif ENABLE_PERSONA_PREGENERATION:
                    # === LEGACY MODE: Pre-generate ALL persona versions ===
                    # REF-004: Use method that handles flag conflicts
                    # FIX-001: Changed to method call for Pydantic v2 compatibility
                    PERSONAS_TO_PREGENERATE = settings.get_personas_to_pregenerate()

                    logger.info(f"🎭 LEGACY MODE: Pre-generating {len(PERSONAS_TO_PREGENERATE)} persona versions for cluster {cluster['cluster_id']}")
                    persona_versions_generated = 0

                    for persona_id in PERSONAS_TO_PREGENERATE:
                        try:
                            logger.info(f"🎭 [{persona_versions_generated + 1}/{len(PERSONAS_TO_PREGENERATE)}] Generating '{persona_id}'...")

                            persona_synthesis = await self.llm_service.synthesize_with_persona(
                                base_synthesis=synthesis,
                                articles=articles,
                                persona_id=persona_id
                            )

                            # === QUALITY EVALUATION ===
                            quality_result = evaluate_persona_synthesis(persona_synthesis, persona_id)
                            quality_score = quality_result.get("overall_score", 0.0)
                            quality_tier = quality_result.get("quality_tier", "unknown")

                            logger.info(f"📊 Quality check for '{persona_id}': score={quality_score:.2f} ({quality_tier})")

                            if quality_result.get("should_fallback", False):
                                logger.warning(f"⚠️ Persona '{persona_id}' quality too low ({quality_score:.2f}), skipping.")
                                continue

                            # Create a new synthesis object for this persona version
                            persona_version = synthesis.copy()
                            persona_version_id = str(uuid.uuid4())
                            persona_version["id"] = persona_version_id
                            persona_version["base_synthesis_id"] = base_synthesis_id
                            persona_version["title"] = persona_synthesis.get("title", synthesis["title"])
                            persona_version["introduction"] = persona_synthesis.get("introduction", synthesis.get("introduction", ""))
                            persona_version["body"] = persona_synthesis.get("body", "")
                            persona_version["summary"] = persona_synthesis.get("body", synthesis.get("summary", ""))
                            persona_version["keyPoints"] = persona_synthesis.get("keyPoints", synthesis.get("keyPoints", []))
                            persona_version["analysis"] = persona_synthesis.get("analysis", synthesis.get("analysis", ""))
                            persona_version["signature"] = persona_synthesis.get("signature", "")
                            persona_version["persona_id"] = persona_id
                            persona_version["persona_name"] = persona_synthesis.get("persona", {}).get("name", persona_id)
                            persona_version["persona_signature"] = persona_synthesis.get("signature", "")
                            persona_version["is_persona_version"] = True
                            persona_version["quality_score"] = quality_score
                            persona_version["quality_tier"] = quality_tier

                            try:
                                await self._store_syntheses([persona_version])
                                logger.success(f"💾 Persona '{persona_id}' saved: {persona_version_id[:8]}...")
                            except Exception as save_error:
                                logger.warning(f"⚠️ Failed to save persona '{persona_id}': {save_error}")

                            syntheses.append(persona_version)
                            persona_versions_generated += 1

                        except Exception as persona_error:
                            logger.warning(f"⚠️ Pre-generation failed for '{persona_id}': {persona_error}")
                            continue

                    logger.success(f"🎉 Cluster {cluster['cluster_id']}: 1 base + {persona_versions_generated} persona versions")
                else:
                    logger.info(f"⏭️ Persona generation disabled")
                    logger.success(f"🎉 Cluster {cluster['cluster_id']}: Neutral synthesis only")

            except Exception as e:
                logger.error(f"❌ Failed to generate synthesis for cluster {cluster['cluster_id']}: {e}")
                import traceback
                logger.error(traceback.format_exc())
                continue

        return syntheses

    async def _store_articles(
        self,
        articles: List[Dict[str, Any]],
        embeddings: List[List[float]]
    ) -> bool:
        """Store articles in Qdrant vector database"""
        try:
            formatted_articles = []
            for article in articles:
                # Préparer la liste des sources qui couvrent cet article
                covered_by = article.get("covered_by_sources", [])
                if not covered_by:
                    source = article.get("source_name", "") or article.get("source_domain", "")
                    covered_by = [source] if source else []

                formatted_articles.append({
                    "id": article.get("url", ""),
                    "title": article.get("raw_title", ""),
                    "summary": article.get("summary", ""),
                    "content": article.get("raw_text", ""),
                    "source": article.get("source_name", ""),
                    "source_domain": article.get("source_domain", ""),
                    "published_at": article.get("published_at", ""),
                    "url": article.get("url", ""),
                    "language": article.get("language", ""),
                    "image_url": article.get("image_url", ""),
                    "authors": ", ".join(article.get("authors", [])),
                    # Nouveaux champs de viralité
                    "viral_score": article.get("viral_score", 1),
                    "covered_by_sources": ", ".join(covered_by),
                    "duplicate_count": article.get("duplicate_count", 1)
                })

            success = self.qdrant.upsert_articles(formatted_articles, embeddings)
            return success

        except Exception as e:
            logger.error(f"❌ Failed to store articles: {e}")
            return False

    async def _store_syntheses(
        self,
        syntheses: List[Dict[str, Any]]
    ) -> bool:
        """Store syntheses in Qdrant vector database"""
        try:
            # Generate embeddings for syntheses
            synthesis_texts = [
                f"{s.get('title', '')} {s.get('summary', '')}"
                for s in syntheses
            ]
            synthesis_embeddings = self.embedding_service.encode(synthesis_texts)

            # Store each synthesis
            for synthesis, embedding in zip(syntheses, synthesis_embeddings):
                self.qdrant.upsert_synthesis(synthesis, embedding)

            logger.success(f"✅ Stored {len(syntheses)} syntheses")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to store syntheses: {e}")
            return False

    async def _process_intelligence_hub(
        self,
        synthesis: Dict[str, Any],
        articles: List[Dict[str, Any]],
        cluster_embeddings
    ) -> None:
        """
        Process Intelligence Hub: Entity Resolution + Topic Assignment + Causal Aggregation

        This is called after each synthesis is generated and stored.
        """
        import numpy as np
        synthesis_id = synthesis.get("id", "")

        try:
            # === 1. ENTITY RESOLUTION ===
            if self.entity_resolver:
                key_entities = synthesis.get("key_entities", [])
                resolved_entity_ids = []

                for entity in key_entities:
                    # Handle both dict and tuple formats
                    if isinstance(entity, dict):
                        entity_name = entity.get("name", "")
                        entity_type = entity.get("type", "UNKNOWN")
                    elif isinstance(entity, (tuple, list)) and len(entity) >= 2:
                        entity_name, entity_type = entity[0], entity[1]
                    else:
                        entity_name = str(entity)
                        entity_type = "UNKNOWN"

                    if not entity_name:
                        continue

                    try:
                        # Resolve entity to canonical form
                        entity_id, is_new = await self.entity_resolver.resolve_entity(
                            mention=entity_name,
                            entity_type=entity_type.upper(),
                            context=synthesis.get("title", "")
                        )
                        resolved_entity_ids.append(entity_id)

                        if is_new:
                            logger.debug(f"🆕 New entity created: {entity_name} ({entity_type})")
                        else:
                            logger.debug(f"✅ Entity resolved: {entity_name} -> {entity_id[:8]}...")

                    except Exception as e:
                        logger.warning(f"⚠️ Entity resolution failed for '{entity_name}': {e}")

                # Store resolved entity IDs in synthesis
                synthesis["resolved_entity_ids"] = resolved_entity_ids

                # Update entity mentions
                if resolved_entity_ids:
                    try:
                        await self._update_entity_mentions(resolved_entity_ids, synthesis_id)
                        logger.info(f"📊 Updated mentions for {len(resolved_entity_ids)} entities")
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to update entity mentions: {e}")

                # Update entity relationships (co-occurrence)
                if len(resolved_entity_ids) >= 2:
                    try:
                        await self.entity_resolver.update_entity_relationships(
                            entity_ids=resolved_entity_ids,
                            synthesis_id=synthesis_id
                        )
                        logger.debug(f"🔗 Entity relationships updated")
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to update entity relationships: {e}")

            # === 2. TOPIC DETECTION & ASSIGNMENT ===
            if self.topic_detector and self.embedding_service:
                try:
                    # Compute synthesis embedding from cluster mean
                    synthesis_embedding = np.mean(cluster_embeddings, axis=0).tolist()

                    # Try to assign to existing topic
                    topic_id = await self.topic_detector.assign_synthesis_to_topic(
                        synthesis_id=synthesis_id,
                        synthesis_embedding=synthesis_embedding,
                        synthesis_metadata={
                            "title": synthesis.get("title", ""),
                            "category": synthesis.get("category", "MONDE"),
                            "key_entities": synthesis.get("key_entities", [])[:5]
                        }
                    )

                    if topic_id:
                        synthesis["topic_id"] = topic_id
                        logger.info(f"📁 Synthesis assigned to topic: {topic_id[:8]}...")

                        # === 3. CAUSAL AGGREGATION for topic ===
                        if self.causal_aggregator:
                            try:
                                await self._queue_causal_aggregation(topic_id)
                            except Exception as e:
                                logger.warning(f"⚠️ Causal aggregation failed: {e}")
                    else:
                        logger.debug(f"🆕 No matching topic found, synthesis remains unassigned")

                except Exception as e:
                    logger.warning(f"⚠️ Topic assignment failed: {e}")

            logger.success(f"🧠 Intelligence Hub processed for synthesis {synthesis_id[:8]}...")

        except Exception as e:
            logger.error(f"❌ Intelligence Hub processing failed: {e}")
            import traceback
            logger.debug(traceback.format_exc())

    async def _update_entity_mentions(
        self,
        entity_ids: List[str],
        synthesis_id: str
    ) -> None:
        """Update entity mention counts and synthesis references"""
        if not self.qdrant:
            return

        for entity_id in entity_ids:
            try:
                self.qdrant.update_entity_mentions(
                    entity_id=entity_id,
                    synthesis_id=synthesis_id
                )
            except Exception as e:
                logger.debug(f"Failed to update entity {entity_id[:8]}...: {e}")

    async def _queue_causal_aggregation(self, topic_id: str) -> None:
        """
        Queue causal graph aggregation for a topic.
        In production, this could be a background job.
        For now, we run it synchronously but with a limit on frequency.
        """
        if not self.causal_aggregator or not self.qdrant:
            return

        try:
            # Get topic details
            topic = self.qdrant.get_topic_by_id(topic_id)
            if not topic:
                return

            synthesis_ids = topic.get("synthesis_ids", [])
            if len(synthesis_ids) < 2:
                # Need at least 2 syntheses to aggregate
                return

            # Aggregate causal graphs
            aggregated_graph = self.causal_aggregator.aggregate_causal_graphs(
                synthesis_ids=synthesis_ids,
                include_timeline=True
            )

            if aggregated_graph.get("nodes"):
                # Store aggregated graph
                self.qdrant.update_topic_causal_graph(
                    topic_id=topic_id,
                    causal_graph=aggregated_graph
                )
                logger.info(f"📊 Causal graph aggregated for topic {topic_id[:8]}... "
                          f"({len(aggregated_graph['nodes'])} nodes, {len(aggregated_graph['edges'])} edges)")

        except Exception as e:
            logger.warning(f"⚠️ Causal aggregation error: {e}")


# Global instance
pipeline_engine = PipelineEngine()


async def init_pipeline():
    """Initialize pipeline engine"""
    await pipeline_engine.initialize()


def get_pipeline_engine() -> PipelineEngine:
    """Dependency injection for FastAPI"""
    return pipeline_engine
