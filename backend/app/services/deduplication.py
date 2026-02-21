"""
Advanced Deduplication System with Viral Score
Utilise embeddings BGE-M3 pour détecter les doublons sémantiques
ET calcule un score de viralité basé sur le nombre de sources couvrant le même sujet
"""
from typing import List, Dict, Any, Tuple
import numpy as np
from loguru import logger

from app.ml.embeddings import get_embedding_service


class DeduplicationEngine:
    """
    Déduplication avancée d'articles par similarité sémantique
    - Détecte les articles identiques (copies exactes)
    - Détecte les articles très similaires (même sujet, sources différentes)
    - Garde le plus complet/qualitatif
    - NOUVEAU: Calcule un viral_score = nombre de sources couvrant le même sujet
    """

    def __init__(self, similarity_threshold: float = 0.85):
        """
        Args:
            similarity_threshold: Seuil de similarité (0-1)
                0.95+ = quasi-identique
                0.85-0.95 = très similaire (même événement)
                0.70-0.85 = similaire (même sujet)
        """
        self.similarity_threshold = similarity_threshold
        self.similarity_threshold = similarity_threshold
        self.embedding_service = None

    def initialize(self):
        """Initialize dependencies"""
        self.embedding_service = get_embedding_service()

    def compute_similarity_matrix(
        self,
        embeddings: np.ndarray
    ) -> np.ndarray:
        """
        Calcule matrice de similarité cosine entre tous les articles

        Args:
            embeddings: (n_articles, embedding_dim)

        Returns:
            Matrice de similarité (n_articles, n_articles)
        """
        # Normaliser pour similarité cosine
        embeddings_norm = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)

        # Similarité cosine = dot product des vecteurs normalisés
        similarity_matrix = np.dot(embeddings_norm, embeddings_norm.T)

        return similarity_matrix

    def find_duplicate_groups(
        self,
        articles: List[Dict[str, Any]],
        embeddings: np.ndarray
    ) -> List[List[int]]:
        """
        Trouve les groupes d'articles dupliqués

        Returns:
            Liste de groupes d'indices d'articles similaires
            Ex: [[0, 5, 12], [3, 8], [15, 20, 21]]
        """
        n_articles = len(articles)
        similarity_matrix = self.compute_similarity_matrix(embeddings)

        # Matrice des duplications (au-dessus du seuil)
        duplicate_mask = similarity_matrix > self.similarity_threshold

        # Ne pas comparer un article avec lui-même
        np.fill_diagonal(duplicate_mask, False)

        # Grouper les articles similaires
        visited = set()
        duplicate_groups = []

        for i in range(n_articles):
            if i in visited:
                continue

            # Trouver tous les articles similaires à i
            similar_indices = np.where(duplicate_mask[i])[0].tolist()

            if similar_indices:
                # Créer un groupe avec i et tous ses similaires
                group = [i] + similar_indices
                duplicate_groups.append(group)

                # Marquer comme visités
                visited.update(group)

        logger.info(f"Found {len(duplicate_groups)} duplicate groups")
        return duplicate_groups

    def select_best_article(
        self,
        articles: List[Dict[str, Any]],
        indices: List[int]
    ) -> int:
        """
        Sélectionne le meilleur article parmi un groupe de duplicats

        Critères (par ordre de priorité):
        1. Longueur du contenu (plus complet)
        2. Présence d'images
        3. Source réputée
        4. Date de publication (plus récent)

        Returns:
            Index du meilleur article
        """
        if len(indices) == 1:
            return indices[0]

        # Sources premium (ordre de préférence)
        PREMIUM_SOURCES = [
            "The New York Times", "The Guardian", "BBC News", "Reuters",
            "Le Monde", "The Washington Post", "Financial Times"
        ]

        best_idx = indices[0]
        best_score = 0

        for idx in indices:
            article = articles[idx]
            score = 0

            # 1. Longueur du contenu (40% du score)
            content_length = len(article.get("raw_text", ""))
            score += min(content_length / 1000, 40)  # Max 40 points

            # 2. Présence d'image (20% du score)
            if article.get("image_url"):
                score += 20

            # 3. Source réputée (30% du score)
            source_name = article.get("source_name", "")
            if source_name in PREMIUM_SOURCES:
                score += 30

            # 4. Fraîcheur (10% du score)
            try:
                from datetime import datetime
                pub_date = datetime.fromisoformat(article.get("published_at", ""))
                now = datetime.now()
                days_old = (now - pub_date).days
                freshness = max(0, 10 - days_old)  # Plus récent = meilleur
                score += freshness
            except (ValueError, TypeError, OSError):
                pass

            if score > best_score:
                best_score = score
                best_idx = idx

        return best_idx

    def deduplicate_articles(
        self,
        articles: List[Dict[str, Any]],
        embeddings: np.ndarray
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Déduplique les articles ET calcule le score de viralité

        Le viral_score représente le nombre de sources différentes
        qui couvrent le même sujet. Plus le score est élevé, plus
        le sujet est "chaud" / viral.

        Returns:
            (unique_articles, removed_articles)
            unique_articles auront un champ 'viral_score' et 'covered_by_sources'
        """
        if len(articles) == 0:
            return [], []

        # Trouver les groupes de duplicats
        duplicate_groups = self.find_duplicate_groups(articles, embeddings)

        # Indices à garder et mapping vers leurs groupes
        kept_indices = set(range(len(articles)))
        removed_articles = []
        viral_info = {}  # idx -> {viral_score, sources}

        # Pour chaque groupe, garder le meilleur ET calculer viral_score
        for group in duplicate_groups:
            best_idx = self.select_best_article(articles, group)

            # Collecter toutes les sources uniques du groupe
            sources_in_group = set()
            for idx in group:
                source = articles[idx].get("source_name", "") or articles[idx].get("source_domain", "")
                if source:
                    sources_in_group.add(source)

            # Le viral_score = nombre de sources différentes couvrant ce sujet
            viral_score = len(sources_in_group)

            # Stocker l'info de viralité pour le meilleur article
            viral_info[best_idx] = {
                "viral_score": viral_score,
                "covered_by_sources": list(sources_in_group),
                "duplicate_count": len(group)
            }

            # Retirer les autres du groupe
            for idx in group:
                if idx != best_idx:
                    kept_indices.discard(idx)
                    removed_articles.append(articles[idx])

        # Articles uniques avec viral_score
        unique_articles = []
        for i in sorted(kept_indices):
            article = articles[i].copy()  # Copie pour ne pas modifier l'original

            if i in viral_info:
                # Article qui avait des doublons -> viral
                article["viral_score"] = viral_info[i]["viral_score"]
                article["covered_by_sources"] = viral_info[i]["covered_by_sources"]
                article["duplicate_count"] = viral_info[i]["duplicate_count"]
            else:
                # Article unique, pas de doublons
                article["viral_score"] = 1
                source = article.get("source_name", "") or article.get("source_domain", "")
                article["covered_by_sources"] = [source] if source else []
                article["duplicate_count"] = 1

            unique_articles.append(article)

        # Trier par viral_score décroissant (les plus viraux en premier)
        unique_articles.sort(key=lambda x: x.get("viral_score", 1), reverse=True)

        # Log des articles les plus viraux
        top_viral = [a for a in unique_articles if a.get("viral_score", 1) > 1][:5]
        if top_viral:
            logger.info(f"🔥 Top viral articles:")
            for a in top_viral:
                title = a.get("raw_title", a.get("title", ""))[:50]
                logger.info(f"   - [{a['viral_score']} sources] {title}...")

        logger.info(
            f"Deduplication: {len(articles)} articles → "
            f"{len(unique_articles)} unique ({len(removed_articles)} removed)"
        )

        return unique_articles, removed_articles

    def get_deduplication_report(
        self,
        articles: List[Dict[str, Any]],
        removed: List[Dict[str, Any]],
        duplicate_groups: List[List[int]]
    ) -> Dict[str, Any]:
        """Génère un rapport de déduplication"""
        return {
            "total_articles": len(articles) + len(removed),
            "unique_articles": len(articles),
            "duplicates_removed": len(removed),
            "duplicate_groups": len(duplicate_groups),
            "deduplication_rate": len(removed) / (len(articles) + len(removed)) if articles else 0,
            "groups_details": [
                {
                    "size": len(group),
                    "sources": list(set([articles[i].get("source_name", "") for i in group]))
                }
                for group in duplicate_groups
            ]
        }


# Global instance
dedup_engine = DeduplicationEngine(similarity_threshold=0.85)


def get_deduplication_engine() -> DeduplicationEngine:
    """Dependency injection"""
    return dedup_engine
