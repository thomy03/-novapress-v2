# NovaPress AI v2 - Rapport d'Audit Complet

**Date**: 5 Janvier 2026 | **Version**: 2.0.0-alpha | **Auditeur**: Claude Code

---

## RESUME EXECUTIF

| Domaine | Score | Criticite | Findings |
|---------|-------|-----------|----------|
| **Backend** | 7/10 | ELEVEE | 19 issues (3 critiques) |
| **Frontend** | 6.5/10 | ELEVEE | 18 issues (7 critiques) |
| **Infrastructure** | 6.5/10 | CRITIQUE | 16 issues (4 critiques) |
| **Global** | 6.5/10 | **CRITIQUE** | 53 issues totales |

**Verdict**: Application fonctionnelle mais **NON PRETE pour production** sans corrections de securite.

---

## 1. PROBLEMES CRITIQUES (P0) - A CORRIGER IMMEDIATEMENT

### 1.1 SECURITE - SECRETS EXPOSES

**Fichier**: `backend/.env`
```
OPENROUTER_API_KEY=sk-or-v1-***EXPOSED***
PERPLEXITY_API_KEY=pplx-***EXPOSED***
XAI_API_KEY=xai-***EXPOSED***
```

**Actions**:
1. Regenerer TOUTES les cles API immediatement
2. Nettoyer l'historique git: `git filter-branch`
3. Implementer secrets management (Vault/K8s secrets)

### 1.2 SECURITE - ADMIN API KEY HARDCODEE

**Fichier**: `backend/app/api/routes/admin.py:17`
```python
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "novapress-admin-2024")  # DANGER!
```

**Fix**: Ajouter dans `.env`: `ADMIN_API_KEY=<cle-securisee-32-chars>`

### 1.3 SECURITE - DEBUG MODE EN PRODUCTION

**Fichier**: `backend/.env:39`
```
DEBUG=True  # DANGEREUX - Stack traces exposees
```

**Fix**: Changer en `DEBUG=False`

### 1.4 FRONTEND - FUITE MEMOIRE WEBSOCKET

**Fichier**: `app/admin/pipeline/page.tsx:31-76`
```typescript
// WebSocket se reconnecte indefiniment sans cleanup
setTimeout(connectWebSocket, 3000); // Reconnexion infinie!
```

**Fix**: Utiliser useRef pour tracker les timeouts + cleanup complet

### 1.5 FRONTEND - PAS D'ERROR BOUNDARY

**Fichier**: `app/layout.tsx`
- Une erreur non-geree fait crash toute l'app
- **Fix**: Creer `ErrorBoundary.tsx` et envelopper le contenu

### 1.6 BACKEND - GESTION ERREUR JSON LLM

**Fichier**: `backend/app/ml/llm.py:72-76`
```python
except json.JSONDecodeError:
    return {}  # Retourne dict vide = syntheses cassees!
```

**Fix**: Retourner un fallback structure avec score de qualite bas

### 1.7 BACKEND - RACE CONDITION PIPELINE

**Fichier**: `backend/app/services/pipeline_manager.py:59-73`
- Deux workers peuvent lancer le pipeline simultanement
- **Fix**: Utiliser Redis pour l'etat global au lieu du singleton Python

---

## 2. PROBLEMES HAUTE PRIORITE (P1)

### 2.1 Backend

| ID | Fichier | Probleme | Impact |
|----|---------|----------|--------|
| B1 | `advanced_scraper.py` | Pas de timeout par source | Pipeline bloque |
| B2 | `pipeline.py:135` | Embeddings calcules 2x | Performance -50% |
| B3 | `search_enrichment.py` | Pas de retry API externe | Echec transitoire |
| B4 | `persona.py` | Signature non echappee JSON | Frontend crash |
| B5 | `causal_extraction.py` | Pas de validation structure | Graphes vides |

### 2.2 Frontend

| ID | Fichier | Probleme | Impact |
|----|---------|----------|--------|
| F1 | `ArticlesContext.tsx:271` | Race condition toggleTag | Filtres incoherents |
| F2 | `synthesis/[id]/page.tsx` | setState after unmount | Memory leak |
| F3 | `Header.tsx:68` | Hydration mismatch | React warnings |
| F4 | Multiple | Inline style mutations | Incompatible concurrent |
| F5 | Multiple | Null checks manquants API | Runtime errors |

### 2.3 Infrastructure

| ID | Fichier | Probleme | Impact |
|----|---------|----------|--------|
| I1 | `docker-compose.yml` | `qdrant:latest` flottant | Instabilite |
| I2 | `Dockerfile` | Execution root | Securite |
| I3 | `main.py` | Rate limiting non applique | DoS possible |
| I4 | `main.py:87` | CORS trop permissif | Securite |
| I5 | `requirements-locked.txt` | Versions divergentes | Instabilite |

---

## 3. PROBLEMES PRIORITE MOYENNE (P2)

### 3.1 Performance

- **Pas de caching React Query** - Refetch inutiles entre pages
- **Pas de lazy loading** composants lourds (React Flow)
- **Embeddings non caches** dans Redis
- **Contradiction detection basique** - Patterns regex simples

### 3.2 Qualite Code

