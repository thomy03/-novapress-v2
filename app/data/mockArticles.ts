// Mock data pour le développement - sera remplacé par les vraies données du backend

import { Article, Tag, Category } from '../types/Article';

export const mockTags: Tag[] = [
  { id: '1', name: 'Intelligence Artificielle', slug: 'ia', color: '#DC2626', count: 45 },
  { id: '2', name: 'Machine Learning', slug: 'ml', color: '#000000', count: 32 },
  { id: '3', name: 'ChatGPT', slug: 'chatgpt', color: '#DC2626', count: 28 },
  { id: '4', name: 'Climat', slug: 'climat', color: '#000000', count: 67 },
  { id: '5', name: 'Énergie Renouvelable', slug: 'energie-renouvelable', color: '#DC2626', count: 41 },
  { id: '6', name: 'Finance', slug: 'finance', color: '#000000', count: 89 },
  { id: '7', name: 'Cryptomonnaie', slug: 'crypto', color: '#DC2626', count: 23 },
  { id: '8', name: 'Startup', slug: 'startup', color: '#000000', count: 56 },
  { id: '9', name: 'Santé', slug: 'sante', color: '#DC2626', count: 72 },
  { id: '10', name: 'Espace', slug: 'espace', color: '#000000', count: 34 },
  { id: '11', name: 'Politique', slug: 'politique', color: '#DC2626', count: 93 },
  { id: '12', name: 'Union Européenne', slug: 'ue', color: '#000000', count: 48 },
  { id: '13', name: 'Innovation', slug: 'innovation', color: '#DC2626', count: 61 },
  { id: '14', name: 'Cybersécurité', slug: 'cybersecurite', color: '#000000', count: 37 },
  { id: '15', name: '5G', slug: 'g', color: '#DC2626', count: 19 },
];

export const mockCategories: Category[] = [
  { id: '1', name: 'Technologie', slug: 'tech', icon: '💻' },
  { id: '2', name: 'Économie', slug: 'economie', icon: '📊' },
  { id: '3', name: 'Monde', slug: 'monde', icon: '🌍' },
  { id: '4', name: 'Politique', slug: 'politique', icon: '🏛️' },
  { id: '5', name: 'Culture', slug: 'culture', icon: '🎭' },
  { id: '6', name: 'Sport', slug: 'sport', icon: '⚽' },
  { id: '7', name: 'Sciences', slug: 'sciences', icon: '🔬' },
  { id: '8', name: 'Santé', slug: 'sante', icon: '🏥' },
];

