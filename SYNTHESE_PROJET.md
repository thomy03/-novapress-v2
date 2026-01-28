# Synthèse Détaillée du Projet : novapress-v2

## 1. Vue d'Ensemble

**NovaPress-v2** est une application web de type "agrégateur de contenu" ou "plateforme de veille". Son objectif est de collecter, traiter et présenter des articles d'actualité de manière intelligente.

Le projet est une application **full-stack** composée de :
- Un **frontend** moderne développé avec **Next.js 15** et **React 19** en **TypeScript**.
- Un **backend** sous forme d'API REST développé avec **Python** et le micro-framework **Flask**.

Il existe une distinction importante entre l'**architecture actuellement implémentée** (Flask + SQLite) et l'**architecture cible** documentée (FastAPI, PostgreSQL, Services IA, etc.), qui représente la vision à long terme du projet.

---

## 2. Frontend (Application `app`)

Le frontend est une application Next.js utilisant l'**App Router**. Il est responsable de toute l'interface utilisateur.

### 2.1. Technologies Principales

- **Framework**: Next.js 15.4.6
- **Bibliothèque UI**: React 19.1.0
- **Langage**: TypeScript 5
- **Styling**: Tailwind CSS 4 (configuré via `postcss.config.mjs` et `tailwind.config.ts` implicitement) et CSS global (`globals.css`).
- **Gestionnaire de paquet**: `npm` (basé sur `package-lock.json`).

### 2.2. Structure des Dossiers (`app`)

La structure est bien organisée et suit les conventions modernes de Next.js :

- **`app/page.tsx`**: Point d'entrée principal de l'application, qui rend le composant `HomePage`.
- **`app/layout.tsx`**: Layout racine qui englobe toutes les pages. Il configure les métadonnées (SEO), la langue (`fr`), et surtout, les **Providers de contexte**.
- **`app/components/`**: Contient les composants React réutilisables.
  - `pages/HomePage.tsx`: Le composant qui structure la page d'accueil.
  - `articles/ArticleGrid.tsx`, `ArticleCard.tsx`: Composants pour afficher les grilles et les cartes d'articles.
  - `layout/Header.tsx`, `Footer.tsx`: Composants de mise en page.
  - `ui/SearchBar.tsx`, `TagCloud.tsx`: Composants d'interface utilisateur pour l'interaction.
- **`app/contexts/`**: Gère l'état global de l'application via l'API Context de React.
  - `ArticlesContext.tsx`: Pour gérer les données des articles.
  - `AuthContext.tsx`: Pour la gestion de l'authentification (même si la logique n'est pas entièrement implémentée).
  - `ThemeContext.tsx`: Pour basculer entre les thèmes (ex: clair/sombre).
- **`app/hooks/`**: Contient les hooks React personnalisés pour la logique métier (ex: `useArticles`, `useInfiniteScroll`).
- **`app/lib/api/`**: Gère la communication avec le backend.
  - `client.ts`: Contient probablement la logique pour faire les appels `fetch` à l'API backend.
- **`app/types/`**: Définit les types TypeScript, notamment `Article.ts` qui structure les données d'un article.

### 2.3. Configuration (`next.config.js`)

Le fichier de configuration de Next.js est optimisé pour la production :
- **Optimisation des images**: Autorise les images provenant de `picsum.photos` et `unsplash.com`.
- **Sécurité**: Ajoute des en-têtes HTTP de sécurité (`X-Frame-Options`, `X-XSS-Protection`, etc.).
- **Mise en cache**: Configure une stratégie de cache agressive pour les assets statiques.
- **Optimisation Webpack**: Active le "tree shaking" et la séparation des "chunks" (morceaux de code) pour de meilleures performances en production.

---

## 3. Backend (Dossier `backend`)

Le backend est une API REST simple mais fonctionnelle qui sert les données au frontend.

### 3.1. Technologies Principales

- **Framework**: Flask 3.0.0
- **Serveur WSGI**: Gunicorn 21.2.0 (pour la production)
- **Langage**: Python
- **Base de données**: SQLite (un fichier `articles.db` local).
- **Utilitaires**: `Flask-CORS` pour gérer les autorisations cross-origin avec le frontend Next.js, `python-dotenv` pour la gestion des variables d'environnement.

### 3.2. API Endpoints (`api.py`)

L'API expose plusieurs routes préfixées par `/api`:

- `GET /api/health`: Vérifie l'état de santé de l'API et la connexion à la base de données.
- `GET /api/articles`: Endpoint principal. Retourne une liste paginée d'articles. Accepte des paramètres de requête comme `limit`, `offset`, et `search`.
- `GET /api/articles/<article_id>`: Retourne un article unique par son ID.
- `GET /api/trending`: Retourne les 10 articles les plus récents (utilisé comme substitut pour les tendances).
- `GET /api/search?q=...`: Endpoint de recherche dédié.

### 3.3. Gestion des Données

- **Source**: Les données proviennent d'une base de données SQLite (`backend/data/articles.db`).
- **Formatage**: Une fonction `format_article` dans `api.py` est cruciale. Elle prend les données brutes de la base de données et les transforme pour correspondre exactement à la structure attendue par le frontend (`Article.ts`). Elle génère également des données fictives (ex: URL d'image avec `picsum.photos`, catégorie, etc.).

---

## 4. Architecture Cible vs. Implémentation Actuelle (`docs/ARCHITECTURE.md`)

Le document d'architecture révèle une vision beaucoup plus ambitieuse pour le projet, qui n'est pas encore implémentée.

### 4.1. Architecture Cible (Vision Future)

- **Backend**: **FastAPI** au lieu de Flask pour de meilleures performances et une validation de données native.
- **Base de données**: **PostgreSQL** (plus robuste que SQLite) et **Redis** pour la mise en cache.
- **Couche IA/ML**: Une pipeline complexe est décrite :
  - **Embeddings**: Utilisation de `BGE-M3` pour la vectorisation de texte.
  - **Clustering**: `HDBSCAN` pour regrouper les articles par sujet.
  - **Recherche Vectorielle**: `FAISS` pour trouver des articles similaires.
  - **Génération de texte**: Un système RAG (Retrieval-Augmented Generation) pour la synthèse.
- **Déploiement**: Conteneurisation avec **Docker** et orchestration avec **Kubernetes**.
- **Monitoring**: Une stack complète avec Prometheus, Grafana, et Sentry.

### 4.2. Implémentation Actuelle (Code Existant)

- **Backend**: **Flask**, un framework plus simple.
- **Base de données**: **SQLite**, une base de données fichier, non adaptée à une forte charge.
- **Couche IA/ML**: **Inexistante**. La logique se limite à des requêtes SQL `LIKE` pour la recherche.
- **Déploiement**: Scripts `dev.sh`/`dev.ps1` pour un lancement local. Pas de configuration de production avancée.

**Conclusion de l'écart**: Le projet actuel est un **prototype fonctionnel** ou un **MVP (Minimum Viable Product)**. La documentation d'architecture sert de **feuille de route** pour les développements futurs.

---

## 5. Scripts et Opérations

- **`package.json`**: Contient les scripts `dev`, `build`, `start`, `lint` pour le projet Next.js.
- **`dev.ps1` / `dev.sh`**: Scripts shell pour faciliter le lancement de l'environnement de développement (probablement pour lancer le frontend et le backend simultanément).
