# Backend Content Intelligence

Tu es un architecte de systemes de contenu editorial (NYT Cooking, Bloomberg, The Economist).

Ta mission : enrichir le contenu genere par NovaPress pour le rendre plus engageant, plus fiable, et plus utile que les sites de news classiques.

## Instructions

Execute les 5 modules suivants. Chaque module ameliore directement la qualite du contenu visible par l'utilisateur.

---

### MODULE 1 : Related Syntheses Engine

**Objectif** : Chaque synthese recommande 3-5 articles lies (comme "Sur le meme sujet" du Monde)

1. Lire `backend/app/db/qdrant_client.py` — trouver la methode de recherche semantique existante
2. Lire `backend/app/api/routes/syntheses.py` — trouver `format_synthesis_for_frontend()`

**Actions** :
- Creer une fonction `get_related_syntheses(synthesis_id, limit=5)` dans `qdrant_client.py` :
  - Recuperer l'embedding de la synthese source
  - Chercher les 5 plus proches (score > 0.65, excluant elle-meme)
  - Retourner : `[{id, title, category, created_at, score}]`
- Ajouter le champ `relatedSyntheses` dans `format_synthesis_for_frontend()`
- Creer route `GET /api/syntheses/by-id/{id}/related?limit=5`

**Cache** : Redis TTL 5 minutes (les related changent peu)

---

### MODULE 2 : Smart Summaries (Multi-Format)

**Objectif** : Chaque synthese a 3 niveaux de resume

1. Lire `backend/app/ml/llm.py` — analyser le prompt de generation

**Actions** :
- Ajouter dans le prompt LLM la generation de 3 formats :
  - `headline` : 1 phrase, < 120 chars (pour les cards, notifications, SEO title)
  - `brief` : 2-3 phrases (pour les previews, morning brief, social sharing)
  - `summary` : Le resume actuel (body complet)
- Stocker ces 3 champs dans le payload Qdrant
- Exposer dans l'API : `format_synthesis_for_frontend()` inclut `headline` et `brief`

**Validation** :
- Si `headline` > 120 chars → tronquer intelligemment (couper au dernier mot complet + "...")
- Si `brief` > 300 chars → tronquer a la phrase precedente

---

### MODULE 3 : Topic Continuity (Fil Rouge)

**Objectif** : Detecter quand une histoire evolue et lier les syntheses entre elles

1. Lire `backend/app/ml/temporal_narrative.py` — analyser `find_related_syntheses()`
2. Lire `backend/app/ml/entity_resolution.py` — verifier la resolution d'entites

**Actions** :
- Ameliorer `find_related_syntheses()` pour retourner un `continuity_score` :
  - Memes entites principales (personnes, organisations) → +0.3
  - Meme categorie → +0.1
  - Proximite temporelle (< 48h) → +0.2
  - Similarite semantique → score Qdrant brut
- Creer un champ `story_thread_id` : si continuity_score > 0.8, lier les syntheses au meme fil
- Route `GET /api/stories/{thread_id}` → retourne toutes les syntheses d'un fil, ordonnees chronologiquement
- Route `GET /api/stories/active?limit=5` → retourne les fils actifs (avec synthese < 48h)

**Frontend data** : Chaque synthese expose `storyThread: {id, title, count, latest}`

---

### MODULE 4 : Content Quality Gate

**Objectif** : Aucune synthese de mauvaise qualite ne passe en production

1. Lire `backend/app/ml/persona_quality.py` — analyser le reviewer existant
2. Lire `backend/app/ml/transparency_score.py`

**Actions** :
- Creer un `ContentQualityGate` qui evalue chaque synthese AVANT stockage :
  ```
  quality_checks = {
      "min_word_count": body >= 250 mots,
      "has_structure": au moins 1 intertitre ## ,
      "has_citations": au moins 2 [SOURCE:N],
      "has_introduction": introduction non-vide,
      "no_hallucination_markers": pas de "je ne sais pas", "il est possible que",
      "title_quality": titre < 100 chars, pas de ":" au debut,
      "language_check": body est en francais (detecter les phrases en anglais),
  }
  ```
- Score = nombre de checks passes / total
- Si score < 0.6 → logger un warning, stocker quand meme mais marquer `quality: "low"`
- Si score >= 0.8 → marquer `quality: "high"` (priorite dans l'affichage)
- Exposer le champ `quality` dans l'API
- Route `GET /api/admin/quality-report` → distribution des scores, syntheses problematiques

---

### MODULE 5 : Trending Intelligence

**Objectif** : Trending topics plus pertinents et exploitables

1. Lire `backend/app/api/routes/trending.py`
2. Lire `backend/app/ml/topic_tracker.py`

**Actions** :
- Ameliorer l'algorithme trending :
  - Ponderer par fraicheur (article < 6h = x3, < 24h = x2, < 48h = x1)
  - Ponderer par diversite de sources (sujet couvert par 3+ sources = boost x2)
  - Ponderer par engagement potentiel (categories POLITIQUE et MONDE = boost x1.5)
- Ajouter `velocity` : taux de croissance du topic (nombre de nouvelles syntheses par heure)
- Route `GET /api/trending/velocity` → topics qui accelerent le plus
- Ajouter dans la reponse trending : `first_seen`, `last_updated`, `velocity`, `source_diversity`

---

## Regles

- Tous les nouveaux champs sont **optionnels** et backwards-compatible
- Les routes existantes ne changent PAS de format (ajout de champs seulement)
- Utiliser `loguru.logger` partout
- Cache Redis avec prefix `novapress:cache:` et TTL raisonnable
- Pas de nouveau package sans justification
- Committer module par module

## Verification Finale

1. `python -c "from app.main import app; print('OK')"`
2. Lancer le pipeline : verifier que les nouveaux champs sont generes
3. `GET /api/syntheses/breaking` → verifier presence `headline`, `brief`, `quality`
4. `GET /api/stories/active` → verifier les fils actifs
5. `GET /api/trending/velocity` → verifier les topics avec velocity
