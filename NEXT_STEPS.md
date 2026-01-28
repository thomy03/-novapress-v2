# NovaPress AI v2 - Prochaines Etapes

## CE QUI EST FAIT

### Backend API (Flask)
- [x] Flask API fonctionnel (port 5000)
- [x] Database SQLite avec **1032 articles**
- [x] Endpoints REST complets
- [x] `format_article()` corrige pour sqlite3.Row
- [x] CORS configure pour Next.js
- [x] Format de reponse adapte au frontend (imageUrl, readTime, tags string[])
- [x] Pagination compatible PaginatedResponse

### Frontend (Next.js 15)
- [x] Next.js 15 avec TypeScript
- [x] Interface professionnelle newspaper-style
- [x] Composants React (ArticleCard, Header, Footer, etc.)
- [x] API Client configure (port 5000)
- [x] ArticlesContext.tsx corrige pour conversion articles
- [x] Types API mis a jour (NewsSource, Article)

### Integration
- [x] Frontend connecte au backend
- [x] CORS fonctionne (preflight OPTIONS + GET)
- [x] Articles charges depuis la base de donnees (1032 articles)

---

## COMMENT DEMARRER

### Option 1: Script automatique (recommande)
```bash
cd /mnt/c/Users/tkado/Documents/novapress-v2
./dev.sh
```

### Option 2: Demarrage manuel

**Terminal 1 - Backend:**
```bash
cd /mnt/c/Users/tkado/Documents/novapress-v2/backend
source venv/bin/activate
python3 api.py
```

**Terminal 2 - Frontend:**
```bash
cd /mnt/c/Users/tkado/Documents/novapress-v2
npm run dev
```

### Verifier que tout fonctionne
```bash
# Test Backend
curl http://localhost:5000/api/health
# Doit retourner: {"articlesCount": 1032, "status": "healthy", ...}

# Test Frontend
# Ouvrir http://localhost:3000 dans le navigateur
```

---

## ENDPOINTS API DISPONIBLES

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/health` | GET | Status du serveur |
| `/api/articles` | GET | Liste paginee d'articles |
| `/api/articles/<id>` | GET | Article par ID |
| `/api/trending` | GET | Articles tendances |
| `/api/search?q=` | GET | Recherche d'articles |

### Parametres /api/articles
- `limit`: Nombre d'articles (defaut: 50)
- `offset`: Decalage pour pagination
- `search`: Recherche dans titre/contenu

---

## PROCHAINES ETAPES

### Court terme
1. [ ] **Tester le pipeline IA** (scraping + embeddings + clustering)
   ```bash
   cd backend
   source venv/bin/activate
   python scripts/run_fast_pipeline.py
   ```

2. [ ] **Ameliorer les donnees affichees**
   - Ajouter de vraies images depuis les articles scraped
   - Extraire les themes/categories depuis le contenu
   - Calculer le temps de lecture reel

3. [ ] **Ajouter la recherche semantique**
   - Utiliser Qdrant pour la recherche vectorielle
   - Implementer l'endpoint `/api/search` avec embeddings

### Moyen terme
4. [ ] **Authentification utilisateur**
   - Implementer JWT tokens
   - Creer endpoints `/api/auth/login`, `/api/auth/signup`

5. [ ] **WebSocket temps reel**
   - Notifications pour nouveaux articles
   - Mise a jour automatique du feed

6. [ ] **Pipeline automatique**
   - Scraping periodique (cron job)
   - Clustering automatique des nouveaux articles

### Long terme
7. [ ] **Deploiement production**
   - Vercel (Frontend)
   - Railway/Render (Backend)
   - Base PostgreSQL managee

8. [ ] **Application mobile**
   - React Native avec Expo
   - Monorepo Turborepo

---

## ARCHITECTURE ACTUELLE

```
Frontend (Next.js :3000)
        |
        | HTTP/REST
        v
Backend (Flask :5000)
        |
        | SQLite
        v
Database (data/articles.db)
   1032 articles
```

## FICHIERS MODIFIES

1. `backend/api.py` - Format de reponse adapte
2. `app/contexts/ArticlesContext.tsx` - Conversion articles
3. `app/types/api.ts` - Types NewsSource et Article

---

**Derniere mise a jour**: 24 Novembre 2025
**Status**: Frontend + Backend connectes et fonctionnels
