"""
OpenRouter LLM Service
Uses OpenAI Client to connect to OpenRouter API
"""
from typing import Optional, Dict, Any, List
import json
from loguru import logger
from openai import AsyncOpenAI

from app.core.config import settings


class LLMService:
    """LLM Service via OpenRouter"""

    def __init__(self):
        self.client: Optional[AsyncOpenAI] = None
        self.model = settings.OPENROUTER_MODEL

    async def initialize(self):
        """Initialize OpenAI client for OpenRouter"""
        try:
            logger.info(f"Connecting to OpenRouter with model {self.model}")
            self.client = AsyncOpenAI(
                api_key=settings.OPENROUTER_API_KEY,
                base_url=settings.OPENROUTER_BASE_URL,
            )
            logger.success(f"✅ OpenRouter client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize OpenRouter client: {e}")
            raise

    async def generate(self, prompt: str, temperature: float = 0.7, max_tokens: int = 2000) -> str:
        """
        Generate text completion
        """
        if not self.client:
            await self.initialize()

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return ""

    async def generate_json(self, prompt: str, temperature: float = 0.3, max_tokens: int = 4000) -> Dict[str, Any]:
        """
        Generate JSON response with extended token limit for long-form content
        """
        if not self.client:
            await self.initialize()

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

            text = response.choices[0].message.content
            return json.loads(text)
        except json.JSONDecodeError:
            logger.error("Failed to parse JSON from LLM")
            return {}
        except Exception as e:
            logger.error(f"LLM JSON generation failed: {e}")
            return {}

    async def synthesize_articles(self, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate a professional newspaper-style synthesis from multiple articles
        """
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

3. CORPS DE L'ARTICLE (body):
   - Article DÉVELOPPÉ de 400-600 mots minimum
   - Structure en paragraphes thématiques
   - Contexte et enjeux expliqués
   - CHAQUE paragraphe DOIT avoir 1-2 citations [SOURCE:N] après les faits importants
   - Analyse des implications et perspectives
   - Style journalistique professionnel (Le Monde, NYT)

4. POINTS CLÉS (keyPoints):
   - 4-6 points essentiels
   - Phrases complètes et informatives (pas juste des mots-clés)
   - Chaque point = une information importante distincte

5. ANALYSE (analysis):
   - 2-3 phrases sur les implications ou le contexte plus large
   - Perspective d'expert

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
  "readingTime": 5
}}
"""

        result = await self.generate_json(prompt, temperature=0.6)

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
            "complianceScore": 95,
            "readingTime": result.get("readingTime", 5)
        }

    async def synthesize_articles_advanced(
        self,
        articles: List[Dict[str, Any]],
        enhanced_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate synthesis using advanced RAG context with contradictions and fact-dense chunks.

        Args:
            articles: Original articles for source references
            enhanced_context: Context from AdvancedRAG.prepare_synthesis_context()
        """
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
📈 Chunks les plus factuels: {len(enhanced_context.get('top_chunks', []))}
📰 Sources analysées: {enhanced_context.get('sources_count', len(articles))}
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

3. CORPS (body): 400-600 mots, paragraphes thématiques, citations [SOURCE:N]
   {"- INCLURE une section sur les contradictions entre sources" if contradictions else ""}

4. POINTS CLÉS (keyPoints): 4-6 points essentiels, phrases complètes

5. ANALYSE (analysis): 2-3 phrases sur les implications

Format JSON strict:
{{
  "title": "...",
  "introduction": "...",
  "body": "...",
  "keyPoints": ["...", "...", "...", "..."],
  "analysis": "...",
  "readingTime": 5,
  "hasContradictions": {"true" if contradictions else "false"}
}}
"""

        result = await self.generate_json(prompt, temperature=0.6, max_tokens=4500)

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
            "complianceScore": 95,
            "readingTime": result.get("readingTime", 5),
            "hasContradictions": result.get("hasContradictions", len(contradictions) > 0)
        }

    async def synthesize_with_history(
        self,
        articles: List[Dict[str, Any]],
        enhanced_context: Dict[str, Any],
        historical_context_text: str,
        narrative_arc: str = "emerging"
    ) -> Dict[str, Any]:
        """
        Generate synthesis using Advanced RAG + Historical Context (TNA).
        This is the ULTIMATE synthesis method combining all intelligence layers.

        Args:
            articles: Current cluster articles
            enhanced_context: Context from AdvancedRAG (chunks, contradictions, entities)
            historical_context_text: Formatted historical context from TNA
            narrative_arc: Current story phase (emerging, developing, peak, declining, resolved)
        """
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

        prompt = f"""Tu es le RÉDACTEUR EN CHEF d'un grand quotidien de référence (Le Monde, NYT).
Tu rédiges un ARTICLE DE SYNTHÈSE ENRICHI avec contexte historique.

{historical_context_text}

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

⚠️ RÈGLES OBLIGATOIRES:
1. INTÈGRE le contexte historique: mentionne l'évolution, les faits précédents
2. MONTRE la progression: "Après X survenu [date], aujourd'hui Y..."
3. REFORMULE tout avec tes propres mots (anti-plagiat)
4. CITE les sources: [SOURCE:N] après chaque fait (une seule fois par source)
5. Si contradictions: présente les deux versions objectivement

📊 STRUCTURE ENRICHIE:

1. TITRE (title): Accrocheur, reflète l'évolution si applicable

2. INTRODUCTION (introduction):
   - Rappel BREF du contexte historique (1 phrase)
   - Nouveaux développements d'aujourd'hui
   - 60-100 mots avec [SOURCE:N]

3. CORPS (body): 500-700 mots
   - Premier paragraphe: Rappel contexte + nouveautés
   - Paragraphes thématiques avec citations [SOURCE:N]
   - Section "Évolution de l'affaire" si histoire en développement
   - Analyse des implications

4. POINTS CLÉS (keyPoints): 5-6 points
   - Inclure 1-2 points sur l'évolution historique
   - Nouveaux développements

5. ANALYSE (analysis):
   - Implications + projection future basée sur la trajectoire

6. TIMELINE (timeline): Liste des dates clés (si histoire > 1 jour)

7. CHAÎNE CAUSALE (causal_chain): Relations cause-effet OBLIGATOIRES
   - Identifie 3-6 relations causales dans l'histoire
   - Format: cause → effet avec type de relation
   - Types: "causes" (direct), "triggers" (déclencheur), "enables" (permet), "prevents" (empêche)

Format JSON:
{{
  "title": "...",
  "introduction": "...",
  "body": "...",
  "keyPoints": ["...", "..."],
  "analysis": "...",
  "timeline": ["[Date] Événement 1", "[Date] Événement 2"],
  "narrativeArc": "{narrative_arc}",
  "readingTime": 6,
  "causal_chain": [
    {{
      "cause": "Description de la cause (événement, décision, action)",
      "effect": "Description de l'effet/conséquence",
      "type": "causes|triggers|enables|prevents",
      "sources": ["Source1", "Source2"]
    }},
    {{
      "cause": "Autre cause identifiée",
      "effect": "Son effet",
      "type": "triggers",
      "sources": ["Source3"]
    }}
  ]
}}
"""

        result = await self.generate_json(prompt, temperature=0.6, max_tokens=6000)

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
            "causal_chain": result.get("causal_chain", [])  # Causal relations for Nexus Causal
        }

    async def synthesize_with_persona(
        self,
        base_synthesis: Dict[str, Any],
        articles: List[Dict[str, Any]],
        persona_id: str
    ) -> Dict[str, Any]:
        """
        Re-generate a synthesis using a specific persona's voice and style.

        Args:
            base_synthesis: The original neutral synthesis
            articles: Original source articles
            persona_id: ID of the persona to use (le_cynique, l_optimiste, le_conteur, le_satiriste)

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
            include_signature=True
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
