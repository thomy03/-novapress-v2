# NovaPress AI v2 - Prochaines Étapes

**Mis à jour**: 30 Novembre 2025
**Status**: Navigation dynamique et News Ticker - COMPLÉTÉ

---

## Fonctionnalités Complétées

### Session 30 Nov 2025 - Navigation Dynamique
- [x] Classification automatique des synthèses par catégorie
- [x] News ticker dynamique avec données API
- [x] Navigation avec compteurs par catégorie
- [x] Bouton EN DIRECT fonctionnel avec badge
- [x] Page /live avec timeline temps réel
- [x] Filtrage des synthèses par catégorie

**Détails**: Voir `.claude/SESSION_30_NOV_2025_IMPROVEMENTS.md`

### Sessions Précédentes
- [x] Connexion Frontend ↔ Backend
- [x] Pipeline IA opérationnelle (53 sources)
- [x] Clustering HDBSCAN fonctionnel
- [x] Synthèses LLM via OpenRouter
- [x] Pages synthèses dédiées (/synthesis/[id])
- [x] Redesign page accueil (Hero + Grid)

---

## Phase Actuelle: Validation et Tests

### 1. Tester le Système Complet (Priorité: HAUTE)

```powershell
# Backend
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 5000

# Frontend
npm run dev

# Générer des synthèses avec catégories
python scripts/run_fast_pipeline.py
```

**Vérifications**:
- [ ] News ticker affiche des données réelles
- [ ] Navigation affiche les compteurs par catégorie
- [ ] Bouton EN DIRECT fonctionne (badge + lien /live)
- [ ] Page /live affiche la timeline
- [ ] Filtrage par catégorie fonctionne

### 2. Tests API Nouveaux Endpoints

```powershell
# Synthèses breaking (pour ticker)
curl http://localhost:5000/api/syntheses/breaking

# Synthèses live (dernières 24h)
curl http://localhost:5000/api/syntheses/live?hours=24

# Synthèses par catégorie
curl http://localhost:5000/api/syntheses/category/TECH
curl http://localhost:5000/api/syntheses/category/MONDE

# Stats catégories
curl http://localhost:5000/api/trending/categories

# Compteur live
curl http://localhost:5000/api/trending/live-count
```

---

## Prochaines Fonctionnalités

### Court Terme (1-2 semaines)

1. **Optimisations Performance**
   - Cache Redis pour stats catégories
   - Pagination des synthèses sur /live
   - Lazy loading images

2. **WebSocket Temps Réel**
   - Notifier le frontend quand nouvelle synthèse
   - Mise à jour automatique du ticker
   - Badge "nouveau" sur navigation

3. **Authentification Utilisateur**
   - Login/Signup avec JWT
   - Préférences utilisateur (catégories favorites)
   - Historique de lecture

### Moyen Terme (2-4 semaines)

1. **Notifications Push**
   - Breaking news alerts
   - Nouvelles synthèses dans catégories suivies

2. **Mode Hors-Ligne (PWA)**
   - Cache des synthèses récentes
   - Service worker pour offline

3. **Recherche Avancée**
   - Recherche sémantique dans synthèses
   - Filtres date + catégorie + sources

### Long Terme (1-2 mois)

1. **Déploiement Production**
   - Docker Compose optimisé
   - CI/CD avec GitHub Actions
   - Monitoring avec Prometheus/Grafana

2. **API Publique**
   - Documentation Swagger complète
   - Rate limiting
   - API keys pour accès externe

---

## Architecture Actuelle

```
Frontend (Next.js 15)
├── Navigation dynamique avec compteurs
├── News ticker API-driven
├── Page /live timeline
├── Filtrage par catégorie
└── IntelligenceSection connecté

Backend (FastAPI)
├── /api/syntheses/breaking      ← NewsTicker
├── /api/syntheses/live          ← Page /live
├── /api/syntheses/category/{cat}← Filtrage
├── /api/trending/categories     ← Navigation badges
└── /api/trending/live-count     ← EN DIRECT badge

Pipeline IA
├── Scraping 53 sources news
├── Sources alternatives (Reddit, HN, ArXiv)
├── Classification automatique
├── Embeddings BGE-M3
└── Synthèse LLM (OpenRouter)
```

---

## Commandes Utiles

```powershell
# Frontend
npm run dev                                    # http://localhost:3000

# Backend
cd backend && .\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 5000      # http://localhost:5000

# Pipeline
python scripts/run_fast_pipeline.py            # Générer synthèses

# Docker
docker ps                                      # Status containers
docker logs tradingbot_v2-qdrant-1            # Logs Qdrant
```

---

## Problèmes Potentiels

### CORS Errors
```python
# backend/app/core/config.py
CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3002"]
```

### Redis Connection Refused
Vérifier port 6380 (pas 6379!)

### Qdrant Collection Not Found
```python
python -c "from app.db.qdrant_client import get_qdrant_service; get_qdrant_service()"
```

### spaCy Model Missing
```powershell
python -m spacy download fr_core_news_lg
```

---

## Documentation

| Fichier | Description |
|---------|-------------|
| `.claude/CLAUDE.md` | Documentation technique complète |
| `.claude/SESSION_30_NOV_2025_IMPROVEMENTS.md` | Améliorations session actuelle |
| `.claude/BACKEND_TECHNICAL_DOCUMENTATION.md` | Architecture backend |
| `CLAUDE.md` (racine) | Quick reference |
