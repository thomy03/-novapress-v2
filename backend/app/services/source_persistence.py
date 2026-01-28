"""
Source Persistence Service - NovaPress AI v2
Persists discovered sources and health metrics to Redis + JSON backup.
Sources are no longer lost on restart!
"""
import json
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from pathlib import Path
from loguru import logger
from dataclasses import dataclass, asdict, field
from enum import Enum

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("redis-py not available - using JSON-only persistence")

from app.core.config import settings


class SourceStatus(Enum):
    """Status of a news source"""
    ACTIVE = "active"
    DEGRADED = "degraded"
    BLOCKED = "blocked"
    BLACKLISTED = "blacklisted"
    DISCOVERED = "discovered"  # Newly discovered, not yet validated


@dataclass
class SourceHealth:
    """Health metrics for a single source"""
    domain: str
    name: str
    status: SourceStatus = SourceStatus.ACTIVE

    # Success/failure tracking
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0

    # Rolling 7-day stats
    failures_last_7_days: int = 0
    success_last_7_days: int = 0

    # Timestamps
    last_success: Optional[str] = None
    last_failure: Optional[str] = None
    last_error: Optional[str] = None
    discovered_at: Optional[str] = None

    # Source metadata
    tier: int = 2  # 1=major, 2=standard, 3=minor
    has_rss: bool = False
    rss_urls: List[str] = field(default_factory=list)
    category: str = "MONDE"
    language: str = "unknown"

    # Discovery metadata (if discovered by LLM)
    discovered_by: Optional[str] = None  # "llm", "manual", "rss_probe"
    replaces_domain: Optional[str] = None  # Domain this source replaces

    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.successful_requests / self.total_requests

    @property
    def is_healthy(self) -> bool:
        return self.status == SourceStatus.ACTIVE and self.success_rate >= 0.5

    def record_success(self):
        self.total_requests += 1
        self.successful_requests += 1
        self.success_last_7_days += 1
        self.last_success = datetime.now().isoformat()
        # Update status if recovering
        if self.status == SourceStatus.DEGRADED and self.success_rate >= 0.7:
            self.status = SourceStatus.ACTIVE

    def record_failure(self, error: str):
        self.total_requests += 1
        self.failed_requests += 1
        self.failures_last_7_days += 1
        self.last_failure = datetime.now().isoformat()
        self.last_error = error
        # Degrade status if failing
        if self.success_rate < 0.5:
            self.status = SourceStatus.DEGRADED
        if self.failures_last_7_days >= 5 and self.success_last_7_days == 0:
            self.status = SourceStatus.BLOCKED

    def to_dict(self) -> Dict:
        data = asdict(self)
        data['status'] = self.status.value
        return data

    @classmethod
    def from_dict(cls, data: Dict) -> 'SourceHealth':
        data = data.copy()
        data['status'] = SourceStatus(data.get('status', 'active'))
        # Handle rss_urls field
        if 'rss_urls' not in data:
            data['rss_urls'] = []
        return cls(**data)


