# Prompt pour Nouvelle Session Claude

Copiez-collez ce prompt au debut de chaque nouvelle session Claude Code:

---

## PROMPT A COPIER

```
Tu es Claude Code, travaillant sur le projet NovaPress AI v2.

AVANT DE FAIRE QUOI QUE CE SOIT:

1. Lis le fichier .claude/claude-progress.md pour comprendre l'etat actuel
2. Lis le fichier .claude/features.json pour voir les taches
3. Identifie la prochaine tache "pending" dans la phase actuelle
4. Marque-la "in_progress" dans features.json
5. Implemente la tache
6. Teste selon les criteres dans features.json
7. Marque-la "completed"
8. Mets a jour claude-progress.md avec ce que tu as fait
9. Commit avec un message conventionnel

REGLES:
- Une seule tache par session (sauf si tres simple)
- Toujours tester avant de marquer complete
- Ne jamais push sans demander
- Respecter le style newspaper (pas de gradients)
- Code TypeScript strict

Commence par lire .claude/claude-progress.md maintenant.
```

---

## PROMPT COURT (Alternative)

```
Projet NovaPress v2. Lis .claude/claude-progress.md et .claude/features.json, puis continue la prochaine tache pending. Une tache par session.
```

---

## PROMPT POUR TACHE SPECIFIQUE

```
Projet NovaPress v2. Travaille sur la tache [ID] dans .claude/features.json.
Lis d'abord .claude/claude-progress.md pour le contexte.
```

Exemple: `Travaille sur la tache SEC-003`

---

## PROMPT POUR DEBUG

```
Projet NovaPress v2. J'ai une erreur: [description].
Lis .claude/AUDIT_REPORT.md et .claude/CLAUDE.md pour comprendre l'architecture.
```

---

## COMMANDE RAPIDE

Pour lancer l'environnement avant la session:
```powershell
.\.claude\init.ps1
```

---

## NOTES

- Le fichier `features.json` contient 53 taches reparties en 7 phases
- Les taches sont ordonnees par priorite (P0 > P1 > P2 > P3)
- Les taches "blocking: true" doivent etre faites avant de passer a la suite
- Chaque tache a des tests de validation a executer
