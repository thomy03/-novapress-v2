"""
OpenRouter LLM Service
Uses OpenAI Client to connect to OpenRouter API
Includes retry logic with exponential backoff for resilience
Circuit breaker pattern to prevent cascading failures
"""
from typing import Optional, Dict, Any, List
import json
import asyncio
import random
from loguru import logger
from openai import AsyncOpenAI, APIError, APIConnectionError, RateLimitError, APITimeoutError

from app.core.config import settings
from app.core.circuit_breaker import get_circuit_breaker, CircuitOpenError


# Retry configuration
MAX_RETRIES = 3
BASE_DELAY = 2.0
MAX_DELAY = 30.0


def calculate_target_length(
    num_sources: int,
    num_chunks: int = 0,
    has_history: bool = False,
    is_update: bool = False
) -> tuple[int, int, int]:
    """
    Calculate dynamic target length for synthesis based on available context.

    Args:
        num_sources: Number of source articles
        num_chunks: Number of RAG chunks (if using advanced RAG)
        has_history: Whether historical context is available (TNA)
        is_update: Whether this is an update to an existing synthesis

    Returns:
        Tuple of (min_words, max_words, max_tokens)

    Formula:
        - Base: 450 mots (garantit minimum 600 mots)
        - +80 mots par source au-dela de 3
        - +40 mots par chunk RAG
        - +200 mots si contexte historique
        - +300 mots si mise a jour (UPDATE)
        - min: 600 mots, PAS DE LIMITE MAX (syntheses peuvent grandir)
        - max_tokens: adapte a la longueur cible
    """
    base = 450

    # Bonus for additional sources (beyond the first 3)
    source_bonus = max(0, num_sources - 3) * 80  # Augmente de 50 a 80

    # Bonus for RAG chunks
    chunk_bonus = num_chunks * 40  # Augmente de 30 a 40

    # Bonus for historical context
    history_bonus = 200 if has_history else 0  # Augmente de 150 a 200

    # Bonus for updates (syntheses qui s'enrichissent)
    update_bonus = 300 if is_update else 0

    # Calculate word counts
    min_words = base + source_bonus + chunk_bonus + history_bonus + update_bonus

    # MINIMUM 600 MOTS - PAS DE LIMITE MAXIMUM
    min_words = max(600, min_words)
    max_words = min_words + 400  # Suggestion, pas une limite stricte

    # Calculate max_tokens: ~7 tokens per French word + JSON overhead
    # Pas de limite stricte pour permettre aux syntheses de grandir
    max_tokens = int(max_words * 7 + 2000)  # +2000 for JSON structure + growth
    max_tokens = max(6000, max_tokens)  # Minimum 6000 tokens

    return (min_words, max_words, max_tokens)


