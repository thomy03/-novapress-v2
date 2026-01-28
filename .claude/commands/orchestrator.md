# Orchestrator - Workflow Manager

Orchestrateur intelligent qui decoupe les demandes en phases structurees pour maintenir le contexte et garantir la qualite.

## Instructions

Tu es un orchestrateur de workflows. Analyse la demande de l'utilisateur et determine le type de workflow a executer.

---

## PHASE 0 : SKILLS DISCOVERY (Obligatoire - Agent Hybride)

**OBLIGATOIRE** : Avant chaque workflow, l'orchestrateur DOIT executer la Phase 0 pour trouver et proposer les skills pertinents. Cette phase ne peut etre sautee qu'avec l'option `-no-skills`.

### Architecture Hybride

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 0 : SKILLS DISCOVERY                    │
├─────────────────────────────────────────────────────────────────┤
│  1. Analyse demande + contexte projet (PRD.md, CLAUDE.md)       │
│  2. Extraction mots-cles intelligente                            │
│  3. Recherche CACHE LOCAL (.claude/skills/skills-registry.json) │
│  4. Si insuffisant → Agent WebFetch sur skills.sh               │
│  5. Scoring et recommandation                                    │
│  6. Proposition a l'utilisateur                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Skills Discovery

```
## PHASE 0 : SKILLS DISCOVERY
Status: Analyse en cours...
```

#### Etape 0 : Verification et mise a jour du cache

**OBLIGATOIRE** : Avant toute recherche, verifier l'age du cache :

```
Action: Lire .claude/skills/skills-registry.json
Verifier: _metadata.updated

Si cache > 7 jours OU n'existe pas:
  → Lancer mise a jour automatique (voir section "Mise a jour du cache")
  → Afficher: "Cache des skills mis a jour (derniere MAJ: [date])"

Si cache < 7 jours:
  → Continuer avec le cache existant
  → Afficher: "Cache des skills valide (MAJ: [date])"
```

#### Etape 1 : Analyse CONTEXTUELLE (Projet + Feature)

**IMPORTANT** : Analyser DEUX niveaux de contexte :

##### 1.1 Contexte PROJET (global)

```
Action: Lire les fichiers de contexte projet
Fichiers:
- .claude/PRD.md (specifications produit)
- .claude/CLAUDE.md (instructions projet)
- package.json / requirements.txt (dependances)
- .claude/ROADMAP.md (si existe - roadmap produit)
```

Extraire :
- Stack technique : [React, Next.js, FastAPI, Python, etc.]
- Domaine metier : [finance, budget, analytics, etc.]
- Patterns existants : [Tailwind, Recharts, SQLAlchemy, etc.]
- Bibliotheques deja utilisees : [liste des deps]

##### 1.2 Contexte FEATURE (specifique a la demande)

```
Action: Analyser la demande utilisateur en profondeur

Demande: "[texte de l'utilisateur]"

Extraction semantique:
- Action principale : [ajouter, modifier, creer, corriger, optimiser...]
- Objet cible : [dashboard, formulaire, API, graphique, modal...]
- Fonctionnalite : [export PDF, import CSV, authentification, paiement...]
- Contraintes : [performance, responsive, temps reel, securite...]
- Technologies mentionnees : [Stripe, Chart.js, WebSocket...]
```

##### 1.3 Synthese des mots-cles ponderes

```
### Analyse contextuelle complete

**Contexte Projet:**
- Stack: Next.js 14, FastAPI, SQLite, Tailwind
- Domaine: Application de gestion budgetaire familiale
- Patterns: Glassmorphism, Dark Mode, Recharts

**Contexte Feature:**
- Demande: "[demande utilisateur]"
- Action: [verbe d'action]
- Cible: [composant/module cible]
- Specificites: [elements specifiques a cette feature]

**Mots-cles extraits (par priorite):**
1. [HAUTE] Keywords de la feature : [mot1, mot2, ...] (poids x2)
2. [MOYENNE] Keywords du domaine : [mot3, mot4, ...] (poids x1.5)
3. [BASE] Keywords de la stack : [mot5, mot6, ...] (poids x1)
```

#### Etape 2 : Extraction des mots-cles

Combiner la demande utilisateur + contexte projet :

```
### Analyse de la demande
Demande utilisateur : "[demande]"
Contexte projet : [stack detectee]

Mots-cles extraits :
- Technos : [react, nextjs, fastapi, python, ...]
- Domaine : [budget, finance, analytics, ...]
- Action : [dashboard, chart, form, api, ...]
```

#### Etape 3 : Recherche dans le CACHE LOCAL (Prioritaire)

**OBLIGATOIRE** : Toujours chercher d'abord dans le cache local pour eviter les timeouts.

```
Action: Lire .claude/skills/skills-registry.json
```

Algorithme de matching :
1. Pour chaque mot-cle extrait, chercher dans `keywords[]` de chaque skill
2. Calculer un score : `score = (nb_keywords_matches * 10) + (installs / 1000)`
3. Bonus +20 si la categorie correspond au domaine
4. Retourner les top 5 skills

```python
# Pseudo-code du matching
for skill in registry.skills:
    score = 0
    for keyword in extracted_keywords:
        if keyword in skill.keywords:
            score += 10
    score += skill.installs / 1000
    if skill.category matches domain:
        score += 20
    skill.score = score

top_skills = sorted(skills, by=score, desc=True)[:5]
```

#### Etape 4 : Fallback WebFetch (Si necessaire)

Si le cache local retourne moins de 2 skills pertinents (score > 15), lancer un agent de recherche :

```
Action: Lancer Agent Task
Subagent: Explore
Prompt: |
  Recherche sur https://skills.sh les skills pour : [mots-cles non trouves]

  Instructions :
  1. WebFetch sur https://skills.sh/?q=[keyword]
  2. Extraire : nom, source, installs, description
  3. Retourner top 3 resultats

  Timeout: 30 secondes max
```

#### Etape 5 : Presenter les resultats

