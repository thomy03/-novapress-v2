"""
Advanced RAG Module for NovaPress AI v2
Implements: Chunking with overlap, Contradiction Detection, Fact Density Scoring, Entity-Centric indexing
"""
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import re
from dataclasses import dataclass
from loguru import logger


@dataclass
class Chunk:
    """Represents a text chunk with metadata"""
    text: str
    source_id: str
    source_name: str
    source_url: str
    chunk_index: int
    start_char: int
    end_char: int


@dataclass
class Contradiction:
    """Represents a detected contradiction between sources"""
    source1_name: str
    source1_text: str
    source2_name: str
    source2_text: str
    similarity_score: float
    contradiction_type: str  # "factual", "sentiment", "temporal"


class AdvancedRAG:
    """Advanced RAG processing with chunking, contradiction detection, and fact scoring"""

    def __init__(self, embedding_service=None):
        self.embedding_service = embedding_service

        # Fact indicators (words that suggest factual content)
        self.fact_indicators = {
            'fr': [
                r'\d{1,2}\s*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)',
                r'\d+\s*%', r'\d+\s*(millions?|milliards?|euros?|dollars?)',
                r'selon\s+\w+', r'a\s+déclaré', r'a\s+annoncé',
                r'officiellement', r'confirme', r'rapport'
            ],
            'en': [
                r'\d{1,2}\s*(january|february|march|april|may|june|july|august|september|october|november|december)',
                r'\d+\s*%', r'\d+\s*(million|billion|euros?|dollars?)',
                r'according to', r'stated', r'announced',
                r'officially', r'confirmed', r'report'
            ]
        }

        # Opinion/hedge indicators (words that suggest opinion, not fact)
        self.hedge_indicators = {
            'fr': [
                r'probablement', r'peut-être', r'semble', r'pourrait',
                r'on pense que', r'il est possible', r'certains estiment',
                r'apparemment', r'vraisemblablement'
            ],
            'en': [
                r'probably', r'maybe', r'seems', r'might', r'could',
                r'it is thought', r'it is possible', r'some believe',
                r'apparently', r'presumably'
            ]
        }

        # Negation patterns for contradiction detection
        self.negation_patterns = {
            'fr': [r'\bne\s+\w+\s+pas\b', r'\baucun\b', r'\bjamais\b', r'\bni\b'],
            'en': [r'\bnot\b', r'\bno\b', r'\bnever\b', r'\bneither\b', r'\bnor\b']
        }

    # ==========================================
    # 1. CHUNKING WITH OVERLAP
    # ==========================================

    def chunk_text(
        self,
        text: str,
        max_tokens: int = 256,
        overlap_tokens: int = 50,
        source_id: str = "",
        source_name: str = "",
        source_url: str = ""
    ) -> List[Chunk]:
        """
        Split text into overlapping chunks for better context preservation.
        Inspired by Google File Search approach.

        Args:
            text: Text to chunk
            max_tokens: Maximum tokens per chunk (approximated as words)
            overlap_tokens: Number of overlapping tokens between chunks
            source_id: ID of the source article
            source_name: Name of the source
            source_url: URL of the source

        Returns:
            List of Chunk objects
        """
        if not text or not text.strip():
            return []

        # Split by sentences first for cleaner chunks
        sentences = self._split_sentences(text)

        chunks = []
        current_chunk_words = []
        current_char_start = 0
        chunk_index = 0

        for sentence in sentences:
            sentence_words = sentence.split()

            # If adding this sentence exceeds max_tokens, save current chunk
            if len(current_chunk_words) + len(sentence_words) > max_tokens and current_chunk_words:
                chunk_text = ' '.join(current_chunk_words)
                chunks.append(Chunk(
                    text=chunk_text,
                    source_id=source_id,
                    source_name=source_name,
                    source_url=source_url,
                    chunk_index=chunk_index,
                    start_char=current_char_start,
                    end_char=current_char_start + len(chunk_text)
                ))
                chunk_index += 1

                # Keep overlap_tokens words for context continuity
                overlap_words = current_chunk_words[-overlap_tokens:] if len(current_chunk_words) > overlap_tokens else current_chunk_words
                current_chunk_words = overlap_words
                current_char_start = current_char_start + len(chunk_text) - len(' '.join(overlap_words))

            current_chunk_words.extend(sentence_words)

        # Don't forget the last chunk
        if current_chunk_words:
            chunk_text = ' '.join(current_chunk_words)
            chunks.append(Chunk(
                text=chunk_text,
                source_id=source_id,
                source_name=source_name,
                source_url=source_url,
                chunk_index=chunk_index,
                start_char=current_char_start,
                end_char=current_char_start + len(chunk_text)
            ))

        return chunks

    def chunk_articles(
        self,
        articles: List[Dict[str, Any]],
        max_tokens: int = 256,
        overlap_tokens: int = 50
    ) -> List[Chunk]:
        """
        Chunk multiple articles into overlapping segments.

        Args:
            articles: List of article dictionaries
            max_tokens: Max tokens per chunk
            overlap_tokens: Overlap between chunks

        Returns:
            List of all chunks from all articles
        """
        all_chunks = []

        for article in articles:
            text = article.get('raw_text', article.get('content', ''))
            title = article.get('raw_title', article.get('title', ''))
            source_id = article.get('id', '')
            source_name = article.get('source_name', article.get('source_domain', 'Unknown'))
            source_url = article.get('url', '')

            # Include title in the first chunk
            full_text = f"{title}. {text}" if title else text

            chunks = self.chunk_text(
                full_text,
                max_tokens=max_tokens,
                overlap_tokens=overlap_tokens,
                source_id=source_id,
                source_name=source_name,
                source_url=source_url
            )
            all_chunks.extend(chunks)

        logger.info(f"Created {len(all_chunks)} chunks from {len(articles)} articles")
        return all_chunks

    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        # Simple sentence splitter (handles French and English)
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    # ==========================================
    # 2. CONTRADICTION DETECTION
    # ==========================================

    def detect_contradictions(
        self,
        articles: List[Dict[str, Any]],
        embeddings: np.ndarray,
        similarity_threshold: float = 0.75,
        sentiment_diff_threshold: float = 0.4
    ) -> List[Contradiction]:
        """
        Detect contradictions between articles in the same cluster.

        High semantic similarity + opposite sentiment/negation = potential contradiction

        Args:
            articles: List of article dictionaries
            embeddings: Pre-computed embeddings for articles
            similarity_threshold: Min similarity to consider as same topic
            sentiment_diff_threshold: Min sentiment difference for contradiction

        Returns:
            List of detected contradictions
        """
        contradictions = []
        n = len(articles)

        if n < 2:
            return contradictions

        # Compute pairwise similarities
        similarity_matrix = np.dot(embeddings, embeddings.T)

        for i in range(n):
            for j in range(i + 1, n):
                similarity = similarity_matrix[i, j]

                # Only check pairs with high semantic similarity (same topic)
                if similarity < similarity_threshold:
                    continue

                text1 = articles[i].get('raw_text', articles[i].get('content', ''))[:1000]
                text2 = articles[j].get('raw_text', articles[j].get('content', ''))[:1000]

                # Check for contradiction signals
                contradiction_type = self._check_contradiction_signals(text1, text2)

                if contradiction_type:
                    source1_name = articles[i].get('source_name', 'Source 1')
                    source2_name = articles[j].get('source_name', 'Source 2')

                    contradictions.append(Contradiction(
                        source1_name=source1_name,
                        source1_text=text1[:200],
                        source2_name=source2_name,
                        source2_text=text2[:200],
                        similarity_score=float(similarity),
                        contradiction_type=contradiction_type
                    ))

                    logger.info(f"Contradiction detected between {source1_name} and {source2_name}: {contradiction_type}")

        return contradictions

    def _check_contradiction_signals(self, text1: str, text2: str) -> Optional[str]:
        """
        Check if two texts show signs of contradiction.

        Returns contradiction type or None if no contradiction detected.
        """
        text1_lower = text1.lower()
        text2_lower = text2.lower()

        # Check for negation asymmetry
        negation_count1 = sum(
            len(re.findall(pattern, text1_lower))
            for patterns in self.negation_patterns.values()
            for pattern in patterns
        )
        negation_count2 = sum(
            len(re.findall(pattern, text2_lower))
            for patterns in self.negation_patterns.values()
            for pattern in patterns
        )

        # Significant negation difference suggests contradiction
        if abs(negation_count1 - negation_count2) >= 3:
            return "factual"

        # Check for contradictory number patterns (e.g., "10%" vs "50%")
        numbers1 = set(re.findall(r'\d+', text1))
        numbers2 = set(re.findall(r'\d+', text2))

        # If both texts have numbers but they're very different
        if numbers1 and numbers2:
            common = numbers1 & numbers2
            if len(common) == 0 and len(numbers1 | numbers2) > 4:
                return "factual"

        # Check for temporal contradiction (different dates for same event)
        dates1 = self._extract_dates(text1)
        dates2 = self._extract_dates(text2)
        if dates1 and dates2 and dates1 != dates2:
            return "temporal"

        return None

    def _extract_dates(self, text: str) -> List[str]:
        """Extract date patterns from text"""
        date_patterns = [
            r'\d{1,2}/\d{1,2}/\d{2,4}',
            r'\d{1,2}\s*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)',
            r'\d{1,2}\s*(january|february|march|april|may|june|july|august|september|october|november|december)',
        ]
        dates = []
        for pattern in date_patterns:
            dates.extend(re.findall(pattern, text.lower()))
        return dates

    # ==========================================
    # 3. FACT DENSITY SCORING
    # ==========================================

    def score_fact_density(self, text: str) -> float:
        """
        Score how fact-dense a text is (0.0 to 1.0).
        Higher score = more facts, fewer opinions.

        Args:
            text: Text to score

        Returns:
            Float between 0 and 1
        """
        if not text:
            return 0.0

        text_lower = text.lower()

        # Count fact indicators
        fact_count = 0
        for lang_patterns in self.fact_indicators.values():
            for pattern in lang_patterns:
                fact_count += len(re.findall(pattern, text_lower))

        # Count hedge/opinion indicators
        hedge_count = 0
        for lang_patterns in self.hedge_indicators.values():
            for pattern in lang_patterns:
                hedge_count += len(re.findall(pattern, text_lower))

        # Count specific entities (numbers, quoted text)
        numbers = len(re.findall(r'\d+', text))
        quotes = len(re.findall(r'[«»""].*?[«»""]', text))

        fact_count += numbers * 0.5 + quotes * 2

        # Compute density score
        total = fact_count + hedge_count + 1  # +1 to avoid division by zero
        density = fact_count / total

        # Normalize to 0-1
        return min(1.0, density)

    def rank_chunks_by_fact_density(self, chunks: List[Chunk]) -> List[Tuple[Chunk, float]]:
        """
        Rank chunks by their fact density.

        Args:
            chunks: List of chunks

        Returns:
            List of (chunk, score) tuples sorted by score descending
        """
        scored = [(chunk, self.score_fact_density(chunk.text)) for chunk in chunks]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored

    # ==========================================
    # 4. ENTITY-CENTRIC INDEXING
    # ==========================================

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extract named entities from text using pattern matching.
        For production, you'd use spaCy NER.

        Args:
            text: Text to extract entities from

        Returns:
            Dict with entity types as keys and lists of entities as values
        """
        entities = {
            'persons': [],
            'organizations': [],
            'locations': [],
            'dates': []
        }

        # Capitalize words (likely proper nouns) - simple heuristic
        capitalized = re.findall(r'\b[A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)*\b', text)

        # Filter common words
        common_words = {'Le', 'La', 'Les', 'Un', 'Une', 'The', 'A', 'An', 'Ce', 'Cette', 'Il', 'Elle'}
        proper_nouns = [w for w in capitalized if w not in common_words and len(w) > 2]

        # Locations (simplified - look for known patterns)
        location_indicators = ['à', 'en', 'au', 'aux', 'in', 'at', 'from']
        for indicator in location_indicators:
            pattern = rf'\b{indicator}\s+([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)*)'
            matches = re.findall(pattern, text)
            entities['locations'].extend(matches)

        # Dates
        entities['dates'] = self._extract_dates(text)

        # Organizations (keywords)
        org_keywords = ['gouvernement', 'ministry', 'company', 'corporation', 'association', 'parti', 'group']
        for keyword in org_keywords:
            pattern = rf'([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)*)\s+{keyword}'
            matches = re.findall(pattern, text, re.IGNORECASE)
            entities['organizations'].extend(matches)

        # Remaining proper nouns likely persons
        used = set(entities['locations'] + entities['organizations'])
        entities['persons'] = [p for p in proper_nouns if p not in used][:10]  # Top 10

        # Deduplicate
        for key in entities:
            entities[key] = list(set(entities[key]))

        return entities

    def build_entity_index(self, articles: List[Dict[str, Any]]) -> Dict[str, List[str]]:
        """
        Build an entity-to-article index.

        Args:
            articles: List of article dictionaries

        Returns:
            Dict mapping entity names to list of article IDs
        """
        entity_index = {}

        for article in articles:
            article_id = article.get('id', str(id(article)))
            text = article.get('raw_text', article.get('content', ''))
            title = article.get('raw_title', article.get('title', ''))

            entities = self.extract_entities(f"{title} {text}")

            # Index all entities
            for entity_type, entity_list in entities.items():
                for entity in entity_list:
                    entity_lower = entity.lower()
                    if entity_lower not in entity_index:
                        entity_index[entity_lower] = []
                    if article_id not in entity_index[entity_lower]:
                        entity_index[entity_lower].append(article_id)

        logger.info(f"Built entity index with {len(entity_index)} unique entities")
        return entity_index

    def search_by_entity(
        self,
        entity_index: Dict[str, List[str]],
        query_entities: List[str]
    ) -> List[str]:
        """
        Find articles mentioning specific entities.

        Args:
            entity_index: Entity-to-article index
            query_entities: List of entity names to search for

        Returns:
            List of article IDs (intersection of all entities)
        """
        if not query_entities:
            return []

        # Find articles for each entity
        article_sets = []
        for entity in query_entities:
            entity_lower = entity.lower()
            if entity_lower in entity_index:
                article_sets.append(set(entity_index[entity_lower]))

        if not article_sets:
            return []

        # Return intersection (articles mentioning ALL entities)
        result = article_sets[0]
        for s in article_sets[1:]:
            result = result & s

        return list(result)

    # ==========================================
    # 5. ENHANCED SYNTHESIS CONTEXT
    # ==========================================

    def prepare_synthesis_context(
        self,
        articles: List[Dict[str, Any]],
        embeddings: np.ndarray,
        max_chunks: int = 10
    ) -> Dict[str, Any]:
        """
        Prepare enhanced context for LLM synthesis.

        Includes:
        - Top chunks by fact density
        - Detected contradictions
        - Entity summary

        Args:
            articles: List of articles
            embeddings: Pre-computed embeddings
            max_chunks: Max chunks to include in context

        Returns:
            Dict with enhanced context for LLM
        """
        # 1. Chunk all articles
        all_chunks = self.chunk_articles(articles)

        # 2. Rank by fact density
        ranked_chunks = self.rank_chunks_by_fact_density(all_chunks)
        top_chunks = ranked_chunks[:max_chunks]

        # 3. Detect contradictions
        contradictions = self.detect_contradictions(articles, embeddings)

        # 4. Extract entities
        entity_index = self.build_entity_index(articles)
        top_entities = sorted(entity_index.keys(), key=lambda e: len(entity_index[e]), reverse=True)[:10]

        return {
            'top_chunks': [
                {
                    'text': chunk.text,
                    'source': chunk.source_name,
                    'url': chunk.source_url,
                    'fact_score': score
                }
                for chunk, score in top_chunks
            ],
            'contradictions': [
                {
                    'source1': c.source1_name,
                    'source2': c.source2_name,
                    'type': c.contradiction_type,
                    'excerpt1': c.source1_text,
                    'excerpt2': c.source2_text
                }
                for c in contradictions
            ],
            'key_entities': top_entities,
            'total_chunks': len(all_chunks),
            'sources_count': len(articles)
        }


# Global instance
advanced_rag = AdvancedRAG()


def get_advanced_rag() -> AdvancedRAG:
    """Dependency injection"""
    return advanced_rag
