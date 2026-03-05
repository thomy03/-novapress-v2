# Frontend Editorial Polish

Tu es un directeur artistique de media digital premium (The Economist, Bloomberg, Mediapart).

Ta mission : transformer le frontend NovaPress en une experience editoriale qui donne envie de revenir. Chaque pixel compte.

## Contexte

- **Stack** : Next.js 15, React 19, TypeScript, inline styles
- **Design** : Newspaper (NYT, Le Monde), NO gradients, Georgia serif
- **Couleurs** : text=#000, breaking=#DC2626, accent=#2563EB, bg=#FFF, border=#E5E5E5
- **Dark mode** : Supporte via ThemeContext

## Instructions

Execute les 6 modules. Chaque module produit un changement visible et impactant.

---

### MODULE 1 : Homepage Hero Impact

**Objectif** : Le hero doit capturer l'attention en < 2 secondes

1. Lire `app/components/articles/HeroSynthesis.tsx`
2. Lire `app/components/pages/HomePage.tsx` — section hero

**Actions** :
- Hero card : ajouter un `overlay gradient` subtil (noir 0% → noir 60%) sur l'image pour lisibilite du titre
- Titre hero : augmenter a `28px` Georgia bold, `line-height: 1.25`, max 2 lignes avec `line-clamp`
- Ajouter un `badge temps de lecture` : "3 min" calcule depuis le body (200 mots/min)
- Ajouter la `source principale` sous le titre : "Sources : Le Monde, Reuters, BBC" (max 3)
- Sur mobile (< 640px) : hero plein ecran, titre en bas sur fond semi-transparent

**IMPORTANT** : Le gradient overlay est autorise ICI car c'est pour la lisibilite du texte sur image (pas decoratif). Utiliser `background: linear-gradient(transparent, rgba(0,0,0,0.7))`.

---

### MODULE 2 : Card System Refinement

**Objectif** : Les cartes de synthese doivent etre cliquables, scanables, hierarchisees

1. Lire `app/components/articles/SynthesisCompactCard.tsx`
2. Lire `app/components/pages/HomePage.tsx` — `FeaturedCategoryCard`, `TextOnlyCard`, `BriefCard`

**Actions** :
- `FeaturedCategoryCard` : ajouter un hover effect (translateY -2px + shadow subtile)
- `TextOnlyCard` : ajouter un indicateur de fraicheur : point rouge si < 2h, orange si < 6h
- `BriefCard` : ajouter le nombre de sources entre parentheses apres le titre : "(4 sources)"
- Toutes les cartes : ajouter `cursor: pointer` et `transition: all 0.2s ease`
- Ajouter la categorie en couleur sur chaque carte (petit badge en haut a gauche)

**Palette categories** (coherente avec TrendingTopics) :
```typescript
const CATEGORY_COLORS = {
  MONDE: '#DC2626',
  POLITIQUE: '#DC2626',
  ECONOMIE: '#F59E0B',
  TECH: '#2563EB',
  CULTURE: '#8B5CF6',
  SPORT: '#10B981',
  SCIENCES: '#06B6D4',
};
```

---

### MODULE 3 : Synthesis Page — Reading Experience

**Objectif** : L'experience de lecture doit rivaliser avec Medium ou The Economist

1. Lire `app/components/synthesis/SynthesisBody.tsx`
2. Lire `app/components/synthesis/SynthesisClient.tsx`

**Actions** :
- Ajouter une **barre de progression de lecture** en haut (position fixed, height 3px, couleur accent)
  - Calculee par `scrollY / (documentHeight - windowHeight) * 100`
  - Smooth transition, disparait quand scroll = 0
- Ajouter un **temps de lecture estimee** sous le titre : "Lecture 4 min"
- Ameliorer la typographie du body :
  - Paragraphes : `font-size: 19px`, `line-height: 1.85`, `max-width: 680px`
  - Intertitres `## ` : `font-size: 24px`, `margin-top: 48px`, `font-weight: 700`
  - Citations `[SOURCE:N]` : style superscript bleu cliquable (deja fait, verifier)
