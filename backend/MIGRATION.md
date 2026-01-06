# Migration Guide: Gemini → Open Source Stack

Guide de migration du code existant utilisant Gemini vers la stack 100% open source.

## Vue d'ensemble des changements

| Ancien (Gemini) | Nouveau (Open Source) | Fichier |
|-----------------|------------------------|---------|
| `GoogleGenAI` | `sentence_transformers.SentenceTransformer` | `app/ml/embeddings.py` |
| `ai.models.generateContent()` | `ollama.Client.generate()` | `app/ml/llm.py` |
| Google Search Grounding | RSS + Google News RSS | `app/services/scraper.py` |
| Gemini NER | spaCy `fr_core_news_lg` | `app/ml/knowledge_graph.py` |

## Migration étape par étape

### 1. Remplacer les embeddings

#### Ancien code (Gemini)

```python
from google.generativeai import embed

result = embed.embed_content(
    model="models/embedding-001",
    content=text
)
embedding = result['embedding']
```

#### Nouveau code (BGE-M3)

```python
from app.ml.embeddings import get_embedding_service

embedding_service = get_embedding_service()
embedding = embedding_service.encode_single(text)
```

### 2. Remplacer la génération de texte

#### Ancien code (Gemini)

```python
from google.generativeai import GenerativeModel

model = GenerativeModel('gemini-2.5-flash')
response = model.generate_content(prompt)
text = response.text
```

#### Nouveau code (Ollama/Mistral)

```python
from app.ml.llm import get_llm_service

llm_service = get_llm_service()
text = llm_service.generate(prompt, temperature=0.7)
```

### 3. Remplacer la génération JSON

#### Ancien code (Gemini)

```python
result = model.generate_content(
    prompt,
    generation_config={"response_mime_type": "application/json"}
)
data = json.loads(result.text)
```

#### Nouveau code (Ollama)

```python
from app.ml.llm import get_llm_service

llm_service = get_llm_service()
data = llm_service.generate_json(prompt)
```

### 4. Remplacer le scraping

#### Ancien code (Google Search Grounding)

```python
result = ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Search for articles about AI',
    config: { tools: [{ googleSearch: {} }] }
})
```

#### Nouveau code (RSS + Google News)

```python
from app.services.scraper import get_scraper_service

scraper = get_scraper_service()

# Option 1: RSS feeds
articles = await scraper.scrape_rss_feeds()

# Option 2: Google News RSS (no API key)
articles = await scraper.search_google_news("AI", max_results=10)
```

### 5. Remplacer l'extraction d'entités

#### Ancien code (Gemini NER)

```python
prompt = f"Extract entities from: {text}"
result = model.generate_content(prompt)
entities = parse_entities(result.text)
```

#### Nouveau code (spaCy)

```python
from app.ml.knowledge_graph import get_kg_extractor

kg_extractor = get_kg_extractor()
entities = kg_extractor.extract_entities([text])
```

### 6. Remplacer le Knowledge Graph

#### Ancien code (Gemini)

```python
prompt = """
Analyze these texts and build a Knowledge Graph.
Format: JSON with nodes and edges.
"""
result = model.generate_content(prompt, format="json")
graph = json.loads(result.text)
```

#### Nouveau code (spaCy + NetworkX)

```python
from app.ml.knowledge_graph import get_kg_extractor

kg_extractor = get_kg_extractor()
graph = kg_extractor.build_knowledge_graph(articles)
```

## Migration du Pipeline principal

### Ancien Pipeline (docs/pipeline.ts)

```typescript
// 1. COLLECTE via Gemini
const articles = await GeminiService.fetchSourceMaterial(topic, mode);

// 2. VECTORISATION via Gemini Embeddings
// (implicite)

// 3. GRAPH via Gemini
const graph = await GeminiService.extractKnowledgeGraph(articles);

// 4. SYNTHÈSE via Gemini
const synthesis = await GeminiService.generateSynthesis(clusterArticles);
```

### Nouveau Pipeline (app/services/pipeline.py)

```python
from app.services.pipeline import get_pipeline_engine

pipeline = get_pipeline_engine()
await pipeline.initialize()

# Exécuter le pipeline complet
results = await pipeline.run_full_pipeline(
    topics=["Intelligence Artificielle"],
    mode="RSS"
)

# Résultats
print(f"Articles: {results['total_articles']}")
print(f"Clusters: {len(results['clusters'])}")
print(f"Knowledge Graph: {results['knowledge_graph']}")
print(f"Synthèses: {len(results['syntheses'])}")
```

## Avantages de la migration

### Coûts

| Opération | Gemini (API) | Open Source |
|-----------|--------------|-------------|
| 1000 embeddings | ~$0.025 | $0 |
| 1000 LLM calls | ~$0.50 | $0 |
| Total mensuel (100k articles) | ~$50-100 | $0 |

### Performance

- **Latence**: ~100ms vs ~500ms (réseau)
- **Débit**: Limité par GPU local vs rate limits API
- **Disponibilité**: 100% vs dépend de Google

### Confidentialité

- **Gemini**: Données envoyées à Google
- **Open Source**: 100% local, confidentialité totale

## Checklist de migration

- [ ] Installer Ollama et télécharger Mistral
- [ ] Installer spaCy et télécharger `fr_core_news_lg`
- [ ] Configurer Qdrant pour le stockage vectoriel
- [ ] Remplacer tous les appels `GeminiService.*`
- [ ] Tester le pipeline complet
- [ ] Comparer les résultats (qualité)
- [ ] Optimiser les prompts pour Mistral
- [ ] Déployer en production

## Troubleshooting

### Ollama ne démarre pas

```bash
# Vérifier le service
docker logs novapress_ollama

# Redémarrer
docker-compose restart ollama
```

### spaCy model manquant

```bash
# Dans le container
docker exec novapress_backend python -m spacy download fr_core_news_lg

# Ou en local
python -m spacy download fr_core_news_lg
```

### Embeddings trop lents

```python
# Activer GPU (si disponible)
# Dans .env
EMBEDDING_DEVICE=cuda

# Augmenter batch size
EMBEDDING_BATCH_SIZE=64
```

### LLM génère du texte de mauvaise qualité

```python
# Ajuster la température
llm_service.generate(prompt, temperature=0.5)  # Plus déterministe

# Utiliser un meilleur modèle
ollama pull mistral:latest
# ou
ollama pull llama2:13b
```

## Support

Pour toute question sur la migration :
- Documentation: `/backend/README.md`
- Examples: `/backend/examples/`
- Issues: GitHub Issues

---

**Migration complète: Gemini → Open Source** ✅
