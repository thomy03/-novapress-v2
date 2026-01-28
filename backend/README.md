# NovaPress AI v2 - Backend

## 100% Open Source Stack - NO GOOGLE/GEMINI

Backend professionnel pour plateforme d'intelligence d'actualités.

## Stack Technologique

### Core
- **FastAPI** 0.115.0 - Framework API moderne et performant
- **Python** 3.11+ - Langage principal
- **PostgreSQL** 16 - Base de données relationnelle
- **Redis** 7 - Cache et sessions

### Machine Learning (100% Open Source)
- **BGE-M3** (BAAI/bge-m3) - Embeddings multilingues 1024-dim
- **sentence-transformers** - Gestion des embeddings
- **Ollama** + **Mistral 7B** - LLM local pour synthèses
- **spaCy** (fr_core_news_lg) - NER et analyse linguistique
- **HDBSCAN** - Clustering par densité
- **NetworkX** - Analyse de graphes de connaissance

### Vector Database
- **Qdrant** - Stockage et recherche vectorielle

### Web Scraping
- **BeautifulSoup4** - Parsing HTML
- **Newspaper3k** - Extraction d'articles
- **feedparser** - Parsing RSS
- **httpx** - Client HTTP async

## Architecture

```
backend/
├── app/
│   ├── main.py                 # Point d'entrée FastAPI
│   ├── core/
│   │   └── config.py          # Configuration centralisée
│   ├── api/
│   │   └── routes/            # Endpoints API
│   │       ├── articles.py    # Articles CRUD
│   │       ├── trending.py    # Topics tendance
│   │       ├── search.py      # Recherche sémantique
│   │       ├── auth.py        # Authentification
│   │       └── websocket.py   # WebSocket temps réel
│   ├── db/
│   │   ├── session.py         # PostgreSQL session
│   │   └── qdrant_client.py   # Qdrant vector DB
│   ├── ml/
│   │   ├── embeddings.py      # BGE-M3 service
│   │   ├── llm.py             # Ollama/Mistral service
│   │   ├── clustering.py      # HDBSCAN clustering
│   │   └── knowledge_graph.py # spaCy + NetworkX
│   └── services/
│       ├── scraper.py         # Web scraping
│       └── pipeline.py        # Pipeline principal
├── docker-compose.yml         # Orchestration
├── Dockerfile                 # Image Docker
├── requirements.txt           # Dépendances Python
└── README.md                  # Ce fichier
```

## Installation

### Prérequis

- Python 3.11+
- Docker & Docker Compose
- 8GB RAM minimum (16GB recommandé)
- GPU optionnel (pour accélération)

### Installation Locale

```bash
# 1. Installer les dépendances
pip install -r requirements.txt

# 2. Télécharger le modèle spaCy
python -m spacy download fr_core_news_lg

# 3. Installer Ollama
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Télécharger depuis https://ollama.ai

# 4. Télécharger Mistral
ollama pull mistral:7b-instruct

# 5. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 6. Lancer le backend
uvicorn app.main:app --reload --port 5000
```

### Installation Docker (Recommandé)

```bash
# 1. Copier la configuration
cp .env.example .env

# 2. Lancer tous les services
docker-compose up -d

# 3. Télécharger Mistral dans Ollama
docker exec -it novapress_ollama ollama pull mistral:7b-instruct

# 4. Vérifier le statut
docker-compose ps
```

## Configuration

### Variables d'Environnement

Voir `.env.example` pour la configuration complète.

**Essentielles:**

```env
# Base de données
DATABASE_URL=postgresql+asyncpg://novapress:password@localhost:5432/novapress_db
REDIS_URL=redis://localhost:6379/0

# Qdrant
QDRANT_URL=http://localhost:6333

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral:7b-instruct

# Sécurité
SECRET_KEY=votre-secret-key-tres-securisee

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
```

## Utilisation

### Pipeline Principal

Le pipeline NovaPress V3 exécute automatiquement :

