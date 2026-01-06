# NovaPress AI v2 - Améliorations Session 30 Novembre 2025

**Date**: 30 Novembre 2025
**Objectif**: Rendre la navigation et le news ticker dynamiques et fonctionnels

---

## Résumé Exécutif

Cette session a implémenté un système complet de **navigation dynamique par catégories** et un **news ticker en temps réel** connectés aux synthèses IA générées par le pipeline.

### Fonctionnalités Ajoutées

1. **Classification automatique des synthèses par catégorie** (MONDE, TECH, ECONOMIE, etc.)
2. **News ticker dynamique** avec données API et fallback
3. **Navigation avec compteurs** par catégorie
4. **Bouton EN DIRECT fonctionnel** avec badge de comptage
5. **Page /live** pour suivre l'actualité en temps réel
6. **Filtrage des synthèses** par catégorie sélectionnée

---

## Partie 1: Backend - Classification par Catégorie

### 1.1 Nouveau Service: Category Classifier

**Fichier créé**: `backend/app/ml/category_classifier.py`

```python
# Classification NLP par keywords
CATEGORY_KEYWORDS = {
    "TECH": ["intelligence artificielle", "startup", "cybersécurité", ...],
    "ECONOMIE": ["inflation", "PIB", "bourse", ...],
    "POLITIQUE": ["élection", "gouvernement", "parlement", ...],
    # ... autres catégories
}

def classify_synthesis(title: str, summary: str, key_entities: List[str] = None) -> Tuple[str, float]:
    """
    Classifie une synthèse dans une catégorie basée sur les keywords.
    Retourne (category_name, confidence_score 0-1)
    """
```

**Catégories supportées**:
- MONDE (International)
- TECH (Technologie)
- ECONOMIE (Économie/Finance)
- POLITIQUE (Politique)
- CULTURE (Culture/Arts)
- SPORT (Sports)
- SCIENCES (Sciences)

### 1.2 Modification Qdrant Client

**Fichier modifié**: `backend/app/db/qdrant_client.py`

**Champs ajoutés au payload**:
```python
"category": str  # Catégorie de la synthèse
"category_confidence": float  # Score de confiance (0-1)
```

**Nouvelles méthodes**:
```python
def get_syntheses_by_category(self, category: str, limit: int = 20) -> List[Dict]
def get_breaking_syntheses(self, limit: int = 5) -> List[Dict]
def get_live_syntheses(self, hours: int = 24, limit: int = 50) -> List[Dict]
```

### 1.3 Intégration Pipeline

**Fichier modifié**: `backend/app/services/pipeline.py`

```python
from app.ml.category_classifier import classify_synthesis

# Après génération de la synthèse:
category, category_confidence = classify_synthesis(
    synthesis.get("title", ""),
    synthesis.get("summary", ""),
    key_entities
)
synthesis["category"] = category
synthesis["category_confidence"] = category_confidence
```

### 1.4 Nouveaux Endpoints API

**Fichier modifié**: `backend/app/api/routes/syntheses.py`

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/syntheses/breaking` | GET | 5 dernières synthèses (pour ticker) |
| `/api/syntheses/live` | GET | Synthèses des X dernières heures |
| `/api/syntheses/category/{cat}` | GET | Synthèses filtrées par catégorie |

**Fichier modifié**: `backend/app/api/routes/trending.py`

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/trending/` | GET | Topics tendance depuis synthèses |
| `/api/trending/categories` | GET | Stats par catégorie avec compteurs |
| `/api/trending/live-count` | GET | Nombre de synthèses récentes |

---

## Partie 2: Frontend - Services et Types

### 2.1 Nouveaux Types TypeScript

**Fichier modifié**: `app/types/api.ts`

```typescript
export interface Synthesis {
  id: string;
  title: string;
  summary: string;
  introduction: string;
  body: string;
  analysis: string;
  keyPoints: string[];
  sources: string[];
  sourceArticles: SourceArticle[];
  numSources: number;
  clusterId: number;
  complianceScore: number;
  readingTime: number;
  createdAt: string;
  category: SynthesisCategory;
  categoryConfidence: number;
  type: 'synthesis';
}

export type SynthesisCategory =
  | 'MONDE'
  | 'TECH'
  | 'ECONOMIE'
  | 'POLITIQUE'
  | 'CULTURE'
  | 'SPORT'
  | 'SCIENCES';

export interface CategoryStats {
  name: SynthesisCategory;
  displayName: string;
  count: number;
  latestAt: string;
  isHot: boolean;
  recentTitles: string[];
}
```

