"""
Entity Resolution Service for Intelligence Hub
Resolves entity mentions to canonical entities using:
1. Exact match (normalized)
2. Fuzzy match (Levenshtein distance)
3. Semantic match (embedding similarity)
"""
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import defaultdict
import re
import unicodedata
from loguru import logger
from datetime import datetime

from app.core.config import settings


class EntityResolutionService:
    """
    Resolves entity mentions to canonical entities.
    Uses fuzzy matching + embedding similarity for disambiguation.
    """

    def __init__(self):
        self.embedding_service = None
        self.qdrant_service = None
        self.nlp = None

        # Thresholds for matching
        self.exact_match_threshold = 1.0
        self.fuzzy_match_threshold = 0.85  # Levenshtein similarity
        self.semantic_match_threshold = 0.90  # Embedding similarity

        # Cache for resolved entities (session-level)
        self._resolution_cache: Dict[str, str] = {}  # mention -> entity_id

        # Common aliases and variations
        self.COMMON_ALIASES = {
            # Politicians - France
            "macron": "Emmanuel Macron",
            "e. macron": "Emmanuel Macron",
            "le président macron": "Emmanuel Macron",
            "le président de la république": "Emmanuel Macron",
            "marine le pen": "Marine Le Pen",
            "mélenchon": "Jean-Luc Mélenchon",
            "jlm": "Jean-Luc Mélenchon",

            # Politicians - International
            "biden": "Joe Biden",
            "trump": "Donald Trump",
            "poutine": "Vladimir Putin",
            "putin": "Vladimir Putin",
            "zelensky": "Volodymyr Zelensky",
            "zelenskyy": "Volodymyr Zelensky",
            "xi": "Xi Jinping",
            "xi jinping": "Xi Jinping",

            # Organizations
            "onu": "Organisation des Nations Unies",
            "un": "Organisation des Nations Unies",
            "united nations": "Organisation des Nations Unies",
            "ue": "Union Européenne",
            "eu": "Union Européenne",
            "european union": "Union Européenne",
            "otan": "OTAN",
            "nato": "OTAN",
            "fmi": "Fonds Monétaire International",
            "imf": "Fonds Monétaire International",

            # Tech companies
            "google": "Google",
            "alphabet": "Google",
            "meta": "Meta",
            "facebook": "Meta",
            "fb": "Meta",
            "microsoft": "Microsoft",
            "msft": "Microsoft",
            "apple": "Apple",
            "aapl": "Apple",
            "amazon": "Amazon",
            "amzn": "Amazon",
            "tesla": "Tesla",
            "tsla": "Tesla",
            "openai": "OpenAI",
            "open ai": "OpenAI",
        }

    async def initialize(self):
        """Initialize services"""
        try:
            from app.ml.embeddings import embedding_service
            from app.db.qdrant_client import qdrant_service

            self.embedding_service = embedding_service
            self.qdrant_service = qdrant_service

            # Load spaCy for NER
            import spacy
            try:
                self.nlp = spacy.load(settings.SPACY_MODEL)
                logger.success("✅ Entity Resolution Service initialized")
            except OSError:
                logger.warning(f"⚠️ spaCy model '{settings.SPACY_MODEL}' not found")
                self.nlp = None

        except Exception as e:
            logger.error(f"Failed to initialize Entity Resolution Service: {e}")
            raise

    def normalize_entity(self, text: str) -> str:
        """
        Normalize an entity mention for comparison.

        Steps:
        1. Convert to lowercase
        2. Remove accents (NFD normalization)
        3. Remove extra whitespace
        4. Remove common prefixes/suffixes (Mr., Dr., etc.)
        """
        # Lowercase
        text = text.lower().strip()

        # Remove accents
        text = unicodedata.normalize('NFD', text)
        text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')

        # Remove common prefixes/suffixes
        prefixes = ['mr.', 'mr ', 'mme.', 'mme ', 'dr.', 'dr ', 'prof.', 'prof ',
                    'président ', 'president ', 'ministre ', 'minister ',
                    'le ', 'la ', 'les ', 'l\'', 'the ']
        for prefix in prefixes:
            if text.startswith(prefix):
                text = text[len(prefix):]

        # Remove extra whitespace
        text = ' '.join(text.split())

        return text

    def levenshtein_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate Levenshtein similarity (0.0 to 1.0).
        1.0 = identical, 0.0 = completely different
        """
        if s1 == s2:
            return 1.0

        len1, len2 = len(s1), len(s2)
        if len1 == 0 or len2 == 0:
            return 0.0

        # Create distance matrix
        matrix = [[0] * (len2 + 1) for _ in range(len1 + 1)]

        for i in range(len1 + 1):
            matrix[i][0] = i
        for j in range(len2 + 1):
            matrix[0][j] = j

        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                cost = 0 if s1[i-1] == s2[j-1] else 1
                matrix[i][j] = min(
                    matrix[i-1][j] + 1,      # deletion
                    matrix[i][j-1] + 1,      # insertion
                    matrix[i-1][j-1] + cost  # substitution
                )

        distance = matrix[len1][len2]
        max_len = max(len1, len2)
        return 1.0 - (distance / max_len)

    async def resolve_entity(
        self,
        mention: str,
        entity_type: str,
        context: str = ""
    ) -> Tuple[str, bool]:
        """
        Resolve a mention to an existing entity or create new.

        Resolution strategy:
        1. Check session cache
        2. Check common aliases
        3. Exact match (normalized)
        4. Fuzzy match (Levenshtein > 0.85)
        5. Semantic match (embedding similarity > 0.90)
        6. Create new entity if no match

        Args:
            mention: The entity mention text
            entity_type: Type (PERSON, ORG, GPE, LOC, EVENT, PRODUCT)
            context: Optional context for better disambiguation

        Returns:
            (entity_id, is_new) - entity_id and whether it was newly created
        """
        if not self.qdrant_service:
            logger.warning("Qdrant service not initialized, returning temporary ID")
            return mention, True

        # Normalize the mention
        normalized = self.normalize_entity(mention)

        # Check session cache
        cache_key = f"{entity_type}:{normalized}"
        if cache_key in self._resolution_cache:
            return self._resolution_cache[cache_key], False

        # Check common aliases
        if normalized in self.COMMON_ALIASES:
            canonical_name = self.COMMON_ALIASES[normalized]
            normalized = self.normalize_entity(canonical_name)
            mention = canonical_name  # Use canonical for display

        # Search existing entities of same type by name
        existing_entities = self.qdrant_service.search_entities_by_name(
            name=normalized[:20],  # Use partial name for search
            entity_type=entity_type,
            limit=20
        )

        # 1. Exact match check
        for entity in existing_entities:
            entity_normalized = self.normalize_entity(entity.get("canonical_name", ""))
            if entity_normalized == normalized:
                entity_id = entity["id"]
                self._resolution_cache[cache_key] = entity_id
                logger.debug(f"Entity resolved (exact): '{mention}' -> '{entity['canonical_name']}'")
                return entity_id, False

            # Check aliases
            for alias in entity.get("aliases", []):
                alias_normalized = self.normalize_entity(alias)
                if alias_normalized == normalized:
                    entity_id = entity["id"]
                    self._resolution_cache[cache_key] = entity_id
                    logger.debug(f"Entity resolved (alias): '{mention}' -> '{entity['canonical_name']}'")
                    return entity_id, False

        # 2. Fuzzy match check
        for entity in existing_entities:
            entity_normalized = self.normalize_entity(entity.get("canonical_name", ""))
            similarity = self.levenshtein_similarity(normalized, entity_normalized)

            if similarity >= self.fuzzy_match_threshold:
                entity_id = entity["id"]
                self._resolution_cache[cache_key] = entity_id

                # Add this mention as an alias if not already present
                await self._add_alias(entity_id, mention)

                logger.debug(f"Entity resolved (fuzzy {similarity:.2f}): '{mention}' -> '{entity['canonical_name']}'")
                return entity_id, False

        # 3. Semantic match check (if embedding service available)
        if self.embedding_service:
            try:
                # Generate embedding for the mention with context
                text_to_embed = f"{mention} {entity_type}" if not context else f"{mention} {entity_type} {context[:100]}"
                # encode() returns array of embeddings, take first one
                embeddings = self.embedding_service.encode([text_to_embed])
                mention_embedding = embeddings[0] if len(embeddings) > 0 else None

                if mention_embedding is not None and len(mention_embedding) > 0:
                    # Search by embedding
                    similar_entities = self.qdrant_service.search_entities_by_embedding(
                        query_embedding=mention_embedding.tolist() if hasattr(mention_embedding, 'tolist') else mention_embedding,
                        entity_type=entity_type,
                        limit=5
                    )

                    for entity in similar_entities:
                        if entity.get("similarity_score", 0) >= self.semantic_match_threshold:
                            entity_id = entity["id"]
                            self._resolution_cache[cache_key] = entity_id

                            # Add as alias
                            await self._add_alias(entity_id, mention)

                            logger.debug(f"Entity resolved (semantic {entity['similarity_score']:.2f}): '{mention}' -> '{entity['canonical_name']}'")
                            return entity_id, False

            except Exception as e:
                logger.debug(f"Semantic matching failed: {e}")

        # 4. No match found - create new entity
        entity_id = await self._create_entity(mention, entity_type, context)
        self._resolution_cache[cache_key] = entity_id
        logger.debug(f"New entity created: '{mention}' ({entity_type}) -> {entity_id[:8]}...")

        return entity_id, True

    async def _create_entity(
        self,
        canonical_name: str,
        entity_type: str,
        context: str = ""
    ) -> str:
        """Create a new entity in the database."""
        import uuid
        from datetime import datetime

        entity_id = str(uuid.uuid4())

        # Generate embedding for the entity
        text_to_embed = f"{canonical_name} {entity_type}"
        if context:
            text_to_embed += f" {context[:100]}"

        embedding = None
        if self.embedding_service:
            try:
                # encode() returns array of embeddings, take first one
                embeddings = self.embedding_service.encode([text_to_embed])
                embedding = embeddings[0] if len(embeddings) > 0 else None
                if embedding is not None and hasattr(embedding, 'tolist'):
                    embedding = embedding.tolist()
            except Exception as e:
                logger.warning(f"Failed to generate entity embedding: {e}")

        if embedding is None:
            # Fallback to random embedding if service fails
            import numpy as np
            embedding = np.random.randn(settings.EMBEDDING_DIMENSION).tolist()

        entity = {
            "id": entity_id,
            "canonical_name": canonical_name,
            "aliases": [],
            "entity_type": entity_type.upper(),
            "description": "",
            "first_seen": datetime.now().timestamp(),
            "last_seen": datetime.now().timestamp(),
            "mention_count": 1,
            "synthesis_ids": [],
            "as_cause_count": 0,
            "as_effect_count": 0,
            "related_entities": [],
            "topics": []
        }

        self.qdrant_service.upsert_entity(entity, embedding)

        return entity_id

    async def _add_alias(self, entity_id: str, alias: str) -> bool:
        """Add an alias to an existing entity."""
        try:
            entity = self.qdrant_service.get_entity_by_id(entity_id)
            if not entity:
                return False

            aliases = entity.get("aliases", [])
            normalized_alias = self.normalize_entity(alias)

            # Check if alias already exists (normalized)
            existing_normalized = [self.normalize_entity(a) for a in aliases]
            if normalized_alias not in existing_normalized:
                aliases.append(alias)
                entity["aliases"] = aliases

                # Re-upsert
                from app.db.qdrant_client import qdrant_service
                result = qdrant_service.client.retrieve(
                    collection_name=qdrant_service.entities_collection,
                    ids=[entity_id],
                    with_vectors=True
                )
                if result and result[0].vector:
                    qdrant_service.upsert_entity(entity, result[0].vector)
                    return True

            return False

        except Exception as e:
            logger.warning(f"Failed to add alias: {e}")
            return False

    async def resolve_entities_batch(
        self,
        mentions: List[Tuple[str, str]],
        context: str = ""
    ) -> List[Tuple[str, bool]]:
        """
        Resolve multiple entity mentions in batch.

        Args:
            mentions: List of (mention_text, entity_type) tuples
            context: Optional shared context

        Returns:
            List of (entity_id, is_new) tuples
        """
        results = []
        for mention, entity_type in mentions:
            entity_id, is_new = await self.resolve_entity(mention, entity_type, context)
            results.append((entity_id, is_new))
        return results

    def extract_and_resolve_entities(
        self,
        text: str,
        context: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Extract entities from text using spaCy and resolve them.

        Args:
            text: Text to extract entities from
            context: Optional context for resolution

        Returns:
            List of resolved entity dictionaries
        """
        if not self.nlp:
            logger.warning("spaCy not initialized, skipping entity extraction")
            return []

        doc = self.nlp(text[:10000])  # Limit text length

        entity_types = {"ORG", "PERSON", "GPE", "LOC", "EVENT", "PRODUCT"}
        entities = []
        seen_mentions = set()

        for ent in doc.ents:
            if ent.label_ in entity_types:
                mention = ent.text.strip()
                if mention and mention not in seen_mentions:
                    seen_mentions.add(mention)
                    entities.append({
                        "mention": mention,
                        "type": ent.label_,
                        "start": ent.start_char,
                        "end": ent.end_char
                    })

        return entities

    async def update_entity_relationships(
        self,
        entity_ids: List[str],
        synthesis_id: str
    ):
        """
        Update co-occurrence relationships between entities that appear in the same synthesis.

        Args:
            entity_ids: List of entity IDs that co-occur
            synthesis_id: The synthesis where they co-occur
        """
        if len(entity_ids) < 2:
            return

        # For each pair of entities, add to related_entities
        for i, entity_id in enumerate(entity_ids):
            try:
                entity = self.qdrant_service.get_entity_by_id(entity_id)
                if not entity:
                    continue

                related = entity.get("related_entities", [])
                for j, other_id in enumerate(entity_ids):
                    if i != j and other_id not in related:
                        related.append(other_id)

                entity["related_entities"] = related[:50]  # Limit to top 50 relations

                # Re-upsert
                result = self.qdrant_service.client.retrieve(
                    collection_name=self.qdrant_service.entities_collection,
                    ids=[entity_id],
                    with_vectors=True
                )
                if result and result[0].vector:
                    self.qdrant_service.upsert_entity(entity, result[0].vector)

            except Exception as e:
                logger.warning(f"Failed to update entity relationships: {e}")

    def clear_cache(self):
        """Clear the session resolution cache."""
        self._resolution_cache.clear()
        logger.debug("Entity resolution cache cleared")


# Global instance
entity_resolution_service = EntityResolutionService()


async def init_entity_resolution():
    """Initialize entity resolution service"""
    await entity_resolution_service.initialize()


def get_entity_resolution_service() -> EntityResolutionService:
    """Dependency injection for FastAPI"""
    return entity_resolution_service
