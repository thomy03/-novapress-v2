"""
NovaLex Legal Pipeline
Fork of NovaPress pipeline adapted for legal/compliance documents.
Sources: CNIL, Legifrance, EUR-Lex, CEPD (100% open data / public domain)
Embeddings: Gemini Embedding 2 (3072-dim, multimodal)
"""
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime
from loguru import logger

from app.core.config import settings
from app.db.qdrant_client import get_qdrant_service
from app.ml.gemini_embeddings import get_gemini_embedding_service


class LegalPipelineEngine:
    """
    NovaLex Pipeline for legal document processing.

    1. Scrape legal sources (CNIL, Legifrance, EUR-Lex, CEPD)
    2. Embed with Gemini Embedding 2 (text + PDF multimodal)
    3. Store in Qdrant (novalex_documents, 3072-dim)
    4. Cluster related documents (HDBSCAN)
    5. RAG + Contradiction detection (law changes vs previous state)
    6. TNA (legislative timeline: bill -> adoption -> decrees -> case law)
    7. Causal Graph (EU directive -> FR law -> CNIL decision -> sanction)
    8. LLM synthesis with post-generation verification
    9. Personas: Avocat / DPO / Dirigeant
    """

    def __init__(self):
        self.qdrant = None
        self.gemini = None
        self.scrapers = []
        self.initialized = False

    async def initialize(self):
        """Initialize pipeline services."""
        if self.initialized:
            return

        # Qdrant
        self.qdrant = get_qdrant_service()
        if not self.qdrant.client:
            await self.qdrant.initialize()

        # Gemini Embeddings
        self.gemini = get_gemini_embedding_service()
        if not self.gemini:
            logger.warning("Gemini Embedding service not available (no API key?)")

        # Legal scrapers
        try:
            from app.services.legal_scrapers import get_all_legal_scrapers
            self.scrapers = get_all_legal_scrapers()
            logger.info(f"Loaded {len(self.scrapers)} legal scrapers")
        except ImportError as e:
            logger.warning(f"Legal scrapers not available: {e}")

        self.initialized = True
        logger.info("NovaLex Legal Pipeline initialized")

    async def run_full_pipeline(
        self,
        sources: Optional[List[str]] = None,
        category: str = "RGPD",
    ) -> Dict[str, Any]:
        """
        Run the complete legal pipeline.

        Args:
            sources: List of source names to scrape (None = all)
            category: Legal category focus (RGPD, CYBER, FINANCE)

        Returns:
            Pipeline results dict
        """
        await self.initialize()

        results = {
            "started_at": datetime.now().isoformat(),
            "category": category,
            "raw_documents": 0,
            "embedded_documents": 0,
            "stored_documents": 0,
            "clusters": 0,
            "syntheses": 0,
            "errors": [],
        }

        # === 1. SCRAPE LEGAL SOURCES ===
        logger.info(f"Step 1: Scraping legal sources (category={category})...")
        documents = await self._scrape_sources(sources)
        results["raw_documents"] = len(documents)

        if not documents:
            logger.warning("No legal documents scraped. Aborting pipeline.")
            return results

        logger.success(f"Scraped {len(documents)} legal documents")

        # === 2. EMBED WITH GEMINI ===
        logger.info("Step 2: Embedding documents with Gemini Embedding 2...")
        embedded_docs = await self._embed_documents(documents)
        results["embedded_documents"] = len(embedded_docs)

        if not embedded_docs:
            logger.warning("No documents could be embedded. Check Gemini API key.")
            return results

        # === 3. STORE IN QDRANT ===
        logger.info("Step 3: Storing in Qdrant (novalex_documents)...")
        stored = await self._store_documents(embedded_docs)
        results["stored_documents"] = stored

        # === 4. CLUSTER RELATED DOCUMENTS ===
        logger.info("Step 4: Clustering related documents...")
        clusters = await self._cluster_documents(embedded_docs)
        results["clusters"] = len(clusters)

        # === 5. GENERATE SYNTHESES ===
        logger.info("Step 5: Generating legal syntheses...")
        syntheses = await self._generate_syntheses(clusters, category)
        results["syntheses"] = len(syntheses)

        # === 6. VERIFY REFERENCES ===
        logger.info("Step 6: Anti-hallucination verification...")
        verified = await self._verify_syntheses(syntheses)

        results["completed_at"] = datetime.now().isoformat()
        logger.success(
            f"NovaLex pipeline complete: {results['raw_documents']} docs -> "
            f"{results['clusters']} clusters -> {results['syntheses']} syntheses"
        )

        return results

    async def _scrape_sources(
        self, sources: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Scrape all legal sources concurrently."""
        all_documents = []

        active_scrapers = self.scrapers
        if sources:
            active_scrapers = [s for s in self.scrapers if s.source_name in sources]

        tasks = [scraper.scrape() for scraper in active_scrapers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                scraper_name = active_scrapers[i].source_name if i < len(active_scrapers) else "unknown"
                logger.error(f"Scraper {scraper_name} failed: {result}")
            elif isinstance(result, list):
                all_documents.extend(result)
                scraper_name = active_scrapers[i].source_name if i < len(active_scrapers) else "unknown"
                logger.info(f"{scraper_name}: {len(result)} documents")

        return all_documents

    async def _embed_documents(
        self, documents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Embed documents using Gemini Embedding 2."""
        if not self.gemini:
            logger.error("Gemini embedding service not available")
            return []

        embedded = []

        # Batch embed text content
        texts = []
        for doc in documents:
            text = f"{doc.get('title', '')} {doc.get('content', '')[:2000]}"
            texts.append(text)

        try:
            vectors = await self.gemini.embed_texts(texts, task="RETRIEVAL_DOCUMENT")

            for doc, vector in zip(documents, vectors):
                doc["vector"] = vector
                embedded.append(doc)

        except Exception as e:
            logger.error(f"Batch embedding failed: {e}")
            # Fall back to individual embedding
            for doc in documents:
                try:
                    text = f"{doc.get('title', '')} {doc.get('content', '')[:2000]}"
                    vector = await self.gemini.embed_text(text)
                    doc["vector"] = vector
                    embedded.append(doc)
                except Exception as inner_e:
                    logger.debug(f"Failed to embed doc '{doc.get('title', '')[:50]}': {inner_e}")

        return embedded

    async def _store_documents(
        self, documents: List[Dict[str, Any]]
    ) -> int:
        """Store embedded documents in Qdrant novalex collection."""
        stored = 0
        import hashlib

        for doc in documents:
            vector = doc.pop("vector", None)
            if not vector:
                continue

            # Generate deterministic ID from URL
            doc_id = hashlib.md5(doc.get("url", str(stored)).encode()).hexdigest()

            payload = {
                "title": doc.get("title", ""),
                "url": doc.get("url", ""),
                "source_name": doc.get("source_name", ""),
                "content": doc.get("content", "")[:5000],
                "summary": doc.get("summary", "")[:500],
                "published_at": doc.get("published_at", ""),
                "doc_type": doc.get("doc_type", "unknown"),
                "jurisdiction": doc.get("jurisdiction", ""),
                "category": doc.get("category", ""),
                "pdf_url": doc.get("pdf_url", ""),
                "reference": doc.get("reference", ""),
                "scraped_at": doc.get("scraped_at", datetime.now().isoformat()),
                "modality": "text",
            }

            if self.qdrant.upsert_legal_document(doc_id, vector, payload):
                stored += 1

        logger.info(f"Stored {stored}/{len(documents)} documents in Qdrant")
        return stored

    async def _cluster_documents(
        self, documents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Cluster related legal documents using HDBSCAN."""
        if len(documents) < 3:
            # Not enough documents for clustering, treat as single cluster
            return [{"cluster_id": 0, "documents": documents}] if documents else []

        try:
            import numpy as np
            from app.ml.clustering import get_clustering_engine

            vectors = np.array([doc["vector"] for doc in documents if "vector" in doc])
            clustering_engine = get_clustering_engine()
            labels, stats = clustering_engine.cluster_articles(vectors)

            # Group by cluster
            from collections import defaultdict
            clusters_map = defaultdict(list)
            for idx, label in enumerate(labels):
                if label == -1:
                    continue
                clusters_map[label].append(documents[idx])

            clusters = [
                {"cluster_id": label, "documents": docs}
                for label, docs in clusters_map.items()
                if len(docs) >= 2
            ]

            logger.info(f"Clustering: {len(clusters)} clusters from {len(documents)} documents")
            return clusters

        except Exception as e:
            logger.error(f"Clustering failed: {e}")
            return [{"cluster_id": 0, "documents": documents}]

    async def _generate_syntheses(
        self,
        clusters: List[Dict[str, Any]],
        category: str,
    ) -> List[Dict[str, Any]]:
        """Generate legal syntheses for each cluster using LLM."""
        syntheses = []

        try:
            from app.ml.llm import get_llm_service
            llm = get_llm_service()
        except Exception as e:
            logger.error(f"LLM service not available: {e}")
            return []

        for cluster in clusters:
            docs = cluster["documents"]
            if not docs:
                continue

            # Build context from legal documents
            sources_text = "\n---\n".join([
                f"SOURCE {i+1} ({doc.get('source_name', 'Unknown')}):\n"
                f"TYPE: {doc.get('doc_type', 'unknown')}\n"
                f"REFERENCE: {doc.get('reference', 'N/A')}\n"
                f"TITRE: {doc.get('title', 'No title')}\n"
                f"CONTENU: {doc.get('content', '')[:2000]}"
                for i, doc in enumerate(docs[:7])
            ])

            prompt = f"""Tu es un JURISTE SPECIALISE en {category} et protection des donnees.
Tu rediges une SYNTHESE JURIDIQUE professionnelle a partir des sources suivantes.

REGLES IMPERATIVES:
1. Cite TOUS les articles de loi avec leur numero exact
2. Distingue clairement: loi en vigueur vs projet vs jurisprudence
3. Indique la juridiction (FR, EU) pour chaque reference
4. Format: introduction, analyse, implications pratiques, recommandations
5. Chaque affirmation juridique doit etre sourcee [SOURCE:N]
6. Utilise le vocabulaire juridique precis

SOURCES:
{sources_text}

Genere un JSON avec:
{{
  "title": "titre de la synthese juridique",
  "summary": "resume en 2-3 phrases",
  "body": "corps complet de la synthese (800-1200 mots)",
  "key_points": ["point cle 1", "point cle 2", ...],
  "legal_references": ["Art. 5 RGPD", "Decision CNIL SAN-2024-001", ...],
  "implications": "implications pratiques pour DPO/avocats/dirigeants",
  "category": "{category}"
}}"""

            try:
                from app.ml.llm import get_llm_service
                llm_service = get_llm_service()
                result = await llm_service._call_openrouter(prompt, max_tokens=4000)

                if result:
                    import json
                    try:
                        # Try to parse JSON from response
                        json_match = re.search(r'\{.*\}', result, re.DOTALL)
                        if json_match:
                            synthesis = json.loads(json_match.group())
                            synthesis["cluster_id"] = cluster["cluster_id"]
                            synthesis["num_sources"] = len(docs)
                            synthesis["source_documents"] = [
                                {"title": d.get("title", ""), "url": d.get("url", ""), "source": d.get("source_name", "")}
                                for d in docs
                            ]
                            syntheses.append(synthesis)
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse LLM JSON for cluster {cluster['cluster_id']}")

            except Exception as e:
                logger.error(f"Synthesis generation failed for cluster {cluster['cluster_id']}: {e}")

        logger.info(f"Generated {len(syntheses)} legal syntheses")
        return syntheses

    async def _verify_syntheses(
        self, syntheses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Verify legal references in syntheses (anti-hallucination)."""
        from app.ml.legal_verifier import verify_synthesis

        for synthesis in syntheses:
            body = synthesis.get("body", "")
            if not body:
                continue

            try:
                verification = await verify_synthesis(body)
                synthesis["verification"] = verification

                if verification["needs_regeneration"]:
                    logger.warning(
                        f"Synthesis '{synthesis.get('title', '')[:50]}' has low confidence "
                        f"({verification['confidence_score']}%) - may need regeneration"
                    )
                else:
                    logger.info(
                        f"Synthesis verified: {verification['confidence_score']}% confidence "
                        f"({verification['references_verified']}/{verification['references_found']} refs)"
                    )
            except Exception as e:
                logger.error(f"Verification failed: {e}")
                synthesis["verification"] = {"error": str(e), "confidence_score": 0}

        return syntheses

    async def search(
        self,
        query: str,
        doc_type: Optional[str] = None,
        jurisdiction: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Search legal documents using Gemini Embedding 2 for query embedding.
        Supports cross-modal search: text query -> finds PDFs, images, decisions.
        """
        await self.initialize()

        if not self.gemini:
            logger.error("Gemini embedding service not available for search")
            return []

        # Embed query with RETRIEVAL_QUERY task type
        query_vector = await self.gemini.search_query(query)

        # Search Qdrant
        results = self.qdrant.search_legal_documents(
            query_vector=query_vector,
            limit=limit,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
            category=category,
        )

        return results


# Import re at module level
import re

# Singleton
_legal_pipeline = None


def get_legal_pipeline() -> LegalPipelineEngine:
    """Get or create the legal pipeline singleton."""
    global _legal_pipeline
    if _legal_pipeline is None:
        _legal_pipeline = LegalPipelineEngine()
    return _legal_pipeline
