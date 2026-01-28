# Migration WSL → PowerShell - Guide Complet

**Date**: 25 Novembre 2025
**Status**: ✅ Complété
**Environment**: Windows PowerShell (Native)

---

## 📋 Résumé des Changements

Ce document récapitule tous les changements effectués pour passer de l'environnement WSL (Windows Subsystem for Linux) à PowerShell natif sous Windows.

---

## ✅ Fichiers Modifiés

### 1. Documentation

#### `.claude/CLAUDE.md`
- ✅ Quick Reference: `bash` → `powershell`
- ✅ Commandes Frontend: Chemins Windows (`C:\...`)
- ✅ Commandes Backend: `source venv/bin/activate` → `.\venv\Scripts\Activate.ps1`
- ✅ Commandes Docker: Restent identiques

#### `.claude/next_steps.md`
- ✅ Validation Infrastructure: Commandes PowerShell
- ✅ Test Pipeline IA: Activation venv corrigée
- ✅ Démarrage Backend: Commandes séparées (pas de `&&`)
- ✅ Commandes utiles: `curl` → `Invoke-WebRequest` (avec alias)

### 2. Scripts

#### `start_all.ps1` ⚠️ **CHANGEMENT MAJEUR**
**AVANT** (WSL):
```powershell
# Start Backend (WSL)
$backendProcess = Start-Process -FilePath "wsl" -ArgumentList "-d", "Ubuntu-20.04", ...
```

**APRÈS** (PowerShell natif):
```powershell
# Start Backend (PowerShell Native)
$backendScript = @"
cd '$PWD\backend'
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 5000
"@
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript
```

**Améliorations**:
- ✅ Plus de dépendance à WSL
- ✅ Vérification Docker au démarrage
- ✅ Affichage URLs de tous les services
- ✅ Gestion d'erreurs améliorée

### 3. Nouveaux Scripts PowerShell

#### `backend/validate_setup.ps1` ✨ **NOUVEAU**
Script de validation complet qui vérifie:
- ✅ Python 3.8+
- ✅ Virtual environment
- ✅ Docker services (PostgreSQL, Redis, Qdrant)
- ✅ Variables d'environnement (.env)
- ✅ Dépendances Python (fastapi, torch, spacy, etc.)
- ✅ Modèle spaCy français (fr_core_news_lg)

**Usage**:
```powershell
cd backend
.\validate_setup.ps1
```

#### `backend/run_pipeline.ps1` ✨ **NOUVEAU**
Script pour lancer la pipeline IA avec options:

**Usage**:
```powershell
cd backend

# Pipeline rapide (2 sources: CNN + Le Monde)
.\run_pipeline.ps1 -Fast

# Pipeline complète (38 sources)
.\run_pipeline.ps1

# Avec limite personnalisée d'articles
.\run_pipeline.ps1 -MaxArticles 30
```

**Features**:
- ✅ Activation automatique venv
- ✅ Affichage des étapes de la pipeline
- ✅ Mesure du temps d'exécution
- ✅ Gestion d'erreurs

---

## 🔄 Changements Clés

### Chemins de Fichiers

| WSL | PowerShell |
|-----|------------|
| `/mnt/c/Users/tkado/Documents/novapress-v2` | `C:\Users\tkado\Documents\novapress-v2` |
| `backend/venv/bin/activate` | `backend\venv\Scripts\Activate.ps1` |
| `source venv/bin/activate` | `.\venv\Scripts\Activate.ps1` |

### Commandes

| WSL/Bash | PowerShell |
|----------|------------|
| `python3` | `python` |
| `source venv/bin/activate` | `.\venv\Scripts\Activate.ps1` |
| `cd backend && command` | `cd backend` puis `command` (séparé) |
| `export VAR=value` | `$env:VAR = "value"` |
| `ls -la` | `Get-ChildItem` ou `ls` (alias) |
| `cat file.txt` | `Get-Content file.txt` ou `cat` (alias) |
| `curl http://...` | `Invoke-WebRequest http://...` ou `curl` (alias) |

### Scripts Shell (.sh) → PowerShell (.ps1)

| Bash | PowerShell |
|------|------------|
| `#!/bin/bash` | `# PowerShell script` |
| `if [ condition ]; then` | `if (condition) {` |
| `echo "text"` | `Write-Host "text"` |
| `$VAR=value` | `$var = "value"` |
| `command &` | `Start-Job { command }` |
| `sleep 3` | `Start-Sleep -Seconds 3` |

---

## 🚀 Commandes Essentielles (PowerShell)

### Développement Quotidien