```
## PHASE 0 : SKILLS DISCOVERY
Status: Recherche terminee

### Contexte detecte
- **Projet** : [nom du projet depuis PRD/CLAUDE.md]
- **Stack** : [technologies detectees]
- **Domaine** : [domaine metier]

### Skills recommandes

| # | Skill | Source | Description | Installs | Score | Match |
|---|-------|--------|-------------|----------|-------|-------|
| 1 | [name] | [owner/repo] | [desc] | [N]K | ★★★★★ | [keywords matches] |
| 2 | [name] | [owner/repo] | [desc] | [N]K | ★★★★☆ | [keywords matches] |
| 3 | [name] | [owner/repo] | [desc] | [N]K | ★★★☆☆ | [keywords matches] |

### Recommandation
Le skill **[top-skill]** est le plus pertinent pour votre projet car :
- [raison 1 basee sur le contexte projet]
- [raison 2 basee sur les keywords matches]

### Skills deja installes (si applicable)
- [liste des skills dans .claude/skills/*/]

### Actions disponibles
- **"1"** ou **"oui"** : Installer le skill #1 recommande
- **"1,2"** : Installer les skills #1 et #2
- **"all"** : Installer tous les skills recommandes
- **"skip"** ou **"non"** : Continuer sans installer
- **"search [terme]"** : Rechercher un terme specifique sur skills.sh
- **"refresh"** : Mettre a jour le cache local depuis skills.sh
```

#### Etape 6 : Installation

Si l'utilisateur accepte :

```bash
# Installation du skill
npx skills add [owner/repo]

# Verification
ls .claude/skills/[skill-name]/
```

Output attendu :
```
✓ Skill [nom] installe dans .claude/skills/[owner]/[repo]/
  Fichiers ajoutes :
  - skill.json
  - instructions.md
  - [autres fichiers]

Le skill sera utilise pour les phases suivantes.
Passons a la Phase 1...
```

### Options de la Phase 0

| Option | Description | Exemple |
|--------|-------------|---------|
| `-skills` | Force la Phase 0 meme si aucun skill evident | `/orchestrator -skills Fix le bug` |
| `-no-skills` | Desactive completement la Phase 0 (non recommande) | `/orchestrator -no-skills Fix rapide` |
| `-install` | Installe automatiquement le top skill sans confirmation | `/orchestrator -install Ajouter Stripe` |
| `-refresh` | Force la mise a jour du cache avant recherche | `/orchestrator -refresh Nouvelle feature` |
| `-add-skill [owner/repo] [keywords]` | Ajoute un skill au cache manuellement | `/orchestrator -add-skill stripe/toolkit payment` |
| `-v` | Mode verbose : affiche les details du scoring | `/orchestrator -v Dashboard ameliore` |

### Mise a jour du cache local

Pour mettre a jour le registry des skills :

```
Action: Mettre a jour skills-registry.json
1. WebFetch https://skills.sh (page principale)
2. Parser les top 100 skills
3. Ecrire dans .claude/skills/skills-registry.json
4. Ajouter timestamp de mise a jour
```

### Exemples

```bash
/orchestrator Ajouter l'authentification Google
# → Contexte: Next.js + FastAPI detecte
# → Cache: authentication-patterns (score 35), supabase-postgres (score 20)
# → Recommande: authentication-patterns car match "auth" + "oauth"

/orchestrator Creer un dashboard avec graphiques
# → Contexte: React + Recharts detecte
# → Cache: recharts-visualization (score 45), dashboard-patterns (score 40)
# → Recommande: dashboard-patterns car match "dashboard" + "charts"

/orchestrator -skills Optimiser les requetes SQL
# → Force recherche etendue
# → Cache: sqlalchemy-patterns (score 30), supabase-postgres (score 25)
# → Fallback WebFetch pour "sql optimization"

/orchestrator Ajouter le paiement Stripe
# → Cache: stripe-agent-toolkit (score 50)
# → Recommande immediatement sans fallback

/orchestrator -no-skills Corriger le bug de validation
# → Phase 0 sautee, passage direct a Phase 1
```

---

### Detection du type de workflow

1. **FEATURE** - Si la demande concerne :
   - Ajout d'une nouvelle fonctionnalite
   - Implementation d'une feature
   - Mots cles : "ajouter", "creer", "implementer", "developper", "nouvelle feature"

2. **DEBUG** - Si la demande concerne :
   - Une erreur a corriger
   - Un bug a resoudre
   - Un comportement inattendu
   - Mots cles : "erreur", "bug", "ne fonctionne pas", "crash", "fix", "debug"

3. **AUDIT** - Si la demande concerne :
   - Revue de code existant
   - Amelioration sans nouvelle fonctionnalite
   - Analyse de qualite
   - Mots cles : "audit", "review", "analyser", "ameliorer", "nettoyer", "refactor"

4. **BREAKING-CHANGE** - Si la demande concerne :
   - Modification d'une API existante (format reponse, parametres)
   - Changement de schema de base de donnees
   - Modification d'interface TypeScript partagee
   - Renommage de fonctions/hooks exportes
   - Mots cles : "modifier l'API", "changer le format", "pagination", "migration", "breaking change", "schema"
   - **Detection automatique** : Si Phase 1.5 (Impact Analysis) detecte > 3 consommateurs

### Options disponibles

- **`-auto`** : Mode automatique, pas de validation intermediaire (execution directe)
- **`-x`** : Mode examen, ajoute une phase d'auto-revue critique a la fin
- **`-v`** : Mode verbose, affiche plus de details a chaque phase
- **`-skills`** : Force la Phase 0 Skills Discovery meme si aucun skill evident
- **`-no-skills`** : Desactive la Phase 0 Skills Discovery (execution directe)
- **`-install`** : Installe automatiquement les skills recommandes sans confirmation
- **`-impact`** : Force l'execution de la Phase 1.5 (Impact Analysis) meme sans breaking change evident
- **`-no-regression`** : Desactive la Phase 4.5 (Regression Check) - NON RECOMMANDE

---

## WORKFLOW FEATURE

Execute ce workflow pour les demandes de nouvelles fonctionnalites.

### Phase 1 : ANALYSE (Exploration)

```
## PHASE 1/5 : ANALYSE
Status: En cours...

Je vais explorer la base de code pour comprendre le contexte.
```

Actions a effectuer :
1. Identifier les fichiers potentiellement concernes par la feature
2. Analyser les dependances et imports existants
3. Comprendre l'architecture actuelle liee a la demande
4. Lister les patterns et conventions utilisees dans le projet
5. NE MODIFIER AUCUN FICHIER