class LLMService:
    """LLM Service via OpenRouter with circuit breaker"""

    # Phase 2.5: Cost Tracker - Prix DeepSeek V3.2 via OpenRouter
    # Source: https://openrouter.ai/models/deepseek/deepseek-chat
    PRICE_INPUT_PER_TOKEN = 0.00000027   # $0.27/M tokens
    PRICE_OUTPUT_PER_TOKEN = 0.0000011   # $1.10/M tokens

    def __init__(self):
        self.client: Optional[AsyncOpenAI] = None
        self.model = settings.OPENROUTER_MODEL
        self.circuit_breaker = get_circuit_breaker("openrouter")
        self._last_generation_cost = 0.0  # Track last generation cost

    async def initialize(self):
        """Initialize OpenAI client for OpenRouter"""
        try:
            logger.info(f"Connecting to OpenRouter with model {self.model}")
            self.client = AsyncOpenAI(
                api_key=settings.OPENROUTER_API_KEY,
                base_url=settings.OPENROUTER_BASE_URL,
                timeout=120.0,  # 2 minutes timeout for LLM calls
            )
            logger.success(f"✅ OpenRouter client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize OpenRouter client: {e}")
            raise

    def _calculate_cost(self, response) -> float:
        """
        Calculate USD cost from OpenRouter response.
        Phase 2.5 - Plan Backend: Cost Tracker

        Args:
            response: OpenAI ChatCompletion response with usage info

        Returns:
            Cost in USD (float)
        """
        try:
            if not response or not hasattr(response, 'usage'):
                return 0.0

            usage = response.usage
            prompt_tokens = getattr(usage, 'prompt_tokens', 0) or 0
            completion_tokens = getattr(usage, 'completion_tokens', 0) or 0

            cost = (prompt_tokens * self.PRICE_INPUT_PER_TOKEN) + \
                   (completion_tokens * self.PRICE_OUTPUT_PER_TOKEN)

            self._last_generation_cost = round(cost, 6)
            return self._last_generation_cost

        except Exception as e:
            logger.warning(f"Failed to calculate cost: {e}")
            return 0.0

    def get_last_generation_cost(self) -> float:
        """Get the cost of the last generation call"""
        return self._last_generation_cost

    async def generate(self, prompt: str, temperature: float = 0.7, max_tokens: int = 2000) -> str:
        """
        Generate text completion with retry logic and circuit breaker
        """
        if not self.client:
            await self.initialize()

        # Check circuit breaker first
        try:
            return await self.circuit_breaker.call(
                self._generate_with_retry, prompt, temperature, max_tokens
            )
        except CircuitOpenError as e:
            logger.warning(f"Circuit breaker open: {e}")
            return ""

    async def _generate_with_retry(self, prompt: str, temperature: float, max_tokens: int) -> str:
        """Internal method with retry logic, called through circuit breaker"""
        last_exception = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return response.choices[0].message.content
            except RateLimitError as e:
                last_exception = e
                if attempt < MAX_RETRIES:
                    delay = min(BASE_DELAY * (2 ** attempt) + random.uniform(0, 1), MAX_DELAY)
                    logger.warning(f"Rate limit hit, retrying in {delay:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                    await asyncio.sleep(delay)
            except (APIConnectionError, APITimeoutError) as e:
                last_exception = e
                if attempt < MAX_RETRIES:
                    delay = min(BASE_DELAY * (2 ** attempt) + random.uniform(0, 1), MAX_DELAY)
                    logger.warning(f"API connection error, retrying in {delay:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                    await asyncio.sleep(delay)
            except APIError as e:
                # Only retry on 5xx errors
                if hasattr(e, 'status_code') and 500 <= e.status_code < 600:
                    last_exception = e
                    if attempt < MAX_RETRIES:
                        delay = min(BASE_DELAY * (2 ** attempt) + random.uniform(0, 1), MAX_DELAY)
                        logger.warning(f"API error {e.status_code}, retrying in {delay:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                        await asyncio.sleep(delay)
                else:
                    logger.error(f"LLM generation failed (non-retryable): {e}")
                    raise  # Let circuit breaker track this failure
            except Exception as e:
                logger.error(f"LLM generation failed: {e}")
                raise  # Let circuit breaker track this failure

        logger.error(f"LLM generation failed after {MAX_RETRIES} retries: {last_exception}")
        raise last_exception or Exception("Max retries exceeded")

    async def generate_json(self, prompt: str, temperature: float = 0.3, max_tokens: int = 4000) -> Dict[str, Any]:
        """
        Generate JSON response with extended token limit for long-form content.
        Returns fallback structure on error instead of empty dict.
        Includes retry logic with exponential backoff and circuit breaker.
        """
        if not self.client:
            await self.initialize()

        fallback_response = {
            "title": "Synthèse d'actualité",
            "introduction": "",
            "body": "",
            "summary": "",
            "keyPoints": [],
            "analysis": "",
            "readingTime": 5,
            "causal_chain": [],
            "predictions": []
        }

        # Check circuit breaker first
        try:
            return await self.circuit_breaker.call(
                self._generate_json_with_retry, prompt, temperature, max_tokens
            )
        except CircuitOpenError as e:
            logger.warning(f"Circuit breaker open: {e}")
            return fallback_response

    async def _generate_json_with_retry(self, prompt: str, temperature: float, max_tokens: int) -> Dict[str, Any]:
        """Internal method with retry logic for JSON generation"""
        fallback_response = {
            "title": "Synthèse d'actualité",
            "introduction": "",
            "body": "",
            "summary": "",
            "keyPoints": [],
            "analysis": "",
            "readingTime": 5,
            "causal_chain": [],
            "predictions": []
        }

        last_exception = None
        text = None

        for attempt in range(MAX_RETRIES + 1):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "Tu es un assistant expert en rédaction journalistique. Tu produis uniquement du JSON valide, en français."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format={"type": "json_object"}
                )

                # Phase 2.5: Track generation cost
                self._calculate_cost(response)

                text = response.choices[0].message.content
                if not text:
                    logger.warning("LLM returned empty response, using fallback")
                    return fallback_response

                # Try to parse JSON, handling markdown code blocks if present
                text = text.strip()
                if text.startswith("```"):
                    lines = text.split("\n")
                    json_lines = []
                    in_block = False
                    for line in lines:
                        if line.startswith("```json") or line.startswith("```"):
                            in_block = not in_block
                            continue
                        if in_block:
                            json_lines.append(line)
                    text = "\n".join(json_lines)

                return json.loads(text)

            except RateLimitError as e:
                last_exception = e
                if attempt < MAX_RETRIES:
                    delay = min(BASE_DELAY * (2 ** attempt) + random.uniform(0, 1), MAX_DELAY)
                    logger.warning(f"Rate limit hit, retrying in {delay:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                    await asyncio.sleep(delay)
            except (APIConnectionError, APITimeoutError) as e:
                last_exception = e
                if attempt < MAX_RETRIES:
                    delay = min(BASE_DELAY * (2 ** attempt) + random.uniform(0, 1), MAX_DELAY)
                    logger.warning(f"API connection error, retrying in {delay:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                    await asyncio.sleep(delay)
            except APIError as e:
                if hasattr(e, 'status_code') and 500 <= e.status_code < 600:
                    last_exception = e
                    if attempt < MAX_RETRIES:
                        delay = min(BASE_DELAY * (2 ** attempt) + random.uniform(0, 1), MAX_DELAY)
                        logger.warning(f"API error {e.status_code}, retrying in {delay:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                        await asyncio.sleep(delay)
                else:
                    logger.error(f"LLM JSON generation failed (non-retryable): {e}")
                    raise  # Let circuit breaker track this failure
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from LLM: {e}")
                logger.debug(f"Raw LLM response: {text[:500] if text else 'empty'}")
                return fallback_response  # JSON parse errors are not API failures
            except Exception as e:
                logger.error(f"LLM JSON generation failed: {e}")
                raise  # Let circuit breaker track this failure

        logger.error(f"LLM JSON generation failed after {MAX_RETRIES} retries: {last_exception}")
        raise last_exception or Exception("Max retries exceeded")

    async def synthesize_articles(self, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate a professional newspaper-style synthesis from multiple articles.
        Length is dynamically calculated based on number of sources.
        """
        num_sources = min(len(articles), 7)  # Cap at 7 for context window

        # Calculate dynamic length based on source count
        min_words, max_words, max_tokens = calculate_target_length(
            num_sources=num_sources,
            num_chunks=0,
            has_history=False
        )

        # Use full content (raw_text) instead of just summary, with reasonable truncation
        sources_text = "\n---\n".join([
            f"SOURCE {i+1} ({article.get('source_name', article.get('source', 'Unknown'))}):\n"
            f"TITRE: {article.get('raw_title', article.get('title', 'No title'))}\n"
            f"CONTENU: {article.get('raw_text', article.get('content', article.get('summary', 'No content')))[:2000]}"
            for i, article in enumerate(articles[:7])  # Use up to 7 articles for richer context
        ])

        prompt = f"""Tu es un RÉDACTEUR EN CHEF d'un grand quotidien comme Le Monde ou le New York Times.
Tu dois rédiger un ARTICLE DE SYNTHÈSE complet et professionnel, pas un simple résumé.

⚠️ RÈGLES DE RÉDACTION OBLIGATOIRES (Copyright/Plagiat):
1. REFORMULE ENTIÈREMENT chaque information avec TES PROPRES MOTS
2. NE COPIE JAMAIS de phrases ou paragraphes des sources
3. Si tu cites, utilise des guillemets ET nomme la source: «...» (selon Le Monde)
4. Synthétise et analyse, ne résume pas mot-à-mot
5. Transforme les faits en prose journalistique originale

⚠️ CITATIONS OBLIGATOIRES - TRÈS IMPORTANT:
Pour chaque fait ou information importante, tu DOIS indiquer la source avec ce format exact: [SOURCE:N]
où N est le numéro de la source (1, 2, 3, etc.).
Exemple: "La France a annoncé de nouvelles mesures économiques [SOURCE:1] tandis que l'Allemagne prépare sa réponse [SOURCE:2]."
Place [SOURCE:N] juste après le fait concerné, PAS à la fin du paragraphe.

⚠️ RÈGLE IMPORTANTE: Chaque source ne doit être citée qu'UNE SEULE FOIS dans tout l'article.
- NE PAS répéter [SOURCE:1] plusieurs fois
- Cite chaque source [SOURCE:N] exactement une fois lors de sa première utilisation
- Si tu utilises des informations de la même source à plusieurs endroits, ne cite qu'au premier usage

IMPORTANT: Rédige ENTIÈREMENT EN FRANÇAIS, même si les sources sont dans d'autres langues.

📊 CONTEXTE DE RICHESSE:
- Nombre de sources: {num_sources}
- Longueur cible: {min_words}-{max_words} mots

╔══════════════════════════════════════════════════════════════════╗
║  🔴🔴🔴 EXIGENCE CRITIQUE - LONGUEUR MINIMUM: {min_words} MOTS 🔴🔴🔴  ║
╠══════════════════════════════════════════════════════════════════╣
║  Le CORPS (body) DOIT contenir AU MOINS {min_words} mots.            ║
║  ⚠️ Un article trop court sera REJETÉ et considéré INVALIDE.    ║
║  ⚠️ Développe CHAQUE point en profondeur avec:                  ║
║     - Contexte et background                                      ║
║     - Causes et conséquences                                      ║
║     - Réactions et perspectives                                   ║
║     - Enjeux et implications futures                              ║
║  ⚠️ Utilise des paragraphes de 100-150 mots chacun.             ║
║  ⚠️ Il faut MINIMUM 5 paragraphes substantiels dans le body.    ║
╚══════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════
SOURCES À SYNTHÉTISER:
═══════════════════════════════════════
{sources_text}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION:
═══════════════════════════════════════

1. TITRE (title):
   - Accrocheur, informatif, factuel
   - Style journal de référence (pas sensationnaliste)
   - 8-15 mots maximum

2. CHAPÔ / INTRODUCTION (introduction):
   - 2-3 phrases percutantes qui résument l'essentiel
   - Répond aux questions: Quoi? Qui? Quand? Où?
   - 50-80 mots
   - DOIT contenir au moins une citation [SOURCE:N]

3. CORPS DE L'ARTICLE (body): ⚠️ MINIMUM {min_words} MOTS OBLIGATOIRE
   - Article DÉVELOPPÉ de {min_words}-{max_words} mots (MINIMUM ABSOLU: {min_words})
   - EXACTEMENT 5-7 paragraphes de 100-150 mots chacun
   - Structure en paragraphes thématiques
   - Contexte et enjeux expliqués
   - CHAQUE paragraphe DOIT avoir 1-2 citations [SOURCE:N] après les faits importants
   - Analyse des implications et perspectives
   - Style journalistique professionnel (Le Monde, NYT)
   - PLUS de sources = article PLUS LONG et PLUS DÉTAILLÉ

4. POINTS CLÉS (keyPoints):
   - 4-6 points essentiels
   - Phrases complètes et informatives (pas juste des mots-clés)
   - Chaque point = une information importante distincte

5. ANALYSE (analysis):
   - 2-3 phrases sur les implications ou le contexte plus large
   - Perspective d'expert

6. CHAÎNE CAUSALE (causal_chain) - ⚠️ OBLIGATOIRE (minimum 3):
   ╔════════════════════════════════════════════════════════════════╗
   ║  🔴 Tu DOIS générer AU MOINS 3 relations cause-effet         ║
   ║  🔴 Sinon la synthèse sera considérée INVALIDE               ║
   ╚════════════════════════════════════════════════════════════════╝
   - Types: "causes" (direct), "triggers" (déclencheur), "enables" (permet), "prevents" (empêche)
   - Pour CHAQUE fait: demande-toi "Pourquoi?" (→cause) et "Et après?" (→effet)
   - Exemple: Une annonce politique → réaction des marchés → impact sur les ménages
   - SI pas de relations explicites: crée des relations LOGIQUES implicites

7. ANALYSE TONALE (sentiment) - OBLIGATOIRE:
   - Évalue le ton DOMINANT de l'actualité rapportée
   - "positive": bonne nouvelle, avancée, succès, progrès
   - "negative": crise, conflit, échec, problème grave
   - "neutral": fait divers, annonce factuelle, information technique
   - "mixed": situation ambivalente, gagnants et perdants

8. INTENSITÉ DU SUJET (topic_intensity) - OBLIGATOIRE:
   - "breaking": événement majeur qui vient de se produire, urgence
   - "hot": sujet brûlant, débat vif, forte couverture médiatique
   - "developing": histoire en cours, nouveaux développements
   - "standard": actualité normale, information de fond

Format JSON strict:
{{
  "title": "Titre accrocheur et factuel",
  "introduction": "Chapô avec les faits essentiels [SOURCE:1] et le contexte [SOURCE:2]...",
  "body": "Premier paragraphe sur le fait principal [SOURCE:1]. Deuxième paragraphe avec contexte supplémentaire [SOURCE:2] et réactions [SOURCE:3]. Troisième paragraphe sur les implications [SOURCE:1]...",
  "keyPoints": [
    "Premier point clé développé avec contexte",
    "Deuxième point clé avec détails importants",
    "Troisième point sur les implications",
    "Quatrième point sur les perspectives"
  ],
  "analysis": "Analyse des enjeux plus larges et des implications futures...",
  "causal_chain": [
    {{"cause": "Fait déclencheur", "effect": "Conséquence observée", "type": "causes", "sources": ["Source1"]}},
    {{"cause": "Réaction", "effect": "Impact", "type": "triggers", "sources": ["Source2"]}}
  ],
  "sentiment": "positive|negative|neutral|mixed",
  "topic_intensity": "breaking|hot|developing|standard",
  "readingTime": {max(3, min_words // 200)}
}}
"""

        result = await self.generate_json(prompt, temperature=0.6, max_tokens=max_tokens)

        # Combine introduction + body for the summary field (backward compatibility)
        intro = result.get("introduction", "")
        body = result.get("body", "")
        full_summary = f"{intro}\n\n{body}" if intro and body else result.get("summary", intro or body)

        return {
            "title": result.get("title", "Synthèse d'actualité"),
            "summary": full_summary,
            "introduction": intro,
            "body": body,
            "keyPoints": result.get("keyPoints", []),
            "analysis": result.get("analysis", ""),
            "causal_chain": result.get("causal_chain", []),
            "sentiment": result.get("sentiment", "neutral"),
            "topic_intensity": result.get("topic_intensity", "standard"),
            "complianceScore": 95,
            "readingTime": result.get("readingTime", 5),
            "generation_cost_usd": self.get_last_generation_cost()  # Phase 2.5: Cost Tracker
        }

    async def synthesize_articles_advanced(
        self,
        articles: List[Dict[str, Any]],
        enhanced_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate synthesis using advanced RAG context with contradictions and fact-dense chunks.
        Length is dynamically calculated based on sources and RAG chunks.

        Args:
            articles: Original articles for source references
            enhanced_context: Context from AdvancedRAG.prepare_synthesis_context()
        """
        num_sources = min(len(articles), 7)
        num_chunks = len(enhanced_context.get('top_chunks', []))

        # Calculate dynamic length
        min_words, max_words, max_tokens = calculate_target_length(
            num_sources=num_sources,
            num_chunks=num_chunks,
            has_history=False
        )

        # Format top fact-dense chunks
        chunks_text = "\n---\n".join([
            f"[CHUNK {i+1}] (Source: {chunk['source']}, Score factuel: {chunk['fact_score']:.2f})\n{chunk['text'][:800]}"
            for i, chunk in enumerate(enhanced_context.get('top_chunks', [])[:7])
        ])

        # Format contradictions if any
        contradictions = enhanced_context.get('contradictions', [])
        contradictions_text = ""
        if contradictions:
            contradictions_text = "\n\n⚠️ CONTRADICTIONS DÉTECTÉES ENTRE SOURCES:\n"
            for i, c in enumerate(contradictions[:3]):  # Max 3 contradictions
                contradictions_text += f"""
━━━ Contradiction {i+1} ({c['type']}) ━━━
• {c['source1']}: "{c['excerpt1'][:150]}..."
• {c['source2']}: "{c['excerpt2'][:150]}..."
"""

        # Format key entities
        entities = enhanced_context.get('key_entities', [])[:8]
        entities_text = ", ".join(entities) if entities else "Non identifiées"

        # Build source mapping for citations
        sources_text = "\n---\n".join([
            f"SOURCE {i+1} ({article.get('source_name', article.get('source', 'Unknown'))}):\n"
            f"TITRE: {article.get('raw_title', article.get('title', 'No title'))}\n"
            f"CONTENU: {article.get('raw_text', article.get('content', article.get('summary', 'No content')))[:1500]}"
            for i, article in enumerate(articles[:7])
        ])

        prompt = f"""Tu es un RÉDACTEUR EN CHEF d'un grand quotidien comme Le Monde ou le New York Times.
Tu dois rédiger un ARTICLE DE SYNTHÈSE complet, professionnel et NUANCÉ.

═══════════════════════════════════════
ANALYSE AVANCÉE (Intelligence NovaPress)
═══════════════════════════════════════

📊 ENTITÉS CLÉS: {entities_text}
📈 Chunks les plus factuels: {num_chunks}
📰 Sources analysées: {num_sources}
📏 Longueur cible: {min_words}-{max_words} mots (proportionnel à la richesse)

🔴 LONGUEUR MINIMUM ABSOLUE: {min_words} MOTS (PAS DE LIMITE MAX)
   Le corps (body) DOIT contenir AU MINIMUM {min_words} mots. Pas de limite max!

{contradictions_text}

═══════════════════════════════════════
EXTRAITS FACTUELS (classés par densité)
═══════════════════════════════════════
{chunks_text}

═══════════════════════════════════════
SOURCES COMPLÈTES
═══════════════════════════════════════
{sources_text}

═══════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════

⚠️ RÈGLES DE RÉDACTION OBLIGATOIRES:
1. REFORMULE ENTIÈREMENT chaque information avec TES PROPRES MOTS
2. NE COPIE JAMAIS de phrases des sources
3. Si tu cites, utilise des guillemets: «...» (selon Le Monde)

⚠️ GESTION DES CONTRADICTIONS:
{"- IMPORTANT: Des contradictions ont été détectées. Tu DOIS les mentionner dans l'article avec objectivité." if contradictions else "- Aucune contradiction majeure détectée."}
{"- Présente les deux versions: 'Selon X... tandis que Y affirme...'" if contradictions else ""}
{"- Ne prends pas parti, laisse le lecteur juger" if contradictions else ""}

⚠️ CITATIONS - RÈGLE STRICTE:
- Format: [SOURCE:N] où N = numéro de la source
- Chaque source citée UNE SEULE FOIS (première utilisation)
- Place [SOURCE:N] juste après le fait, pas à la fin du paragraphe

IMPORTANT: Rédige ENTIÈREMENT EN FRANÇAIS.

STRUCTURE ATTENDUE:

1. TITRE (title): Accrocheur, factuel, 8-15 mots

2. INTRODUCTION (introduction): 2-3 phrases, 50-80 mots, avec [SOURCE:N]

3. CORPS (body): {min_words}-{max_words} mots, paragraphes thématiques, citations [SOURCE:N]
   - PLUS de sources et chunks = article PLUS LONG
   {"- INCLURE une section sur les contradictions entre sources" if contradictions else ""}

4. POINTS CLÉS (keyPoints): 4-6 points essentiels, phrases complètes

5. ANALYSE (analysis): 2-3 phrases sur les implications

6. CHAÎNE CAUSALE (causal_chain) - ⚠️ OBLIGATOIRE (minimum 3):
   ╔════════════════════════════════════════════════════════════════╗
   ║  🔴 Tu DOIS générer AU MOINS 3 relations cause-effet         ║
   ║  🔴 Sinon la synthèse sera considérée INVALIDE               ║
   ╚════════════════════════════════════════════════════════════════╝
   - Types: "causes", "triggers", "enables", "prevents"
   - Pour CHAQUE fait: "Pourquoi?" → cause / "Et après?" → effet
   - SI pas explicite: crée des relations logiques implicites

7. ANALYSE TONALE (sentiment) - OBLIGATOIRE:
   - "positive": bonne nouvelle, succès, progrès
   - "negative": crise, conflit, échec
   - "neutral": fait divers, annonce technique
   - "mixed": situation ambivalente

8. INTENSITÉ DU SUJET (topic_intensity) - OBLIGATOIRE:
   - "breaking": événement majeur urgent
   - "hot": sujet brûlant, forte couverture
   - "developing": histoire en cours
   - "standard": actualité normale

Format JSON strict:
{{
  "title": "...",
  "introduction": "...",
  "body": "...",
  "keyPoints": ["...", "...", "...", "..."],
  "analysis": "...",
  "causal_chain": [
    {{"cause": "Événement déclencheur", "effect": "Conséquence", "type": "causes", "sources": ["Source"]}},
    {{"cause": "Action", "effect": "Réaction", "type": "triggers", "sources": ["Source"]}}
  ],
  "sentiment": "positive|negative|neutral|mixed",
  "topic_intensity": "breaking|hot|developing|standard",
  "readingTime": {max(3, min_words // 200)},
  "hasContradictions": {"true" if contradictions else "false"}
}}
"""

        result = await self.generate_json(prompt, temperature=0.6, max_tokens=max_tokens)

        # Combine introduction + body for backward compatibility
        intro = result.get("introduction", "")
        body = result.get("body", "")
        full_summary = f"{intro}\n\n{body}" if intro and body else result.get("summary", intro or body)

        return {
            "title": result.get("title", "Synthèse d'actualité"),
            "summary": full_summary,
            "introduction": intro,
            "body": body,
            "keyPoints": result.get("keyPoints", []),
            "analysis": result.get("analysis", ""),
            "causal_chain": result.get("causal_chain", []),
            "sentiment": result.get("sentiment", "neutral"),
            "topic_intensity": result.get("topic_intensity", "standard"),
            "complianceScore": 95,
            "readingTime": result.get("readingTime", 5),
            "hasContradictions": result.get("hasContradictions", len(contradictions) > 0),
            "generation_cost_usd": self.get_last_generation_cost()  # Phase 2.5: Cost Tracker
        }

    async def synthesize_with_history(
        self,
        articles: List[Dict[str, Any]],
        enhanced_context: Dict[str, Any],
        historical_context_text: str,
        narrative_arc: str = "emerging",
        search_context_text: str = ""
    ) -> Dict[str, Any]:
        """
        Generate synthesis using Advanced RAG + Historical Context (TNA) + Search Enrichment.
        This is the ULTIMATE synthesis method combining all intelligence layers.
        Length is dynamically calculated based on sources, chunks, and history.

        Args:
            articles: Current cluster articles
            enhanced_context: Context from AdvancedRAG (chunks, contradictions, entities)
            historical_context_text: Formatted historical context from TNA
            narrative_arc: Current story phase (emerging, developing, peak, declining, resolved)
            search_context_text: Web/social context from Perplexity/Grok enrichment (Phase 6 fix)
        """
        num_sources = min(len(articles), 6)
        num_chunks = len(enhanced_context.get('top_chunks', []))
        has_history = bool(historical_context_text and len(historical_context_text) > 50)

        # Calculate dynamic length based on context richness
        min_words, max_words, max_tokens = calculate_target_length(
            num_sources=num_sources,
            num_chunks=num_chunks,
            has_history=has_history
        )

        # Format chunks
        chunks_text = "\n---\n".join([
            f"[CHUNK {i+1}] ({chunk['source']}, score: {chunk['fact_score']:.2f})\n{chunk['text'][:600]}"
            for i, chunk in enumerate(enhanced_context.get('top_chunks', [])[:6])
        ])

        # Format contradictions
        contradictions = enhanced_context.get('contradictions', [])
        contradictions_text = ""
        if contradictions:
            contradictions_text = "\n⚠️ CONTRADICTIONS ACTUELLES:\n"
            for c in contradictions[:2]:
                contradictions_text += f"• {c['source1']} vs {c['source2']} ({c['type']})\n"

        # Sources for citations
        sources_text = "\n---\n".join([
            f"SOURCE {i+1} ({article.get('source_name', 'Unknown')}):\n"
            f"{article.get('raw_title', '')} - {article.get('raw_text', '')[:1000]}"
            for i, article in enumerate(articles[:6])
        ])

        # Narrative arc specific instructions
        arc_instructions = {
            "emerging": "C'est une NOUVELLE HISTOIRE. Présente clairement les faits initiaux et le contexte.",
            "developing": "Histoire en DÉVELOPPEMENT. Montre l'évolution depuis les premiers éléments et les nouveaux développements.",
            "peak": "Histoire à son APOGÉE. Synthétise tous les aspects, les enjeux majeurs et les positions des différents acteurs.",
            "declining": "Histoire en DÉCLIN. Résume ce qui s'est passé, les conclusions qui se dessinent.",
            "resolved": "Histoire RÉSOLUE. Récapitule le dénouement, les leçons et l'impact durable."
        }

        # Phase 6: Build search enrichment section if available
        search_enrichment_section = ""
        if search_context_text and len(search_context_text) > 50:
            search_enrichment_section = f"""
═══════════════════════════════════════
🌐 ENRICHISSEMENT WEB (Perplexity/Grok)
═══════════════════════════════════════
{search_context_text}

⚠️ UTILISE CES INFORMATIONS: Les faits vérifiés et le contexte social ci-dessus
doivent être INTÉGRÉS dans ton article pour enrichir l'analyse.
"""

        prompt = f"""Tu es le RÉDACTEUR EN CHEF d'un grand quotidien de référence (Le Monde, NYT).
Tu rédiges un ARTICLE DE SYNTHÈSE ENRICHI avec contexte historique.

{historical_context_text}
{search_enrichment_section}
═══════════════════════════════════════
NOUVELLES INFORMATIONS (AUJOURD'HUI)
═══════════════════════════════════════
{chunks_text}
{contradictions_text}

═══════════════════════════════════════
SOURCES DÉTAILLÉES
═══════════════════════════════════════
{sources_text}

═══════════════════════════════════════
INSTRUCTIONS SPÉCIALES
═══════════════════════════════════════

📝 CONSIGNE NARRATIVE: {arc_instructions.get(narrative_arc, arc_instructions['developing'])}

📊 CONTEXTE DE RICHESSE:
- Sources: {num_sources} | Chunks RAG: {num_chunks} | Contexte historique: {'Oui' if has_history else 'Non'}
- Longueur cible: {min_words}-{max_words} mots (proportionnel à la richesse des données)

╔══════════════════════════════════════════════════════════════════════════╗
║  🔴🔴🔴 EXIGENCE CRITIQUE - LONGUEUR MINIMUM: {min_words} MOTS 🔴🔴🔴       ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Le CORPS (body) DOIT contenir AU MOINS {min_words} mots.                    ║
║  ⚠️ Un article trop court sera REJETÉ et considéré INVALIDE.            ║
║                                                                          ║
║  DÉVELOPPE en profondeur avec:                                           ║
║    1️⃣ Contexte historique et background de l'affaire                    ║
║    2️⃣ Les nouveaux développements en détail                             ║
║    3️⃣ Les causes et facteurs explicatifs                                ║
║    4️⃣ Les réactions des différents acteurs                              ║
║    5️⃣ Les conséquences et implications                                  ║
║    6️⃣ Les perspectives et scénarios futurs                              ║
║                                                                          ║
║  📏 STRUCTURE: 6-8 paragraphes de 100-150 mots chacun                    ║
║  📏 TOTAL BODY: MINIMUM {min_words} mots (vise {max_words}+)                 ║
╚══════════════════════════════════════════════════════════════════════════╝

⚠️ RÈGLES OBLIGATOIRES:
1. INTÈGRE le contexte historique: mentionne l'évolution, les faits précédents
2. MONTRE la progression: "Après X survenu [date], aujourd'hui Y..."
3. REFORMULE tout avec tes propres mots (anti-plagiat)
4. CITE les sources: [SOURCE:N] après chaque fait (une seule fois par source)
5. Si contradictions: présente les deux versions objectivement
6. PLUS de sources/chunks/historique = article BEAUCOUP PLUS LONG et DÉTAILLÉ

📊 STRUCTURE ENRICHIE:

1. TITRE (title): Accrocheur, reflète l'évolution si applicable

2. INTRODUCTION (introduction):
   - Rappel BREF du contexte historique (1 phrase)
   - Nouveaux développements d'aujourd'hui
   - 60-100 mots avec [SOURCE:N]

3. CORPS (body): ⚠️ MINIMUM {min_words} MOTS OBLIGATOIRE ⚠️
   - EXACTEMENT 6-8 paragraphes de 100-150 mots chacun
   - Paragraphe 1: Rappel contexte + nouveautés
   - Paragraphe 2-3: Détails des faits principaux
   - Paragraphe 4: Réactions et positions des acteurs
   - Paragraphe 5-6: Analyse et implications
   - Paragraphe 7-8: Perspectives et enjeux futurs
   - ⚠️ DERNIER PARAGRAPHE: Inclure une phrase prospective du type:
     "À court terme, [scénario A] apparaît comme le plus probable (X%).
     À plus long terme, [scénario B] pourrait se concrétiser si [condition]."
   - Citations [SOURCE:N] après chaque fait important
   - Exploite TOUTES les informations des {num_sources} sources

4. POINTS CLÉS (keyPoints): 5-6 points
   - Inclure 1-2 points sur l'évolution historique
   - Nouveaux développements

5. ANALYSE (analysis): ⚠️ INTÈGRE LES SCÉNARIOS FUTURS
   - Implications actuelles
   - OBLIGATOIRE: Termine par une phrase d'anticipation du type:
     "Compte tenu de [facteur clé], nos analyses suggèrent [scénario le plus probable]
     avec une probabilité estimée de X%."
   - Mentionne 1-2 scénarios à probabilité >50% que tu vas détailler dans "predictions"

6. TIMELINE (timeline): Liste des dates clés (si histoire > 1 jour)

7. ⚠️ CHAÎNE CAUSALE (causal_chain): ABSOLUMENT OBLIGATOIRE - NE JAMAIS OMETTRE
   ╔══════════════════════════════════════════════════════════════════════════╗
   ║  🔴🔴🔴 CRITIQUE: MINIMUM 3 RELATIONS CAUSALES OBLIGATOIRES 🔴🔴🔴       ║
   ╠══════════════════════════════════════════════════════════════════════════╣
   ║  ⚠️ Si tu ne génères pas AU MOINS 3 relations, la synthèse est REJETÉE  ║
   ║  ⚠️ CHAQUE actualité a des CAUSES et des CONSÉQUENCES - trouve-les!     ║
   ╚══════════════════════════════════════════════════════════════════════════╝

   🔍 MÉTHODE POUR IDENTIFIER LES RELATIONS:

   Étape 1 - Pour CHAQUE fait principal, pose ces questions:
   • "Pourquoi cela s'est-il produit?" → Identifie la CAUSE
   • "Qu'est-ce que cela va provoquer?" → Identifie l'EFFET

   Étape 2 - Cherche ces indicateurs dans les sources:
   • Mots causaux FR: "car", "donc", "suite à", "en raison de", "a provoqué",
     "conduit à", "entraîne", "parce que", "à cause de", "grâce à"
   • Mots causaux EN: "because", "due to", "as a result", "led to", "caused"

   Étape 3 - Types d'événements qui ONT TOUJOURS des relations causales:
   • Décision politique → impact sur société/économie/citoyens
   • Annonce économique → réaction des marchés/entreprises
   • Événement sportif → conséquences pour les acteurs
   • Découverte scientifique → applications/implications
   • Conflit/crise → réactions diplomatiques/mesures prises

   📋 TYPES DE RELATIONS (choisir parmi):
   • "causes": cause directe (A provoque directement B)
   • "triggers": déclencheur (A déclenche une réaction B)
   • "enables": permet (A rend B possible)
   • "prevents": empêche (A bloque B)

   💡 SI TU NE TROUVES PAS DE RELATIONS EXPLICITES:
   Crée des relations IMPLICITES logiques basées sur le contexte:
   - "Situation actuelle" → "Réaction probable des acteurs"
   - "Décision/annonce" → "Impact attendu"
   - "Problème identifié" → "Mesures proposées"

8. 🔮 SCÉNARIOS FUTURS (predictions): OBLIGATOIRE - 2-4 scénarios analysés comme un journaliste d'investigation
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⚠️ PAS de liste mécanique de faits. Raisonne comme un journaliste senior qui croise les sources:

   MÉTHODE JOURNALISTIQUE:
   1. SCÉNARIO PRINCIPAL (>60%): Celui qui découle logiquement des faits dominants.
      Nomme-le clairement ("Le scénario de l'escalade", "La voie du compromis").
      Explique POURQUOI c'est le plus probable: quels signaux CONCRETS observés dans les sources le soutiennent?
      Mentionne un précédent historique similaire si pertinent.

   2. SCÉNARIO ALTERNATIF (30-60%): Le retournement possible. Qu'est-ce qui pourrait changer la donne?
      Identifie le SIGNAL FAIBLE qui indiquerait que ce scénario se concrétise.

   3. SCÉNARIO DISRUPTIF (<30%): L'hypothèse que personne ne veut envisager mais que les données ne permettent pas d'écarter.

   Pour chaque scénario, génère ces champs:
   - "prediction": Titre du scénario + description narrative (2-3 phrases, pas juste un fait sec)
   - "rationale": Raisonnement éditorial — quels SIGNAUX CONCRETS des sources soutiennent ce scénario + précédent historique si applicable
   - "signal_watch": "Surveiller [indicateur précis] pour confirmer ce scénario" (ce que le lecteur doit observer)
   - "probability": 0.0-1.0
   - "type": "economic" | "political" | "social" | "geopolitical" | "tech"
   - "timeframe": "court_terme" (< 2 semaines) | "moyen_terme" (1-3 mois) | "long_terme" (> 3 mois)

9. 📊 ANALYSE TONALE (sentiment): OBLIGATOIRE
   - "positive": bonne nouvelle, succès, progrès, avancée
   - "negative": crise, conflit, échec, problème grave
   - "neutral": fait technique, information de fond
   - "mixed": situation ambivalente, gagnants et perdants

10. 🔥 INTENSITÉ DU SUJET (topic_intensity): OBLIGATOIRE
   - "breaking": événement majeur qui vient de se produire, URGENCE
   - "hot": sujet brûlant, forte couverture médiatique, débat vif
   - "developing": histoire en cours, nouveaux développements
   - "standard": actualité normale, information de fond

Format JSON (causal_chain + predictions + sentiment + topic_intensity OBLIGATOIRES):
{{
  "title": "...",
  "introduction": "...",
  "body": "...",
  "keyPoints": ["...", "..."],
  "analysis": "...",
  "timeline": ["[Date] Événement 1", "[Date] Événement 2"],
  "narrativeArc": "{narrative_arc}",
  "readingTime": {max(4, min_words // 150)},
  "causal_chain": [
    {{
      "cause": "Annonce de nouvelles sanctions économiques par l'UE",
      "effect": "Chute de 15% de la devise locale en 24 heures",
      "type": "triggers",
      "sources": ["Le Monde", "Reuters"]
    }},
    {{
      "cause": "Chute de la devise locale",
      "effect": "Hausse des prix des importations affectant le pouvoir d'achat",
      "type": "causes",
      "sources": ["Les Echos"]
    }},
    {{
      "cause": "Mécontentement populaire face à l'inflation",
      "effect": "Manifestations dans les grandes villes",
      "type": "triggers",
      "sources": ["AFP", "France Info"]
    }}
  ],
  "predictions": [
    {{
      "prediction": "Le scénario de l'escalade sociale — Si les hausses de prix persistent sans réponse gouvernementale, une mobilisation syndicale organisée est probable d'ici deux semaines. Les appels à la grève générale observés dans plusieurs villes pourraient se fédérer.",
      "probability": 0.75,
      "type": "social",
      "timeframe": "court_terme",
      "rationale": "Trois signaux convergents: (1) la rhétorique syndicale s'est durcie depuis 48h selon Le Monde et France Info, (2) le précédent de 2019 montre qu'une telle configuration mène à des grèves dans 70% des cas, (3) aucun geste d'apaisement gouvernemental n'a été annoncé.",
      "signal_watch": "Surveiller les annonces de l'intersyndicale dans les 72h — une conférence de presse commune serait le signal d'une mobilisation nationale coordonnée."
    }},
    {{
      "prediction": "La voie du compromis — Une négociation discrète entre gouvernement et syndicats, loin des caméras, pourrait désamorcer la crise avant qu'elle n'atteigne son point de rupture.",
      "probability": 0.50,
      "type": "political",
      "timeframe": "moyen_terme",
      "rationale": "Les précédents historiques (2010, 2016) montrent que les crises similaires ont souvent abouti à des concessions de dernière minute. Le calendrier politique — élections dans 6 mois — crée une pression supplémentaire pour éviter une image de chaos.",
      "signal_watch": "Surveiller les déclarations du ministre du Travail: un changement de ton vers 'le dialogue' indiquerait des négociations en coulisses."
    }},
    {{
      "prediction": "Impact négatif sur les marchés financiers européens si la crise persiste",
      "probability": 0.45,
      "type": "economic",
      "timeframe": "moyen_terme",
      "rationale": "L'interconnexion économique rend les marchés sensibles aux instabilités régionales"
    }}
  ],
  "sentiment": "negative",
  "topic_intensity": "hot"
}}
"""

        result = await self.generate_json(prompt, temperature=0.6, max_tokens=max_tokens)

        intro = result.get("introduction", "")
        body = result.get("body", "")
        full_summary = f"{intro}\n\n{body}" if intro and body else result.get("summary", intro or body)

        return {
            "title": result.get("title", "Synthèse d'actualité"),
            "summary": full_summary,
            "introduction": intro,
            "body": body,
            "keyPoints": result.get("keyPoints", []),
            "analysis": result.get("analysis", ""),
            "timeline": result.get("timeline", []),
            "narrativeArc": narrative_arc,
            "complianceScore": 95,
            "readingTime": result.get("readingTime", 6),
            "hasContradictions": len(contradictions) > 0,
            "isEnriched": True,  # Flag indicating TNA was used
            "causal_chain": result.get("causal_chain", []),  # Causal relations for Nexus Causal
            "generation_cost_usd": self.get_last_generation_cost(),  # Phase 2.5: Cost Tracker
            "predictions": result.get("predictions", []),  # Future predictions for Nexus Causal
            "sentiment": result.get("sentiment", "neutral"),  # Tone for persona selection
            "topic_intensity": result.get("topic_intensity", "standard")  # Urgency level
        }

    async def synthesize_with_persona(
        self,
        base_synthesis: Dict[str, Any],
        articles: List[Dict[str, Any]],
        persona_id: str,
        feedback_context: str | None = None
    ) -> Dict[str, Any]:
        """
        Re-generate a synthesis using a specific persona's voice and style.

        Args:
            base_synthesis: The original neutral synthesis
            articles: Original source articles
            persona_id: ID of the persona to use (le_cynique, l_optimiste, le_conteur, le_satiriste)
            feedback_context: Optional reader feedback to improve the persona's output

        Returns:
            New synthesis with persona's style applied
        """
        from app.ml.persona import get_persona, build_persona_prompt, PersonaType

        persona = get_persona(persona_id)
        if not persona:
            logger.warning(f"Unknown persona '{persona_id}', falling back to neutral")
            return base_synthesis

        # If neutral, return original
        if persona_id == PersonaType.NEUTRAL:
            return base_synthesis

        # Format sources for context
        sources_text = "\n---\n".join([
            f"SOURCE {i+1} ({article.get('source_name', 'Unknown')}):\n"
            f"TITRE: {article.get('raw_title', article.get('title', ''))}\n"
            f"CONTENU: {article.get('raw_text', article.get('content', ''))[:1500]}"
            for i, article in enumerate(articles[:6])
        ])

        # Base content from neutral synthesis
        base_content = f"""TITRE ORIGINAL: {base_synthesis.get('title', '')}

INTRODUCTION ORIGINALE:
{base_synthesis.get('introduction', '')}

CORPS DE L'ARTICLE ORIGINAL:
{base_synthesis.get('body', '')}

POINTS CLES ORIGINAUX:
{chr(10).join(['- ' + p for p in base_synthesis.get('keyPoints', [])])}

ANALYSE ORIGINALE:
{base_synthesis.get('analysis', '')}
"""

        # Build persona-specific prompt
        prompt = build_persona_prompt(
            persona=persona,
            base_content=base_content,
            sources_text=sources_text,
            include_signature=True,
            feedback_context=feedback_context
        )

        # Generate with persona's temperature
        result = await self.generate_json(prompt, temperature=persona.temperature, max_tokens=5000)

        intro = result.get("introduction", "")
        body = result.get("body", "")
        full_summary = f"{intro}\n\n{body}" if intro and body else base_synthesis.get("summary", "")

        return {
            "title": result.get("title", base_synthesis.get("title", "")),
            "summary": full_summary,
            "introduction": intro,
            "body": body,
            "keyPoints": result.get("keyPoints", base_synthesis.get("keyPoints", [])),
            "analysis": result.get("analysis", base_synthesis.get("analysis", "")),
            "signature": result.get("signature", persona.signature),
            "persona": {
                "id": persona.id,
                "name": persona.name,
                "displayName": persona.display_name,
                "tone": persona.tone,
            },
            "complianceScore": base_synthesis.get("complianceScore", 95),
            "readingTime": result.get("readingTime", base_synthesis.get("readingTime", 5)),
            "isPersonaVersion": True,
            "generation_cost_usd": self.get_last_generation_cost(),  # Phase 2.5: Cost Tracker
        }

    async def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extract named entities from text
        """
        prompt = f"""Extrais les ENTITÉS NOMMÉES de ce texte.

TEXTE:
{text[:1000]}

Format JSON strict:
{{
  "organizations": ["Org1", "Org2"],
  "persons": ["Person1", "Person2"],
  "locations": ["Location1", "Location2"],
  "events": ["Event1", "Event2"]
}}
"""

        result = await self.generate_json(prompt, temperature=0.2)

        return {
            "organizations": result.get("organizations", []),
            "persons": result.get("persons", []),
            "locations": result.get("locations", []),
            "events": result.get("events", [])
        }


# Global instance
llm_service = LLMService()


async def init_llm():
    """Initialize the global LLM service"""
    await llm_service.initialize()


def get_llm_service() -> LLMService:
    """Dependency injection for FastAPI"""
    return llm_service
