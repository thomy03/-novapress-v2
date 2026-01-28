# NovaPress AI v2 - Scraping Avancé & Respect des Règles

## 🎯 Objectif

Créer des **synthèses originales** en scrappant directement les articles de journaux mondiaux, tout en **respectant strictement** les règles légales et éthiques.

## ✅ Respect des Règles

### 1. robots.txt

```python
# Vérification automatique avant CHAQUE requête
if not self._check_robots_txt(domain, url):
    logger.warning(f"Scraping not allowed by robots.txt: {url}")
    return None
```

**Comment ça marche:**
- Télécharge et parse le `robots.txt` de chaque site
- Cache les règles pour éviter de recharger
- Respecte les interdictions (`Disallow`)
- Utilise User-Agent: `NovaPress/2.0`

### 2. Rate Limiting Intelligent

```python
# Délai entre requêtes par domaine
RATE_LIMITS = {
    "lemonde.fr": 1.0,      # 1 sec entre requêtes
    "nytimes.com": 2.0,     # 2 sec (plus conservateur)
    "theguardian.com": 1.0
}
```

**Pourquoi:**
- Évite de surcharger les serveurs
- Respecte les ressources des sites
- Évite les bannissements IP

### 3. Détection de Paywall

```python
# Si paywall détecté, on SKIP l'article
if self._detect_paywall(html, url):
    logger.warning(f"Paywall detected: {url}")
    return None  # On ne contourne PAS
```

**Contenu paywall:**
- ❌ ON NE CONTOURNE PAS
- ❌ ON N'UTILISE PAS de techniques de bypass
- ✅ On scrape uniquement le contenu librement accessible

### 4. User-Agent Transparent

```python
headers = {
    "User-Agent": "NovaPress/2.0 (+https://novapress.ai)"
}
```

**Identification claire:**
- Nom du bot
- URL du projet
- Pas de masquage en navigateur

### 5. Déduplication Éthique

```python
# On garde le MEILLEUR article, pas tous les doublons
if await self._is_duplicate(title, content):
    return None  # Skip duplicate
```

**Pourquoi:**
- Évite de surcharger le stockage
- Respecte les sources originales
- Synthèses de meilleure qualité

---

## 🌍 Sources Scrappées (10 journaux mondiaux)

### Français
- **Le Monde** (lemonde.fr)
- **Le Figaro** (lefigaro.fr)
- **Libération** (liberation.fr)

### Anglais
- **The New York Times** (nytimes.com)
- **The Guardian** (theguardian.com)
- **BBC News** (bbc.com)
- **Reuters** (reuters.com)

### Autres Langues
- **Der Spiegel** (spiegel.de) - Allemand
- **El País** (elpais.com) - Espagnol
- **Corriere della Sera** (corriere.it) - Italien

---

## 🔧 Fonctionnement du Pipeline V4

### Étape 1: Découverte d'Articles

```python
# Visite la page d'accueil de chaque source
articles_urls = await scraper.discover_article_urls("lemonde.fr", max_articles=20)

# Résultat: Liste d'URLs d'articles récents
# ['https://lemonde.fr/article/...', ...]
```

**Processus:**
1. Charge la homepage
2. Parse HTML avec BeautifulSoup
3. Extrait liens d'articles (pas sections/catégories)
4. Filtre URLs valides
5. Retourne max 20 URLs

### Étape 2: Scraping d'Articles

```python
# Pour chaque URL découverte
article_data = await scraper.scrape_article(url)

# Extraction avec Newspaper3k
{
    "url": "https://...",
    "source_name": "Le Monde",
    "raw_title": "Titre de l'article",
    "raw_text": "Contenu complet...",
    "summary": "Résumé auto-extrait",
    "published_at": "2025-01-19T...",
    "authors": ["Auteur 1", "Auteur 2"],
    "image_url": "https://...",
    "language": "fr"
}
```

