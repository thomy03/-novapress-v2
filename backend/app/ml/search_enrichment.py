"""
Search Enrichment Module for NovaPress AI v2
Integrates Perplexity Sonar and xAI Grok for enhanced synthesis context.

Features:
- Perplexity Sonar: Real-time web search for fact-checking and context
- xAI Grok: X/Twitter sentiment and breaking news
- Combines both for comprehensive enrichment
- Retry logic with exponential backoff for API resilience
- Circuit breaker pattern to prevent cascading failures
"""
from typing import List, Dict, Any, Optional, TypeVar, Callable
from dataclasses import dataclass, field
import httpx
import asyncio
import random
from datetime import datetime
from loguru import logger

from app.core.config import settings
from app.core.circuit_breaker import get_circuit_breaker, CircuitOpenError

T = TypeVar('T')


async def retry_with_backoff(
    func: Callable[..., T],
    *args,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    retryable_status_codes: tuple = (429, 500, 502, 503, 504),
    **kwargs
) -> T:
    """
    Retry an async function with exponential backoff.

    Args:
        func: Async function to retry
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds
        max_delay: Maximum delay cap in seconds
        retryable_status_codes: HTTP status codes that trigger a retry
    """
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except httpx.HTTPStatusError as e:
            if e.response.status_code not in retryable_status_codes:
                raise
            last_exception = e
            status_code = e.response.status_code
        except (httpx.TimeoutException, httpx.ConnectError) as e:
            last_exception = e
            status_code = "timeout/connect"
        except Exception as e:
            # Don't retry on unexpected errors
            raise

        if attempt < max_retries:
            # Exponential backoff with jitter
            delay = min(base_delay * (2 ** attempt) + random.uniform(0, 1), max_delay)
            logger.warning(f"API call failed ({status_code}), retrying in {delay:.1f}s (attempt {attempt + 1}/{max_retries})")
            await asyncio.sleep(delay)

    # All retries exhausted
    logger.error(f"API call failed after {max_retries} retries")
    raise last_exception


@dataclass
class SearchResult:
    """Single search result with source"""
    content: str
    source: str
    url: str = ""
    relevance_score: float = 0.0


@dataclass
class EnrichedContext:
    """Combined enrichment from all search APIs"""
    # Perplexity results
    perplexity_context: str = ""
    perplexity_sources: List[Dict[str, str]] = field(default_factory=list)

    # Grok results
    grok_context: str = ""
    social_sentiment: str = ""  # positive, negative, neutral, mixed
    trending_reactions: List[str] = field(default_factory=list)

    # Combined
    fact_check_notes: List[str] = field(default_factory=list)
    additional_context: str = ""
    enrichment_timestamp: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "perplexity_context": self.perplexity_context,
            "perplexity_sources": self.perplexity_sources,
            "grok_context": self.grok_context,
            "social_sentiment": self.social_sentiment,
            "trending_reactions": self.trending_reactions,
            "fact_check_notes": self.fact_check_notes,
            "additional_context": self.additional_context,
            "enrichment_timestamp": self.enrichment_timestamp
        }


