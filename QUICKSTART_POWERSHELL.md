# NovaPress AI v2 - Quick Start (PowerShell)

**Environment**: Windows PowerShell Native
**Last Updated**: 25 Novembre 2025

---

## 🚀 Démarrage Rapide (3 étapes)

### 1️⃣ Valider l'Installation

```powershell
cd backend
.\validate_setup.ps1
```

**Devrait afficher**:
- ✅ Python 3.8+
- ✅ Virtual environment
- ✅ PostgreSQL, Redis, Qdrant
- ✅ Variables d'environnement
- ✅ Dépendances Python
- ✅ Modèle spaCy français

---

### 2️⃣ Démarrer l'Application

```powershell
# Retour à la racine
cd ..

# Lancer tout (Frontend + Backend)
.\start_all.ps1
```

**Deux fenêtres PowerShell vont s'ouvrir**:
- 🐍 Backend (FastAPI) - http://localhost:5000
- ⚛️ Frontend (Next.js) - http://localhost:3000

---

### 3️⃣ Accéder à l'Application

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| API Documentation | http://localhost:5000/api/docs |

---

## 🧪 Tester la Pipeline IA

### Test Rapide (2 sources)

```powershell
cd backend
.\venv\Scripts\Activate.ps1
.\run_pipeline.ps1 -Fast
```

**Durée**: ~2-3 minutes
**Sources**: CNN + Le Monde

### Pipeline Complète (38 sources)

```powershell
.\run_pipeline.ps1
```

**Durée**: ~5-10 minutes
**Sources**: Tous les médias mondiaux configurés

---

## 🔧 Commandes Utiles

### Backend

```powershell
# Activer venv
cd backend
.\venv\Scripts\Activate.ps1

# Lancer API
uvicorn app.main:app --reload --port 5000

# Installer dépendances
pip install -r requirements-locked.txt

# Télécharger modèle spaCy
python -m spacy download fr_core_news_lg
```

### Frontend

```powershell
# Développement
npm run dev

# Build production
npm run build
npm run start

# Linting
npm run lint
```

### Docker

```powershell
# Vérifier services
docker ps

# Logs
docker logs tradingbot_v2-postgres-1
docker logs tradingbot_v2-redis-1
docker logs tradingbot_v2-qdrant-1

# Redémarrer
docker restart tradingbot_v2-postgres-1
```

---

## ⚠️ Troubleshooting

### Erreur: "Scripts execution disabled"

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Erreur: "Port already in use"

```powershell
# Trouver le processus
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# Tuer le processus
Stop-Process -Id <PID>
```

### Erreur: "Docker not running"

1. Ouvrir Docker Desktop
2. Attendre que Docker soit "Running"
3. Vérifier: `docker ps`

### Erreur: "Redis connection refused"

Vérifier le port dans `.env`:
```env
REDIS_URL=redis://localhost:6380/0
```

**Port critique**: Redis utilise **6380** (non standard)

---

## 📁 Structure du Projet

```
novapress-v2/
├── start_all.ps1              # ⭐ Démarrage rapide
├── QUICKSTART_POWERSHELL.md   # Ce fichier
├── MIGRATION_WSL_TO_POWERSHELL.md  # Guide migration
│
├── app/                       # Frontend Next.js
│   ├── page.tsx
│   ├── components/
│   ├── contexts/
│   └── lib/
│
├── backend/                   # Backend FastAPI
│   ├── validate_setup.ps1    # ⭐ Validation
│   ├── run_pipeline.ps1      # ⭐ Pipeline IA
│   ├── venv/                 # Virtual environment
│   ├── app/
│   │   ├── main.py           # Entry point
│   │   ├── api/routes/
│   │   ├── services/
│   │   └── ml/
│   ├── scripts/
│   └── .env                  # ⚠️ Configuration
│
└── .claude/
    ├── CLAUDE.md             # 📖 Documentation complète
    └── next_steps.md         # 📋 Prochaines étapes
```

---

## 🎯 Workflows Courants

### Développement Frontend

```powershell
# Terminal 1: Backend
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 5000

# Terminal 2: Frontend
npm run dev
```

### Test Pipeline IA

```powershell
cd backend
.\venv\Scripts\Activate.ps1

# Test rapide
.\run_pipeline.ps1 -Fast

# Vérifier résultats dans Qdrant
python -c "from qdrant_client import QdrantClient; client = QdrantClient('http://localhost:6333'); print(client.get_collections())"
```

### Ajouter une Dépendance Python

```powershell
cd backend
.\venv\Scripts\Activate.ps1

# Installer
pip install package-name

# Mettre à jour requirements
pip freeze > requirements.txt
```

---

## 📚 Documentation Complète

- **Documentation technique**: `.claude/CLAUDE.md`
- **Prochaines étapes**: `.claude/next_steps.md`
- **Migration WSL→PS**: `MIGRATION_WSL_TO_POWERSHELL.md`

---

## ✅ Checklist Premier Lancement

- [ ] Docker Desktop démarré
- [ ] PostgreSQL, Redis, Qdrant en cours d'exécution
- [ ] Fichier `.env` configuré
- [ ] Virtual environment créé
- [ ] Dépendances Python installées
- [ ] Modèle spaCy téléchargé
- [ ] Dépendances Node.js installées
- [ ] Validation setup OK (`.\validate_setup.ps1`)

---

## 🆘 Besoin d'Aide ?

1. **Valider l'installation**: `cd backend && .\validate_setup.ps1`
2. **Consulter la doc**: `.claude/CLAUDE.md`
3. **Vérifier Docker**: `docker ps`
4. **Logs Backend**: Voir terminal Backend
5. **Logs Frontend**: Voir terminal Frontend

---

**Happy Coding! 🚀**