- Ajouter des **separateurs visuels** entre sections : `<hr>` fine (1px, #E5E5E5, margin 40px)
- Sources sidebar : ajouter le favicon de chaque source (utiliser `https://www.google.com/s2/favicons?domain=DOMAIN&sz=16`)

---

### MODULE 4 : Sidebar Enhancement

**Objectif** : La sidebar droite doit engager (pas juste informer)

1. Lire `app/components/trending/TrendingTopics.tsx`
2. Lire `app/components/pages/HomePage.tsx` — `SidebarDossiers`

**Actions** :
- **TrendingTopics** : ajouter un indicateur visuel de "chaleur" :
  - Topics avec > 5 syntheses : barre rouge plus large
  - Topics avec velocity haute : icone flamme ou texte "En hausse"
- **SidebarDossiers** : ajouter le nombre de syntheses par dossier
- Ajouter une section **"A ne pas manquer"** en bas de sidebar :
  - 3 syntheses avec le meilleur `transparency_score`
  - Afficher le score : "Fiabilite 92%"
  - Style : petites cartes avec titre + score + categorie badge

---

### MODULE 5 : Micro-Interactions & Polish

**Objectif** : Les details qui font la difference entre amateur et professionnel

1. Lire `app/globals.css`
2. Lire `app/components/layout/Header.tsx`

**Actions** :
- **Scroll-to-top** : bouton discret en bas a droite, apparait apres 500px de scroll
  - Style : cercle 40px, fond blanc, border #E5E5E5, fleche vers le haut
  - Animation : fadeIn/fadeOut smooth
- **Skeleton loading** : remplacer les "Chargement..." par des skeletons gris animes
  - Pour les cartes : rectangle gris pulse (aspect-ratio du contenu final)
  - Pour le texte : barres grises de largeurs variees
  - Animation : `@keyframes skeleton-pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 0.8 } }`
- **Date relative** : afficher "il y a 2h" au lieu de "05/03/2026 14:30"
  - < 1h : "il y a X min"
  - < 24h : "il y a X heures"
  - < 7j : "Lundi", "Mardi"...
  - Sinon : "5 mars 2026"
- **Smooth scroll** : ajouter `scroll-behavior: smooth` au html
- **Selection couleur** : `::selection { background: #2563EB20; color: #000; }`

---

### MODULE 6 : Mobile Experience

**Objectif** : 60%+ du trafic est mobile — l'experience doit etre native-like

1. Lire les composants avec `@media (max-width:` dans `globals.css`
2. Lire `app/components/layout/BottomNav.tsx`

**Actions** :
- **Homepage mobile** :
  - Hero : pleine largeur, image aspect-ratio 16:9, titre sur 3 lignes max
  - Categories : scroll horizontal (swipe) au lieu de grid
  - Sidebar : cachee sur mobile, contenu accessible via onglet "Explorer"
- **Synthese mobile** :
  - Barre de progression de lecture toujours visible
  - Sidebars en accordions (deja fait — verifier que c'est fluide)
  - Bouton "Partager" sticky en bas (Web Share API)
- **Navigation mobile** :
  - Bottom nav : verifier que les icones sont assez grandes (44px touch target minimum)
  - Swipe entre syntheses (optionnel, uniquement si simple a implementer)
- **Performance** :
  - Images : ajouter `loading="lazy"` sur toutes les images sauf hero
  - Fonts : preload Georgia si custom font
  - `<meta name="theme-color" content="#FFFFFF">` (deja dans manifest?)

---

## Regles

- **Inline styles** obligatoires (pas de CSS modules, pas de Tailwind classes sauf utilitaires existants)
- **NO gradients decoratifs** — seul le hero overlay est autorise
- **Dark mode** : tous les nouveaux styles doivent utiliser `theme.text`, `theme.bg`, etc.
- **Accessibility** : tous les boutons ont un `aria-label`, images un `alt`
- **Performance** : pas de nouvelle lib > 10KB. Preferer CSS natif a JS.
- Committer module par module

## Verification Finale

1. `npx next build` — 0 erreurs
2. Desktop : hero impactant, cartes hierarchisees, sidebar engageante
3. Mobile : navigation fluide, lecture confortable, pas de scroll horizontal non-voulu
4. Dark mode : tous les nouveaux elements s'adaptent
5. Lighthouse : Performance > 90, Accessibility > 95
