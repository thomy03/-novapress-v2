# 🚀 NovaPress AI v2 - Guide de Démarrage Complet

## Architecture Fusionnée Frontend + Backend

Félicitations ! Ton projet NovaPress AI v2 est maintenant un projet fullstack unifié :

```
novapress-v2/
├── 📱 Frontend (Next.js 15)
│   └── Port 3000
└── 🐍 Backend (Flask API)
    └── Port 5000
```

## ✅ Ce qui a été fait

### 1. Backend Intégré
- ✅ API Flask copiée depuis `novapress_ai_v2`
- ✅ Database SQLite (33MB, ~1000+ articles)
- ✅ Endpoints REST compatibles Next.js
- ✅ CORS configuré pour localhost

### 2. Configuration
- ✅ `.env.local` créé avec variables
- ✅ `.env.example` pour documentation
- ✅ `backend/requirements.txt` (dépendances minimales)

### 3. Scripts de Démarrage
- ✅ `dev.sh` pour Linux/macOS/WSL
- ✅ `dev.ps1` pour Windows PowerShell
- ✅ Démarrage automatique des 2 serveurs

### 4. Frontend Connecté
- ✅ API config mise à jour (port 5000)
- ✅ ArticlesContext prêt à consommer le backend
- ✅ Fallback sur mock data si backend indisponible

## 🎯 Démarrage Immédiat

### Option A: Script Automatique (Recommandé)

#### Sur WSL/Linux/macOS:
```bash
cd /mnt/c/Users/tkado/Documents/novapress-v2
./dev.sh
```

#### Sur Windows PowerShell:
```powershell
cd C:\Users\tkado\Documents\novapress-v2
.\dev.ps1
```

### Option B: Démarrage Manuel

#### Terminal 1 - Backend:
```bash
cd /mnt/c/Users/tkado/Documents/novapress-v2

# Créer virtual env (première fois seulement)
python3 -m venv backend/venv

# Activer
source backend/venv/bin/activate  # Linux/macOS/WSL
# OU
backend\venv\Scripts\activate     # Windows

# Installer dépendances (première fois)
pip install -r backend/requirements.txt

# Démarrer API
python backend/api.py
```

✅ Backend démarré sur **http://localhost:5000**

#### Terminal 2 - Frontend:
```bash
cd /mnt/c/Users/tkado/Documents/novapress-v2

# Installer dépendances (première fois)
npm install

# Démarrer Next.js
npm run dev
```

✅ Frontend démarré sur **http://localhost:3000**

## 🧪 Vérifier que tout fonctionne

### 1. Test Backend
Ouvre ton navigateur :
```
http://localhost:5000/api/health
```

Tu devrais voir :
```json
{
  "status": "healthy",
  "database": "connected",
  "articlesCount": 1234,
  "timestamp": "2025-01-15T...",
  "version": "2.0.0"
}
```

### 2. Test Articles API
```
http://localhost:5000/api/articles?limit=5
```

Tu devrais voir 5 articles formatés en JSON.

### 3. Test Frontend
```
http://localhost:3000
```

L'application NovaPress s'affiche normalement.

### 4. Test Connexion Frontend ↔ Backend
Ouvre la console du navigateur (F12) et regarde les requêtes réseau.
Tu devrais voir des appels à `http://localhost:5000/api/...`

## 📡 API Endpoints Disponibles

| Endpoint | Description | Exemple |
|----------|-------------|---------|
| `GET /api/health` | Health check | Status + stats |
| `GET /api/articles` | Liste articles | ?limit=10&offset=0 |
| `GET /api/articles/<id>` | Article détail | /api/articles/123 |
| `GET /api/trending` | Topics tendance | Top 10 articles |
| `GET /api/search` | Recherche | ?q=intelligence+artificielle |

## 🔧 Variables d'Environnement

Fichier `.env.local` (déjà créé) :

```env
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000

# Backend
FLASK_ENV=development
FLASK_DEBUG=true
DATABASE_PATH=backend/data/articles.db
PORT=5000
```

## 🗄️ Base de Données

### Localisation
```
backend/data/articles.db
```

### Taille
33 MB (~1000+ articles)

### Explorer la DB
```bash
# Installer sqlite3
sudo apt install sqlite3  # Linux
brew install sqlite3      # macOS

# Explorer
sqlite3 backend/data/articles.db

# Voir les tables
.tables

# Compter les articles
SELECT COUNT(*) FROM topics;

# Voir 5 derniers articles
SELECT id, titre, date_creation
FROM topics
ORDER BY date_creation DESC
LIMIT 5;

# Quitter
.quit
```

## 🚨 Troubleshooting

### Problème: Backend ne démarre pas

**Erreur: `python3: command not found`**
```bash
# Installer Python 3.10+
sudo apt install python3 python3-venv python3-pip
```

**Erreur: `ModuleNotFoundError: No module named 'flask'`**
```bash
# Réinstaller les dépendances
source backend/venv/bin/activate
pip install -r backend/requirements.txt
```

**Erreur: `Database connection failed`**
```bash
# Vérifier que la DB existe
ls -lh backend/data/articles.db

# Si manquante, recopier depuis novapress_ai_v2
cp /mnt/c/Users/tkado/Documents/novapress_ai_v2/data/articles.db backend/data/
```

### Problème: Frontend ne se connecte pas au backend

**Erreur: `Failed to fetch` dans la console**

1. Vérifier que le backend est démarré :
```bash
curl http://localhost:5000/api/health
```

2. Vérifier les variables d'environnement :
```bash
cat .env.local
# Doit contenir : NEXT_PUBLIC_API_URL=http://localhost:5000
```

3. Redémarrer Next.js :
```bash
npm run dev
```

### Problème: Port déjà utilisé

**Backend (Port 5000)**
```bash
# Trouver le process
lsof -i :5000

# Tuer le process
kill -9 <PID>

# OU changer le port dans .env.local
PORT=5001
```

**Frontend (Port 3000)**
```bash
# Next.js va proposer automatiquement 3001, 3002...
# Ou forcer un port :
npm run dev -- --port 3001
```

## ⚡ Prochaines Étapes

Maintenant que le backend est fusionné, tu peux :

### 1. Développer des nouvelles features
- Ajouter l'authentification
- Implémenter WebSocket temps réel
- Créer page détail article

### 2. Optimiser
- Migrer vers Tailwind (comme discuté)
- Ajouter des tests
- Optimiser les requêtes DB

### 3. Prépar
er mobile
- Setup Expo React Native
- Créer Monorepo Turborepo
- Utiliser NativeWind

## 📚 Documentation Supplémentaire

- [README.md](./README.md) - Vue d'ensemble
- [CLAUDE.md](./CLAUDE.md) - Context pour Claude
- [docs/BACKEND_INTEGRATION.md](./docs/BACKEND_INTEGRATION.md) - Intégration détaillée

---

**🎉 Ton projet est prêt ! Lance `./dev.sh` et commence à coder !**