class PerplexityClient:
    """
    Perplexity Sonar API Client for real-time web search.

    Docs: https://docs.perplexity.ai/
    Models: sonar (search), sonar-pro (advanced)
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or getattr(settings, 'PERPLEXITY_API_KEY', '')
        self.base_url = "https://api.perplexity.ai"
        self.model = "sonar"  # or "sonar-pro" for advanced
        self.circuit_breaker = get_circuit_breaker("perplexity")

    async def search_context(
        self,
        query: str,
        max_tokens: int = 500
    ) -> Dict[str, Any]:
        """
        Search for additional context using Perplexity Sonar.

        Args:
            query: Search query (topic or question)
            max_tokens: Max response tokens

        Returns:
            Dict with content and sources
        """
        if not self.api_key:
            logger.warning("Perplexity API key not configured")
            return {"content": "", "sources": []}

        async def _make_request():
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a research assistant. Provide factual, well-sourced information about current events. Be concise and cite sources."
                            },
                            {
                                "role": "user",
                                "content": f"Recherche les dernières informations sur: {query}\n\nFournis un résumé factuel avec les sources."
                            }
                        ],
                        "max_tokens": max_tokens,
                        "return_citations": True
                    }
                )
                response.raise_for_status()
                return response.json()

        try:
            # Use circuit breaker to protect against cascading failures
            data = await self.circuit_breaker.call(
                retry_with_backoff, _make_request, max_retries=3, base_delay=2.0
            )
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            citations = data.get("citations", [])

            # Handle citations - can be strings (URLs) or dicts
            sources = []
            for c in citations:
                if isinstance(c, str):
                    sources.append({"url": c, "title": c})
                elif isinstance(c, dict):
                    sources.append({
                        "url": c.get("url", ""),
                        "title": c.get("title", c.get("url", ""))
                    })

            logger.success(f"Perplexity search: {len(sources)} sources found")
            return {"content": content, "sources": sources}

        except CircuitOpenError as e:
            logger.warning(f"Perplexity circuit breaker open: {e}")
            return {"content": "", "sources": []}
        except Exception as e:
            logger.error(f"Perplexity search failed after retries: {e}")
            return {"content": "", "sources": []}

    async def fact_check(
        self,
        claims: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Fact-check specific claims using web search.

        Args:
            claims: List of claims to verify

        Returns:
            List of fact-check results
        """
        if not self.api_key or not claims:
            return []

        async def _check_claim(claim: str) -> Dict[str, Any]:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a fact-checker. Verify claims with current sources. Respond with: VERIFIED, PARTIALLY TRUE, UNVERIFIED, or FALSE, followed by brief explanation."
                            },
                            {
                                "role": "user",
                                "content": f"Vérifie cette affirmation: {claim}"
                            }
                        ],
                        "max_tokens": 200
                    }
                )
                response.raise_for_status()
                return response.json()

        results = []
        for claim in claims[:3]:  # Limit to 3 claims to avoid rate limits
            try:
                data = await retry_with_backoff(
                    _check_claim, claim,
                    max_retries=2, base_delay=1.5
                )
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                results.append({
                    "claim": claim,
                    "result": content
                })
            except Exception as e:
                logger.error(f"Fact-check failed for '{claim[:50]}...': {e}")

        return results