**Newspaper3k** fait:
- Téléchargement HTML
- Détection automatique du contenu principal
- Extraction auteurs, date, images
- Nettoyage HTML (retire pub, menus, etc.)

### Étape 3: Déduplication Intelligente

```python
# Détecte doublons par embeddings
similarity_matrix = compute_similarity(embeddings)

# Groupes d'articles similaires
groups = [[0, 5, 12],  # Même événement, 3 sources différentes
          [3, 8],      # Même sujet, 2 sources
          [15, 20]]    # Doublons

# Garde le meilleur de chaque groupe
for group in groups:
    best = select_best_article(articles, group)
    keep.append(best)
```

**Critères de sélection:**
1. **Longueur** (40%) - Article le plus complet
2. **Image** (20%) - Présence d'illustration
3. **Source** (30%) - Source réputée (NYT, Guardian, Le Monde...)
4. **Fraîcheur** (10%) - Plus récent

**Résultat:**
- 100 articles scrapés → 60 articles uniques
- Taux de déduplication: ~40%

### Étape 4: Embeddings BGE-M3

```python
# Vectorisation pour similarité sémantique
embeddings = bge_m3.encode(articles)
# Shape: (60, 1024)
```

**BGE-M3:**
- Multilingue (français, anglais, etc.)
- 1024 dimensions
- État de l'art pour retrieval

### Étape 5: Clustering HDBSCAN

```python
# Regroupe articles par thème
clusters = hdbscan.fit_predict(embeddings)

# Résultat: 8 clusters thématiques
# Cluster 0: IA et technologie (15 articles)
# Cluster 1: Économie mondiale (12 articles)
# Cluster 2: Géopolitique (8 articles)
# ...
```

**HDBSCAN:**
- Détection automatique du nombre de clusters
- Pas besoin de spécifier K
- Robuste au bruit

### Étape 6: Knowledge Graph

```python
# Extraction d'entités avec spaCy
entities = spacy_ner.extract(articles)

# Construction du graphe
graph = {
    "nodes": [
        {"id": "node_0", "label": "Emmanuel Macron", "type": "PERSON"},
        {"id": "node_1", "label": "Union Européenne", "type": "ORG"},
        ...
    ],
    "edges": [
        {"source": "node_0", "target": "node_1", "label": "CO_OCCURS"},
        ...
    ]
}
```

**spaCy fr_core_news_lg:**
- Reconnaissance d'entités nommées
- Personnes, organisations, lieux, événements
- Précision: 92% sur français

### Étape 7: Synthèse AI (Ollama/Mistral)

```python
# Pour chaque cluster (top 10)
synthesis = await mistral.generate_synthesis(cluster_articles)

# Résultat
{
    "title": "Intelligence Artificielle : les régulations se multiplient",
    "summary": "Face à l'essor de l'IA, les gouvernements mondiaux...",
    "keyPoints": [
        "L'UE finalise son AI Act",
        "Les États-Unis annoncent de nouvelles règles",
        "Débat sur l'IA générative et droits d'auteur"
    ],
    "sources": ["Le Monde", "NYT", "Guardian"],
    "complianceScore": 95,
    "readingTime": 3
}
```