class SourcePersistence:
    """
    Persists discovered sources and health metrics.

    Storage hierarchy:
    1. Redis (primary) - fast, shared across instances
    2. JSON file (backup) - survives Redis restarts

    Keys in Redis:
    - novapress:sources:health:{domain} - SourceHealth JSON
    - novapress:sources:discovered - Set of discovered domains
    - novapress:sources:blacklist - Set of blacklisted domains
    """

    REDIS_KEY_PREFIX = "novapress:sources"
    JSON_BACKUP_PATH = Path("data/sources_backup.json")
    SAVE_INTERVAL_SECONDS = 60  # Auto-save to JSON every minute

    def __init__(self):
        self._redis: Optional[redis.Redis] = None
        self._sources: Dict[str, SourceHealth] = {}
        self._blacklist: set = set()
        self._last_save_time: Optional[datetime] = None
        self._initialized = False

    async def initialize(self):
        """Initialize persistence layer"""
        if self._initialized:
            return

        # Try Redis first
        if REDIS_AVAILABLE:
            try:
                self._redis = redis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True
                )
                # Test connection
                await self._redis.ping()
                logger.info("✅ SourcePersistence connected to Redis")
            except Exception as e:
                logger.warning(f"⚠️ Redis connection failed: {e} - using JSON only")
                self._redis = None

        # Load from JSON backup
        await self._load_from_json()

        # Sync from Redis if available (Redis takes priority)
        if self._redis:
            await self._sync_from_redis()

        self._initialized = True
        logger.info(f"📊 SourcePersistence initialized: {len(self._sources)} sources loaded")

    async def close(self):
        """Close connections and save state"""
        await self._save_to_json()
        if self._redis:
            await self._redis.close()

    # ==================== PUBLIC API ====================

    async def get_source_health(self, domain: str) -> Optional[SourceHealth]:
        """Get health metrics for a source"""
        await self._ensure_initialized()
        return self._sources.get(domain)

    async def get_all_sources(self) -> Dict[str, SourceHealth]:
        """Get all tracked sources"""
        await self._ensure_initialized()
        return self._sources.copy()

    async def get_healthy_sources(self) -> List[str]:
        """Get list of healthy source domains"""
        await self._ensure_initialized()
        return [d for d, h in self._sources.items() if h.is_healthy]

    async def get_failing_sources(self) -> List[str]:
        """Get list of failing source domains (candidates for replacement)"""
        await self._ensure_initialized()
        return [
            d for d, h in self._sources.items()
            if h.status in [SourceStatus.BLOCKED, SourceStatus.DEGRADED]
        ]

    async def save_source(self, health: SourceHealth):
        """Save or update a source's health metrics"""
        await self._ensure_initialized()
        self._sources[health.domain] = health

        # Save to Redis
        if self._redis:
            try:
                key = f"{self.REDIS_KEY_PREFIX}:health:{health.domain}"
                await self._redis.set(key, json.dumps(health.to_dict()))
            except Exception as e:
                logger.error(f"Failed to save to Redis: {e}")

        # Periodic JSON backup
        await self._maybe_save_to_json()

    async def save_discovered_source(
        self,
        domain: str,
        config: Dict[str, Any],
        discovered_by: str = "llm",
        replaces: Optional[str] = None
    ):
        """Save a newly discovered source"""
        await self._ensure_initialized()

        health = SourceHealth(
            domain=domain,
            name=config.get("name", domain),
            status=SourceStatus.DISCOVERED,
            discovered_at=datetime.now().isoformat(),
            discovered_by=discovered_by,
            replaces_domain=replaces,
            tier=config.get("tier", 2),
            has_rss=bool(config.get("rss_urls")),
            rss_urls=config.get("rss_urls", []),
            category=config.get("category", "MONDE"),
            language=config.get("language", "unknown")
        )

        await self.save_source(health)

        # Add to discovered set in Redis
        if self._redis:
            try:
                await self._redis.sadd(f"{self.REDIS_KEY_PREFIX}:discovered", domain)
            except Exception as e:
                logger.error(f"Failed to save discovered source to Redis: {e}")

        logger.info(f"💡 Discovered source saved: {domain} (replaces: {replaces})")

    async def record_success(self, domain: str):
        """Record a successful scrape for a source"""
        await self._ensure_initialized()

        health = self._sources.get(domain)
        if health:
            health.record_success()
            await self.save_source(health)

    async def record_failure(self, domain: str, error: str):
        """Record a failed scrape for a source"""
        await self._ensure_initialized()

        health = self._sources.get(domain)
        if health:
            health.record_failure(error)
            await self.save_source(health)

    async def add_to_blacklist(self, domain: str, reason: str = ""):
        """Add a source to blacklist (permanent block)"""
        await self._ensure_initialized()

        self._blacklist.add(domain)

        if domain in self._sources:
            self._sources[domain].status = SourceStatus.BLACKLISTED
            self._sources[domain].last_error = f"Blacklisted: {reason}"
            await self.save_source(self._sources[domain])

        if self._redis:
            try:
                await self._redis.sadd(f"{self.REDIS_KEY_PREFIX}:blacklist", domain)
            except Exception as e:
                logger.error(f"Failed to add to Redis blacklist: {e}")

        logger.warning(f"🚫 Source blacklisted: {domain} - {reason}")

    async def remove_from_blacklist(self, domain: str):
        """Remove a source from blacklist"""
        await self._ensure_initialized()

        self._blacklist.discard(domain)

        if domain in self._sources:
            self._sources[domain].status = SourceStatus.DISCOVERED

        if self._redis:
            try:
                await self._redis.srem(f"{self.REDIS_KEY_PREFIX}:blacklist", domain)
            except Exception as e:
                logger.error(f"Failed to remove from Redis blacklist: {e}")

        logger.info(f"✅ Source removed from blacklist: {domain}")

    async def is_blacklisted(self, domain: str) -> bool:
        """Check if a source is blacklisted"""
        await self._ensure_initialized()
        return domain in self._blacklist

    async def get_health_report(self) -> Dict[str, Any]:
        """Generate a comprehensive health report"""
        await self._ensure_initialized()

        active = []
        degraded = []
        blocked = []
        blacklisted = []
        discovered = []

        for domain, health in self._sources.items():
            entry = {
                "domain": domain,
                "name": health.name,
                "success_rate": round(health.success_rate * 100, 1),
                "total_requests": health.total_requests,
                "last_success": health.last_success,
                "last_error": health.last_error,
                "tier": health.tier,
                "has_rss": health.has_rss
            }

            if health.status == SourceStatus.ACTIVE:
                active.append(entry)
            elif health.status == SourceStatus.DEGRADED:
                degraded.append(entry)
            elif health.status == SourceStatus.BLOCKED:
                blocked.append(entry)
            elif health.status == SourceStatus.BLACKLISTED:
                blacklisted.append(entry)
            elif health.status == SourceStatus.DISCOVERED:
                discovered.append(entry)

        total = len(self._sources)
        return {
            "total_sources": total,
            "active_count": len(active),
            "degraded_count": len(degraded),
            "blocked_count": len(blocked),
            "blacklisted_count": len(blacklisted),
            "discovered_count": len(discovered),
            "overall_health": len(active) / total if total > 0 else 0,
            "sources": {
                "active": sorted(active, key=lambda x: -x["success_rate"]),
                "degraded": degraded,
                "blocked": blocked,
                "blacklisted": blacklisted,
                "discovered": discovered
            }
        }

    # ==================== INTERNAL METHODS ====================

    async def _ensure_initialized(self):
        """Ensure persistence is initialized"""
        if not self._initialized:
            await self.initialize()

    async def _sync_from_redis(self):
        """Sync sources from Redis (takes priority over JSON)"""
        if not self._redis:
            return

        try:
            # Get all health keys
            cursor = 0
            pattern = f"{self.REDIS_KEY_PREFIX}:health:*"
            while True:
                cursor, keys = await self._redis.scan(cursor, match=pattern, count=100)
                for key in keys:
                    data = await self._redis.get(key)
                    if data:
                        try:
                            health_data = json.loads(data)
                            health = SourceHealth.from_dict(health_data)
                            self._sources[health.domain] = health
                        except Exception as e:
                            logger.error(f"Failed to parse Redis health data: {e}")
                if cursor == 0:
                    break

            # Get blacklist
            blacklist = await self._redis.smembers(f"{self.REDIS_KEY_PREFIX}:blacklist")
            self._blacklist = set(blacklist)

            logger.info(f"📥 Synced {len(self._sources)} sources from Redis")

        except Exception as e:
            logger.error(f"Failed to sync from Redis: {e}")

    async def _load_from_json(self):
        """Load sources from JSON backup"""
        try:
            if self.JSON_BACKUP_PATH.exists():
                with open(self.JSON_BACKUP_PATH, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # Load sources
                for domain, health_data in data.get("sources", {}).items():
                    try:
                        self._sources[domain] = SourceHealth.from_dict(health_data)
                    except Exception as e:
                        logger.error(f"Failed to load source {domain}: {e}")

                # Load blacklist
                self._blacklist = set(data.get("blacklist", []))

                logger.info(f"📥 Loaded {len(self._sources)} sources from JSON backup")
        except Exception as e:
            logger.error(f"Failed to load from JSON: {e}")

    async def _save_to_json(self):
        """Save sources to JSON backup"""
        try:
            # Ensure directory exists
            self.JSON_BACKUP_PATH.parent.mkdir(parents=True, exist_ok=True)

            data = {
                "last_updated": datetime.now().isoformat(),
                "sources": {d: h.to_dict() for d, h in self._sources.items()},
                "blacklist": list(self._blacklist)
            }

            with open(self.JSON_BACKUP_PATH, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            self._last_save_time = datetime.now()
            logger.debug(f"💾 Saved {len(self._sources)} sources to JSON backup")

        except Exception as e:
            logger.error(f"Failed to save to JSON: {e}")

    async def _maybe_save_to_json(self):
        """Save to JSON if enough time has passed since last save"""
        if self._last_save_time is None:
            await self._save_to_json()
            return

        elapsed = (datetime.now() - self._last_save_time).total_seconds()
        if elapsed >= self.SAVE_INTERVAL_SECONDS:
            await self._save_to_json()


# Singleton instance
_persistence: Optional[SourcePersistence] = None


async def get_source_persistence() -> SourcePersistence:
    """Get or create source persistence singleton"""
    global _persistence
    if _persistence is None:
        _persistence = SourcePersistence()
        await _persistence.initialize()
    return _persistence


async def init_source_persistence():
    """Initialize source persistence (call at app startup)"""
    await get_source_persistence()