Output attendu :
```
### Resultats de l'analyse

**Fichiers concernes :**
- `path/to/file1.ts` - [raison]
- `path/to/file2.py` - [raison]

**Dependances identifiees :**
- [liste des dependances]

**Patterns existants :**
- [conventions detectees]

**Complexite estimee :** [Faible/Moyenne/Elevee]
```

### Phase 1.5 : IMPACT ANALYSIS (Obligatoire si modification API/Schema)

**DECLENCHEUR** : Cette phase est OBLIGATOIRE si la feature implique :
- Modification d'un endpoint API existant
- Changement de format de reponse/requete
- Modification de schema de base de donnees
- Changement de signature de fonction/hook partage

```
## PHASE 1.5/6 : ANALYSE D'IMPACT
Status: Recherche des consommateurs...
```

#### Etape 1 : Detection du type de modification

```
### Type de modification detecte
- [ ] Nouvel endpoint API (pas de breaking change)
- [ ] Modification endpoint existant → BREAKING CHANGE POTENTIEL
- [ ] Nouveau composant/hook (pas de breaking change)
- [ ] Modification composant/hook existant → IMPACT A EVALUER
- [ ] Modification schema DB → MIGRATION REQUISE
```

#### Etape 2 : Recherche automatique des consommateurs

**Pour une modification d'API backend :**
```bash
# Rechercher tous les appels a l'endpoint modifie
grep -r "api.get.*[endpoint]" --include="*.ts" --include="*.tsx" frontend/
grep -r "api.post.*[endpoint]" --include="*.ts" --include="*.tsx" frontend/
grep -r "[endpoint]" --include="*.ts" --include="*.tsx" frontend/lib/api.ts
```

**Pour une modification de hook/fonction :**
```bash
# Rechercher tous les imports et usages
grep -r "import.*[functionName]" --include="*.ts" --include="*.tsx" frontend/
grep -r "from.*[modulePath]" --include="*.ts" --include="*.tsx" frontend/
```

**Pour une modification de schema DB :**
```bash
# Rechercher tous les usages du modele
grep -r "[ModelName]" --include="*.py" backend/
grep -r "[table_name]" --include="*.py" backend/
```

#### Etape 3 : Rapport d'impact

```
### Rapport d'Analyse d'Impact

**Modification prevue :**
- Fichier : [path/to/file]
- Type : [API/Hook/Schema/Fonction]
- Description : [ce qui change]

**Format AVANT → APRES :**
```
// AVANT
GET /transactions → Transaction[]

// APRES
GET /transactions → { items: Transaction[], total: number, page: number }
```

**Consommateurs identifies :** [N fichiers]

| # | Fichier | Ligne | Usage | Action requise |
|---|---------|-------|-------|----------------|
| 1 | hooks/useCleanDashboard.ts | 91 | api.get('/transactions') | Extraire .items |
| 2 | components/UltraModernDashboard.tsx | 127 | api.get('/transactions') | Extraire .items |
| 3 | app/analytics/page.tsx | 192 | api.get('/transactions') | Extraire .items |
| ... | ... | ... | ... | ... |

**Risque de regression :** [Faible/Moyen/Eleve]
- Faible : 1-2 consommateurs, tous dans le scope du changement
- Moyen : 3-5 consommateurs, certains hors scope
- Eleve : 6+ consommateurs, impact large

**Decision :**
- [ ] Continuer avec mise a jour de TOUS les consommateurs
- [ ] Ajouter retro-compatibilite (supporter ancien ET nouveau format)
- [ ] Abandonner et repenser l'approche
```

#### Etape 4 : Plan de migration

Si breaking change confirme :
```
### Plan de Migration

**Strategie choisie :** [Migration complete / Retro-compatible / Deprecation progressive]

**Ordre de modification :**
1. [Fichier 1] - [Description modification]
2. [Fichier 2] - [Description modification]
...

**Tests a executer apres migration :**
- [ ] Test unitaire [X]
- [ ] Test integration [Y]
- [ ] Test manuel page [Z]
```

### Phase 2 : PLANIFICATION

```
## PHASE 2/6 : PLANIFICATION
Status: Redaction du plan...
```

Produire un plan detaille incluant :

1. **Acceptance Criteria (Criteres de succes)**
   - [ ] Critere 1 - mesurable et verifiable
   - [ ] Critere 2 - mesurable et verifiable
   - [ ] Critere N - mesurable et verifiable

2. **Strategie technique**
   - Architecture proposee
   - Fichiers a creer/modifier
   - Ordre des operations
   - Integration avec l'existant

3. **Risques potentiels**
   - Risque 1 : [description] - Mitigation : [solution]
   - Risque 2 : [description] - Mitigation : [solution]

4. **Etapes d'implementation**
   - Etape 1 : [description precise]
   - Etape 2 : [description precise]
   - Etape N : [description precise]

### Phase 3 : VALIDATION (sauf si -auto)

```
## PHASE 3/5 : ATTENTE DE VALIDATION
Status: En attente...

Le plan ci-dessus est-il correct ? Voulez-vous que je procede a l'implementation ?

Options :
- "oui" / "valide" / "go" : Continuer avec l'implementation
- "non" / "modifie" : Ajuster le plan selon vos retours
- Fournir des modifications specifiques
```

Si `-auto` est specifie, passer directement a la Phase 4.

### Phase 4 : EXECUTION

```
## PHASE 4/5 : EXECUTION
Status: Implementation en cours...
```

Pour chaque etape du plan :
1. Annoncer l'etape en cours
2. Executer les modifications
3. Confirmer la completion

Format :
```
### Etape 1/N : [Nom de l'etape]
- Action : [description]
- Fichier : [path]
- Status : Termine

### Etape 2/N : [Nom de l'etape]
...
```

### Phase 4.5 : REGRESSION CHECK (Obligatoire apres modifications)

**DECLENCHEUR** : Cette phase est OBLIGATOIRE apres toute modification de code.

```
## PHASE 4.5/6 : VERIFICATION REGRESSION
Status: Tests en cours...
```

#### Etape 1 : Tests automatises

