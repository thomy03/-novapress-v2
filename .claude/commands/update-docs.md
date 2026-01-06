# Commande: Mise à jour Documentation Projet

**Objectif**: Mettre à jour `.claude/CLAUDE.md` avec les dernières avancées du projet de manière précise et concise.

## Instructions

Analyse la session actuelle et met à jour la documentation `.claude/CLAUDE.md` en suivant ces étapes :

### 1. Mise à jour de l'en-tête (lignes 4-8)

```markdown
**Dernière mise à jour**: [DATE DU JOUR]
**Version**: 2.0.0-alpha
**Status Global**: [X]% Complet (Frontend [Y]%, Backend [Z]%)
**Stack**: Next.js 15.4.6 | FastAPI 0.115 | BGE-M3 | HDBSCAN | Qdrant
**Pipeline IA**: [Status actuel avec émojis]
```

### 2. Ajout d'une nouvelle section dans "Bugs Résolus"

Si des bugs ont été corrigés dans cette session, ajouter après la dernière session :

```markdown
### Session du [DATE] ([Description courte])

**[N] bugs [critiques/majeurs/mineurs] résolus**:

#### 1. [Nom du bug] ✅

**Symptôme**:
```
[Message d'erreur exact]
```

**Fichier**: `[chemin/fichier.py:ligne]`

**Cause**: [Explication concise en 1 phrase]

**Fix**:
```python
# ❌ AVANT
[code avant]

# ✅ APRÈS
[code après]
```

**Résultat**: [Impact mesurable du fix]
```

### 3. Mise à jour du tableau "État Actuel du Projet"

Mettre à jour les pourcentages et statuts dans la section Roadmap :

```markdown
| Composant | Status | Complétion | Notes |
|-----------|--------|-----------|-------|
| **Pipeline IA** | ✅ **TESTÉ** | [%] | **[Détails tests réussis]** ✅ |
```

### 4. Mise à jour de la section "Immédiat (Cette Semaine)"

Marquer les tâches complétées avec ✅ et ajouter résultats :

```markdown
1. **[Nom tâche]** ✅ **COMPLÉTÉ [DATE]**
   - ✅ Sous-tâche 1 → **[Résultat chiffré]**
   - ✅ Sous-tâche 2 → **[Résultat chiffré]**
```

### 5. Ajout dans le Changelog (en haut de la section)

```markdown
### [YYYY-MM-DD] - [Titre Session Concis]

**Fixed**:
- ✅ [Bug 1]: [Description courte]
- ✅ [Bug 2]: [Description courte]

**Changed**:
- `[fichier]`: [Modification]

**Added**:
- ✅ [Feature/Test]: [Description]

**Tested**:
- ✅ [Composant]: [Résultat mesurable]
- 🎉 **[Achievement notable]**

**Status**: [Impact global du changement]
```

## Critères de Qualité

✅ **Concision**: 1 phrase par cause/fix, pas de verbiage
✅ **Mesurable**: Toujours donner des chiffres (10/10, 90%, 11.3s)
✅ **Précis**: Fichiers avec numéros de ligne exacts
✅ **Contextuel**: Assez de détails pour comprendre dans 6 mois
✅ **Structuré**: Suivre exactement le format markdown

## Informations à Capturer

### Bugs Résolus
- Message d'erreur exact
- Fichier + numéro de ligne
- Cause racine en 1 phrase
- Code avant/après (10 lignes max)
- Résultat mesurable

### Tests Réussis
- Composant testé
- Méthode de test
- Résultat chiffré (X/Y réussis, Z% amélioration)
- Temps d'exécution si pertinent

### Avancées Projet
- Pourcentage de complétion mis à jour
- Fonctionnalités devenues opérationnelles
- Services/conteneurs lancés
- Dépendances installées

### Difficultés Rencontrées
- Problèmes non résolus
- Limitations découvertes
- Contournements temporaires (workarounds)

## Exemple de Mise à Jour Complète

```markdown
**Dernière mise à jour**: 25 Novembre 2025
**Status Global**: 90% Complet (Frontend 95%, Backend 85%)
**Pipeline IA**: ✅ OPÉRATIONNELLE (Scraping, Embeddings, Dédup, Qdrant Storage)

---

### Session du 25 Novembre 2025 (Pipeline IA - Tests Complets)

**3 bugs critiques résolus + Pipeline 100% opérationnelle** 🎉

#### 1. Fix Qdrant Timestamp ✅
**Symptôme**: `Range.gte should be a valid number, got '2025-11-23...'`
**Fichier**: `backend/app/db/qdrant_client.py:292`
**Cause**: Range.gte attend float, pas ISO string
**Fix**: `.isoformat()` → `.timestamp()`
**Résultat**: 0 erreurs → Fetch 0 articles (aucune erreur) ✅

[...]

**Tested**:
- ✅ Scraping: 10/10 articles (CNN + Le Monde)
- ✅ Embeddings: 10 vecteurs 1024-dim générés
- 🎉 **Pipeline complétée en 11.3s**

**Status**: Pipeline IA opérationnelle, Backend 75% → 85%
```

## Actions à Effectuer

1. Lire `.claude/CLAUDE.md` (lignes 1-100 pour contexte)
2. Identifier les changements de cette session
3. Mettre à jour l'en-tête (date, status, pourcentages)
4. Ajouter nouvelle section "Bugs Résolus" si applicable
5. Mettre à jour tableau "État Actuel du Projet"
6. Mettre à jour "Immédiat (Cette Semaine)"
7. Ajouter entrée Changelog en haut
8. Vérifier cohérence globale du document

## Note Importante

⚠️ **NE PAS** :
- Supprimer l'historique ancien
- Modifier les sections existantes (sauf tableaux de status)
- Ajouter du contenu non vérifié
- Utiliser des estimations sans source

✅ **TOUJOURS** :
- Garder les exemples de code concis (< 10 lignes)
- Utiliser émojis de status (✅ ⏳ ❌ 🎉)
- Donner des chiffres précis et mesurables
- Dater chaque modification
