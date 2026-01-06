# NovaPress AI v2 - Skills & Ressources

**Version**: 2.0.0 | **Mise à jour**: 30 Nov 2025

---

## Quick Commands

### Lancement Projet Complet

```powershell
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd backend && .\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 5000

# Terminal 3: Pipeline IA
cd backend && .\venv\Scripts\Activate.ps1
python scripts/run_fast_pipeline.py
```

### Services Docker

```powershell
# Démarrer tous les services
docker start tradingbot_v2-postgres-1 tradingbot_v2-redis-1 tradingbot_v2-qdrant-1

# Vérifier status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Logs en temps réel
docker logs -f tradingbot_v2-qdrant-1
```

---

## Fichiers Clés par Fonctionnalité

### Frontend (Next.js 15)

| Fonctionnalité | Fichier | Description |
|----------------|---------|-------------|
| Page principale | `app/page.tsx` | Layout newspaper, articles grid |
| Article détail | `app/article/[id]/page.tsx` | Page article individuel |
| Synthèse détail | `app/synthesis/[id]/page.tsx` | Page synthèse IA complète |
| HeroArticle | `app/components/articles/HeroArticle.tsx` | Article principal full-width |
| SecondaryRow | `app/components/articles/SecondaryArticleRow.tsx` | 2 articles horizontaux |
| CompactCard | `app/components/articles/CompactArticleCard.tsx` | Cartes grille minimalistes |
| SynthesisCard | `app/components/articles/SynthesisCard.tsx` | Carte synthèse IA |
| IntelligenceSection | `app/components/articles/IntelligenceSection.tsx` | Section synthèses IA (filtrage catégorie) |
| NewsTicker | `app/components/layout/NewsTicker.tsx` | **NEW** Ticker dynamique API |
| Navigation | `app/components/layout/Navigation.tsx` | **NEW** Catégories + EN DIRECT |
| Page Live | `app/live/page.tsx` | **NEW** Timeline temps réel |
| API Client | `app/lib/api/client.ts` | HTTP client pour backend |
| Articles Service | `app/lib/api/services/articles.ts` | Services API articles |
| Syntheses Service | `app/lib/api/services/syntheses.ts` | **NEW** Services API synthèses |
| Context Articles | `app/contexts/ArticlesContext.tsx` | State global articles |
| Config API | `app/lib/api/config.ts` | Configuration endpoints |
| Types API | `app/types/api.ts` | Types Synthesis, CategoryStats, etc. |

### Backend (FastAPI)

| Fonctionnalité | Fichier | Description |
|----------------|---------|-------------|
| Main App | `backend/app/main.py` | Point d'entrée FastAPI |
| Routes Articles | `backend/app/api/routes/articles.py` | CRUD articles |
| Routes Syntheses | `backend/app/api/routes/syntheses.py` | API synthèses IA + breaking/live/category |
| Routes Trending | `backend/app/api/routes/trending.py` | **NEW** Categories + live-count |
| Pipeline IA | `backend/app/services/pipeline.py` | Orchestration V6 ULTIMATE |
| Category Classifier | `backend/app/ml/category_classifier.py` | **NEW** Classification NLP par keywords |
| Advanced Scraper | `backend/app/services/advanced_scraper.py` | 53 sources news |
| Social Scraper | `backend/app/services/social_scraper.py` | Reddit, HN, ArXiv, Wikipedia |
| Embeddings | `backend/app/ml/embeddings.py` | BGE-M3 (1024-dim) |
| Clustering | `backend/app/ml/clustering.py` | HDBSCAN + Sub-clustering |
| Advanced RAG | `backend/app/ml/advanced_rag.py` | Chunking, contradictions, facts |
| Temporal Narrative | `backend/app/ml/temporal_narrative.py` | TNA - historical context |
| Search Enrichment | `backend/app/ml/search_enrichment.py` | Perplexity + Grok |
| LLM Service | `backend/app/ml/llm.py` | Génération synthèses OpenRouter |
| Qdrant Client | `backend/app/db/qdrant_client.py` | Vector database |
| Config | `backend/app/core/config.py` | Settings centralisés |

### Configuration

| Fichier | Contenu |
|---------|---------|
| `backend/.env` | Variables backend (DB, Redis, API keys, Perplexity, Grok) |
| `.env.local` | Variables frontend (API URLs) |
| `next.config.ts` | Config Next.js (images, etc.) |
| `backend/app/core/config.py` | Settings Pydantic centralisés |

---

## Pipeline V6 ULTIMATE - Flow Complet

```
Scraping (53 news + Reddit/HN/ArXiv/Wikipedia)
    ↓
Embeddings (BGE-M3, 1024-dim)
    ↓
Déduplication (cosine similarity > 0.85)
    ↓
Clustering (HDBSCAN + Sub-clustering)
    ↓
Advanced RAG (Chunking, Contradictions, Fact Density)
    ↓
Temporal Narrative Arc (Historical Context, Story Evolution)
    ↓
Search Enrichment (Perplexity + Grok - optionnel)
    ↓
LLM Synthesis (OpenRouter - toujours en français)
    ↓
Storage (Qdrant Vector DB)
```