class GrokClient:
    """
    xAI Grok API Client for X/Twitter sentiment and real-time social context.

    Docs: https://docs.x.ai/
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or getattr(settings, 'XAI_API_KEY', '')
        self.base_url = "https://api.x.ai/v1"
        self.model = "grok-2-latest"  # or "grok-2-mini" for faster
        self.circuit_breaker = get_circuit_breaker("xai")

    async def get_social_context(
        self,
        topic: str,
        max_tokens: int = 400
    ) -> Dict[str, Any]:
        """
        Get social media context and sentiment for a topic.

        Args:
            topic: Topic to analyze
            max_tokens: Max response tokens

        Returns:
            Dict with social context and sentiment
        """
        if not self.api_key:
            logger.warning("xAI/Grok API key not configured")
            return {"content": "", "sentiment": "unknown", "reactions": []}

        async def _make_request():
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": """You are a social media analyst with access to X/Twitter.
Analyze the current social sentiment and reactions around a topic.
Respond in JSON format:
{
    "sentiment": "positive|negative|neutral|mixed",
    "summary": "brief summary of social reactions",
    "key_reactions": ["reaction1", "reaction2", "reaction3"],
    "trending_hashtags": ["#tag1", "#tag2"]
}"""
                            },
                            {
                                "role": "user",
                                "content": f"Analyse le sentiment social sur X/Twitter pour: {topic}"
                            }
                        ],
                        "max_tokens": max_tokens
                    }
                )
                response.raise_for_status()
                return response.json()

        try:
            # Use circuit breaker to protect against cascading failures
            data = await self.circuit_breaker.call(
                retry_with_backoff, _make_request, max_retries=3, base_delay=2.0
            )
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

            # Try to parse JSON response
            try:
                import json
                parsed = json.loads(content)
                logger.success(f"Grok social analysis: sentiment={parsed.get('sentiment', 'unknown')}")
                return {
                    "content": parsed.get("summary", ""),
                    "sentiment": parsed.get("sentiment", "unknown"),
                    "reactions": parsed.get("key_reactions", []),
                    "hashtags": parsed.get("trending_hashtags", [])
                }
            except json.JSONDecodeError:
                return {
                    "content": content,
                    "sentiment": "unknown",
                    "reactions": [],
                    "hashtags": []
                }

        except CircuitOpenError as e:
            logger.warning(f"Grok circuit breaker open: {e}")
            return {"content": "", "sentiment": "unknown", "reactions": []}
        except Exception as e:
            logger.error(f"Grok social context failed after retries: {e}")
            return {"content": "", "sentiment": "unknown", "reactions": []}

    async def get_breaking_context(
        self,
        topic: str
    ) -> str:
        """
        Get breaking news context from X/Twitter.

        Args:
            topic: Topic to search

        Returns:
            Breaking news summary
        """
        if not self.api_key:
            return ""

        async def _make_request():
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You have access to real-time X/Twitter data. Provide the latest breaking updates on the topic. Be concise and factual."
                            },
                            {
                                "role": "user",
                                "content": f"Quelles sont les dernières actualités sur X concernant: {topic}"
                            }
                        ],
                        "max_tokens": 300
                    }
                )
                response.raise_for_status()
                return response.json()

        try:
            # Use circuit breaker to protect against cascading failures
            data = await self.circuit_breaker.call(
                retry_with_backoff, _make_request, max_retries=2, base_delay=1.5
            )
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")
        except CircuitOpenError as e:
            logger.warning(f"Grok circuit breaker open: {e}")
            return ""
        except Exception as e:
            logger.error(f"Grok breaking context failed after retries: {e}")
            return ""


class SearchEnrichmentEngine:
    """
    Main engine for search-based synthesis enrichment.
    Combines Perplexity and Grok for comprehensive context.
    """

    def __init__(self):
        self.perplexity = PerplexityClient()
        self.grok = GrokClient()

    def set_api_keys(self, perplexity_key: str = None, xai_key: str = None):
        """Set API keys after initialization"""
        if perplexity_key:
            self.perplexity.api_key = perplexity_key
        if xai_key:
            self.grok.api_key = xai_key

    async def enrich_cluster(
        self,
        cluster_topic: str,
        key_entities: List[str] = None,
        claims_to_verify: List[str] = None,
        use_perplexity: bool = True,
        use_grok: bool = True
    ) -> EnrichedContext:
        """
        Enrich a cluster with search-based context.

        Args:
            cluster_topic: Main topic of the cluster
            key_entities: Important entities to research
            claims_to_verify: Specific claims for fact-checking
            use_perplexity: Enable Perplexity search
            use_grok: Enable Grok social context

        Returns:
            EnrichedContext with all gathered information
        """
        context = EnrichedContext(
            enrichment_timestamp=datetime.now().isoformat()
        )

        tasks = []

        # Perplexity: Web context + fact-checking
        if use_perplexity and self.perplexity.api_key:
            tasks.append(self._get_perplexity_context(cluster_topic, claims_to_verify))

        # Grok: Social sentiment + breaking news
        if use_grok and self.grok.api_key:
            tasks.append(self._get_grok_context(cluster_topic))

        if not tasks:
            logger.warning("No search APIs configured for enrichment")
            return context

        # Run all enrichment tasks in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Enrichment task failed: {result}")
                continue

            if isinstance(result, dict):
                if "perplexity_context" in result:
                    context.perplexity_context = result["perplexity_context"]
                    context.perplexity_sources = result.get("perplexity_sources", [])
                    context.fact_check_notes = result.get("fact_check_notes", [])

                if "grok_context" in result:
                    context.grok_context = result["grok_context"]
                    context.social_sentiment = result.get("social_sentiment", "")
                    context.trending_reactions = result.get("trending_reactions", [])

        # Combine into additional context
        context.additional_context = self._format_combined_context(context)

        logger.success(f"Enrichment complete: Perplexity={bool(context.perplexity_context)}, Grok={bool(context.grok_context)}")
        return context

    async def _get_perplexity_context(
        self,
        topic: str,
        claims: List[str] = None
    ) -> Dict[str, Any]:
        """Get Perplexity search context and fact-checks"""
        result = {
            "perplexity_context": "",
            "perplexity_sources": [],
            "fact_check_notes": []
        }

        # Main search
        search_result = await self.perplexity.search_context(topic)
        result["perplexity_context"] = search_result.get("content", "")
        result["perplexity_sources"] = search_result.get("sources", [])

        # Fact-checking
        if claims:
            fact_checks = await self.perplexity.fact_check(claims)
            result["fact_check_notes"] = [
                f"{fc['claim']}: {fc['result']}"
                for fc in fact_checks
            ]

        return result

    async def _get_grok_context(self, topic: str) -> Dict[str, Any]:
        """Get Grok social context and breaking news"""
        result = {
            "grok_context": "",
            "social_sentiment": "",
            "trending_reactions": [],
            "has_breaking": False
        }

        # Social sentiment analysis
        social = await self.grok.get_social_context(topic)
        result["grok_context"] = social.get("content", "")
        result["social_sentiment"] = social.get("sentiment", "")
        result["trending_reactions"] = social.get("reactions", [])

        # Breaking news (enabled via config)
        if getattr(settings, 'ENABLE_BREAKING_NEWS', False):
            try:
                breaking = await self.grok.get_breaking_context(topic)
                if breaking:
                    result["grok_context"] += f"\n\n🔴 DERNIERE HEURE: {breaking}"
                    result["has_breaking"] = True
                    logger.info(f"Breaking news found for topic: {topic[:50]}...")
            except Exception as e:
                logger.warning(f"Breaking news fetch failed (non-critical): {e}")
                result["has_breaking"] = False

        return result

    def _format_combined_context(self, context: EnrichedContext) -> str:
        """Format all enrichment data for LLM prompt"""
        sections = []

        if context.perplexity_context:
            sections.append(f"""
