/**
 * Causal Graph Icons & Sizing Utilities
 * Shared across Nexus full-screen, Topics embedded graph, and sidebar previews.
 * Provides content-aware SVG icons and dynamic node sizing.
 */

// ============================================================================
// ICON DEFINITIONS — Compact SVG paths for thematic icons
// ============================================================================

interface IconDef {
  path: string;
  viewBox: string;
}

const ICONS: Record<string, IconDef> = {
  military: {
    path: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    viewBox: '0 0 24 24',
  },
  explosion: {
    path: 'M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z',
    viewBox: '0 0 24 24',
  },
  energy: {
    path: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z',
    viewBox: '0 0 24 24',
  },
  economy: {
    path: 'M3 20h18v2H3v-2zm1-8h2v7H4v-7zm4-4h2v11H8V8zm4-6h2v17h-2V2zm4 4h2v13h-2V6zm4 6h2v7h-2v-7z',
    viewBox: '0 0 24 24',
  },
  politics: {
    path: 'M12 2L3 7v2h18V7L12 2zm0 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM5 11v7h2v-7H5zm4 0v7h2v-7H9zm4 0v7h2v-7h-2zm4 0v7h2v-7h-2zM3 20v2h18v-2H3z',
    viewBox: '0 0 24 24',
  },
  diplomacy: {
    path: 'M16.5 3A5.49 5.49 0 0012 5.34 5.49 5.49 0 007.5 3 5.5 5.5 0 002 8.5c0 5.25 10 13.5 10 13.5S22 13.75 22 8.5A5.5 5.5 0 0016.5 3z',
    viewBox: '0 0 24 24',
  },
  health: {
    path: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
    viewBox: '0 0 24 24',
  },
  climate: {
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    viewBox: '0 0 24 24',
  },
  tech: {
    path: 'M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z',
    viewBox: '0 0 24 24',
  },
  security: {
    path: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
    viewBox: '0 0 24 24',
  },
  finance: {
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    viewBox: '0 0 24 24',
  },
  transport: {
    path: 'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43 1.43 1.43 2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z',
    viewBox: '0 0 24 24',
  },
  justice: {
    path: 'M12 2L4 7v2h16V7L12 2zM4 21h16v-2H4v2zm2-3h2v-6H6v6zm4 0h4v-6h-4v6zm6 0h2v-6h-2v6z',
    viewBox: '0 0 24 24',
  },
  migration: {
    path: 'M15 4V2H9v2H2v16h20V4h-7zm-4 0h2v2h-2V4zM4 18V6h16v12H4zm9-7h3l-4 4-4-4h3V8h2v3z',
    viewBox: '0 0 24 24',
  },
  food: {
    path: 'M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z',
    viewBox: '0 0 24 24',
  },
  // Default icons by node type
  event_default: {
    path: 'M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm1-5C6.47 2 2 6.5 2 12a10 10 0 0010 10 10 10 0 0010-10A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16z',
    viewBox: '0 0 24 24',
  },
  entity_default: {
    path: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    viewBox: '0 0 24 24',
  },
  decision_default: {
    path: 'M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z',
    viewBox: '0 0 24 24',
  },
  outcome_default: {
    path: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z',
    viewBox: '0 0 24 24',
  },
  prediction_default: {
    path: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-6h2v2h-2v-2zm0-8h2v6h-2V6z',
    viewBox: '0 0 24 24',
  },
};

// ============================================================================
// KEYWORD → ICON MAPPING (French + English)
// ============================================================================