### Paramètres Clustering (config.py)

```python
MIN_CLUSTER_SIZE: int = 3          # Minimum articles par cluster
MIN_SAMPLES: int = 2               # Densité minimum
CLUSTER_SELECTION_EPSILON: float = 0.08  # Distance max intra-cluster
MIN_CLUSTER_SIMILARITY: float = 0.55     # Cohérence minimum (cosine)
MAX_CLUSTER_SIZE: int = 20         # Déclenche sub-clustering si dépassé
```

---

## Patterns de Code Récurrents

### Fetch Articles (Frontend)

```typescript
// app/lib/api/services.ts
export const articlesService = {
  getAll: async (params?: ArticlesParams): Promise<Article[]> => {
    const response = await apiClient.get('/api/articles', { params });
    return response.data;
  },
  getById: async (id: string): Promise<Article> => {
    const response = await apiClient.get(`/api/articles/${id}`);
    return response.data;
  }
};
```

### Pipeline Execution (Backend)

```python
# backend/app/services/pipeline.py
async def run_pipeline():
    # 1. Multi-source Scraping
    articles = await collect_articles(sources)  # News + Social + Academic

    # 2. RAG: Fetch historical
    recent = qdrant.get_recent_articles(hours=24)
    combined = articles + recent

    # 3. Embeddings
    embeddings = embedding_service.encode(texts)

    # 4. Déduplication
    unique_articles = deduplicate(combined, embeddings)

    # 5. Clustering + Sub-clustering
    clusters = cluster_articles(unique_articles, embeddings)

    # 6. Generate Syntheses (RAG + TNA + Search Enrichment)
    syntheses = await generate_syntheses(clusters)

    # 7. Storage Qdrant
    store_articles(unique_articles, embeddings)
    store_syntheses(syntheses)
```

### Search Enrichment (Backend)

```python
# backend/app/ml/search_enrichment.py
async def enrich_cluster(cluster_topic, key_entities, claims_to_verify):
    # Perplexity: Web search + fact-checking
    perplexity_result = await perplexity.search_context(cluster_topic)
    fact_checks = await perplexity.fact_check(claims_to_verify)

    # Grok: Social sentiment + breaking news
    grok_result = await grok.get_social_context(cluster_topic)

    return EnrichedContext(
        perplexity_context=perplexity_result["content"],
        grok_context=grok_result["content"],
        social_sentiment=grok_result["sentiment"]
    )
```

### Qdrant Operations

```python
# Recherche sémantique
results = qdrant_client.query_points(
    collection_name="novapress_articles",
    query=query_embedding,
    limit=10,
    score_threshold=0.7
)

# Storage avec payload
qdrant_client.upsert(
    collection_name="novapress_articles",
    points=[
        PointStruct(
            id=article_id,
            vector=embedding,
            payload={"title": title, "content": content}
        )
    ]
)
```

---

## API Endpoints Reference

### Articles

```
GET  /api/articles           → Liste paginée (limit, offset, category)
GET  /api/articles/:id       → Article unique
POST /api/search?q=          → Recherche sémantique
```

### Syntheses

```
GET  /api/syntheses              → Liste synthèses IA
GET  /api/syntheses/:id          → Synthèse unique avec contenu complet
GET  /api/syntheses/breaking     → Synthèses pour news ticker (5 récentes)
GET  /api/syntheses/live         → Synthèses dernières X heures (?hours=24)
GET  /api/syntheses/category/:cat→ Filtrage par catégorie (MONDE, TECH, etc.)
```

### Trending

```
GET  /api/trending               → Topics tendances
GET  /api/trending/categories    → Stats par catégorie avec compteurs
GET  /api/trending/live-count    → Compteur pour badge EN DIRECT
```

### Health & Debug

```
GET  /health                 → Status services
GET  /api/docs               → Swagger UI
```

---

## Troubleshooting Quick Fixes

### Erreur: Port 3000 occupé

```powershell
npm run dev -- -p 3002
```

### Erreur: Redis connection refused

```powershell
# Port 6379 (vérifier .env)
docker start tradingbot_v2-redis-1
```

### Erreur: 0 clusters générés

```python
# config.py - Ajuster les seuils
MIN_CLUSTER_SIMILARITY: float = 0.55  # Réduire si trop strict (était 0.80)
CLUSTER_SELECTION_EPSILON: float = 0.08  # Augmenter pour clusters plus larges
```

### Erreur: Cluster too large

Le sub-clustering se déclenche automatiquement. Sinon:
```python
MAX_CLUSTER_SIZE: int = 25  # Augmenter si nécessaire
```