```bash
# Backend
cd backend && python -m pytest -v --tb=short

# Frontend
cd frontend && npm test -- --watchAll=false

# Si tests specifiques existent pour le module modifie
pytest tests/test_[module].py -v
npm test -- [component].test.tsx
```

#### Etape 2 : Verification des consommateurs (si Phase 1.5 executee)

Pour chaque consommateur identifie dans l'analyse d'impact :
```
### Verification des Consommateurs

| # | Fichier | Status | Test |
|---|---------|--------|------|
| 1 | hooks/useCleanDashboard.ts | ✅ Modifie | Compile OK |
| 2 | components/UltraModernDashboard.tsx | ✅ Modifie | Compile OK |
| 3 | app/analytics/page.tsx | ✅ Modifie | Compile OK |
| 4 | components/AICoachWidget.tsx | ❌ OUBLIE | A CORRIGER |
```

#### Etape 3 : Test manuel rapide

```
### Checklist Test Manuel (2-3 min)

Pages principales a verifier :
- [ ] Dashboard : Affichage correct des donnees
- [ ] Transactions : Liste et pagination fonctionnelles
- [ ] Analytics : Graphiques charges
- [ ] Settings : Formulaires operationnels

Console navigateur :
- [ ] Pas d'erreur JavaScript rouge
- [ ] Pas de warning critique
- [ ] Network : Pas de requetes 4xx/5xx

Logs backend :
- [ ] Pas d'exception Python
- [ ] Pas d'erreur SQL
```

#### Etape 4 : Rapport de regression

```
### Rapport de Regression

**Tests automatises :**
- Backend : [X/Y] tests passes
- Frontend : [X/Y] tests passes

**Consommateurs verifies :** [N/M]
- ✅ Tous modifies : [liste]
- ❌ Oublies (CRITIQUE) : [liste si applicable]

**Test manuel :**
- [ ] Dashboard OK
- [ ] Transactions OK
- [ ] Analytics OK
- [ ] Console propre

**Status :** [PASSE / ECHEC - corrections requises]
```

**Si ECHEC :** Retourner a Phase 4 pour corriger les fichiers oublies.

### Phase 5 : VALIDATION FINALE

```
## PHASE 5/6 : VALIDATION
Status: Verification des criteres...
```

Verifier chaque critere d'acceptation :
```
### Verification des Acceptance Criteria

- [x] Critere 1 : VALIDE - [preuve/explication]
- [x] Critere 2 : VALIDE - [preuve/explication]
- [ ] Critere 3 : ECHEC - [raison et action corrective]
```

### Phase 6 (Optionnel avec -x) : EXAMEN

```
## PHASE 6/5 : AUTO-REVUE CRITIQUE
Status: Analyse approfondie...
```

Effectuer une revue sur 3 axes :

1. **Securite**
   - Injections possibles ?
   - Donnees sensibles exposees ?
   - Validation des entrees ?

2. **Logique**
   - Edge cases couverts ?
   - Gestion des erreurs ?
   - Performance acceptable ?

3. **Proprete du code**
   - Nommage coherent ?
   - Duplication evitee ?
   - Documentation suffisante ?

Corriger automatiquement les problemes trouves.

---

## WORKFLOW DEBUG

Execute ce workflow pour les erreurs et bugs.

### Phase 1 : INIT & ANALYZE

```
## PHASE 1/4 : INITIALISATION & ANALYSE
Status: Identification du bug...
```

Actions :
1. Lire le message d'erreur/log fourni
2. Identifier le fichier et la ligne source
3. Comprendre le contexte d'execution
4. Tracer le flux de donnees jusqu'a l'erreur

Output :
```
### Diagnostic

**Erreur identifiee :** [type d'erreur]
**Localisation :** `file:line`
**Cause probable :** [explication]
**Stack trace analyse :** [resume]
```

### Phase 2 : FIND SOLUTIONS

```
## PHASE 2/4 : RECHERCHE DE SOLUTIONS
Status: Generation d'alternatives...
```

Proposer AU MINIMUM 2 approches differentes :

```
### Solution A : [Nom]
- Description : [explication]
- Avantages : [liste]
- Inconvenients : [liste]
- Complexite : [Faible/Moyenne/Elevee]

### Solution B : [Nom]
- Description : [explication]
- Avantages : [liste]
- Inconvenients : [liste]
- Complexite : [Faible/Moyenne/Elevee]

### Recommandation
Je recommande la **Solution [X]** car [justification].
```

### Phase 3 : PROPOSE & FIX (sauf si -auto)

```
## PHASE 3/4 : PROPOSITION & CORRECTION
Status: En attente de validation...

Voulez-vous que j'applique la Solution [X] recommandee ?
- "oui" : Appliquer le fix
- "B" : Appliquer la Solution B a la place
- [autre] : Proposer une autre approche
```

Si `-auto`, appliquer la solution recommandee directement.

Apres validation, appliquer le fix :
```
### Application du fix
- Fichier modifie : `path/to/file`
- Modification : [description du changement]
- Status : Applique
```

### Phase 4 : VERIFY

```
## PHASE 4/4 : VERIFICATION
Status: Tests en cours...
```

Actions :
1. Verifier que l'erreur ne se reproduit plus
2. Lancer les tests si disponibles
3. Verifier l'absence d'effets de bord

Output :
```
### Resultats de verification

- [x] Erreur originale corrigee
- [x] Tests passes (si applicable)
- [x] Pas d'effets de bord detectes

**Status final :** BUG RESOLU
```

---

## WORKFLOW AUDIT

Execute ce workflow pour les revues et ameliorations de code existant.

### Cible de l'audit

Determiner la cible :
- Si un fichier/dossier est specifie : auditer cette cible
- Sinon : demander a l'utilisateur de preciser

### Axe 1 : LOGIC REVIEW

```
## AUDIT - AXE 1/3 : REVUE LOGIQUE
Status: Analyse en cours...
```

Analyser :
1. Optimisations possibles de la logique
2. Code redondant ou duplique
3. Complexite cyclomatique excessive
4. Fonctions trop longues (>50 lignes)
5. Abstractions manquantes ou excessives

