# NovaPress Backend - Quick Start (5 minutes)

## ⚡ Démarrage Ultra-Rapide

### Option 1: Docker (Recommandé - 3 commandes)

```bash
cd backend
cp .env.example .env
./start.sh  # ou .\start.ps1 sur Windows
```

**C'est tout !** 🎉

Services disponibles après ~2 minutes :
- ✅ Backend API: http://localhost:5000
- ✅ API Docs: http://localhost:5000/api/docs
- ✅ PostgreSQL, Redis, Qdrant, Ollama prêts

---

### Option 2: Local (Développeurs)

```bash
# 1. Installer dépendances
pip install -r requirements.txt

# 2. Télécharger modèles
python -m spacy download fr_core_news_lg
ollama pull mistral:7b-instruct

# 3. Services Docker
docker-compose up -d postgres redis qdrant ollama

# 4. Lancer backend
uvicorn app.main:app --reload --port 5000
```

---

## 🧪 Test Rapide

```bash
# Health check
curl http://localhost:5000/health

# Devrait retourner:
# {"status":"healthy","version":"2.0.0","stack":"100% Open Source (NO Gemini)"}
```

---

## 📚 Endpoints Essentiels

```bash
# Articles
curl http://localhost:5000/api/articles?limit=5

# Recherche sémantique
curl "http://localhost:5000/api/search?q=intelligence%20artificielle"

# API Interactive
open http://localhost:5000/api/docs
```

---

## 🛑 Arrêter

```bash
docker-compose down
```

---

## 📖 Documentation Complète

- **README.md** - Documentation principale
- **MIGRATION.md** - Migration depuis Gemini
- **INTEGRATION.md** - Intégration frontend
- **BACKEND_ARCHITECTURE.md** - Architecture détaillée

---

## 🆘 Problèmes ?

### Docker ne démarre pas
```bash
docker-compose logs backend
```

### Ollama ne répond pas
```bash
docker exec -it novapress_ollama ollama list
ollama pull mistral:7b-instruct
```

### Port 5000 occupé
```bash
# Modifier docker-compose.yml
ports:
  - "5001:5000"  # Utiliser 5001 au lieu de 5000
```

---

**Besoin d'aide ?** Consulter README.md ou issues GitHub