🔍 CONTEXTE WEB (Perplexity):
{context.perplexity_context}
""")

            if context.perplexity_sources:
                sources_str = "\n".join([
                    f"  • {s.get('title', s.get('url', '')) if isinstance(s, dict) else s}"
                    for s in context.perplexity_sources[:5]
                ])
                sections.append(f"Sources web:\n{sources_str}")

        if context.fact_check_notes:
            notes = "\n".join([f"  • {n}" for n in context.fact_check_notes])
            sections.append(f"""
✅ VÉRIFICATION DES FAITS:
{notes}
""")

        if context.grok_context:
            sections.append(f"""
🐦 CONTEXTE SOCIAL (X/Twitter):
Sentiment: {context.social_sentiment.upper() if context.social_sentiment else 'N/A'}
{context.grok_context}
""")

            if context.trending_reactions:
                reactions = ", ".join(context.trending_reactions[:5])
                sections.append(f"Réactions tendance: {reactions}")

        return "\n".join(sections) if sections else ""

    def format_for_llm_prompt(self, context: EnrichedContext) -> str:
        """
        Format enriched context for inclusion in LLM synthesis prompt.

        Args:
            context: EnrichedContext object

        Returns:
            Formatted string for LLM prompt
        """
        if not context.additional_context:
            return ""

        return f"""
╔══════════════════════════════════════════════════════════════╗
║  🌐 ENRICHISSEMENT SEARCH ({context.enrichment_timestamp[:10]})
╚══════════════════════════════════════════════════════════════╝

{context.additional_context}

📝 CONSIGNE: Utilise ce contexte additionnel pour enrichir ta synthèse.
   Cite les sources web si pertinent. Mentionne le sentiment social si significatif.