export const mockArticles: Article[] = [
  {
    id: '1',
    title: "OpenAI révolutionne l'IA avec GPT-5 : capacités de raisonnement sans précédent",
    subtitle: "Le nouveau modèle promet de transformer l'industrie technologique",
    summary: "OpenAI dévoile GPT-5, son modèle d'IA le plus avancé, capable de raisonnement complexe et de résolution de problèmes multi-étapes avec une précision remarquable.",
    content: "Lorem ipsum...",
    slug: "openai-gpt5-revolution-ia",
    status: 'published',
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    category: mockCategories[0],
    tags: [mockTags[0], mockTags[1], mockTags[2], mockTags[12]],
    keywords: ['GPT-5', 'OpenAI', 'Intelligence Artificielle', 'Innovation'],
    featuredImage: 'https://picsum.photos/800/400?random=1',
    viewCount: 15234,
    shareCount: 892,
    readingTime: 5,
    sentiment: 'positive',
    relevanceScore: 95,
    language: 'fr',
    factCheckStatus: 'verified',
    author: {
      id: '1',
      name: 'Marie Dubois',
      role: 'Journaliste Tech',
      avatar: 'https://picsum.photos/100/100?random=100'
    },
    source: {
      id: '1',
      name: 'NovaPress AI',
      url: 'https://novapress.ai',
      credibility: 95,
      type: 'manual'
    }
  },
  {
    id: '2',
    title: "COP30 : Accord historique sur la neutralité carbone d'ici 2040",
    subtitle: "195 pays s'engagent sur des objectifs climatiques ambitieux",
    summary: "La COP30 marque un tournant décisif avec un accord global visant la neutralité carbone d'ici 2040, incluant des mécanismes de financement innovants.",
    content: "Lorem ipsum...",
    slug: "cop30-accord-neutralite-carbone",
    status: 'published',
    publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    category: mockCategories[2],
    tags: [mockTags[3], mockTags[4], mockTags[11]],
    keywords: ['COP30', 'Climat', 'Neutralité Carbone', 'Environnement'],
    featuredImage: 'https://picsum.photos/800/400?random=2',
    viewCount: 28456,
    shareCount: 2341,
    readingTime: 7,
    sentiment: 'positive',
    relevanceScore: 98,
    language: 'fr',
    factCheckStatus: 'verified',
    author: {
      id: '2',
      name: 'Jean-Pierre Martin',
      role: 'Correspondant International',
      avatar: 'https://picsum.photos/100/100?random=101'
    },
    source: {
      id: '2',
      name: 'AFP',
      url: 'https://afp.com',
      credibility: 98,
      type: 'api'
    }
  },
  {
    id: '3',
    title: "Marchés financiers : Le CAC 40 franchit la barre symbolique des 8000 points",
    subtitle: "L'optimisme des investisseurs porté par les résultats des entreprises",
    summary: "Le CAC 40 atteint un nouveau record historique, dépassant les 8000 points pour la première fois, soutenu par d'excellents résultats trimestriels.",
    content: "Lorem ipsum...",
    slug: "cac40-record-8000-points",
    status: 'published',
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    category: mockCategories[1],
    tags: [mockTags[5], mockTags[6]],
    keywords: ['CAC 40', 'Bourse', 'Finance', 'Marchés'],
    featuredImage: 'https://picsum.photos/800/400?random=3',
    viewCount: 12789,
    shareCount: 567,
    readingTime: 4,
    sentiment: 'positive',
    relevanceScore: 85,
    language: 'fr',
    factCheckStatus: 'verified',
    author: {
      id: '3',
      name: 'Sophie Laurent',
      role: 'Analyste Financier',
      avatar: 'https://picsum.photos/100/100?random=102'
    }
  },
  {
    id: '4',
    title: "SpaceX réussit le premier atterrissage de Starship sur Mars",
    subtitle: "Une étape historique vers la colonisation de la planète rouge",
    summary: "SpaceX marque l'histoire spatiale avec le premier atterrissage réussi du Starship sur Mars, ouvrant la voie à l'exploration humaine.",
    content: "Lorem ipsum...",
    slug: "spacex-starship-mars-atterrissage",
    status: 'published',
    publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    category: mockCategories[6],
    tags: [mockTags[9], mockTags[12]],
    keywords: ['SpaceX', 'Mars', 'Starship', 'Espace'],
    featuredImage: 'https://picsum.photos/800/400?random=4',
    viewCount: 45678,
    shareCount: 3456,
    readingTime: 6,
    sentiment: 'positive',
    relevanceScore: 92,
    language: 'fr',
    factCheckStatus: 'verified'
  },
  {
    id: '5',
    title: "Cybersécurité : Nouvelle vague d'attaques ransomware en Europe",
    subtitle: "Les entreprises appelées à renforcer leur protection",
    summary: "Une série coordonnée d'attaques ransomware touche plusieurs grandes entreprises européennes, relançant le débat sur la cybersécurité.",
    content: "Lorem ipsum...",
    slug: "cybersecurite-attaques-ransomware-europe",
    status: 'published',
    publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    category: mockCategories[0],
    tags: [mockTags[13], mockTags[11]],
    keywords: ['Cybersécurité', 'Ransomware', 'Europe', 'Sécurité'],
    featuredImage: 'https://picsum.photos/800/400?random=5',
    viewCount: 8934,
    shareCount: 234,
    readingTime: 5,
    sentiment: 'negative',
    relevanceScore: 88,
    language: 'fr',
    factCheckStatus: 'verified'
  },
  {
    id: '6',
    title: "Breakthrough médical : Nouveau traitement révolutionnaire contre Alzheimer",
    subtitle: "Les essais cliniques montrent 70% d'amélioration cognitive",
    summary: "Un nouveau médicament expérimental montre des résultats prometteurs dans le traitement de la maladie d'Alzheimer, avec une amélioration significative des fonctions cognitives.",
    content: "Lorem ipsum...",
    slug: "traitement-alzheimer-breakthrough",
    status: 'published',
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    category: mockCategories[7],
    tags: [mockTags[8], mockTags[12]],
    keywords: ['Alzheimer', 'Médecine', 'Santé', 'Innovation'],
    featuredImage: 'https://picsum.photos/800/400?random=6',
    viewCount: 34567,
    shareCount: 4567,
    readingTime: 8,
    sentiment: 'positive',
    relevanceScore: 96,
    language: 'fr',
    factCheckStatus: 'verified'
  },
  {
    id: '7',
    title: "5G : Déploiement accéléré en France avec 50 000 antennes actives",
    subtitle: "La couverture atteint 75% de la population",
    summary: "Le déploiement de la 5G s'accélère en France avec l'activation de la 50 000e antenne, couvrant désormais trois quarts de la population.",
    content: "Lorem ipsum...",
    slug: "5g-deploiement-france-50000-antennes",
    status: 'published',
    publishedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    category: mockCategories[0],
    tags: [mockTags[14], mockTags[12]],
    keywords: ['5G', 'Télécommunications', 'France', 'Innovation'],
    featuredImage: 'https://picsum.photos/800/400?random=7',
    viewCount: 6789,
    shareCount: 123,
    readingTime: 3,
    sentiment: 'neutral',
    relevanceScore: 75,
    language: 'fr',
    factCheckStatus: 'verified'
  },
  {
    id: '8',
    title: "Festival de Cannes 2025 : La sélection officielle dévoilée",
    subtitle: "25 films en compétition pour la Palme d'Or",
    summary: "Le Festival de Cannes annonce sa sélection officielle avec des œuvres de réalisateurs prestigieux et de nouveaux talents prometteurs.",
    content: "Lorem ipsum...",
    slug: "festival-cannes-2025-selection",
    status: 'published',
    publishedAt: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
    category: mockCategories[4],
    tags: [],
    keywords: ['Cannes', 'Cinéma', 'Festival', 'Culture'],
    featuredImage: 'https://picsum.photos/800/400?random=8',
    viewCount: 23456,
    shareCount: 1234,
    readingTime: 4,
    sentiment: 'positive',
    relevanceScore: 82,
    language: 'fr',
    factCheckStatus: 'verified'
  }
];

