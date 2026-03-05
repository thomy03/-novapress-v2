# Backend Performance & Quality Audit

Tu es un ingenieur backend senior specialise en systemes de news haute performance (Reuters, Bloomberg Terminal, AP News).

Ta mission : auditer et optimiser le backend NovaPress pour le rendre production-ready et performant.

## Instructions

Execute les 6 modules suivants dans l'ordre. Chaque module produit des changements concrets (pas de rapport theorique).

---

### MODULE 1 : API Response Time Audit

**Objectif** : Toutes les routes < 200ms (hors pipeline)

1. Lire `backend/app/api/routes/syntheses.py` — identifier les appels Qdrant non-caches
2. Lire `backend/app/api/routes/trending.py` — verifier si les stats categories sont recalculees a chaque requete
3. Lire `backend/app/api/routes/articles.py` — verifier pagination et indices

**Actions** :
- Ajouter un cache Redis (TTL 60s) sur `/api/trending/categories` et `/api/trending/live-count`
- Ajouter un cache Redis (TTL 30s) sur `/api/syntheses/breaking` et `/api/syntheses/live`
- Implementer `Cache-Control` headers sur les reponses GET
- Pattern : `await redis.get(key) or (compute + redis.setex(key, ttl, result))`

**Ne PAS** :
- Cacher les reponses utilisateur-specifiques
- Cacher les routes avec pagination dynamique (offset/limit variables)

---

### MODULE 2 : Pipeline Reliability

**Objectif** : Zero crash, recovery automatique, logs structures

1. Lire `backend/app/services/pipeline.py` — `_generate_syntheses()` et `_store_syntheses()`
2. Identifier les points de failure sans try/except
3. Verifier que chaque etape log son temps d'execution

**Actions** :
- Ajouter `try/except` granulaire par cluster (un cluster qui echoue ne kill pas le pipeline)
- Ajouter des metriques de temps par etape : `scraping_time`, `clustering_time`, `synthesis_time`
- Implementer un `PipelineReport` dict retourne en fin de pipeline avec stats completes
- Ajouter retry logic (max 2) sur les appels LLM qui echouent (timeout, rate limit)
- Verifier que `_store_syntheses` fait un upsert atomique (pas de synthese partielle)

**Pattern retry** :
```python
for attempt in range(max_retries + 1):
    try:
        result = await llm_service.synthesize_with_history(...)
        break
    except (asyncio.TimeoutError, Exception) as e:
        if attempt == max_retries:
            logger.error(f"Cluster {cluster_id}: LLM failed after {max_retries} retries: {e}")
            continue
        await asyncio.sleep(2 ** attempt)
```

---

### MODULE 3 : Synthesis Quality Boost

**Objectif** : Syntheses plus riches, mieux structurees, SEO-ready

1. Lire `backend/app/ml/llm.py` — analyser le prompt `synthesize_with_history()`
2. Lire `backend/app/ml/transparency_score.py` — verifier le scoring

**Actions** :
- Enrichir le prompt LLM pour forcer :
  - Un titre accrocheur (< 80 chars, sans deux-points)
  - Une introduction/chapo de 2 phrases max
  - Des intertitres `## ` pour chaque angle
  - Au moins 3 `[SOURCE:N]` citations dans le body
  - Un champ `seo_description` (160 chars max) pour les meta tags
  - Un champ `seo_keywords` (5-8 mots-cles)
- Ajouter validation post-generation :
  - Body minimum 300 mots (sinon re-generer)
  - Au moins 1 intertitre `## `
  - Au moins 2 citations `[SOURCE:N]`
- Stocker `seo_description` et `seo_keywords` dans Qdrant payload

**IMPORTANT** : Ne pas casser le format JSON existant. Ajouter les nouveaux champs en plus.

---

### MODULE 4 : Source Diversity & Freshness

**Objectif** : Plus de sources actives, articles plus frais

1. Lire `backend/app/services/advanced_scraper.py` — verifier quelles sources echouent silencieusement
2. Lire `backend/app/services/rss_scraper.py` — verifier les feeds RSS

**Actions** :
- Ajouter un health check des sources : apres chaque pipeline run, logger quelles sources ont retourne 0 articles
- Creer une route `GET /api/admin/sources/health` qui retourne le status de chaque source (last_success, article_count, error_rate)
- Ajouter des feeds RSS pour les sources qui echouent en scraping direct (beaucoup de journaux ont des RSS fiables)
- Implementer un fallback automatique : si scraping direct echoue pour une source, essayer son RSS

**Sources RSS prioritaires a ajouter** :
```python
RSS_FALLBACKS = {
    "lemonde": "https://www.lemonde.fr/rss/une.xml",
    "lefigaro": "https://www.lefigaro.fr/rss/figaro_actualites.xml",
    "guardian": "https://www.theguardian.com/world/rss",
    "bbc": "http://feeds.bbci.co.uk/news/world/rss.xml",
    "reuters": "https://www.rss.reuters.com/news/topNews",
}
```

---

### MODULE 5 : API Hardening

**Objectif** : API robuste, documentee, securisee

1. Lire `backend/app/api/routes/` — toutes les routes
2. Verifier les validations d'input

**Actions** :
- Ajouter des response models Pydantic sur les routes principales (syntheses, trending, articles)
- Ajouter `max_length` et `ge/le` validators sur tous les Query params (limit <= 100, hours <= 168, etc.)
- Verifier que toutes les routes retournent des formats coherents : `{"data": [...], "total": N, "page": N}`
- Ajouter `ETag` headers sur les reponses cachees pour supporter `If-None-Match` (304 Not Modified)
- Verifier que les erreurs 500 ne leakent pas de stack traces (utiliser des messages generiques)

---

### MODULE 6 : Monitoring & Observability

**Objectif** : Savoir exactement ce qui se passe en production

1. Lire `backend/app/main.py` — verifier le setup logging
2. Lire `backend/app/services/pipeline_manager.py`

**Actions** :
- Ajouter un middleware qui log : method, path, status_code, response_time_ms pour chaque requete
- Creer `GET /api/health/detailed` qui retourne :
  - Qdrant: connected + collection count
  - Redis: connected + memory usage
  - PostgreSQL: connected + active connections
  - Pipeline: last_run, next_scheduled, status
  - Uptime: seconds since start
- Ajouter des compteurs pipeline accessibles via `/api/admin/stats` :
  - total_syntheses_generated (all time)
  - total_articles_scraped (all time)
  - avg_synthesis_quality_score
  - source_success_rates (per source)

---

## Regles

- **Inline styles** sur le frontend, **Pydantic models** sur le backend
- **Ne PAS** installer de nouveaux packages sans justification
- **Ne PAS** modifier la structure de la DB Qdrant (ajouter des champs payload OK)
- **Tester** chaque changement : `cd backend && python -m pytest tests/ -x` ou verification manuelle
- **Committer** module par module (6 commits distincts)
- Toujours utiliser `loguru.logger` (pas `print()` ou `logging`)

## Verification Finale

Apres les 6 modules :
1. `cd backend && python -c "from app.main import app; print('Import OK')"`
2. Verifier que `/api/health/detailed` repond
3. Verifier que `/api/syntheses/breaking` a un header `Cache-Control`
4. Verifier que `/api/admin/sources/health` liste toutes les sources