"""


# ═══════════════════════════════════════════════════════════════
# COST CONTROL - Phase 6 Scraping Improvement Plan
# ═══════════════════════════════════════════════════════════════

# Source tiers for cost control decisions
# Tier 1 = Major sources (justify Perplexity cost if scraping fails)
# Tier 2 = Standard sources
# Tier 3 = Minor sources (never use expensive APIs)
SOURCE_TIERS: Dict[int, List[str]] = {
    1: [
        "lemonde.fr", "lefigaro.fr", "nytimes.com", "theguardian.com",
        "bbc.com", "reuters.com", "washingtonpost.com", "ft.com",
        "economist.com", "wsj.com", "bloomberg.com"
    ],
    2: [
        "liberation.fr", "20minutes.fr", "franceinfo.fr", "cnn.com",
        "techcrunch.com", "theverge.com", "wired.com", "france24.com"
    ],
    3: []  # Minor sources
}


def get_source_tier(domain: str) -> int:
    """Get tier level for a source domain"""
    domain_clean = domain.lower().replace("www.", "")
    for tier, domains in SOURCE_TIERS.items():
        if domain_clean in domains:
            return tier
    return 2  # Default to tier 2


def should_use_perplexity(
    scrape_success: bool,
    content_length: int,
    topic_importance: str = "normal",
    source_tier: int = 2,
    min_content_length: int = 500
) -> tuple[bool, str]:
    """
    Decide if we should call Perplexity API (cost control).

    COST CONTROL RULES:
    1. Scraping OK (>500 chars) → NEVER use Perplexity (cost = 0)
    2. Scraping KO + Breaking/Hot → Perplexity OK (justified)
    3. Scraping KO + Normal + Source Tier 1 → Perplexity OK (important source)
    4. Scraping KO + Minor topic → NO Perplexity (not worth the cost)

    Args:
        scrape_success: Was the scrape successful?
        content_length: Length of scraped content
        topic_importance: "breaking", "hot", "normal", or "minor"
        source_tier: 1 (major), 2 (standard), 3 (minor)
        min_content_length: Minimum content length to consider scrape "successful"

    Returns:
        Tuple of (should_use: bool, reason: str)
    """
    # Rule 1: Successful scrape = no need for expensive API
    if scrape_success and content_length >= min_content_length:
        return False, "scrape_success"

    # Rule 4: Minor topic = not worth API cost
    if topic_importance == "minor":
        return False, "minor_topic"

    # Rule 2: Breaking/Hot = always enrich (justified by urgency)
    if topic_importance in ["breaking", "hot"]:
        return True, f"urgent_{topic_importance}"

    # Rule 3: Major source with failed scrape = enrich
    if source_tier == 1 and (not scrape_success or content_length < min_content_length):
        return True, "tier1_scrape_failed"

    # Default: Don't use expensive API for standard cases
    return False, "cost_control"


def determine_topic_importance(
    cluster_size: int,
    avg_recency_hours: float,
    source_diversity: int,
    has_breaking_keywords: bool = False
) -> str:
    """
    Determine topic importance for cost control decisions.

    Args:
        cluster_size: Number of articles in cluster
        avg_recency_hours: Average age of articles in hours
        source_diversity: Number of unique sources
        has_breaking_keywords: Contains breaking news keywords

    Returns:
        "breaking", "hot", "normal", or "minor"
    """
    # Breaking: Very recent + many sources covering it
    if has_breaking_keywords or (avg_recency_hours < 2 and source_diversity >= 4):
        return "breaking"

    # Hot: Recent + good coverage
    if avg_recency_hours < 6 and (cluster_size >= 5 or source_diversity >= 3):
        return "hot"

    # Minor: Old or single source
    if avg_recency_hours > 48 or source_diversity == 1:
        return "minor"

    return "normal"


# Breaking news keywords for automatic detection
BREAKING_KEYWORDS = [
    "urgent", "breaking", "flash", "alerte", "just in",
    "live", "en direct", "dernière heure", "dernière minute",
    "explosion", "attentat", "séisme", "crash", "mort de",
    "décès de", "démission", "élection", "guerre"
]


def detect_breaking_news(title: str, content: str = "") -> bool:
    """Check if article contains breaking news keywords"""
    text_lower = (title + " " + content).lower()
    return any(kw in text_lower for kw in BREAKING_KEYWORDS)


# Global instance
search_enrichment_engine = SearchEnrichmentEngine()


def get_search_enrichment_engine() -> SearchEnrichmentEngine:
    """Dependency injection"""
    return search_enrichment_engine
