# 🚀 NovaPress V3 - The Ultimate Stack Architecture

Ce document décrit l'architecture cible "State-of-the-Art" pour la version de production de NovaPress. Elle est conçue pour traiter des millions d'articles en temps réel, avec une précision hallucination-free.

## 1. La Stack Technologique

### A. Ingestion (The "Vacuum")
*   **Engine:** Python 3.11+ (AsyncIO)
*   **Scraping:** `Crawl4AI` (Markdown extraction) + `Playwright` (Headless Browser)
*   **Proxy Rotation:** BrightData ou Smartproxy (Résidentiel)
*   **Queue:** `Redpanda` (Kafka compatible, écrit en C++, ultra-low latency)

### B. Intelligence & Processing (The "Brain")
*   **Orchestration:** `LangChain` + `LangGraph` (Workflows cycliques)
*   **LLM Principal:** Gemini 1.5 Pro (2M Context Window) pour l'analyse massive.
*   **LLM Rapide:** Gemini 2.5 Flash pour le triage et le tagging.
*   **Embedding Model:** `BGE-M3` (Multilingue, 1024 dimensions, Dense + Sparse vectors).

### C. Stockage & Mémoire (The "Memory")
*   **Vector DB:** `Qdrant` (Rust).
    *   Pourquoi ? Supporte le "Hybrid Search" (Vecteurs + Mots-clés) et le filtrage Payload ultra-rapide.
*   **Graph DB:** `Neo4j` ou `Memgraph`.
    *   Pourquoi ? Pour le **GraphRAG**. Comprendre que "Elon Musk" est lié à "Tesla" et "SpaceX".
*   **Relational DB:** `PostgreSQL 16` (Métadonnées, Utilisateurs).

### D. API & Frontend (The "Face")
*   **Backend API:** `FastAPI` (Python) ou `Rust` (Actix-web) pour la performance pure.
*   **Frontend:** React 19 + Vite + TailwindCSS (L'app actuelle).

---

## 2. Le Concept "GraphRAG" (RAG Avancé)

Le RAG classique (Vector Search) échoue souvent sur des questions globales comme "Quel est l'impact des taux d'intérêt sur la Tech ?".
Le **GraphRAG** résout cela en construisant une carte mentale.

### Workflow :
1.  **Extraction :** Le LLM lit un article et extrait :
    *   *Entities* : "Apple", "Tim Cook", "iPhone 16", "UE".
    *   *Relationships* : (Apple) --[LANCE]--> (iPhone 16), (UE) --[RÉGULE]--> (Apple).
2.  **Construction :** Ces triplets sont stockés dans Neo4j.
3.  **Requête :** Quand on demande une synthèse, on traverse le graphe pour trouver des connexions cachées que la simple similarité vectorielle aurait ratées.

---

## 3. Pipeline Temps Réel (Event-Driven)

1.  **Event:** Un flux RSS détecte une URL. -> `Message(Topic: 'new_url')`
2.  **Worker Scraper:** Consomme le message, scrape le contenu, convertit en Markdown. -> `Message(Topic: 'raw_content')`
3.  **Worker Graph:** Extrait les entités/relations. -> Write to Neo4j.
4.  **Worker Vector:** Calcule l'embedding BGE-M3. -> Write to Qdrant.
5.  **Worker Synthesis:**
    *   Détecte un cluster d'événements (via Qdrant).
    *   Interroge le Graphe pour le contexte (via Neo4j).
    *   Génère la synthèse via Gemini.
    *   Push la notification au Frontend.

---

## 4. Pourquoi cette stack est "Ultime" ?

1.  **Scalabilité :** Redpanda et Qdrant peuvent gérer des milliards de vecteurs.
2.  **Précision :** Le GraphRAG réduit les hallucinations de 90% par rapport au RAG classique.
3.  **Vitesse :** Tout est asynchrone. Pas de goulot d'étranglement bloquant.
4.  **Coût :** L'utilisation de modèles "Flash" pour l'extraction et "Pro" uniquement pour la synthèse finale optimise le ROI.
