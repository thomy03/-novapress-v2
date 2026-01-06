"""
Article Clustering using HDBSCAN
Density-based clustering for news articles
With strict thematic coherence validation
Uses sklearn.cluster.HDBSCAN (built-in since sklearn 1.3+)
"""
from typing import List, Dict, Any, Tuple
import numpy as np
from sklearn.preprocessing import normalize
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import HDBSCAN
from loguru import logger

from app.core.config import settings


class ClusteringEngine:
    """HDBSCAN Clustering for Articles with Thematic Coherence"""

    def __init__(self):
        self.min_cluster_size = settings.MIN_CLUSTER_SIZE
        self.min_samples = settings.MIN_SAMPLES
        self.cluster_selection_epsilon = settings.CLUSTER_SELECTION_EPSILON
        self.min_cluster_similarity = getattr(settings, 'MIN_CLUSTER_SIMILARITY', 0.80)
        self.max_cluster_size = getattr(settings, 'MAX_CLUSTER_SIZE', 15)

    def _compute_cluster_coherence(
        self,
        embeddings: np.ndarray,
        cluster_labels: np.ndarray,
        cluster_id: int
    ) -> float:
        """
        Compute average pairwise cosine similarity within a cluster.
        Higher = more thematically coherent.
        """
        mask = cluster_labels == cluster_id
        cluster_embeddings = embeddings[mask]

        if len(cluster_embeddings) < 2:
            return 1.0

        # Compute pairwise cosine similarity
        sim_matrix = cosine_similarity(cluster_embeddings)

        # Get upper triangle (excluding diagonal)
        n = len(sim_matrix)
        upper_tri = sim_matrix[np.triu_indices(n, k=1)]

        return float(np.mean(upper_tri))

    def _sub_cluster(
        self,
        embeddings: np.ndarray,
        cluster_mask: np.ndarray,
        next_label: int
    ) -> Tuple[np.ndarray, int]:
        """
        Sub-cluster a large cluster into smaller ones.
        Returns updated labels and count of new clusters created.
        """
        cluster_embeddings = embeddings[cluster_mask]
        indices = np.where(cluster_mask)[0]

        # Use stricter HDBSCAN for sub-clustering
        sub_clusterer = HDBSCAN(
            min_cluster_size=max(2, len(cluster_embeddings) // 5),  # Dynamic min size
            min_samples=2,
            cluster_selection_epsilon=0.03,  # Stricter for sub-clusters
            metric='euclidean',
            cluster_selection_method='leaf'
        )

        sub_labels = sub_clusterer.fit_predict(cluster_embeddings)
        unique_sub = set(sub_labels) - {-1}

        # Map sub-cluster labels to new global labels
        new_labels = np.full(len(cluster_mask), -1, dtype=int)
        sub_count = 0

        for sub_id in unique_sub:
            sub_mask = sub_labels == sub_id
            sub_size = np.sum(sub_mask)

            # Check coherence of sub-cluster
            if sub_size >= 2:
                sub_embeddings = cluster_embeddings[sub_mask]
                if len(sub_embeddings) >= 2:
                    sim_matrix = cosine_similarity(sub_embeddings)
                    n = len(sim_matrix)
                    upper_tri = sim_matrix[np.triu_indices(n, k=1)]
                    coherence = float(np.mean(upper_tri))

                    # Accept sub-cluster if coherent enough
                    if coherence >= self.min_cluster_similarity - 0.1:  # Slightly relaxed
                        sub_indices = indices[sub_mask]
                        new_labels[sub_indices] = next_label + sub_count
                        sub_count += 1
                        logger.debug(f"   ✓ Sub-cluster: {sub_size} articles, coherence={coherence:.3f}")

        return new_labels, sub_count

    def _validate_and_filter_clusters(
        self,
        embeddings: np.ndarray,
        cluster_labels: np.ndarray,
        min_similarity: float
    ) -> np.ndarray:
        """
        Validate clusters and mark incoherent ones as noise (-1).
        Sub-clusters oversized clusters instead of discarding them.
        """
        filtered_labels = cluster_labels.copy()
        unique_clusters = set(cluster_labels) - {-1}

        clusters_removed = 0
        clusters_split = 0
        next_label = max(cluster_labels) + 1  # For new sub-clusters

        for cluster_id in unique_clusters:
            cluster_mask = cluster_labels == cluster_id
            cluster_size = np.sum(cluster_mask)
            coherence = self._compute_cluster_coherence(embeddings, cluster_labels, cluster_id)

            # Check if cluster is too large - try sub-clustering instead of rejecting
            if cluster_size > self.max_cluster_size:
                logger.info(f"🔀 Cluster {cluster_id} too large ({cluster_size}), attempting sub-clustering...")

                # Try to sub-cluster
                new_labels, sub_count = self._sub_cluster(embeddings, cluster_mask, next_label)

                if sub_count > 0:
                    # Apply sub-cluster labels
                    for i, new_label in enumerate(new_labels):
                        if new_label != -1:
                            filtered_labels[i] = new_label
                        elif cluster_mask[i]:  # Was in original cluster but not assigned
                            filtered_labels[i] = -1

                    next_label += sub_count
                    clusters_split += 1
                    logger.success(f"✂️ Cluster {cluster_id} split into {sub_count} sub-clusters")
                else:
                    # Sub-clustering failed, mark as noise
                    filtered_labels[cluster_mask] = -1
                    clusters_removed += 1
                    logger.warning(f"⚠️ Cluster {cluster_id} could not be sub-clustered, marking as noise")
                continue

            if coherence < min_similarity:
                # Mark all articles in this cluster as noise
                filtered_labels[cluster_mask] = -1
                clusters_removed += 1
                logger.warning(f"⚠️ Cluster {cluster_id} removed (coherence={coherence:.3f} < {min_similarity})")
            else:
                logger.debug(f"✅ Cluster {cluster_id} validated (size={cluster_size}, coherence={coherence:.3f})")

        if clusters_removed > 0 or clusters_split > 0:
            logger.info(f"🔍 Filtered {clusters_removed} incoherent clusters, split {clusters_split} oversized clusters")

        return filtered_labels

    def cluster_articles(
        self,
        embeddings: np.ndarray,
        min_cluster_size: int = None,
        min_samples: int = None,
        validate_coherence: bool = True
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Cluster articles using HDBSCAN with thematic coherence validation.

        Args:
            embeddings: Article embeddings (n_articles, embedding_dim)
            min_cluster_size: Minimum cluster size (optional)
            min_samples: Minimum samples (optional)
            validate_coherence: If True, filter clusters with low similarity

        Returns:
            Tuple of (cluster_labels, cluster_stats)
        """
        if len(embeddings) < 3:
            logger.warning("Not enough articles for clustering")
            return np.zeros(len(embeddings), dtype=int), {"num_clusters": 0}

        # Normalize embeddings
        embeddings_norm = normalize(embeddings)

        # HDBSCAN clustering with stricter parameters (sklearn built-in)
        clusterer = HDBSCAN(
            min_cluster_size=min_cluster_size or self.min_cluster_size,
            min_samples=min_samples or self.min_samples,
            cluster_selection_epsilon=self.cluster_selection_epsilon,
            metric='euclidean',
            cluster_selection_method='leaf',  # 'leaf' creates smaller, tighter clusters
            store_centers='centroid'
        )

        cluster_labels = clusterer.fit_predict(embeddings_norm)

        # Log initial clustering
        initial_clusters = len(set(cluster_labels) - {-1})
        logger.info(f"📊 Initial HDBSCAN: {initial_clusters} clusters")

        # Validate cluster coherence (filter out incoherent clusters)
        if validate_coherence and initial_clusters > 0:
            cluster_labels = self._validate_and_filter_clusters(
                embeddings_norm,
                cluster_labels,
                self.min_cluster_similarity
            )

        # Compute cluster statistics
        unique_labels = set(cluster_labels)
        num_clusters = len([l for l in unique_labels if l != -1])
        num_noise = list(cluster_labels).count(-1)

        stats = {
            "num_clusters": num_clusters,
            "num_noise": num_noise,
            "cluster_sizes": {},
            "cluster_coherences": {},
            "cluster_probabilities": clusterer.probabilities_.tolist() if hasattr(clusterer, 'probabilities_') and clusterer.probabilities_ is not None else []
        }

        # Count articles per cluster and compute coherence
        for label in unique_labels:
            if label != -1:
                count = list(cluster_labels).count(label)
                coherence = self._compute_cluster_coherence(embeddings_norm, cluster_labels, label)
                stats["cluster_sizes"][int(label)] = count
                stats["cluster_coherences"][int(label)] = round(coherence, 3)

        logger.info(f"✅ Clustering complete: {num_clusters} coherent clusters, {num_noise} noise points")

        return cluster_labels, stats

    def group_by_clusters(
        self,
        articles: List[Dict[str, Any]],
        cluster_labels: np.ndarray
    ) -> List[Dict[str, Any]]:
        """
        Group articles by their cluster labels

        Args:
            articles: List of article dictionaries
            cluster_labels: Cluster labels from HDBSCAN

        Returns:
            List of cluster dictionaries with grouped articles
            Clusters are sorted by viral_score (sum of viral scores) then by size
        """
        clusters = {}

        for i, (article, label) in enumerate(zip(articles, cluster_labels)):
            if label == -1:  # Skip noise
                continue

            label = int(label)
            if label not in clusters:
                clusters[label] = {
                    "cluster_id": label,
                    "articles": [],
                    "size": 0,
                    "total_viral_score": 0,
                    "all_sources": set()
                }

            clusters[label]["articles"].append(article)
            clusters[label]["size"] += 1

            # Accumuler le viral_score du cluster
            viral_score = article.get("viral_score", 1)
            clusters[label]["total_viral_score"] += viral_score

            # Collecter toutes les sources du cluster
            sources = article.get("covered_by_sources", [])
            if sources:
                clusters[label]["all_sources"].update(sources)
            else:
                source = article.get("source_name", "") or article.get("source_domain", "")
                if source:
                    clusters[label]["all_sources"].add(source)

        # Finaliser les clusters
        for cluster in clusters.values():
            cluster["all_sources"] = list(cluster["all_sources"])
            cluster["unique_sources_count"] = len(cluster["all_sources"])

        # Convert to list and sort by viral_score (priorité), puis par size
        cluster_list = list(clusters.values())
        cluster_list.sort(key=lambda x: (x["total_viral_score"], x["size"]), reverse=True)

        # Log des clusters les plus viraux
        if cluster_list:
            logger.info(f"🔥 Top clusters by virality:")
            for c in cluster_list[:3]:
                logger.info(f"   - Cluster {c['cluster_id']}: {c['size']} articles, viral_score={c['total_viral_score']}, {c['unique_sources_count']} sources")

        return cluster_list

    def find_cluster_representative(
        self,
        cluster_articles: List[Dict[str, Any]],
        cluster_embeddings: np.ndarray
    ) -> int:
        """
        Find the most representative article in a cluster (centroid)

        Args:
            cluster_articles: Articles in the cluster
            cluster_embeddings: Embeddings of cluster articles

        Returns:
            Index of the representative article
        """
        if len(cluster_articles) == 0:
            return 0

        # Compute centroid
        centroid = cluster_embeddings.mean(axis=0)

        # Find closest article to centroid
        distances = np.linalg.norm(cluster_embeddings - centroid, axis=1)
        representative_idx = np.argmin(distances)

        return int(representative_idx)


# Global instance
clustering_engine = ClusteringEngine()


def get_clustering_engine() -> ClusteringEngine:
    """Dependency injection for FastAPI"""
    return clustering_engine
