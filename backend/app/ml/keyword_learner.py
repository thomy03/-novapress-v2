"""
NovaPress AI - Dynamic Keyword Learning System

This module handles automatic learning of new keywords/themes and their
association with appropriate personas.

Architecture:
1. Extract entities from syntheses using spaCy NLP
2. Track recurrence in Redis with 7-day TTL
3. When threshold reached (>10 occurrences), suggest persona via LLM
4. Store learned associations in Qdrant metadata

Usage:
    learner = KeywordLearner()
    await learner.process_synthesis(synthesis)  # Called after each synthesis
    dynamic_keywords = await learner.get_learned_keywords()  # Load for persona selection
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum

import spacy
import redis.asyncio as redis

from app.core.config import settings
from app.ml.persona import PersonaType, PERSONAS

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════

# Thresholds for keyword learning
RECURRENCE_THRESHOLD = 10       # Minimum occurrences to trigger LLM suggestion
RECURRENCE_WINDOW_DAYS = 7      # Time window for counting occurrences
MIN_KEYWORD_LENGTH = 3          # Minimum keyword length
MAX_KEYWORDS_PER_SYNTHESIS = 15 # Maximum keywords to extract per synthesis

# Redis key prefixes
REDIS_PREFIX = "novapress:keywords"
REDIS_COUNTER_PREFIX = f"{REDIS_PREFIX}:count"
REDIS_LEARNED_PREFIX = f"{REDIS_PREFIX}:learned"
REDIS_PENDING_PREFIX = f"{REDIS_PREFIX}:pending"

# Entity types to track (spaCy labels)
RELEVANT_ENTITY_TYPES = {
    "ORG",      # Organizations: OpenAI, GIEC, ONU
    "PRODUCT",  # Products: ChatGPT, iPhone
    "GPE",      # Geo-political entities: France, Bruxelles
    "PERSON",   # People: Macron, Trump
    "EVENT",    # Events: COP29, G20
    "NORP",     # Nationalities, religious/political groups
    "FAC",      # Facilities: Elysée
    "WORK_OF_ART",  # Titles of books, songs, etc.
    "LAW",      # Named documents/laws
}

# Words to ignore (too common or not meaningful for persona selection)
STOPWORDS = {
    "france", "paris", "europe", "monde", "aujourd'hui", "demain",
    "hier", "annee", "mois", "jour", "semaine", "gouvernement",
    "president", "ministre", "pays", "ville", "region",
    # Common French words
    "plus", "moins", "tout", "tous", "cette", "cela", "fait",
    "selon", "ainsi", "alors", "apres", "avant", "depuis",
}


@dataclass
class LearnedKeyword:
    """A keyword learned from synthesis data"""
    keyword: str
    persona_id: str
    confidence: float
    occurrence_count: int
    first_seen: str  # ISO date
    last_seen: str   # ISO date
    category_associations: List[str]  # Categories where this keyword appeared
    source: str  # "auto" or "llm" or "manual"


@dataclass
class KeywordCandidate:
    """A keyword candidate for LLM evaluation"""
    keyword: str
    count: int
    categories: List[str]
    sample_titles: List[str]


# ═══════════════════════════════════════════════════════════════
# KeywordLearner Class
# ═══════════════════════════════════════════════════════════════

class KeywordLearner:
    """
    Learns new keywords from syntheses and suggests persona associations.

    Uses:
    - spaCy for entity extraction
    - Redis for recurrence counting
    - LLM for persona suggestion (when threshold reached)
    - Qdrant/Redis for storing learned associations
    """

    def __init__(self):
        self.nlp = None
        self.redis_client: Optional[redis.Redis] = None
        self.llm_service = None
        self._initialized = False

    async def initialize(self):
        """Initialize NLP model and Redis connection"""
        if self._initialized:
            return

        try:
            # Load spaCy French model
            try:
                self.nlp = spacy.load("fr_core_news_lg")
                logger.info("✅ KeywordLearner: spaCy fr_core_news_lg loaded")
            except OSError:
                # Fallback to smaller model
                try:
                    self.nlp = spacy.load("fr_core_news_md")
                    logger.info("✅ KeywordLearner: spaCy fr_core_news_md loaded (fallback)")
                except OSError:
                    self.nlp = spacy.load("fr_core_news_sm")
                    logger.info("⚠️ KeywordLearner: spaCy fr_core_news_sm loaded (minimal)")

            # Connect to Redis
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("✅ KeywordLearner: Redis connected")

            self._initialized = True

        except Exception as e:
            logger.error(f"❌ KeywordLearner initialization failed: {e}")
            raise

    async def close(self):
        """Close connections"""
        if self.redis_client:
            await self.redis_client.close()

    # ═══════════════════════════════════════════════════════════════
    # Entity Extraction (spaCy)
    # ═══════════════════════════════════════════════════════════════

    def extract_entities(self, text: str) -> List[Tuple[str, str]]:
        """
        Extract named entities from text using spaCy.

        Args:
            text: Text to analyze (title + body)

        Returns:
            List of (entity_text, entity_type) tuples
        """
        if not self.nlp:
            return []

        # Process text
        doc = self.nlp(text[:10000])  # Limit to avoid memory issues

        entities = []
        seen = set()

        for ent in doc.ents:
            # Filter by entity type
            if ent.label_ not in RELEVANT_ENTITY_TYPES:
                continue

            # Normalize
            entity_text = ent.text.strip().lower()

            # Filter
            if len(entity_text) < MIN_KEYWORD_LENGTH:
                continue
            if entity_text in STOPWORDS:
                continue
            if entity_text in seen:
                continue

            seen.add(entity_text)
            entities.append((entity_text, ent.label_))

        return entities[:MAX_KEYWORDS_PER_SYNTHESIS]

    def extract_noun_chunks(self, text: str) -> List[str]:
        """
        Extract significant noun phrases (for compound terms like "intelligence artificielle").
        """
        if not self.nlp:
            return []

        doc = self.nlp(text[:10000])

        chunks = []
        seen = set()

        for chunk in doc.noun_chunks:
            # Only multi-word chunks
            if len(chunk.text.split()) < 2:
                continue

            chunk_text = chunk.text.strip().lower()

            # Filter
            if len(chunk_text) < 8:  # Minimum 8 chars for compound
                continue
            if chunk_text in seen:
                continue

            seen.add(chunk_text)
            chunks.append(chunk_text)

        return chunks[:10]

    # ═══════════════════════════════════════════════════════════════
    # Recurrence Tracking (Redis)
    # ═══════════════════════════════════════════════════════════════

    async def increment_keyword(
        self,
        keyword: str,
        category: str,
        title: str
    ) -> int:
        """
        Increment keyword counter in Redis.

        Args:
            keyword: The keyword to track
            category: Article category
            title: Article title (for context)

        Returns:
            New count for this keyword
        """
        if not self.redis_client:
            return 0

        key = f"{REDIS_COUNTER_PREFIX}:{keyword}"

        # Increment counter
        count = await self.redis_client.incr(key)

        # Set TTL on first occurrence
        if count == 1:
            await self.redis_client.expire(key, RECURRENCE_WINDOW_DAYS * 86400)

        # Store metadata (categories, sample titles)
        meta_key = f"{REDIS_PENDING_PREFIX}:{keyword}"
        meta = await self.redis_client.hgetall(meta_key) or {}

        # Update categories
        categories = json.loads(meta.get("categories", "[]"))
        if category not in categories:
            categories.append(category)
            categories = categories[-5:]  # Keep last 5

        # Update sample titles
        titles = json.loads(meta.get("titles", "[]"))
        if title not in titles:
            titles.append(title[:100])  # Truncate
            titles = titles[-3:]  # Keep last 3

        await self.redis_client.hset(meta_key, mapping={
            "categories": json.dumps(categories),
            "titles": json.dumps(titles),
            "last_seen": datetime.now().isoformat()
        })
        await self.redis_client.expire(meta_key, RECURRENCE_WINDOW_DAYS * 86400)

        return count

    async def get_keywords_above_threshold(self) -> List[KeywordCandidate]:
        """
        Get all keywords that have exceeded the recurrence threshold.
        These are candidates for LLM persona suggestion.
        """
        if not self.redis_client:
            return []

        candidates = []

        # Scan for counter keys
        cursor = 0
        while True:
            cursor, keys = await self.redis_client.scan(
                cursor=cursor,
                match=f"{REDIS_COUNTER_PREFIX}:*",
                count=100
            )

            for key in keys:
                keyword = key.replace(f"{REDIS_COUNTER_PREFIX}:", "")
                count = int(await self.redis_client.get(key) or 0)

                if count >= RECURRENCE_THRESHOLD:
                    # Check if not already learned
                    learned_key = f"{REDIS_LEARNED_PREFIX}:{keyword}"
                    if await self.redis_client.exists(learned_key):
                        continue

                    # Get metadata
                    meta_key = f"{REDIS_PENDING_PREFIX}:{keyword}"
                    meta = await self.redis_client.hgetall(meta_key) or {}

                    candidates.append(KeywordCandidate(
                        keyword=keyword,
                        count=count,
                        categories=json.loads(meta.get("categories", "[]")),
                        sample_titles=json.loads(meta.get("titles", "[]"))
                    ))

            if cursor == 0:
                break

        return candidates

    # ═══════════════════════════════════════════════════════════════
    # LLM Persona Suggestion
    # ═══════════════════════════════════════════════════════════════

    async def suggest_persona_for_keyword(
        self,
        candidate: KeywordCandidate
    ) -> Optional[LearnedKeyword]:
        """
        Use LLM to suggest the best persona for a keyword.

        Args:
            candidate: Keyword candidate with context

        Returns:
            LearnedKeyword if successful, None otherwise
        """
        # Lazy import to avoid circular dependency
        from app.ml.llm import get_llm_service

        if not self.llm_service:
            self.llm_service = get_llm_service()

        # Build prompt
        personas_list = "\n".join([
            f"- {p.id}: {p.display_name} - {p.tone}"
            for p in PERSONAS.values()
        ])

        prompt = f"""Tu es un expert en attribution de style journalistique.