**Ollama/Mistral:**
- LLM local (pas d'API externe)
- Génération de synthèses factuelles
- Respect des sources
- Aucun plagiat

---

## 📊 Exemple Complet

```python
from app.services.pipeline import get_pipeline_engine

# Initialiser
pipeline = get_pipeline_engine()
await pipeline.initialize()

# Exécuter pipeline
results = await pipeline.run_full_pipeline(
    mode="SCRAPE",  # Scraper les sources
    sources=["lemonde.fr", "nytimes.com", "theguardian.com"],
    max_articles_per_source=20
)

# Résultats
print(f"Articles scrapés: {results['stats']['total_scraped']}")
print(f"Articles uniques: {results['stats']['unique_articles']}")
print(f"Clusters: {results['stats']['clusters_found']}")
print(f"Synthèses: {results['stats']['syntheses_generated']}")
print(f"Sources: {results['stats']['sources_used']}")
```

**Output attendu:**
```
🚀 NovaPress Pipeline V4 ULTIMATE (Mode: SCRAPE)
📡 Step 1: Advanced Web Scraping...
   Discovered 20 articles from Le Monde
   Discovered 20 articles from The New York Times
   Discovered 18 articles from The Guardian
   ✅ Scraped 48 articles from 3 sources

🧮 Step 2: Computing embeddings...
   ✅ Generated 48 embeddings (1024-dim)

🔍 Step 3: Intelligent deduplication...
   ✅ 32 unique articles (16 duplicates removed)

🔗 Step 4: Clustering...
   ✅ Found 6 thematic clusters

🕸️ Step 5: Knowledge Graph...
   ✅ Graph: 45 entities, 87 relations

✍️ Step 6: AI Syntheses...
   Generating synthesis for cluster 0 (8 articles)
   Generating synthesis for cluster 1 (7 articles)
   ...
   ✅ Generated 6 AI syntheses

💾 Step 7: Storage...
   ✅ Articles stored in vector database

🎉 Pipeline completed in 42.3s!
```

---

## 🔒 Garanties Légales & Éthiques

### ✅ CE QU'ON FAIT

1. **Scraping Transparent**
   - User-Agent identifiable
   - Respect robots.txt
   - Rate limiting

2. **Contenu Libre**
   - Uniquement contenu public
   - Pas de contournement paywall
   - Attribution des sources

3. **Transformation Creative**
   - Synthèses originales (pas de copie)
   - Analyse sémantique propre
   - Clustering intelligent
   - Graphes de connaissances

4. **Fair Use**
   - Usage informatif/éducatif
   - Transformation substantielle
   - Pas de reproduction intégrale

### ❌ CE QU'ON NE FAIT PAS

1. **Pas de contournement**
   - Pas de bypass paywall
   - Pas de masquage User-Agent
   - Pas d'abus de fréquence

2. **Pas de plagiat**
   - Pas de copie d'articles entiers
   - Pas de republication sans transformation
   - Attribution systématique

3. **Pas de surcharge**
   - Rate limiting strict
   - Concurrence limitée
   - Cache pour éviter re-scraping

---

## 🎓 Aspect Légal (Fair Use / Exception de Citation)

### En France: Exception de Citation

**Article L122-5 du CPI:**
> "Les analyses et courtes citations justifiées par le caractère critique, polémique, pédagogique, scientifique ou d'information de l'œuvre à laquelle elles sont incorporées"

**NovaPress respecte:**
- ✅ Citation courte (résumés, pas articles entiers)
- ✅ Caractère informatif
- ✅ Attribution de la source
- ✅ Transformation substantielle (synthèse AI)

### Aux USA: Fair Use

**17 U.S. Code § 107:**
1. **Purpose**: Informatif, éducatif ✅
2. **Nature**: Œuvres factuelles (news) ✅
3. **Amount**: Portions raisonnables (résumés) ✅
4. **Effect**: Pas de concurrence directe ✅

---

## 📈 Performance

| Métrique | Valeur |
|----------|--------|
| Sources scrapées | 10 journaux mondiaux |
| Articles/source | ~20 |
| Total brut | ~200 articles |
| Après déduplication | ~120 articles uniques |
| Clusters détectés | ~15 thématiques |
| Synthèses générées | ~10-15 |
| Temps pipeline | ~45-60 secondes |

---

## 🚀 Utilisation

```bash
# Mode SCRAPE (journaux mondiaux)
python -m app.services.pipeline --mode=SCRAPE

# Mode TOPIC (recherche thématique)
python -m app.services.pipeline --mode=TOPIC --topics="IA,Économie"

# Mode SIMULATION (test)
python -m app.services.pipeline --mode=SIMULATION
```

---

**NovaPress AI v2 - Scraping Intelligent & Éthique** 🌍✨