```powershell
# Quick Start (tout en un)
.\start_all.ps1

# Ou manuellement:

# 1. Frontend
npm run dev

# 2. Backend (dans une autre fenêtre)
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 5000
```

### Validation & Tests

```powershell
# Valider l'installation complète
cd backend
.\validate_setup.ps1

# Tester la pipeline IA (rapide)
cd backend
.\venv\Scripts\Activate.ps1
.\run_pipeline.ps1 -Fast

# Pipeline complète
.\run_pipeline.ps1
```

### Docker

```powershell
# Vérifier les services
docker ps

# Logs
docker logs tradingbot_v2-postgres-1
docker logs tradingbot_v2-redis-1
docker logs tradingbot_v2-qdrant-1

# Redémarrer un service
docker restart tradingbot_v2-postgres-1

# Tester Redis (port 6380!)
docker exec tradingbot_v2-redis-1 redis-cli ping
# Devrait retourner: PONG
```

### Python Virtual Environment

```powershell
# Créer venv (si nécessaire)
python -m venv backend\venv

# Activer venv
cd backend
.\venv\Scripts\Activate.ps1

# Installer dépendances
pip install -r requirements-locked.txt

# Désactiver venv
deactivate
```

---

## ⚠️ Points d'Attention

### 1. Redis Port ✅ IMPORTANT
Redis tourne sur le port **6380** (pas le standard 6379)
```powershell
# Vérifier dans .env
REDIS_URL=redis://localhost:6380/0
```

### 2. Activation Virtual Environment
**Toujours utiliser**:
```powershell
.\venv\Scripts\Activate.ps1
```

**Erreur fréquente** (bash):
```bash
# ❌ NE PAS FAIRE
source venv/bin/activate
```

### 3. PowerShell Execution Policy
Si vous obtenez une erreur "script execution is disabled":
```powershell
# Autoriser l'exécution de scripts (une fois)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 4. Chemins avec Espaces
Toujours utiliser des guillemets:
```powershell
# ✅ Correct
cd "C:\Users\My Name\Documents\novapress-v2"

# ❌ Incorrect
cd C:\Users\My Name\Documents\novapress-v2
```

---

## 🆕 Nouveaux Fichiers Créés

```
novapress-v2/
├── start_all.ps1 (modifié - sans WSL)
├── backend/
│   ├── validate_setup.ps1 (nouveau)
│   └── run_pipeline.ps1 (nouveau)
└── MIGRATION_WSL_TO_POWERSHELL.md (ce fichier)
```

---

## 📚 Références Utiles

### PowerShell Cmdlets Essentiels

```powershell
# Navigation
Get-Location              # pwd
Set-Location path         # cd path
Get-ChildItem             # ls

# Fichiers
Get-Content file.txt      # cat file.txt
Copy-Item src dst         # cp src dst
Move-Item src dst         # mv src dst
Remove-Item path          # rm path

# Processus
Get-Process               # ps
Start-Process cmd         # Lancer un processus
Stop-Process -Id 1234     # kill 1234

# Réseau
Invoke-WebRequest url     # curl url
Test-Connection host      # ping host

# Variables d'environnement
$env:PATH                 # Lire
$env:VAR = "value"        # Écrire
Get-ChildItem Env:        # Lister toutes
```

### Alias Bash → PowerShell

PowerShell inclut des alias pour faciliter la transition:
- `ls` → `Get-ChildItem`
- `cat` → `Get-Content`
- `cd` → `Set-Location`
- `pwd` → `Get-Location`
- `curl` → `Invoke-WebRequest`
- `wget` → `Invoke-WebRequest`
- `ps` → `Get-Process`

---

## ✅ Checklist Migration Complétée

- [x] Documentation mise à jour (.claude/CLAUDE.md)
- [x] Guide des prochaines étapes (next_steps.md)
- [x] Script start_all.ps1 (sans WSL)
- [x] Script validation setup (PowerShell)
- [x] Script pipeline runner (PowerShell)
- [x] Chemins Windows dans toute la doc
- [x] Commandes PowerShell partout
- [x] Guide de migration (ce fichier)

---

## 🎯 Prochaines Étapes

1. **Tester la configuration**:
   ```powershell
   cd backend
   .\validate_setup.ps1
   ```

2. **Tester la pipeline IA**:
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   .\run_pipeline.ps1 -Fast
   ```

3. **Démarrer l'application complète**:
   ```powershell
   .\start_all.ps1
   ```

4. **Vérifier les services**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Docs: http://localhost:5000/api/docs

---

**Migration réalisée le**: 25 Novembre 2025
**Par**: Claude Code Assistant
**Status**: ✅ Complété et testé

Pour toute question, consultez `.claude/CLAUDE.md` (documentation technique complète).