1. **Scraping** - Collecte d'articles (RSS, Google News)
2. **Embeddings** - Vectorisation BGE-M3 (1024-dim)
3. **Clustering** - Regroupement HDBSCAN
4. **Knowledge Graph** - Extraction d'entités (spaCy)
5. **Synthesis** - Rédaction IA (Ollama/Mistral)
6. **Storage** - Stockage Qdrant + PostgreSQL

### API Endpoints

**Documentation interactive:** http://localhost:5000/api/docs

#### Articles

```bash
# Liste des articles
GET /api/articles?page=1&limit=20&category=tech

# Article par ID
GET /api/articles/{id}

# Articles similaires
GET /api/articles/{id}/related?limit=5

# Breaking news
GET /api/articles/breaking
```

#### Recherche Sémantique

```bash
# Recherche par similarité vectorielle
GET /api/search?q=intelligence+artificielle&limit=10
```

#### Trending

```bash
# Topics tendance
GET /api/trending

# Synthèse d'un topic
GET /api/trending/{topic_id}/synthesis
```

#### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:5000/ws/updates');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'breaking_news') {
    console.log('Breaking:', data.article);
  }
};
```

## Pipeline Programmatique

```python
from app.services.pipeline import get_pipeline_engine

# Initialiser
pipeline = get_pipeline_engine()
await pipeline.initialize()

# Exécuter
results = await pipeline.run_full_pipeline(
    topics=["IA", "Économie"],
    mode="RSS"  # ou "SEARCH" ou "SIMULATION"
)

print(f"Articles collectés: {results['total_articles']}")
print(f"Clusters: {len(results['clusters'])}")
print(f"Synthèses: {len(results['syntheses'])}")
print(f"Graph: {len(results['knowledge_graph']['nodes'])} noeuds")
```

## Tests

```bash
# Tests unitaires
pytest tests/ -v

# Tests avec couverture
pytest --cov=app tests/

# Tests d'intégration
pytest tests/integration/ -v
```

## Performance

### Optimisations

- **Batch Processing** - Embeddings par batch (32 articles)
- **Async I/O** - Scraping concurrent
- **Redis Cache** - Mise en cache des résultats
- **Qdrant** - Recherche vectorielle ultra-rapide

### Benchmarks

| Opération | Temps | Throughput |
|-----------|-------|------------|
| Embedding (1 article) | ~50ms | 20 articles/s |
| Clustering (100 articles) | ~300ms | - |
| Knowledge Graph | ~2s | - |
| Synthesis LLM | ~5s | - |
| Pipeline complet | ~30s | 100 articles |

## Production

### Déploiement

```bash
# Build image Docker
docker build -t novapress-backend:latest .

# Push vers registry
docker tag novapress-backend:latest registry.example.com/novapress:latest
docker push registry.example.com/novapress:latest

# Déployer
docker stack deploy -c docker-compose.prod.yml novapress
```

### Monitoring

- **Logs** - Loguru avec rotation
- **Métriques** - Prometheus endpoint `/metrics`
- **Health Check** - `/health`

## Différences avec Gemini

| Fonctionnalité | Gemini (Old) | NovaPress V3 (New) |
|----------------|--------------|---------------------|
| Embeddings | Google Embeddings | BGE-M3 (BAAI) |
| LLM | Gemini Flash | Ollama/Mistral |
| Scraping | Google Search Grounding | RSS + Google News RSS |
| NER | Gemini | spaCy fr_core_news_lg |
| Coût | $$$$ API calls | $0 (local) |
| Confidentialité | Données envoyées à Google | 100% local |
| Performance | Dépend réseau | Ultra-rapide local |

## Licence

MIT License - NovaPress AI v2

## Support

- Documentation: `/api/docs`
- Issues: https://github.com/novapress/backend/issues
- Email: support@novapress.ai

---

**NovaPress AI v2 - 100% Open Source, 0% Google/Gemini** 🚀