Output :
```
### Problemes de logique identifies

| # | Fichier | Ligne | Probleme | Severite |
|---|---------|-------|----------|----------|
| 1 | file.ts | 42    | [desc]   | Haute    |
| 2 | file.py | 100   | [desc]   | Moyenne  |
```

### Axe 2 : SECURITY REVIEW

```
## AUDIT - AXE 2/3 : REVUE SECURITE
Status: Scan en cours...
```

Verifier :
1. Variables sensibles exposees (API keys, passwords)
2. Injections possibles (SQL, XSS, Command)
3. Validation des entrees utilisateur
4. Authentification/Autorisation
5. Exposition de donnees (console.log, debug)

Output :
```
### Vulnerabilites detectees

| # | Type | Fichier | Ligne | Risque | Recommandation |
|---|------|---------|-------|--------|----------------|
| 1 | XSS  | file.ts | 25    | Eleve  | [fix]          |
```

### Axe 3 : CLEAN CODE

```
## AUDIT - AXE 3/3 : REVUE PROPRETE
Status: Verification des standards...
```

Verifier :
1. Conventions de nommage (camelCase, snake_case selon langage)
2. Structure et organisation des fichiers
3. Commentaires manquants ou excessifs
4. Typage (TypeScript/Python type hints)
5. Imports inutilises ou non tries

Output :
```
### Problemes de proprete

| # | Categorie | Fichier | Description |
|---|-----------|---------|-------------|
| 1 | Nommage   | file.ts | Variable 'x' non descriptive |
```

### Synthese et Actions

```
## SYNTHESE DE L'AUDIT
Status: Compilation des resultats...

### Resume
- Problemes de logique : [N]
- Vulnerabilites securite : [N]
- Problemes de proprete : [N]

### Actions prioritaires (par ordre d'importance)
1. [CRITIQUE] [description] - Fichier: [path]
2. [HAUTE] [description] - Fichier: [path]
3. [MOYENNE] [description] - Fichier: [path]

Voulez-vous que j'applique ces corrections ?
- "oui" / "all" : Appliquer toutes les corrections
- "1,2" : Appliquer seulement les corrections 1 et 2
- "non" : Ne rien modifier
```

---

## WORKFLOW BREAKING-CHANGE

Execute ce workflow specifiquement pour les modifications d'API, schemas ou interfaces partagees.

**DECLENCHEUR** : Utiliser ce workflow quand :
- Modification du format de reponse d'une API
- Ajout/suppression de champs obligatoires
- Changement de type de retour (array → objet, etc.)
- Modification de schema de base de donnees
- Renommage d'endpoints ou de fonctions exportees

### Phase 1 : IDENTIFICATION

```
## PHASE 1/5 : IDENTIFICATION DU BREAKING CHANGE
Status: Analyse de la modification...
```

#### Caracteriser le changement

```
### Caracterisation du Breaking Change

**Element modifie :**
- Type : [API Endpoint / Schema DB / Hook / Fonction / Type TypeScript]
- Chemin : [path/to/file ou endpoint]
- Description : [ce qui change exactement]

**Nature du changement :**
- [ ] Ajout de champ (generalement non-breaking si optionnel)
- [ ] Suppression de champ (BREAKING)
- [ ] Modification de type (BREAKING)
- [ ] Changement de structure (BREAKING)
- [ ] Renommage (BREAKING)

**Exemple concret :**
```typescript
// AVANT
GET /api/transactions → Transaction[]

// APRES
GET /api/transactions → {
  items: Transaction[],
  total: number,
  page: number,
  limit: number
}
```
```

### Phase 2 : INVENTAIRE DES CONSOMMATEURS

```
## PHASE 2/5 : INVENTAIRE COMPLET
Status: Recherche exhaustive...
```

#### Recherche systematique

**Commandes de recherche a executer :**

```bash
# Pour API endpoint
grep -rn "api\.get.*\/transactions" frontend/ --include="*.ts" --include="*.tsx"
grep -rn "api\.post.*\/transactions" frontend/ --include="*.ts" --include="*.tsx"
grep -rn "\/transactions" frontend/lib/api.ts

# Pour Hook/Fonction
grep -rn "useTransactions" frontend/ --include="*.ts" --include="*.tsx"
grep -rn "from.*useTransactions" frontend/ --include="*.ts" --include="*.tsx"

# Pour Type TypeScript
grep -rn "Transaction\[\]" frontend/ --include="*.ts" --include="*.tsx"
grep -rn ": Transaction" frontend/ --include="*.ts" --include="*.tsx"

# Pour Schema DB (backend)
grep -rn "Transaction" backend/ --include="*.py"
grep -rn "transactions" backend/routers/ --include="*.py"
```

#### Rapport d'inventaire

```
### Inventaire des Consommateurs

**Total identifie :** [N] fichiers

#### Consommateurs Directs (appellent l'API/fonction)
| # | Fichier | Ligne | Code | Impact |
|---|---------|-------|------|--------|
| 1 | useCleanDashboard.ts | 91 | `api.get('/transactions')` | Doit extraire .items |
| 2 | UltraModernDashboard.tsx | 127 | `api.get('/transactions')` | Doit extraire .items |
| 3 | ExpensesDrillDown.tsx | 77, 153 | `api.get('/transactions')` | Doit extraire .items |
| 4 | AICoachWidget.tsx | 84 | `api.get('/transactions')` | Doit extraire .items |
| 5 | analytics/page.tsx | 192 | `api.get('/transactions')` | Doit extraire .items |
| 6 | TagDetailModal.tsx | 119 | `api.get('/transactions')` | Doit extraire .items |

#### Consommateurs Indirects (utilisent le resultat)
| # | Fichier | Dependance | Impact |
|---|---------|------------|--------|
| - | Aucun identifie | - | - |

**Fichiers hors scope (pas d'impact) :**
- transactions/page.tsx : Utilise useTransactions (deja compatible)
```

### Phase 3 : STRATEGIE DE MIGRATION

```
## PHASE 3/5 : STRATEGIE DE MIGRATION
Status: Selection de l'approche...
```

#### Options de migration