// Fonctions utilitaires pour filtrer et rechercher
export function filterArticlesByTags(articles: Article[], tagIds: string[]): Article[] {
  if (tagIds.length === 0) return articles;
  
  return articles.filter(article => 
    article.tags.some(tag => tagIds.includes(tag.id))
  );
}

export function filterArticlesByCategory(articles: Article[], categoryId: string): Article[] {
  return articles.filter(article => article.category.id === categoryId);
}

export function searchArticles(articles: Article[], query: string): Article[] {
  const lowerQuery = query.toLowerCase();
  
  return articles.filter(article => 
    article.title.toLowerCase().includes(lowerQuery) ||
    article.summary.toLowerCase().includes(lowerQuery) ||
    article.tags.some(tag => tag.name.toLowerCase().includes(lowerQuery)) ||
    article.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery))
  );
}

export function getPopularTags(articles: Article[], limit: number = 10): Tag[] {
  const tagCount = new Map<string, { tag: Tag; count: number }>();
  
  articles.forEach(article => {
    article.tags.forEach(tag => {
      const existing = tagCount.get(tag.id) || { tag, count: 0 };
      tagCount.set(tag.id, { tag, count: existing.count + 1 });
    });
  });
  
  return Array.from(tagCount.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(item => ({ ...item.tag, count: item.count }));
}

export function getRelatedArticles(article: Article, allArticles: Article[], limit: number = 5): Article[] {
  const tagIds = article.tags.map(tag => tag.id);
  
  return allArticles
    .filter(a => a.id !== article.id)
    .map(a => ({
      article: a,
      score: a.tags.filter(tag => tagIds.includes(tag.id)).length +
             (a.category.id === article.category.id ? 2 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.article);
}