CONTEXTE:
Le terme "{candidate.keyword}" est apparu {candidate.count} fois dans nos synthèses récentes.
Catégories associées: {', '.join(candidate.categories) or 'diverses'}
Exemples de titres:
{chr(10).join(f'- {t}' for t in candidate.sample_titles)}

PERSONAS DISPONIBLES:
{personas_list}

QUESTION:
Quel persona serait le PLUS PERTINENT pour traiter les sujets contenant "{candidate.keyword}" ?

Réponds en JSON:
{{
  "persona_id": "id_du_persona",
  "confidence": 0.0 à 1.0,
  "rationale": "explication courte"
}}
"""

        try:
            result = await self.llm_service.generate_json(
                prompt,
                temperature=0.3,
                max_tokens=500
            )

            persona_id = result.get("persona_id", "neutral")
            confidence = float(result.get("confidence", 0.5))

            # Validate persona exists
            if persona_id not in [p.value for p in PersonaType]:
                logger.warning(f"LLM suggested unknown persona: {persona_id}")
                return None

            logger.info(
                f"🎓 LLM suggestion: '{candidate.keyword}' → {persona_id} "
                f"(confidence: {confidence:.2f})"
            )

            return LearnedKeyword(
                keyword=candidate.keyword,
                persona_id=persona_id,
                confidence=confidence,
                occurrence_count=candidate.count,
                first_seen=datetime.now().isoformat(),
                last_seen=datetime.now().isoformat(),
                category_associations=candidate.categories,
                source="llm"
            )

        except Exception as e:
            logger.error(f"LLM suggestion failed for '{candidate.keyword}': {e}")
            return None

    # ═══════════════════════════════════════════════════════════════
    # Storage (Redis for now, could be Qdrant/PostgreSQL)
    # ═══════════════════════════════════════════════════════════════

    async def save_learned_keyword(self, learned: LearnedKeyword):
        """Save a learned keyword association to Redis"""
        if not self.redis_client:
            return

        key = f"{REDIS_LEARNED_PREFIX}:{learned.keyword}"

        # Convert dataclass to dict and serialize list fields to JSON
        data = asdict(learned)
        # Redis hset doesn't support lists - serialize to JSON string
        if isinstance(data.get('category_associations'), list):
            data['category_associations'] = json.dumps(data['category_associations'])

        await self.redis_client.hset(key, mapping=data)

        # No expiry - learned keywords persist
        logger.info(f"💾 Saved learned keyword: {learned.keyword} → {learned.persona_id}")

    async def get_learned_keywords(self) -> Dict[str, str]:
        """
        Get all learned keyword→persona mappings.

        Returns:
            Dict[keyword, persona_id]
        """
        if not self.redis_client:
            return {}

        learned = {}

        cursor = 0
        while True:
            cursor, keys = await self.redis_client.scan(
                cursor=cursor,
                match=f"{REDIS_LEARNED_PREFIX}:*",
                count=100
            )

            for key in keys:
                data = await self.redis_client.hgetall(key)
                if data:
                    keyword = data.get("keyword", key.replace(f"{REDIS_LEARNED_PREFIX}:", ""))
                    persona_id = data.get("persona_id", "neutral")
                    learned[keyword] = persona_id

            if cursor == 0:
                break

        return learned

    async def get_all_learned_details(self) -> List[LearnedKeyword]:
        """Get all learned keywords with full details"""
        if not self.redis_client:
            return []

        results = []

        cursor = 0
        while True:
            cursor, keys = await self.redis_client.scan(
                cursor=cursor,
                match=f"{REDIS_LEARNED_PREFIX}:*",
                count=100
            )

            for key in keys:
                data = await self.redis_client.hgetall(key)
                if data:
                    try:
                        # Parse category_associations if it's a string
                        categories = data.get("category_associations", "[]")
                        if isinstance(categories, str):
                            categories = json.loads(categories)

                        results.append(LearnedKeyword(
                            keyword=data.get("keyword", ""),
                            persona_id=data.get("persona_id", "neutral"),
                            confidence=float(data.get("confidence", 0.5)),
                            occurrence_count=int(data.get("occurrence_count", 0)),
                            first_seen=data.get("first_seen", ""),
                            last_seen=data.get("last_seen", ""),
                            category_associations=categories,
                            source=data.get("source", "unknown")
                        ))
                    except Exception as e:
                        logger.warning(f"Failed to parse learned keyword: {e}")

            if cursor == 0:
                break

        return results

    # ═══════════════════════════════════════════════════════════════
    # Main Processing
    # ═══════════════════════════════════════════════════════════════

    async def process_synthesis(
        self,
        synthesis: Dict[str, Any],
        trigger_llm: bool = True
    ) -> List[str]:
        """
        Process a synthesis to extract and track keywords.

        Args:
            synthesis: Synthesis data with title, body, category
            trigger_llm: Whether to trigger LLM for keywords above threshold

        Returns:
            List of extracted keywords
        """
        if not self._initialized:
            await self.initialize()

        title = synthesis.get("title", "")
        body = synthesis.get("body", synthesis.get("summary", ""))
        category = synthesis.get("category", "MONDE")

        # Combine text
        full_text = f"{title}\n\n{body}"

        # Extract entities
        entities = self.extract_entities(full_text)
        keywords = [e[0] for e in entities]

        # Also extract compound nouns
        compounds = self.extract_noun_chunks(full_text)
        keywords.extend(compounds)

        # Deduplicate
        keywords = list(set(keywords))

        # Track each keyword
        for keyword in keywords:
            count = await self.increment_keyword(keyword, category, title)

            if count == RECURRENCE_THRESHOLD and trigger_llm:
                # This keyword just hit the threshold - trigger LLM
                logger.info(f"🎯 Keyword '{keyword}' reached threshold ({count})")

                # Get candidate data
                meta_key = f"{REDIS_PENDING_PREFIX}:{keyword}"
                meta = await self.redis_client.hgetall(meta_key) or {}

                candidate = KeywordCandidate(
                    keyword=keyword,
                    count=count,
                    categories=json.loads(meta.get("categories", "[]")),
                    sample_titles=json.loads(meta.get("titles", "[]"))
                )

                # Trigger LLM suggestion (async, don't wait)
                asyncio.create_task(self._learn_keyword(candidate))

        return keywords

    async def _learn_keyword(self, candidate: KeywordCandidate):
        """Background task to learn a keyword via LLM"""
        try:
            learned = await self.suggest_persona_for_keyword(candidate)
            if learned:
                await self.save_learned_keyword(learned)
        except Exception as e:
            logger.error(f"Failed to learn keyword '{candidate.keyword}': {e}")

    async def process_pending_keywords(self) -> int:
        """
        Process all keywords above threshold that haven't been learned yet.
        Called periodically or manually.

        Returns:
            Number of new keywords learned
        """
        candidates = await self.get_keywords_above_threshold()
        learned_count = 0

        for candidate in candidates:
            learned = await self.suggest_persona_for_keyword(candidate)
            if learned:
                await self.save_learned_keyword(learned)
                learned_count += 1
                await asyncio.sleep(1)  # Rate limiting

        return learned_count


# ═══════════════════════════════════════════════════════════════
# Singleton and Factory
# ═══════════════════════════════════════════════════════════════

_keyword_learner: Optional[KeywordLearner] = None


async def get_keyword_learner() -> KeywordLearner:
    """Get or create the global KeywordLearner instance"""
    global _keyword_learner

    if _keyword_learner is None:
        _keyword_learner = KeywordLearner()
        await _keyword_learner.initialize()

    return _keyword_learner


async def get_dynamic_keywords() -> Dict[str, str]:
    """
    Get all dynamic keywords for persona selection.

    Returns:
        Dict[keyword, persona_id] of learned associations
    """
    try:
        learner = await get_keyword_learner()
        return await learner.get_learned_keywords()
    except Exception as e:
        logger.warning(f"Failed to load dynamic keywords: {e}")
        return {}