```
### Options de Migration

#### Option A : Migration Complete (Recommandee si < 10 consommateurs)
- Modifier TOUS les consommateurs en une seule fois
- Avantage : Code propre, pas de dette technique
- Inconvenient : Plus de travail initial

#### Option B : Retro-Compatibilite Temporaire
- Supporter ancien ET nouveau format pendant X semaines
- Avantage : Migration progressive possible
- Inconvenient : Code plus complexe temporairement

Exemple retro-compatible :
```python
# Backend : supporter les deux formats
@router.get("/transactions")
def get_transactions(legacy: bool = False):
    data = fetch_transactions()
    if legacy:
        return data  # Ancien format: array direct
    return {"items": data, "total": len(data), ...}  # Nouveau format
```

#### Option C : Deprecation Progressive
- Creer nouvel endpoint (/v2/transactions)
- Deprecier ancien endpoint avec warning
- Migration sur plusieurs sprints
- Avantage : Zero risque de regression
- Inconvenient : Maintenance double temporaire

### Decision
**Strategie choisie :** [A/B/C]
**Justification :** [raison]
```

### Phase 4 : EXECUTION MIGRATION

```
## PHASE 4/5 : EXECUTION
Status: Migration en cours...
```

#### Ordre d'execution OBLIGATOIRE

```
### Ordre de Migration (CRITIQUE)

**Regle d'or :** Toujours modifier dans cet ordre :
1. Backend (source du changement)
2. Types TypeScript (frontend/lib/api.ts)
3. Hooks partages
4. TOUS les composants consommateurs
5. Tests

**Checklist d'execution :**

□ Etape 1 : Backend
  - [ ] Modifier l'endpoint/schema
  - [ ] Mettre a jour les tests backend
  - [ ] Verifier : pytest passe

□ Etape 2 : Types Frontend
  - [ ] Mettre a jour les types dans lib/api.ts
  - [ ] Ajouter PaginatedResponse<T> si applicable

□ Etape 3 : Consommateur 1/N - [fichier]
  - [ ] Modifier le code
  - [ ] Tester manuellement

□ Etape 4 : Consommateur 2/N - [fichier]
  - [ ] Modifier le code
  - [ ] Tester manuellement

[... repeter pour chaque consommateur ...]

□ Etape finale : Verification globale
  - [ ] npm run build (pas d'erreur TypeScript)
  - [ ] npm test (tous tests passent)
  - [ ] Test manuel des pages concernees
```

### Phase 5 : VERIFICATION COMPLETE

```
## PHASE 5/5 : VERIFICATION COMPLETE
Status: Validation finale...
```

#### Checklist de verification

```
### Checklist de Verification Breaking Change

**Compilation :**
- [ ] `npm run build` : SUCCES (0 erreur)
- [ ] `python -m py_compile app.py` : SUCCES

**Tests automatises :**
- [ ] Backend pytest : [X/Y] passes
- [ ] Frontend Jest : [X/Y] passes

**Consommateurs (verification individuelle) :**
| # | Fichier | Modifie | Compile | Test Manuel |
|---|---------|---------|---------|-------------|
| 1 | useCleanDashboard.ts | ✅ | ✅ | ✅ Dashboard OK |
| 2 | UltraModernDashboard.tsx | ✅ | ✅ | ✅ Dashboard OK |
| 3 | ExpensesDrillDown.tsx | ✅ | ✅ | ✅ Analytics OK |
| 4 | AICoachWidget.tsx | ✅ | ✅ | ✅ Widget OK |
| 5 | analytics/page.tsx | ✅ | ✅ | ✅ Analytics OK |
| 6 | TagDetailModal.tsx | ✅ | ✅ | ✅ Modal OK |

**Test manuel pages principales :**
- [ ] / (Dashboard) : Donnees affichees correctement
- [ ] /transactions : Liste + pagination OK
- [ ] /analytics : Graphiques charges
- [ ] /settings : Pas d'erreur

**Console navigateur :**
- [ ] 0 erreur JavaScript
- [ ] 0 erreur reseau 4xx/5xx

**Status final :** [MIGRATION REUSSIE / ECHEC - voir erreurs]
```

#### Si echec detecte

```
### Correction d'Echec

**Probleme detecte :**
- Fichier : [path]
- Erreur : [description]
- Cause : [consommateur oublie / erreur de code / ...]

**Action corrective :**
1. [Correction a appliquer]
2. Re-executer la verification

→ Retourner a Phase 4 pour corriger
```

### Exemple complet : Migration API Pagination

```
## EXEMPLE : Migration /transactions vers pagination

### Phase 1 : Identification
- Endpoint : GET /transactions
- Changement : Array → Objet pagine
- Raison : Support pagination cote serveur

### Phase 2 : Inventaire
- 6 consommateurs directs identifies
- 0 consommateur indirect

### Phase 3 : Strategie
- Option A choisie (migration complete)
- Justification : 6 fichiers = manageable en une session

### Phase 4 : Execution
1. ✅ Backend : routers/transactions.py modifie
2. ✅ Types : PaginatedResponse<Transaction> ajoute
3. ✅ useCleanDashboard.ts : .items extrait
4. ✅ UltraModernDashboard.tsx : .items extrait
5. ✅ ExpensesDrillDown.tsx : .items extrait (2 endroits)
6. ✅ AICoachWidget.tsx : .items extrait
7. ✅ analytics/page.tsx : .items extrait
8. ✅ TagDetailModal.tsx : .items extrait

### Phase 5 : Verification
- Compilation : OK
- Tests : 136/136 passes
- 6/6 consommateurs verifies
- Test manuel : Toutes pages OK

**MIGRATION REUSSIE**
```

---

## Format de sortie final

A la fin de chaque workflow, afficher :

```
---
## WORKFLOW TERMINE

**Type :** [FEATURE/DEBUG/AUDIT]
**Duree :** [N phases completees]
**Status :** [SUCCES/ECHEC PARTIEL/ECHEC]

### Resume des actions
- [liste des actions effectuees]

### Fichiers modifies
- `path/to/file1` - [description]
- `path/to/file2` - [description]

### Prochaines etapes suggerees (si applicable)
- [suggestion 1]
- [suggestion 2]
---
```

## Exemples d'utilisation