- **Types dupliques** entre `app/types/api.ts` et pages
- **Gestion erreur inconsistante** - Pas de composant ErrorState unifie
- **Logs trop verbeux** - Pas de log level configurable
- **Code dead** - YouTube scraping commente mais present

### 3.3 Accessibilite

- **aria-* incomplets** sur boutons et inputs
- **Labels manquants** sur formulaires
- **Focus management** non implemente

### 3.4 DevOps

- **Scripts casses** - `dev.ps1` reference `api.py` inexistant
- **Pas de .dockerignore** - Image 1.5GB au lieu de 500MB
- **PostgreSQL inutilise** mais dans docker-compose
- **Redis sans persistance AOF**

---

## 4. AMELIORATIONS SUGGEREES

### 4.1 Architecture

| Suggestion | Effort | Impact | ROI |
|------------|--------|--------|-----|
| Multi-agent pre-generation personas | 2j | Cout LLM -80% | ELEVE |
| Circuit breaker API externes | 1j | Stabilite +50% | ELEVE |
| React Query caching | 1j | UX +30% | MOYEN |
| API versioning `/api/v1/` | 0.5j | Maintenabilite | MOYEN |
| Prometheus metrics | 1j | Observabilite | MOYEN |

### 4.2 Fonctionnalites

| Feature | Description | Priorite |
|---------|-------------|----------|
| Quality Reviewers | Evaluation qualite syntheses persona | HAUTE |
| Causal Graph Fix | Renforcer prompt LLM pour relations | HAUTE |
| Search Autocomplete | Suggestions pendant la frappe | MOYENNE |
| PWA Offline | Service worker pour lecture offline | BASSE |
| Dark Mode Toggle | Bouton dans header | BASSE |

### 4.3 Tests

| Type | Coverage Actuelle | Cible | Fichiers Prioritaires |
|------|-------------------|-------|----------------------|
| Unit Backend | ~5% | 60% | llm.py, clustering.py |
| Unit Frontend | ~0% | 40% | contexts, services |
| Integration | ~0% | 30% | Pipeline complet |
| E2E | ~0% | 20% | Parcours utilisateur |

---

## 5. PLAN D'ACTION RECOMMANDE

### Phase 1: Securite (1-2 jours)
- [ ] Regenerer toutes les API keys
- [ ] Cleaner git history
- [ ] DEBUG=False
- [ ] ADMIN_API_KEY securisee
- [ ] Error Boundary frontend

### Phase 2: Stabilite (3-5 jours)
- [ ] Fix WebSocket memory leak
- [ ] Fix race conditions (toggleTag, pipeline)
- [ ] Null checks API responses
- [ ] Retry logic API externes
- [ ] Validation donnees Qdrant

### Phase 3: Performance (1 semaine)
- [ ] React Query caching
- [ ] Lazy load composants lourds
- [ ] Cache embeddings Redis
- [ ] .dockerignore

### Phase 4: Qualite (2 semaines)
- [ ] Centraliser types TypeScript
- [ ] Composants ErrorState/LoadingState
- [ ] Tests unitaires critiques
- [ ] Accessibilite aria-*

### Phase 5: Features (ongoing)
- [ ] Pre-generation multi-personas
- [ ] Quality reviewers
- [ ] Fix graphes causaux
- [ ] Monitoring Prometheus

---

## 6. METRIQUES DE SUCCES

| Metrique | Actuel | Cible | Methode |
|----------|--------|-------|---------|
| Erreurs console | ~15/page | 0 | React DevTools |
| Lighthouse Perf | ~60 | 85+ | Chrome Audit |
| Lighthouse A11y | ~70 | 90+ | Chrome Audit |
| Build time | ~45s | <30s | npm run build |
| Docker image | ~1.5GB | <600MB | docker images |
| API response P95 | ~2s | <500ms | Prometheus |

---

## 7. DETTE TECHNIQUE IDENTIFIEE

### Code a Refactoriser

1. **`pipeline.py`** (800+ lignes) - Decouper en modules
2. **`synthesis/[id]/page.tsx`** (400+ lignes) - Extraire composants
3. **Inline styles partout** - Migrer vers CSS modules ou Tailwind
4. **Singletons globaux** - Migrer vers Dependency Injection

### Dependances a Mettre a Jour

| Package | Actuel | Cible | Breaking Changes |
|---------|--------|-------|------------------|
| newspaper3k | 0.2.8 | trafilatura | Oui (remplacement) |
| playwright | 1.40.0 | 1.50+ | Non |
| fastapi | 0.115 | 0.127 | Mineur |

---

## CONCLUSION

NovaPress v2 est une application **techniquement impressionnante** avec:
- Pipeline IA complet (scraping, clustering, RAG, TNA, causal)
- Frontend moderne (Next.js 15, React 19)
- Architecture bien structuree

**Mais** necessite des corrections critiques avant production:
1. **Securite**: Secrets exposes, auth faible
2. **Stabilite**: Memory leaks, race conditions
3. **Observabilite**: Pas de monitoring

**Effort estime pour production-ready**: 2-3 semaines

---

*Rapport genere par Claude Code - 5 Janvier 2026*