### 2.2 Nouveau Service API

**Fichier créé**: `app/lib/api/services/syntheses.ts`

```typescript
export const synthesesService = {
  getSyntheses(limit: number = 10): Promise<SynthesesResponse>,
  getSynthesis(id: string): Promise<Synthesis>,
  getBreakingSyntheses(limit: number = 5): Promise<BreakingSynthesesResponse>,
  getLiveSyntheses(hours: number = 24, limit: number = 50): Promise<LiveSynthesesResponse>,
  getSynthesesByCategory(category: SynthesisCategory, limit: number = 20): Promise<CategorySynthesesResponse>,
  getTrendingTopics(hours: number = 24, limit: number = 10): Promise<TrendingTopicsResponse>,
  getCategoriesStats(hours: number = 24): Promise<CategoriesStatsResponse>,
  getLiveCount(hours: number = 24): Promise<LiveCountResponse>
};
```

---

## Partie 3: Frontend - Composants UI

### 3.1 NewsTicker Dynamique

**Fichier modifié**: `app/components/layout/NewsTicker.tsx`

**Avant**: Données statiques hardcodées
```javascript
const breakingNews = [
  "🔴 Technologie : ChatGPT intègre...",
  // ... hardcodé
];
```

**Après**: Données API avec fallback
```typescript
const fetchBreakingNews = useCallback(async () => {
  const response = await synthesesService.getBreakingSyntheses(8);
  if (response.data && response.data.length > 0) {
    const newsItems = response.data.map((synthesis: Synthesis) => {
      const emoji = CATEGORY_EMOJI[synthesis.category] || '🔴';
      return `${emoji} ${synthesis.category} : ${synthesis.title}`;
    });
    setBreakingNews(newsItems);
  }
}, []);

// Auto-refresh toutes les 2 minutes
useEffect(() => {
  fetchBreakingNews();
  const interval = setInterval(fetchBreakingNews, 2 * 60 * 1000);
  return () => clearInterval(interval);
}, [fetchBreakingNews]);
```

**Emojis par catégorie**:
- MONDE: 🌍
- TECH: 💻
- ECONOMIE: 📈
- POLITIQUE: 🏛️
- CULTURE: 🎭
- SPORT: ⚽
- SCIENCES: 🔬

### 3.2 Navigation avec Compteurs

**Fichier modifié**: `app/components/layout/Navigation.tsx`

**Fonctionnalités**:
1. Catégories avec badges de comptage
2. Bouton EN DIRECT avec compteur live
3. Indicateur pulsant pour le live
4. Hover effects et transitions

```typescript
const CATEGORIES = [
  { id: 'ACCUEIL', label: 'ACCUEIL', apiCategory: null },
  { id: 'MONDE', label: 'MONDE', apiCategory: 'MONDE' },
  { id: 'TECH', label: 'TECH', apiCategory: 'TECH' },
  // ...
];

// Fetch des stats
const fetchStats = useCallback(async () => {
  const liveResponse = await synthesesService.getLiveCount(24);
  setLiveCount(liveResponse.count);

  const statsResponse = await synthesesService.getCategoriesStats(24);
  // ...
}, []);
```

### 3.3 Page EN DIRECT (/live)

**Fichier créé**: `app/live/page.tsx`