const KEYWORD_GROUPS: { keywords: string[]; icon: string }[] = [
  { keywords: ['frappe', 'missile', 'bombe', 'guerre', 'militaire', 'armee', 'attaque', 'combat', 'offensive', 'arme', 'strike', 'war', 'military', 'bomb', 'weapon', 'assault'], icon: 'explosion' },
  { keywords: ['energie', 'nucleaire', 'petrole', 'gaz', 'electricite', 'charbon', 'renouvelable', 'energy', 'nuclear', 'oil', 'gas', 'coal', 'brent', 'opep'], icon: 'energy' },
  { keywords: ['economie', 'inflation', 'marche', 'bourse', 'pib', 'dette', 'recession', 'croissance', 'economy', 'market', 'gdp', 'debt', 'growth', 'stock'], icon: 'economy' },
  { keywords: ['politique', 'election', 'vote', 'parlement', 'loi', 'president', 'gouvernement', 'politique', 'election', 'parliament', 'law', 'government', 'congress'], icon: 'politics' },
  { keywords: ['diplomatie', 'negociation', 'accord', 'traite', 'onu', 'sommet', 'alliance', 'ambassade', 'diplomacy', 'treaty', 'summit', 'un', 'nato', 'otan'], icon: 'diplomacy' },
  { keywords: ['sante', 'pandemie', 'vaccin', 'hopital', 'oms', 'maladie', 'covid', 'health', 'pandemic', 'vaccine', 'hospital', 'who', 'disease'], icon: 'health' },
  { keywords: ['climat', 'environnement', 'co2', 'pollution', 'rechauffement', 'ecologie', 'climate', 'environment', 'warming', 'carbon', 'ecology'], icon: 'climate' },
  { keywords: ['tech', 'ia', 'cyber', 'numerique', 'algorithme', 'intelligence artificielle', 'ai', 'technology', 'digital', 'quantum', 'computing'], icon: 'tech' },
  { keywords: ['securite', 'terrorisme', 'police', 'defense', 'espionnage', 'renseignement', 'security', 'terrorism', 'defense', 'intelligence', 'surveillance'], icon: 'security' },
  { keywords: ['finance', 'banque', 'taux', 'monnaie', 'crypto', 'bitcoin', 'dollar', 'euro', 'finance', 'bank', 'rate', 'currency', 'central'], icon: 'finance' },
  { keywords: ['transport', 'aviation', 'maritime', 'logistique', 'detroit', 'blocus', 'port', 'transport', 'aviation', 'shipping', 'strait', 'blockade'], icon: 'transport' },
  { keywords: ['justice', 'tribunal', 'proces', 'sanction', 'cour', 'juge', 'condamnation', 'justice', 'court', 'trial', 'sanction', 'judge', 'sentence'], icon: 'justice' },
  { keywords: ['migration', 'refugie', 'frontiere', 'asile', 'immigration', 'migration', 'refugee', 'border', 'asylum', 'immigration'], icon: 'migration' },
  { keywords: ['alimentation', 'agriculture', 'famine', 'recolte', 'food', 'agriculture', 'famine', 'harvest', 'grain', 'wheat'], icon: 'food' },
  { keywords: ['riposte', 'represaille', 'retaliation', 'response', 'contre-attaque', 'counterattack'], icon: 'military' },
];

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get a content-aware SVG icon based on the node's label text.
 * Analyzes keywords in French and English to pick the most relevant icon.
 */
export function getNodeIcon(label: string, nodeType: string): IconDef {
  const lowerLabel = label.toLowerCase();

  // Try keyword matching first
  for (const group of KEYWORD_GROUPS) {
    if (group.keywords.some(kw => lowerLabel.includes(kw))) {
      return ICONS[group.icon];
    }
  }

  // Fallback to type-based default
  const typeKey = `${nodeType}_default`;
  return ICONS[typeKey] || ICONS.event_default;
}

/**
 * Compute dynamic node size based on importance metrics.
 * Returns pixel size for the node.
 */
export function getNodeSize(
  mentionCount: number,
  connectionCount: number,
  isCentral: boolean,
  isPrediction: boolean,
  probability?: number,
): number {
  if (isPrediction) {
    // Predictions: size proportional to probability
    const prob = probability ?? 0.5;
    return 44 + Math.round(prob * 44); // Range: 44-88px (big diff between 30% and 80%)
  }

  const base = 50;
  const mentionBoost = Math.min((mentionCount || 1) * 5, 30); // More aggressive scaling
  const connectionBoost = Math.min(connectionCount * 6, 24); // More aggressive scaling
  const centralBoost = isCentral ? 24 : 0;

  return base + mentionBoost + connectionBoost + centralBoost; // Range: 55-128px
}

/**
 * Render an SVG icon as a JSX-compatible string for use in React components.
 * Returns props for an <svg> element.
 */
export function getIconSvgProps(icon: IconDef, size: number, color: string) {
  return {
    viewBox: icon.viewBox,
    width: size,
    height: size,
    fill: color,
    path: icon.path,
  };
}

/**
 * Condense a long causal label into a short, readable title.
 * Removes filler words, extracts the key subject, keeps max ~25 chars.
 * Examples:
 *   "Riposte iranienne sur Diego Garcia" → "Riposte sur Diego Garcia"
 *   "Préoccupation sécuritaire mondiale accrue" → "Inquietude securitaire"
 *   "Déclaration Trump sur retrait possible" → "Trump: retrait possible"
 *   "Le scénario du statu quo tendu et des négociations indirectes" → "Statu quo & negociations"
 */
export function condensLabel(label: string, maxLen: number = 26): string {
  if (label.length <= maxLen) return label;

  // Remove common French filler prefixes
  let short = label
    .replace(/^(Le scénario d[eu']?\s*)/i, '')
    .replace(/^(La |Le |Les |Un |Une |Des |Du )/i, '')
    .replace(/^(Déclaration |Annonce |Appel |Risque d[e']?\s*)/i, (m) => {
      // Keep a short version of the prefix
      const map: Record<string, string> = {
        'declaration ': 'Decl. ',
        'déclaration ': 'Decl. ',
        'annonce ': '',
        'appel ': 'Appel ',
        "risque d'": 'Risque: ',
        'risque de ': 'Risque: ',
      };
      return map[m.toLowerCase()] ?? m.substring(0, 5) + '. ';
    })
    .replace(/\s+(sur|de|du|des|la|le|les|et|ou|en|au|aux|par|pour|dans|avec)\s+/gi, ' ')
    .trim();

  // If still too long, take first N chars at word boundary
  if (short.length > maxLen) {
    const cut = short.substring(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    short = lastSpace > maxLen * 0.5 ? cut.substring(0, lastSpace) : cut;
  }

  return short;
}