```
# Workflows classiques
/orchestrator Ajoute un bouton de logout dans le header
/orchestrator -auto Implemente la pagination sur la liste des transactions
/orchestrator -x Cree un systeme de notifications push
/orchestrator Lance le workflow DEBUG sur l'erreur suivante : TypeError: Cannot read property 'map' of undefined
/orchestrator Audit de code sur le dossier backend/services/
/orchestrator -auto -x Refactor le composant Dashboard pour ameliorer les performances

# Avec Skills Discovery
/orchestrator -skills Ajouter l'authentification Google OAuth
  → Detecte: Auth → Suggere: better-auth/skills

/orchestrator Creer une page de paiement Stripe
  → Detecte: Paiement → Suggere: stripe/agent-toolkit

/orchestrator -skills Migrer l'app vers React Native
  → Detecte: Mobile → Suggere: expo/skills

/orchestrator Ajouter des animations video dans le dashboard
  → Detecte: Video → Suggere: remotion-dev/skills

/orchestrator -no-skills Corriger le bug de validation
  → Skills Discovery desactive

# Avec Impact Analysis et Regression Check (NOUVEAU)
/orchestrator -impact Modifier l'API /transactions pour retourner un objet pagine
  → Detecte: BREAKING-CHANGE
  → Phase 1.5: Analyse d'impact
  → Trouve: 6 consommateurs a migrer
  → Phase 4.5: Verification regression

/orchestrator Ajouter la pagination backend sur GET /transactions
  → Detection auto: modification API existante
  → Workflow BREAKING-CHANGE active
  → Inventaire complet des consommateurs
  → Migration guidee etape par etape

/orchestrator Changer le schema de la table transactions (ajouter colonne)
  → Detecte: modification schema DB
  → Phase 1.5: Recherche usages du modele
  → Alerte: migration Alembic requise

# Forcer ou desactiver les phases de securite
/orchestrator -impact Ajouter un nouveau champ a l'API user
  → Force l'analyse d'impact meme si nouveau champ (potentiellement breaking)

/orchestrator -no-regression -auto Fix rapide typo dans commentaire
  → Desactive la verification regression (use avec precaution!)
```

---

## Agent de recherche skills.sh - Implementation technique

### Architecture du systeme hybride

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SKILLS DISCOVERY SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────────┐ │
│  │   Demande    │───▶│  Extracteur de   │───▶│   Cache Local         │ │
│  │ Utilisateur  │    │   mots-cles      │    │ skills-registry.json  │ │
│  └──────────────┘    └──────────────────┘    └───────────┬───────────┘ │
│                              │                            │             │
│                              ▼                            ▼             │
│                    ┌──────────────────┐         ┌─────────────────┐    │
│                    │ Contexte Projet  │         │  Matching &     │    │
│                    │ PRD.md/CLAUDE.md │         │  Scoring        │    │
│                    └──────────────────┘         └────────┬────────┘    │
│                                                          │             │
│                                           Score < 15 ?   │             │
│                                                ┌─────────┴─────────┐   │
│                                                ▼                   ▼   │
│                                    ┌───────────────────┐  ┌──────────┐│
│                                    │ Fallback WebFetch │  │ Resultats││
│                                    │   skills.sh       │  │  Directs ││
│                                    └───────────────────┘  └──────────┘│
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Structure du cache local

```
.claude/
├── skills/
│   ├── skills-registry.json      # Cache des 50+ skills populaires
│   ├── vercel-labs/              # Skills installes
│   │   └── agent-skills/
│   │       ├── skill.json
│   │       └── instructions.md
│   └── [autres-skills-installes]/
└── commands/
    └── orchestrator.md
```

### Format du skills-registry.json

```json
{
  "_metadata": {
    "version": "1.0.0",
    "updated": "2026-01-25",
    "source": "https://skills.sh",
    "total_skills": 50
  },
  "skills": [
    {
      "name": "vercel-react-best-practices",
      "source": "vercel-labs/agent-skills",
      "installs": 46178,
      "category": "Frontend",
      "keywords": ["react", "nextjs", "frontend", "components", "hooks"],
      "description": "Best practices pour React et Next.js"
    }
  ]
}
```

### Algorithme de scoring detaille (avec poids contextuels)

```python
def calculate_skill_score(skill, weighted_keywords, project_domain):
    """
    Calcule le score d'un skill en fonction des mots-cles ponderes.

    weighted_keywords = {
        'feature': ['pdf', 'export', 'report'],      # poids x2
        'domain': ['finance', 'budget'],              # poids x1.5
        'stack': ['react', 'nextjs', 'tailwind']      # poids x1
    }
    """
    score = 0
    matches = []

    WEIGHTS = {
        'feature': 2.0,   # Keywords specifiques a la feature demandee
        'domain': 1.5,    # Keywords du domaine metier
        'stack': 1.0      # Keywords de la stack technique
    }

    # 1. Match sur les keywords PONDERES
    for category, keywords in weighted_keywords.items():
        weight = WEIGHTS.get(category, 1.0)
        for keyword in keywords:
            keyword_lower = keyword.lower()
            for skill_keyword in skill['keywords']:
                if keyword_lower in skill_keyword or skill_keyword in keyword_lower:
                    points = 10 * weight
                    score += points
                    matches.append(f"{keyword} ({category}: +{points})")
                    break

    # 2. Bonus popularite (installs / 1000, max 50 points)
    popularity_bonus = min(skill['installs'] / 1000, 50)
    score += popularity_bonus

    # 3. Bonus categorie (20 points si match domaine)
    domain_categories = {
        'finance': ['Finance', 'Dashboard', 'Data Analysis', 'Data Visualization'],
        'ecommerce': ['Payments', 'Forms', 'Security'],
        'mobile': ['Mobile Development', 'Animation'],
        'analytics': ['Dashboard', 'Data Visualization', 'Charts'],
        'backend': ['Database', 'API Design', 'Backend'],
        'frontend': ['Frontend', 'Design', 'CSS', 'Components']
    }
    if skill['category'] in domain_categories.get(project_domain, []):
        score += 20
        matches.append(f"category:{skill['category']} (+20)")

    # 4. Penalite si skill deja installe (eviter doublons)
    # Note: Verifier dans .claude/skills/[owner]/[repo]/

    return {
        'score': round(score, 1),
        'matches': matches,
        'stars': '★' * min(5, int(score / 20)) + '☆' * (5 - min(5, int(score / 20)))
    }

# Exemple d'utilisation
weighted_keywords = {
    'feature': ['pdf', 'export', 'report'],      # Demande: "Ajouter export PDF"
    'domain': ['finance', 'budget'],              # Projet: Budget Famille
    'stack': ['react', 'nextjs']                  # Stack detectee
}

# Resultat pour skill "pdf-generation":
# - pdf (feature: +20)
# - export (feature: +20)
# - react (stack: +10)
# - popularity: +0.5
# - category:Export (+20)
# Total: 70.5 points → ★★★★☆
```