**Fonctionnalités**:
- Timeline chronologique des synthèses
- Filtres temporels (6h, 12h, 24h, 48h)
- Auto-refresh toutes les 2 minutes
- Groupement par jour (Aujourd'hui, Hier, etc.)
- Indicateurs de catégorie avec couleurs
- Responsive design

### 3.4 IntelligenceSection avec Filtrage

**Fichier modifié**: `app/components/articles/IntelligenceSection.tsx`

**Avant**: Fetch toutes les synthèses
```javascript
const response = await fetch(`${API_URL}/api/syntheses/?limit=20`);
```

**Après**: Filtrage par catégorie sélectionnée
```typescript
const { state } = useArticles();
const apiCategory = CATEGORY_MAP[state.selectedCategory.toUpperCase()] || null;

const fetchSyntheses = useCallback(async () => {
  let response;
  if (apiCategory) {
    response = await synthesesService.getSynthesesByCategory(apiCategory, 20);
  } else {
    response = await synthesesService.getSyntheses(20);
  }
  setSyntheses(response.data || []);
}, [apiCategory]);
```

---

## Partie 4: Flux de Données

```
┌─────────────────────────────────────────────────────────────────┐
│                        PIPELINE IA                               │
│  Scraping → Embeddings → Clustering → LLM → Classification      │
│                                              ↓                   │
│                                    category_classifier.py        │
│                                    (MONDE, TECH, ECONOMIE...)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      QDRANT STORAGE                              │
│  synthesis + category + category_confidence + created_at        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       API ENDPOINTS                              │
│  /syntheses/breaking  → NewsTicker                              │
│  /syntheses/live      → Page /live                              │
│  /syntheses/category  → IntelligenceSection                     │
│  /trending/categories → Navigation badges                        │
│  /trending/live-count → EN DIRECT badge                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND COMPONENTS                          │
│  NewsTicker       → Titres défilants avec emojis                │
│  Navigation       → Catégories cliquables avec compteurs        │
│  IntelligenceSection → Synthèses filtrées par catégorie         │
│  /live            → Timeline chronologique temps réel           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Partie 5: Tests et Validation

### Commandes de Test

```powershell
# 1. Démarrer le backend
cd backend && .\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 5000

# 2. Démarrer le frontend
npm run dev

# 3. Générer des synthèses avec catégories
python scripts/run_fast_pipeline.py

# 4. Tester les endpoints
curl http://localhost:5000/api/syntheses/breaking
curl http://localhost:5000/api/syntheses/live?hours=24
curl http://localhost:5000/api/syntheses/category/TECH
curl http://localhost:5000/api/trending/categories
curl http://localhost:5000/api/trending/live-count
```

### Vérifications UI

1. **News Ticker**: Affiche les 8 dernières synthèses avec emojis de catégorie
2. **Navigation**: Chaque catégorie affiche un badge avec le nombre de synthèses
3. **EN DIRECT**: Badge rouge avec compteur, cliquable vers /live
4. **Page /live**: Timeline avec filtres temporels fonctionnels
5. **Filtrage catégorie**: Cliquer sur TECH → affiche uniquement synthèses TECH

---

## Partie 6: Fichiers Modifiés/Créés

### Backend (Python)

| Fichier | Action | Description |
|---------|--------|-------------|
| `backend/app/ml/category_classifier.py` | CRÉÉ | Classification NLP par keywords |
| `backend/app/db/qdrant_client.py` | MODIFIÉ | Champs category + méthodes requête |
| `backend/app/services/pipeline.py` | MODIFIÉ | Intégration classification |
| `backend/app/api/routes/syntheses.py` | MODIFIÉ | Endpoints breaking/live/category |
| `backend/app/api/routes/trending.py` | MODIFIÉ | Endpoints categories/live-count |

### Frontend (TypeScript/React)

| Fichier | Action | Description |
|---------|--------|-------------|
| `app/types/api.ts` | MODIFIÉ | Types Synthesis, CategoryStats, etc. |
| `app/lib/api/services/syntheses.ts` | CRÉÉ | Service client API synthèses |
| `app/lib/api/services/index.ts` | MODIFIÉ | Export synthesesService |
| `app/components/layout/NewsTicker.tsx` | MODIFIÉ | Données dynamiques API |
| `app/components/layout/Navigation.tsx` | MODIFIÉ | Catégories + EN DIRECT fonctionnel |
| `app/live/page.tsx` | CRÉÉ | Page timeline temps réel |
| `app/components/articles/IntelligenceSection.tsx` | MODIFIÉ | Filtrage par catégorie |

---

## Notes Techniques

### Fallback et Résilience

- **NewsTicker**: Si l'API échoue, affiche des données de fallback statiques
- **Navigation**: Les compteurs sont à 0 si l'API ne répond pas
- **Auto-refresh**:
  - NewsTicker: 2 minutes
  - Navigation stats: 5 minutes
  - Page /live: 2 minutes

### Performance

- Lazy loading des composants avec `dynamic()`
- Limite de 100 caractères pour les titres dans le ticker
- Duplication des items ticker pour scroll infini fluide

### Accessibilité

- `aria-label` sur tous les éléments interactifs
- `aria-live="polite"` pour les mises à jour dynamiques
- Focus visible sur navigation clavier

---

## Prochaines Étapes Suggérées

1. **WebSocket** - Temps réel sans polling
2. **Notifications push** - Alertes breaking news
3. **Personnalisation** - Catégories favorites utilisateur
4. **Analytics** - Tracking des catégories populaires
5. **SEO** - Meta tags dynamiques par catégorie

---

**Fin du document - Session 30 Novembre 2025**