### Erreur: Search Enrichment non actif

```bash
# backend/.env - Vérifier les clés API
PERPLEXITY_API_KEY=pplx-xxx
XAI_API_KEY=xai-xxx
```

### Erreur: Qdrant collection missing

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

client = QdrantClient(url="http://localhost:6333")
client.create_collection(
    collection_name="novapress_articles",
    vectors_config=VectorParams(size=1024, distance=Distance.COSINE)
)
```

### Erreur: spaCy model not found

```powershell
python -m spacy download fr_core_news_lg
```

### Erreur: CORS

```python
# backend/.env - Format JSON obligatoire
CORS_ORIGINS=["http://localhost:3000","http://localhost:3002"]
```

### Erreur: Images externes bloquées

```typescript
// next.config.ts
images: { unoptimized: true }
```

### Erreur: Cache Next.js corrompu

```powershell
rm -rf .next && rm -rf node_modules/.cache
# Puis Ctrl+Shift+R dans navigateur
```

---

## Design System Reference

### Palette Officielle

```typescript
const colors = {
  text: '#000000',           // Titres, contenu principal
  textSecondary: '#6B7280',  // Metadata, dates
  breaking: '#DC2626',       // BREAKING NEWS, alertes
  logoAI: '#2563EB',         // Logo "AI" uniquement
  bgMain: '#FFFFFF',         // Fond principal
  bgSecondary: '#F9FAFB',    // Fond secondaire
  border: '#E5E5E5',         // Bordures, séparateurs
};
```

### Typography

- **Titres**: `font-family: Georgia, 'Times New Roman', serif`
- **Corps**: `font-family: system-ui, -apple-system, sans-serif`
- **Ticker**: `14px, uppercase, font-weight: bold`

### Règles Strictes

- **NO** gradients colorés
- **NO** animations excessives
- **NO** couleurs vives/néon
- **YES** style newspaper professionnel
- **YES** hiérarchie claire
- **YES** inline styles pour fiabilité

---

## Tests & Validation

### Valider Setup Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python scripts/validate_setup.py
```

### Tester Pipeline

```powershell
python scripts/run_fast_pipeline.py
```

### Vérifier API

```powershell
# Health check
curl http://localhost:5000/health

# Articles
curl http://localhost:5000/api/articles

# Synthèses
curl http://localhost:5000/api/syntheses
```

### Scores Lighthouse Cibles

| Métrique | Cible |
|----------|-------|
| Performance | > 95 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | > 90 |

---

## Agents Claude Disponibles

### novapress-design-review

Revue design complète avec Playwright. Vérifie:
- Absence de gradients
- Style newspaper
- Responsive design
- Comparaison NYT/Le Monde

**Usage**: `Task tool → subagent_type: "novapress-design-review"`

### ui-enhancement

Amélioration continue UI. Focus:
- Performance composants
- Optimisation images
- Code splitting
- Core Web Vitals

**Usage**: `Task tool → subagent_type: "ui-enhancement"`

---

## Commandes Slash Disponibles

### /audit-claude-doc

Audit complet de `.claude/CLAUDE.md` avec scoring.

### /update-docs

Met à jour la documentation après une session de travail.

---

## Liens Documentation Externe

| Technologie | Documentation |
|-------------|---------------|
| Next.js 15 | https://nextjs.org/docs |
| FastAPI | https://fastapi.tiangolo.com |
| BGE-M3 | https://huggingface.co/BAAI/bge-m3 |
| Qdrant | https://qdrant.tech/documentation |
| HDBSCAN | https://hdbscan.readthedocs.io |
| Playwright | https://playwright.dev/docs |
| Perplexity API | https://docs.perplexity.ai |
| xAI Grok API | https://docs.x.ai |
| OpenRouter | https://openrouter.ai/docs |

---

## Métriques Pipeline (Derniers Tests - 30 Nov 2025)

| Étape | Résultat |
|-------|----------|
| Sources news testées | 53 |
| Sources alternatives | Reddit, HN, ArXiv, Wikipedia |
| Articles scrapés | 130 |
| Articles uniques (RAG) | 179 |
| Clusters initiaux | 14 |
| Clusters validés | En attente test post-fix |
| Synthèses créées | En attente test post-fix |
| Temps total | ~375s |

### Logs Attendus (Post-Fix)

```
📊 Initial HDBSCAN: X clusters
🔀 Cluster Y too large, attempting sub-clustering...
✂️ Cluster Y split into Z sub-clusters
✅ Cluster X validated (size=N, coherence=0.XX)
🌐 Search enrichment: Perplexity=True, Grok=True, Sentiment=XXX
🚀 Using ULTIMATE synthesis (RAG + TNA + Search)
✅ Generated N AI syntheses
```

---

**Mission**: Transformer le chaos informationnel en intelligence journalistique via l'IA.
