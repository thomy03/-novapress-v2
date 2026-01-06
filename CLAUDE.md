# NovaPress AI v2

**Status**: 100% | **Stack**: Next.js 15, FastAPI, BGE-M3, Qdrant | **Doc complète**: `.claude/CLAUDE.md`

## Commandes

```powershell
npm run dev                                    # Frontend :3000
cd backend && .\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 5000      # Backend :5000
python scripts/run_fast_pipeline.py            # Test pipeline
```

## Ports

Frontend:3000 | Backend:5000 | PostgreSQL:5432 | Redis:6380 | Qdrant:6333

## Design Rules

- **❌ NO gradients** - **✅ Newspaper style** (NYT, Le Monde) - **✅ Inline styles**

## Couleurs

| Text | Breaking | Logo AI | BG | Border |
|------|----------|---------|------|--------|
| #000 | #DC2626 | #2563EB | #FFF | #E5E5E5 |

## Prochaines Étapes

1. ~~Connecter Frontend → Backend~~ ✅
2. ~~Tester clustering >5 articles~~ ✅
3. ~~Valider synthèse LLM~~ ✅
4. ~~Redesign page accueil~~ ✅ (Hero + Secondary + Grid)
5. ~~Navigation dynamique~~ ✅ (Catégories + EN DIRECT + /live)
6. Déploiement production

**Version**: 2.0.0-alpha | **Mise à jour**: 30 Nov 2025