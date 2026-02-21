"""
Pipeline Manager - Cancellable Background Task Management
Provides real-time progress via WebSocket
Uses ThreadPoolExecutor for CPU-bound operations (embeddings, clustering)
Uses Redis for distributed locking (multi-worker safety)
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime
from loguru import logger
from enum import Enum
import redis

from app.core.config import settings
from app.services.source_discovery import get_discovery_service, SourceDiscoveryService
from app.services.advanced_scraper import SourceBlockedError

# Thread pool for CPU-bound operations (embeddings, clustering)
# This prevents blocking the async event loop
_cpu_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pipeline_cpu")

# Redis client for distributed locking
_redis_client: Optional[redis.Redis] = None

def get_redis_client() -> redis.Redis:
    """Get or create Redis client for distributed locking"""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
            _redis_client.ping()  # Test connection
            logger.info("Redis client connected for pipeline locking")
        except Exception as e:
            logger.warning(f"Redis not available for locking: {e}. Using local-only mode.")
            _redis_client = None
    return _redis_client

# Redis keys for pipeline state
PIPELINE_LOCK_KEY = "novapress:pipeline:lock"
PIPELINE_STATE_KEY = "novapress:pipeline:state"
PIPELINE_LOCK_TTL = 3600  # 1 hour max lock duration


class PipelineStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    STOPPING = "stopping"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"


class PipelineLog:
    """Log entry for pipeline progress"""
    def __init__(self, level: str, message: str, source: str = None, details: dict = None):
        self.timestamp = datetime.now().isoformat()
        self.level = level  # info, success, warning, error
        self.message = message
        self.source = source
        self.details = details or {}

    def to_dict(self):
        return {
            "timestamp": self.timestamp,
            "level": self.level,
            "message": self.message,
            "source": self.source,
            "details": self.details
        }


class PipelineManager:
    """
    Singleton manager for pipeline execution with cancellation support
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True
        self._current_task: Optional[asyncio.Task] = None
        self._cancel_requested = False
        self._status = PipelineStatus.IDLE
        self._progress = 0
        self._current_step = None
        self._logs: List[PipelineLog] = []
        self._last_run = None
        self._last_result = None
        self._subscribers: List[Callable] = []
        self._source_stats: Dict[str, Dict] = {}
        self._blacklisted_sources: Dict[str, Dict] = {}  # domain -> {reason, timestamp, failures}
        self._discovered_sources: Dict[str, Dict] = {}  # Auto-discovered replacement sources
        self._empty_source_counts: Dict[str, int] = {}  # Track consecutive empty results

        # Configuration
        self.SOURCE_TIMEOUT = 45  # seconds per source (increased to 45s for RSS+fallback)
        self.MAX_CONSECUTIVE_FAILURES = 3  # blacklist after X failures
        self.MAX_CONSECUTIVE_EMPTY = 2  # trigger discovery after X consecutive empty results
        self.MAX_LOGS = 500  # keep last 500 logs

    @property
    def is_running(self) -> bool:
        return self._status == PipelineStatus.RUNNING

    @property
    def status(self) -> str:
        return self._status.value

    def subscribe(self, callback: Callable):
        """Subscribe to pipeline updates"""
        self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable):
        """Unsubscribe from updates"""
        if callback in self._subscribers:
            self._subscribers.remove(callback)

    async def _notify_subscribers(self, event_type: str, data: dict):
        """Notify all subscribers of an event"""
        message = {
            "type": event_type,
            "timestamp": datetime.now().isoformat(),
            **data
        }
        for callback in self._subscribers:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(message)
                else:
                    callback(message)
            except Exception as e:
                logger.error(f"Error notifying subscriber: {e}")

    def add_log(self, level: str, message: str, source: str = None, details: dict = None):
        """Add a log entry and notify subscribers"""
        log = PipelineLog(level, message, source, details)
        self._logs.append(log)

        # Trim old logs
        if len(self._logs) > self.MAX_LOGS:
            self._logs = self._logs[-self.MAX_LOGS:]

        # Schedule notification
        asyncio.create_task(self._notify_subscribers("log", log.to_dict()))

    def check_cancelled(self) -> bool:
        """Check if cancellation was requested - call this in pipeline steps"""
        return self._cancel_requested

    async def update_progress(self, progress: int, step: str = None):
        """Update progress and notify subscribers"""
        self._progress = min(100, max(0, progress))
        if step:
            self._current_step = step

        await self._notify_subscribers("progress", {
            "progress": self._progress,
            "step": self._current_step,
            "status": self._status.value
        })

    async def update_source_status(self, source: str, status: str, articles: int = 0, error: str = None):
        """Update status for a specific source"""
        self._source_stats[source] = {
            "status": status,  # pending, scraping, success, error, timeout, skipped
            "articles": articles,
            "error": error,
            "updated_at": datetime.now().isoformat()
        }

        await self._notify_subscribers("source_update", {
            "source": source,
            **self._source_stats[source]
        })

    def get_state(self) -> Dict[str, Any]:
        """Get current pipeline state"""
        return {
            "status": self._status.value,
            "is_running": self.is_running,
            "progress": self._progress,
            "current_step": self._current_step,
            "last_run": self._last_run,
            "last_result": self._last_result,
            "source_stats": self._source_stats,
            "blacklisted_sources": list(self._blacklisted_sources.keys()),
            "discovered_sources": list(self._discovered_sources.keys()),
            "logs_count": len(self._logs)
        }

    def _blacklist_source(self, domain: str, reason: str):
        """Add a source to the blacklist"""
        if domain in self._blacklisted_sources:
            self._blacklisted_sources[domain]["failures"] += 1
        else:
            self._blacklisted_sources[domain] = {
                "reason": reason,
                "timestamp": datetime.now().isoformat(),
                "failures": 1
            }
        logger.warning(f"⛔ Source blacklisted: {domain} - {reason}")

    async def _try_discover_replacement(self, domain: str, reason: str, source_config: dict = None):
        """
        Try to discover a replacement source when one is blacklisted.
        Non-blocking - runs in background if enabled.
        """
        if not getattr(settings, 'ENABLE_AUTO_DISCOVERY', False):
            return None

        # Check if we've already discovered enough sources
        max_sources = getattr(settings, 'AUTO_DISCOVERY_MAX_SOURCES', 10)
        if len(self._discovered_sources) >= max_sources:
            logger.info(f"Max discovered sources reached ({max_sources}), skipping discovery")
            return None

        try:
            discovery = get_discovery_service()
            self.add_log("info", f"🔍 Searching replacement for {domain}...")

            replacement = await discovery.find_replacement(
                blocked_domain=domain,
                blocked_reason=reason,
                source_config=source_config,
                max_suggestions=3
            )

            if replacement:
                # Store discovered source
                self._discovered_sources[replacement.get("name", domain)] = replacement
                self.add_log("success", f"✅ Discovered replacement: {replacement.get('name')} ({replacement.get('url')})")

                # Add to scraper's sources dynamically
                from app.services.advanced_scraper import AdvancedNewsScraper
                new_domain = replacement.get("url", "").replace("https://", "").replace("http://", "").split("/")[0].replace("www.", "")
                if new_domain:
                    AdvancedNewsScraper.WORLD_NEWS_SOURCES[new_domain] = replacement
                    logger.info(f"Added {new_domain} to active sources")

                return replacement

        except Exception as e:
            logger.error(f"Auto-discovery failed for {domain}: {e}")
            self.add_log("error", f"Auto-discovery failed: {str(e)[:50]}")

        return None

    def _is_blacklisted(self, domain: str) -> bool:
        """Check if a source is blacklisted"""
        return domain in self._blacklisted_sources

    def clear_blacklist(self, domain: str = None):
        """Clear blacklist - all or specific domain"""
        if domain:
            self._blacklisted_sources.pop(domain, None)
            logger.info(f"✅ Removed {domain} from blacklist")
        else:
            self._blacklisted_sources.clear()
            logger.info("✅ Cleared all blacklisted sources")

    def get_blacklist(self) -> Dict[str, Dict]:
        """Get current blacklist"""
        return self._blacklisted_sources.copy()

    def get_discovered_sources(self) -> Dict[str, Dict]:
        """Get auto-discovered replacement sources"""
        return self._discovered_sources.copy()

    def clear_discovered_sources(self):
        """Clear all auto-discovered sources"""
        self._discovered_sources.clear()
        logger.info("✅ Cleared all discovered sources")

    def get_logs(self, limit: int = 100, offset: int = 0) -> List[dict]:
        """Get recent logs"""
        logs = self._logs[-(limit + offset):]
        if offset:
            logs = logs[:-offset]
        return [log.to_dict() for log in logs[-limit:]]

    def _acquire_redis_lock(self) -> bool:
        """Try to acquire distributed lock via Redis. Returns True if acquired."""
        redis_client = get_redis_client()
        if redis_client is None:
            # No Redis available, fall back to local-only check
            return not self.is_running

        try:
            # Use SET NX (set if not exists) with TTL for atomic lock acquisition
            lock_value = f"worker_{id(self)}_{datetime.now().isoformat()}"
            acquired = redis_client.set(
                PIPELINE_LOCK_KEY,
                lock_value,
                nx=True,  # Only set if not exists
                ex=PIPELINE_LOCK_TTL  # Auto-expire after TTL
            )
            if acquired:
                self._lock_value = lock_value
                logger.info(f"Acquired pipeline lock: {lock_value}")
            return bool(acquired)
        except Exception as e:
            logger.error(f"Failed to acquire Redis lock: {e}")
            # Fall back to local check
            return not self.is_running

    def _release_redis_lock(self):
        """Release distributed lock if we own it."""
        redis_client = get_redis_client()
        if redis_client is None:
            return

        try:
            # Only release if we own the lock (compare-and-delete)
            current_value = redis_client.get(PIPELINE_LOCK_KEY)
            if current_value == getattr(self, '_lock_value', None):
                redis_client.delete(PIPELINE_LOCK_KEY)
                logger.info("Released pipeline lock")
        except Exception as e:
            logger.error(f"Failed to release Redis lock: {e}")

    def _is_globally_running(self) -> bool:
        """Check if pipeline is running globally (across all workers)."""
        redis_client = get_redis_client()
        if redis_client is None:
            return self.is_running

        try:
            return redis_client.exists(PIPELINE_LOCK_KEY) > 0
        except Exception:
            return self.is_running

    async def start(
        self,
        mode: str = "SCRAPE",
        sources: Optional[List[str]] = None,
        topics: Optional[List[str]] = None,
        max_articles_per_source: int = 20
    ) -> Dict[str, Any]:
        """Start the pipeline with distributed locking"""
        # Check local state first
        if self.is_running:
            return {"error": "Pipeline is already running on this worker"}

        # Try to acquire distributed lock
        if not self._acquire_redis_lock():
            return {"error": "Pipeline is already running on another worker"}

        # Reset state
        self._cancel_requested = False
        self._status = PipelineStatus.RUNNING
        self._progress = 0
        self._current_step = "initializing"
        self._logs = []
        self._source_stats = {}

        self.add_log("info", f"Pipeline starting in {mode} mode")

        # Create and store the task
        self._current_task = asyncio.create_task(
            self._run_pipeline(mode, sources, topics, max_articles_per_source)
        )

        return {
            "status": "started",
            "pipeline_id": f"pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "started_at": datetime.now().isoformat()
        }

    async def stop(self) -> Dict[str, Any]:
        """Request pipeline stop"""
        if not self.is_running:
            return {"status": "not_running", "message": "No pipeline is currently running"}

        self._cancel_requested = True
        self._status = PipelineStatus.STOPPING
        self.add_log("warning", "Stop requested - cancelling pipeline...")

        await self._notify_subscribers("status", {"status": "stopping"})

        # Cancel the task
        if self._current_task and not self._current_task.done():
            self._current_task.cancel()
            try:
                await asyncio.wait_for(self._current_task, timeout=5.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass

        self._status = PipelineStatus.CANCELLED
        self.add_log("warning", "Pipeline cancelled by user")

        await self._notify_subscribers("status", {"status": "cancelled"})

        return {"status": "cancelled", "message": "Pipeline stopped"}

    async def _run_pipeline(
        self,
        mode: str,
        sources: Optional[List[str]],
        topics: Optional[List[str]],
        max_articles_per_source: int
    ):
        """Internal pipeline execution with cancellation checks"""
        try:
            from app.services.pipeline import PipelineEngine

            await self.update_progress(5, "loading_services")
            self.add_log("info", "Loading AI services...")

            pipeline = PipelineEngine()

            # Inject the manager into the pipeline for progress updates
            pipeline._manager = self

            await self.update_progress(10, "initializing")
            self.add_log("info", "Initializing pipeline engine...")
            await pipeline.initialize()

            if self.check_cancelled():
                raise asyncio.CancelledError()

            await self.update_progress(15, "running")
            self.add_log("success", "Pipeline initialized, starting scraping...")

            # Run the pipeline with the manager
            results = await self._run_with_manager(
                pipeline, mode, sources, topics, max_articles_per_source
            )

            # Complete
            self._status = PipelineStatus.COMPLETED
            self._progress = 100
            self._current_step = "completed"
            self._last_run = datetime.now().isoformat()
            self._last_result = {
                "raw_articles": results.get("raw_articles", 0),
                "unique_articles": results.get("unique_articles", 0),
                "clusters": results.get("clusters", 0),
                "syntheses": results.get("syntheses", 0),
                "completed_at": datetime.now().isoformat()
            }

            self.add_log("success", f"Pipeline completed! {self._last_result['syntheses']} syntheses generated")
            await self._notify_subscribers("completed", self._last_result)

        except asyncio.CancelledError:
            self._status = PipelineStatus.CANCELLED
            self.add_log("warning", "Pipeline was cancelled")
            await self._notify_subscribers("status", {"status": "cancelled"})

        except Exception as e:
            self._status = PipelineStatus.ERROR
            self._current_step = "error"
            self.add_log("error", f"Pipeline error: {str(e)}")
            logger.exception("Pipeline error")
            await self._notify_subscribers("error", {"error": str(e)})

        finally:
            # Always release the distributed lock when pipeline ends
            self._release_redis_lock()

    async def _run_with_manager(
        self,
        pipeline,
        mode: str,
        sources: Optional[List[str]],
        topics: Optional[List[str]],
        max_articles_per_source: int
    ) -> Dict[str, Any]:
        """Run pipeline with progress tracking and source timeouts"""
        from app.services.advanced_scraper import AdvancedNewsScraper

        results = {
            "mode": mode,
            "started_at": datetime.now().isoformat(),
            "raw_articles": 0,
            "unique_articles": 0,
            "clusters": 0,
            "syntheses": 0
        }

        all_articles = []

        # Get source list - filter extended sources if disabled
        source_configs = AdvancedNewsScraper.WORLD_NEWS_SOURCES
        if sources:
            source_domains = sources
        else:
            # Use filtered sources based on ENABLE_EXTENDED_SOURCES config
            all_sources = list(source_configs.keys())
            if getattr(settings, 'ENABLE_EXTENDED_SOURCES', False):
                source_domains = all_sources
                self.add_log("info", f"Extended sources ENABLED: {len(all_sources)} total")
            else:
                extended = AdvancedNewsScraper.EXTENDED_SOURCE_DOMAINS
                source_domains = [s for s in all_sources if s not in extended]
                self.add_log("info", f"Extended sources DISABLED: {len(source_domains)} core sources (skipping {len(extended)} extended)")
        total_sources = len(source_domains)

        await self.update_progress(20, "scraping")
        self.add_log("info", f"Scraping {total_sources} sources...")

        # Scrape each source with timeout
        skipped_blacklisted = 0
        successful_sources = 0  # Phase 1: Low-Tech alert tracking
        failed_sources = 0      # Phase 1: Low-Tech alert tracking
        async with pipeline.advanced_scraper as scraper:
            for i, domain in enumerate(source_domains):
                if self.check_cancelled():
                    raise asyncio.CancelledError()

                source_name = source_configs.get(domain, {}).get("name", domain)

                # Skip blacklisted sources
                if self._is_blacklisted(domain):
                    skipped_blacklisted += 1
                    await self.update_source_status(domain, "skipped", 0, "Blacklisted")
                    self.add_log("warning", f"⏭️ {source_name}: SKIPPED (blacklisted)", source=domain)
                    progress = 20 + int((i + 1) / total_sources * 30)
                    await self.update_progress(progress)
                    continue

                await self.update_source_status(domain, "scraping")
                self.add_log("info", f"Scraping {source_name}...", source=domain)

                try:
                    # Scrape with aggressive timeout - pass timeout to scraper too
                    articles = await asyncio.wait_for(
                        scraper.scrape_source(domain, max_articles=max_articles_per_source, timeout=self.SOURCE_TIMEOUT),
                        timeout=self.SOURCE_TIMEOUT + 3  # Extra 3s grace period for cleanup
                    )

                    if articles:
                        all_articles.extend(articles)
                        await self.update_source_status(domain, "success", len(articles))
                        self.add_log("success", f"{source_name}: {len(articles)} articles", source=domain)
                        # Reset empty count on success
                        self._empty_source_counts[domain] = 0
                        successful_sources += 1  # Phase 1: Low-Tech alert
                    else:
                        await self.update_source_status(domain, "empty", 0)
                        self.add_log("warning", f"{source_name}: no articles found", source=domain)
                        failed_sources += 1  # Phase 1: Low-Tech alert (empty = partial failure)
                        # Track consecutive empty results
                        self._empty_source_counts[domain] = self._empty_source_counts.get(domain, 0) + 1
                        empty_count = self._empty_source_counts[domain]
                        if empty_count >= self.MAX_CONSECUTIVE_EMPTY:
                            self.add_log("warning", f"🔄 {source_name}: {empty_count} consecutive empty runs, searching replacement...")
                            # Try to discover replacement for consistently empty source
                            asyncio.create_task(self._try_discover_replacement(
                                domain, f"Consecutive empty results ({empty_count})",
                                source_configs.get(domain)
                            ))

                except asyncio.TimeoutError:
                    await self.update_source_status(domain, "timeout", 0, f"Timeout after {self.SOURCE_TIMEOUT}s")
                    self.add_log("error", f"⏱️ {source_name}: TIMEOUT after {self.SOURCE_TIMEOUT}s - BLACKLISTED", source=domain)
                    self._blacklist_source(domain, f"Timeout after {self.SOURCE_TIMEOUT}s")
                    failed_sources += 1  # Phase 1: Low-Tech alert
                    # Try to discover replacement (non-blocking, in background)
                    asyncio.create_task(self._try_discover_replacement(
                        domain, f"Timeout after {self.SOURCE_TIMEOUT}s",
                        source_configs.get(domain)
                    ))

                except SourceBlockedError as e:
                    # Source is actively blocking requests (403/406/etc)
                    await self.update_source_status(domain, "blocked", 0, f"{e.error_code}: {e.error_count}/{e.total_urls} requests failed")
                    self.add_log("error", f"⛔ {source_name}: BLOCKED ({e.error_code}) - {e.error_count}/{e.total_urls} failed - BLACKLISTED", source=domain)
                    self._blacklist_source(domain, f"HTTP blocked: {e.error_code}")
                    failed_sources += 1  # Phase 1: Low-Tech alert
                    # Try to discover replacement (non-blocking)
                    asyncio.create_task(self._try_discover_replacement(
                        domain, f"HTTP blocked ({e.error_code})",
                        source_configs.get(domain)
                    ))

                except Exception as e:
                    await self.update_source_status(domain, "error", 0, str(e))
                    self.add_log("error", f"{source_name}: {str(e)}", source=domain)
                    failed_sources += 1  # Phase 1: Low-Tech alert
                    # Blacklist on repeated failures
                    if "getaddrinfo failed" in str(e) or "Connection refused" in str(e):
                        self._blacklist_source(domain, str(e)[:100])
                        # Try to discover replacement (non-blocking)
                        asyncio.create_task(self._try_discover_replacement(
                            domain, str(e)[:100],
                            source_configs.get(domain)
                        ))

                # Update progress
                progress = 20 + int((i + 1) / total_sources * 30)  # 20-50%
                await self.update_progress(progress)

        if skipped_blacklisted > 0:
            self.add_log("info", f"⏭️ Skipped {skipped_blacklisted} blacklisted sources")

        results["raw_articles"] = len(all_articles)
        self.add_log("success", f"Scraping complete: {len(all_articles)} articles collected")

        # Phase 1: Low-Tech Alert - Check success rate
        attempted_sources = successful_sources + failed_sources
        if attempted_sources > 0:
            success_rate = successful_sources / attempted_sources
            results["success_rate"] = round(success_rate * 100, 1)
            self.add_log("info", f"📊 Success rate: {results['success_rate']}% ({successful_sources}/{attempted_sources} sources)")

            if success_rate < 0.50:
                # Critical alert: pipeline is underperforming
                alert_msg = f"🚨 ALERTE: Pipeline success rate critique: {results['success_rate']}% ({successful_sources}/{attempted_sources} sources réussies)"
                self.add_log("error", alert_msg)
                logger.critical(alert_msg)
                # TODO: Envoyer alerte Discord/Slack/Email (à implémenter)
                # await self._send_low_tech_alert(alert_msg)

        if len(all_articles) == 0:
            self.add_log("warning", "No articles collected, stopping pipeline")
            return results

        # Continue with rest of pipeline
        await self.update_progress(55, "deduplication")
        self.add_log("info", "Running deduplication...")

        if self.check_cancelled():
            raise asyncio.CancelledError()

        # Embeddings - Run in thread pool with batch progress updates
        texts = [f"{a.get('raw_title', '')} {a.get('raw_text', '')[:500]}" for a in all_articles]
        total_articles = len(texts)
        batch_size = 20  # Process 20 articles at a time for progress updates

        estimated_time = (total_articles * 3) // 60  # ~3 sec per article on CPU
        self.add_log("info", f"⏳ Computing embeddings for {total_articles} articles (~{estimated_time} min on CPU)...")
        await self.update_progress(55, "embeddings")

        loop = asyncio.get_event_loop()
        all_embeddings = []

        for i in range(0, total_articles, batch_size):
            if self.check_cancelled():
                raise asyncio.CancelledError()

            batch_texts = texts[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total_articles + batch_size - 1) // batch_size

            # Update progress: 55% to 60% during embeddings
            progress = 55 + int((i / total_articles) * 5)
            await self.update_progress(progress, f"embeddings ({batch_num}/{total_batches})")
            self.add_log("info", f"📊 Batch {batch_num}/{total_batches}: Processing articles {i+1}-{min(i+batch_size, total_articles)}...")

            batch_embeddings = await loop.run_in_executor(
                _cpu_executor,
                pipeline.embedding_service.encode,
                batch_texts
            )
            all_embeddings.append(batch_embeddings)

        # Combine all batch embeddings
        import numpy as np
        embeddings = np.vstack(all_embeddings)
        self.add_log("success", f"✅ Embeddings computed for {total_articles} articles")

        # Deduplication - Also CPU-bound (similarity matrix computation)
        self.add_log("info", "Running deduplication (similarity matrix)...")
        unique_articles, removed = await loop.run_in_executor(
            _cpu_executor,
            pipeline.dedup_engine.deduplicate_articles,
            all_articles,
            embeddings
        )
        results["unique_articles"] = len(unique_articles)
        self.add_log("success", f"Deduplication: {len(unique_articles)} unique ({len(removed)} duplicates removed)")

        if len(unique_articles) == 0:
            return results

        # NOTE: Articles are NOT stored to comply with copyright regulations (GDPR, EU Copyright Directive)
        # Only AI-generated syntheses are kept in the database
        self.add_log("info", "📋 Articles will be used for synthesis only (not stored - copyright compliance)")

        await self.update_progress(62, "fetching_history")
        self.add_log("info", "📚 Fetching persistent stories for narrative continuity...")

        # === SMART HYBRID CLUSTERING: Include PERSISTENT syntheses for context ===
        # Uses persistence scoring: recent (3 days) + recurring stories (high update_count)
        from app.db.qdrant_client import qdrant_service
        past_syntheses = qdrant_service.get_persistent_syntheses_with_vectors(
            max_days=90,           # Look back up to 90 days
            recent_days=3,         # Always include last 3 days
            min_persistence_score=3.0,  # Older stories need score >= 3
            limit=150              # Max syntheses to include
        )
        self.add_log("info", f"📚 Found {len(past_syntheses)} syntheses (recent + persistent stories)")
        results["past_syntheses_used"] = len(past_syntheses)

        await self.update_progress(65, "clustering")
        self.add_log("info", "Clustering articles + syntheses (hybrid)...")

        if self.check_cancelled():
            raise asyncio.CancelledError()

        # Compute embeddings for NEW articles only (syntheses already have embeddings)
        unique_texts = [f"{a.get('raw_title', '')} {a.get('raw_text', '')[:500]}" for a in unique_articles]
        total_unique = len(unique_texts)
        batch_size = 20

        self.add_log("info", f"⏳ Computing embeddings for {total_unique} unique articles...")
        all_unique_embeddings = []

        for i in range(0, total_unique, batch_size):
            if self.check_cancelled():
                raise asyncio.CancelledError()

            batch_texts = unique_texts[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total_unique + batch_size - 1) // batch_size

            # Update progress: 65% to 70% during unique embeddings
            progress = 65 + int((i / total_unique) * 5)
            await self.update_progress(progress, f"clustering embeddings ({batch_num}/{total_batches})")

            batch_embeddings = await loop.run_in_executor(
                _cpu_executor,
                pipeline.embedding_service.encode,
                batch_texts
            )
            all_unique_embeddings.append(batch_embeddings)

        article_embeddings = np.vstack(all_unique_embeddings)
        self.add_log("success", f"✅ Embeddings computed for {total_unique} unique articles")

        # === Combine article embeddings with synthesis vectors ===
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
        if synthesis_vectors:
            synthesis_embeddings = np.array(synthesis_vectors)
            combined_embeddings = np.vstack([article_embeddings, synthesis_embeddings])
            self.add_log("info", f"🔗 Combined {len(unique_articles)} articles + {len(past_syntheses)} syntheses for clustering")
        else:
            combined_embeddings = article_embeddings
            self.add_log("info", f"🔗 Clustering {len(unique_articles)} articles (no past syntheses)")

        self.add_log("info", "Running HDBSCAN clustering on hybrid data...")
        cluster_labels, cluster_stats = await loop.run_in_executor(
            _cpu_executor,
            pipeline.clustering_engine.cluster_articles,
            combined_embeddings
        )

        # === Group items by cluster, tracking types ===
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

        # Build clusters for synthesis generation
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
                "size": len(group["articles"]),  # Required by _generate_syntheses
                "past_syntheses": group["syntheses"],  # For context in LLM
                "cluster_type": cluster_type  # "new" or "update"
            })

        results["clusters"] = len(clusters)
        results["updates"] = updates_count
        results["new_topics"] = new_topics_count
        self.add_log("success", f"Found {len(clusters)} clusters: {new_topics_count} new topics, {updates_count} updates")

        await self.update_progress(75, "synthesis")
        self.add_log("info", "Generating AI syntheses...")

        if self.check_cancelled():
            raise asyncio.CancelledError()

        # Syntheses
        syntheses = await pipeline._generate_syntheses(clusters[:10])
        results["syntheses"] = len(syntheses)
        self.add_log("success", f"Generated {len(syntheses)} syntheses")

        await self.update_progress(90, "storing")
        self.add_log("info", "Storing syntheses in database...")

        if self.check_cancelled():
            raise asyncio.CancelledError()

        # Storage - ONLY syntheses (copyright compliance: articles not stored)
        # Articles are used in-memory for embeddings/clustering only
        if syntheses:
            await pipeline._store_syntheses(syntheses)
            self.add_log("success", f"✅ {len(syntheses)} syntheses stored (articles not stored - copyright compliance)")
        else:
            self.add_log("warning", "⚠️ No syntheses to store")

        results["completed_at"] = datetime.now().isoformat()
        return results


# Singleton instance
_pipeline_manager: Optional[PipelineManager] = None


def get_pipeline_manager() -> PipelineManager:
    """Get the singleton pipeline manager"""
    global _pipeline_manager
    if _pipeline_manager is None:
        _pipeline_manager = PipelineManager()
    return _pipeline_manager