### Template de prompt pour l'agent Fallback

```markdown
Tu es un agent de recherche specialise dans skills.sh.

**Contexte projet** : {project_context}
**Mots-cles a rechercher** : {keywords_not_found_in_cache}

**Instructions** :
1. WebFetch sur https://skills.sh/?q={keyword} (timeout 30s max)
2. Si timeout, essayer https://skills.sh et filtrer manuellement
3. Extraire pour chaque skill trouve :
   - name: nom du skill
   - source: owner/repo
   - installs: nombre d'installations
   - description: description courte
4. Retourner au format JSON

**Important** : Si skills.sh est inaccessible, retourner:
{ "error": "timeout", "fallback": "use_cache_only" }
```

### Gestion des erreurs

```
## PHASE 0 : SKILLS DISCOVERY
Status: Recherche partielle

⚠️ Fallback WebFetch echoue (timeout)
Utilisation du cache local uniquement.

### Skills du cache correspondants
| # | Skill | Score | Match |
|---|-------|-------|-------|
| 1 | [skill] | [score] | [keywords] |

Options :
- "1" : Utiliser ce skill du cache
- "retry" : Reessayer WebFetch
- "skip" : Continuer sans skill
- "refresh" : Mettre a jour le cache complet (peut prendre du temps)
```

### Mise a jour automatique du cache (OBLIGATOIRE)

Le cache DOIT etre mis a jour automatiquement dans les cas suivants :
- Cache inexistant
- Cache > 7 jours
- Option `-refresh` utilisee
- Moins de 2 skills pertinents trouves (score > 15)

#### Workflow de mise a jour

```
## MISE A JOUR DU CACHE SKILLS
Status: Rafraichissement en cours...

Etape 1/4 : Connexion a skills.sh
→ WebFetch https://skills.sh
→ Timeout: 60 secondes

Etape 2/4 : Extraction des skills
→ Parser le leaderboard (top 100 minimum)
→ Pour chaque skill extraire:
   - name, source (owner/repo), installs, category
   - Inferer les keywords depuis le nom et la description

Etape 3/4 : Enrichissement des keywords
→ Pour chaque skill, generer des keywords pertinents:
   - Depuis le nom du skill (split par '-')
   - Depuis la categorie
   - Synonymes courants

Etape 4/4 : Sauvegarde du cache
→ Ecrire dans .claude/skills/skills-registry.json
→ Mettre a jour _metadata.updated avec la date du jour
→ Afficher: "✓ Cache mis a jour: [N] skills indexes"
```

#### Agent de mise a jour du cache

**IMPORTANT** : Utiliser le tool `Task` avec un agent `Explore` :

```
Action: Lancer Agent Task
Subagent: Explore
Thoroughness: medium
Prompt: |
  Mise a jour du cache skills.sh

  Instructions:
  1. WebFetch sur https://skills.sh (page principale avec leaderboard)
  2. Extraire TOUS les skills visibles (minimum 50, idealement 100+)
  3. Pour chaque skill, extraire:
     - name: nom du skill
     - source: owner/repo (format "owner/repo-name")
     - installs: nombre d'installations (convertir "10.5K" en 10500)
     - category: categorie si visible, sinon inferer depuis le nom
  4. Generer les keywords pour chaque skill:
     - Split le nom par "-" et "_"
     - Ajouter la categorie en lowercase
     - Ajouter des synonymes courants
  5. Retourner au format JSON compatible avec skills-registry.json

  Format de sortie attendu:
  {
    "_metadata": {
      "version": "1.0.0",
      "updated": "[DATE_DU_JOUR]",
      "source": "https://skills.sh",
      "total_skills": [N]
    },
    "skills": [
      {
        "name": "skill-name",
        "source": "owner/repo",
        "installs": 12345,
        "category": "Category",
        "keywords": ["keyword1", "keyword2", ...],
        "description": "Description courte"
      }
    ]
  }
```

#### Gestion des erreurs de mise a jour

```
## MISE A JOUR DU CACHE
Status: Echec

⚠️ Impossible de mettre a jour le cache
Raison: [timeout/network/parsing error]

Actions:
- Le cache existant sera utilise (si disponible)
- Date du cache actuel: [date ou "inexistant"]

Options:
- "retry" : Reessayer la mise a jour
- "continue" : Continuer avec le cache actuel
- "manual" : Ajouter des skills manuellement
```

#### Ajout manuel de skills au cache

Si un skill n'est pas dans le cache, l'utilisateur peut l'ajouter :

```bash
# Format de la commande
/orchestrator -add-skill [owner/repo] [keywords...]

# Exemple
/orchestrator -add-skill stripe/agent-toolkit payment checkout subscription

# L'orchestrator va:
# 1. WebFetch https://skills.sh/stripe/agent-toolkit pour recuperer les infos
# 2. Ajouter au cache avec les keywords fournis
# 3. Confirmer l'ajout
```

### Verification des skills installes

Avant de proposer un skill, verifier s'il est deja installe :

```bash
# Lister les skills installes
ls -la .claude/skills/*/

# Structure attendue d'un skill installe
.claude/skills/[owner]/[repo]/
├── skill.json        # Metadata du skill
├── instructions.md   # Instructions pour Claude
└── [autres fichiers] # Templates, exemples, etc.
```

### Integration avec les phases suivantes

Les skills installes sont automatiquement integres dans le contexte des phases suivantes :

```
## PHASE 1 : ANALYSE
Skills actifs : vercel-react-best-practices, dashboard-patterns

Les instructions des skills suivants seront appliquees :
- vercel-react-best-practices : Patterns React/Next.js
- dashboard-patterns : Structure de dashboard
```
