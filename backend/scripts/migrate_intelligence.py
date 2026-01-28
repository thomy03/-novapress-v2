"""
Migration Script for Intelligence Hub
=====================================

This script migrates existing syntheses data to the new Intelligence Hub structure:
1. Creates entities collection and resolves entity mentions
2. Detects and creates topics from syntheses clustering
3. Aggregates causal graphs for each topic

Usage:
    python scripts/migrate_intelligence.py

Options:
    --dry-run       Show what would be done without making changes
    --force         Force re-migration even if data exists
    --batch-size    Number of syntheses to process at once (default: 50)
"""

import asyncio
import sys
import argparse
from datetime import datetime
from typing import List, Dict, Any
from loguru import logger

# Add parent directory to path for imports
sys.path.insert(0, '.')

from app.db.qdrant_client import get_qdrant_service, init_qdrant
from app.ml.entity_resolution import get_entity_resolution_service, init_entity_resolution
from app.ml.topic_detection import get_topic_detection_service, init_topic_detection
from app.ml.causal_aggregator import get_causal_aggregator
from app.ml.embeddings import get_embedding_service
from app.core.config import settings


class IntelligenceMigration:
    """Migrates existing data to Intelligence Hub structure."""

    def __init__(self, dry_run: bool = False, force: bool = False, batch_size: int = 50):
        self.dry_run = dry_run
        self.force = force
        self.batch_size = batch_size
        self.qdrant = None
        self.entity_resolver = None
        self.topic_detector = None
        self.causal_aggregator = None
        self.embedding_service = None

        # Stats
        self.stats = {
            "syntheses_processed": 0,
            "entities_created": 0,
            "entities_resolved": 0,
            "topics_created": 0,
            "topics_updated": 0,
            "causal_graphs_aggregated": 0,
            "errors": 0
        }

    async def initialize(self):
        """Initialize all services."""
        logger.info("Initializing services...")

        # Initialize Qdrant
        await init_qdrant()
        self.qdrant = get_qdrant_service()
        logger.success("Qdrant initialized")

        # Initialize embedding service
        self.embedding_service = get_embedding_service()
        logger.success("Embedding service initialized")

        # Initialize entity resolution
        await init_entity_resolution()
        self.entity_resolver = get_entity_resolution_service()
        logger.success("Entity Resolution service initialized")

        # Initialize topic detection
        await init_topic_detection()
        self.topic_detector = get_topic_detection_service()
        logger.success("Topic Detection service initialized")

        # Initialize causal aggregator
        self.causal_aggregator = get_causal_aggregator()
        logger.success("Causal Aggregator initialized")

    async def check_existing_data(self) -> Dict[str, int]:
        """Check if data already exists in collections."""
        try:
            entities_count = self.qdrant.client.count(
                collection_name=self.qdrant.entities_collection
            ).count
        except Exception:
            entities_count = 0

        try:
            topics_count = self.qdrant.client.count(
                collection_name=self.qdrant.topics_collection
            ).count
        except Exception:
            topics_count = 0

        return {
            "entities": entities_count,
            "topics": topics_count
        }

    async def migrate_entities(self, syntheses: List[Dict[str, Any]]) -> None:
        """Migrate entities from existing syntheses."""
        logger.info(f"Migrating entities from {len(syntheses)} syntheses...")

        for synthesis in syntheses:
            try:
                key_entities = synthesis.get("key_entities", [])
                synthesis_id = synthesis.get("id", "")
                title = synthesis.get("title", "")

                if not key_entities:
                    continue

                resolved_ids = []
                for entity in key_entities:
                    # Handle different entity formats
                    if isinstance(entity, dict):
                        entity_name = entity.get("name", "")
                        entity_type = entity.get("type", "UNKNOWN")
                    elif isinstance(entity, (tuple, list)) and len(entity) >= 2:
                        entity_name, entity_type = entity[0], entity[1]
                    else:
                        entity_name = str(entity)
                        entity_type = "UNKNOWN"

                    if not entity_name or len(entity_name) < 2:
                        continue

                    if self.dry_run:
                        logger.debug(f"[DRY RUN] Would resolve entity: {entity_name} ({entity_type})")
                        continue

                    try:
                        entity_id, is_new = await self.entity_resolver.resolve_entity(
                            mention=entity_name,
                            entity_type=entity_type.upper(),
                            context=title
                        )
                        resolved_ids.append(entity_id)

                        if is_new:
                            self.stats["entities_created"] += 1
                        else:
                            self.stats["entities_resolved"] += 1

                    except Exception as e:
                        logger.warning(f"Failed to resolve entity '{entity_name}': {e}")
                        self.stats["errors"] += 1

                # Update entity mentions
                if resolved_ids and not self.dry_run:
                    for entity_id in resolved_ids:
                        try:
                            self.qdrant.update_entity_mentions(entity_id, synthesis_id)
                        except Exception as e:
                            logger.debug(f"Failed to update mentions for {entity_id}: {e}")

                    # Update relationships
                    if len(resolved_ids) >= 2:
                        try:
                            await self.entity_resolver.update_entity_relationships(
                                entity_ids=resolved_ids,
                                synthesis_id=synthesis_id
                            )
                        except Exception as e:
                            logger.debug(f"Failed to update relationships: {e}")

                self.stats["syntheses_processed"] += 1

                if self.stats["syntheses_processed"] % 10 == 0:
                    logger.info(f"Processed {self.stats['syntheses_processed']} syntheses...")

            except Exception as e:
                logger.error(f"Error processing synthesis {synthesis.get('id', 'unknown')}: {e}")
                self.stats["errors"] += 1

    async def detect_topics(self, time_window_days: int = 90) -> None:
        """Detect topics from all syntheses."""
        logger.info(f"Detecting topics from syntheses (window: {time_window_days} days)...")

        if self.dry_run:
            logger.info("[DRY RUN] Would detect topics from all syntheses")
            return

        try:
            detected_topics = await self.topic_detector.detect_topics(
                time_window_days=time_window_days,
                min_syntheses=2
            )

            for topic in detected_topics:
                if topic.get("is_new"):
                    self.stats["topics_created"] += 1
                else:
                    self.stats["topics_updated"] += 1

            logger.success(f"Detected {len(detected_topics)} topics")

        except Exception as e:
            logger.error(f"Topic detection failed: {e}")
            self.stats["errors"] += 1

    async def aggregate_causal_graphs(self) -> None:
        """Aggregate causal graphs for all topics."""
        logger.info("Aggregating causal graphs for topics...")

        if self.dry_run:
            logger.info("[DRY RUN] Would aggregate causal graphs for all topics")
            return

        try:
            # Get all topics
            topics = self.qdrant.get_topics(limit=100)

            for topic in topics:
                topic_id = topic.get("id", "")
                synthesis_ids = topic.get("synthesis_ids", [])

                if len(synthesis_ids) < 2:
                    continue

                try:
                    aggregated = self.causal_aggregator.aggregate_causal_graphs(
                        synthesis_ids=synthesis_ids,
                        include_timeline=True
                    )

                    if aggregated.get("nodes"):
                        self.qdrant.update_topic_causal_graph(topic_id, aggregated)
                        self.stats["causal_graphs_aggregated"] += 1
                        logger.debug(f"Aggregated graph for topic {topic_id[:8]}... "
                                   f"({len(aggregated['nodes'])} nodes)")

                except Exception as e:
                    logger.warning(f"Failed to aggregate graph for topic {topic_id}: {e}")
                    self.stats["errors"] += 1

            logger.success(f"Aggregated {self.stats['causal_graphs_aggregated']} causal graphs")

        except Exception as e:
            logger.error(f"Causal aggregation failed: {e}")
            self.stats["errors"] += 1

    async def run(self) -> Dict[str, Any]:
        """Run the full migration."""
        start_time = datetime.now()
        logger.info("=" * 60)
        logger.info("Intelligence Hub Migration")
        logger.info("=" * 60)

        if self.dry_run:
            logger.warning("DRY RUN MODE - No changes will be made")

        # Initialize services
        await self.initialize()

        # Check existing data
        existing = await self.check_existing_data()
        logger.info(f"Existing data: {existing['entities']} entities, {existing['topics']} topics")

        if existing["entities"] > 0 or existing["topics"] > 0:
            if not self.force:
                logger.warning("Data already exists. Use --force to re-migrate.")
                return self.stats

        # Get all syntheses
        logger.info("Fetching syntheses...")
        try:
            syntheses = self.qdrant.get_recent_syntheses(hours=24 * 365, limit=1000)  # Last year
            logger.info(f"Found {len(syntheses)} syntheses to process")
        except Exception as e:
            logger.error(f"Failed to fetch syntheses: {e}")
            return self.stats

        if not syntheses:
            logger.warning("No syntheses found to migrate")
            return self.stats

        # Step 1: Migrate entities
        logger.info("-" * 40)
        logger.info("Step 1: Migrating Entities")
        logger.info("-" * 40)
        await self.migrate_entities(syntheses)

        # Step 2: Detect topics
        logger.info("-" * 40)
        logger.info("Step 2: Detecting Topics")
        logger.info("-" * 40)
        await self.detect_topics()

        # Step 3: Aggregate causal graphs
        logger.info("-" * 40)
        logger.info("Step 3: Aggregating Causal Graphs")
        logger.info("-" * 40)
        await self.aggregate_causal_graphs()

        # Summary
        duration = (datetime.now() - start_time).total_seconds()
        logger.info("=" * 60)
        logger.info("Migration Complete")
        logger.info("=" * 60)
        logger.info(f"Duration: {duration:.1f}s")
        logger.info(f"Syntheses processed: {self.stats['syntheses_processed']}")
        logger.info(f"Entities created: {self.stats['entities_created']}")
        logger.info(f"Entities resolved: {self.stats['entities_resolved']}")
        logger.info(f"Topics created: {self.stats['topics_created']}")
        logger.info(f"Topics updated: {self.stats['topics_updated']}")
        logger.info(f"Causal graphs aggregated: {self.stats['causal_graphs_aggregated']}")
        logger.info(f"Errors: {self.stats['errors']}")

        return self.stats


async def main():
    parser = argparse.ArgumentParser(description="Migrate data to Intelligence Hub")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    parser.add_argument("--force", action="store_true", help="Force re-migration even if data exists")
    parser.add_argument("--batch-size", type=int, default=50, help="Number of syntheses to process at once")

    args = parser.parse_args()

    migration = IntelligenceMigration(
        dry_run=args.dry_run,
        force=args.force,
        batch_size=args.batch_size
    )

    try:
        stats = await migration.run()
        sys.exit(0 if stats["errors"] == 0 else 1)
    except KeyboardInterrupt:
        logger.warning("Migration interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
