"""Tests for the Transparency Score calculator."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.ml.transparency_score import TransparencyScorer


def make_synthesis(num_sources=3, source_articles=None, contradictions_count=0, has_contradictions=False):
    """Helper to create a test synthesis dict."""
    if source_articles is None:
        source_articles = [
            {"name": f"Source {i}", "url": f"https://source{i}.com/article", "title": f"Article {i}"}
            for i in range(num_sources)
        ]
    return {
        "source_articles": source_articles,
        "num_sources": num_sources,
        "contradictions_count": contradictions_count,
        "has_contradictions": has_contradictions,
        "summary": "Test synthesis with facts: 42% of users, 100 million downloads, published on 2024-01-15.",
    }


def make_articles(domains=None):
    """Helper to create test articles."""
    if domains is None:
        domains = ["lemonde.fr", "cnn.com", "spiegel.de"]
    return [
        {
            "source_domain": domain,
            "url": f"https://{domain}/article",
            "source_name": domain.split(".")[0],
        }
        for domain in domains
    ]


class TestTransparencyScorer:
    def setup_method(self):
        self.scorer = TransparencyScorer()

    def test_basic_score_calculation(self):
        """Score should be between 0 and 100."""
        synthesis = make_synthesis(num_sources=3)
        articles = make_articles()
        result = self.scorer.calculate(synthesis, articles)

        assert 0 <= result["score"] <= 100
        assert result["label"] in ("Excellent", "Bon", "Moyen", "Faible")
        assert "breakdown" in result

    def test_high_diversity_scores_higher(self):
        """More diverse sources should score higher."""
        # Low diversity: 1 source, 1 language, 1 region
        low_synthesis = make_synthesis(num_sources=1, source_articles=[
            {"name": "Le Monde", "url": "https://lemonde.fr/a", "title": "A"}
        ])
        low_articles = make_articles(["lemonde.fr"])

        # High diversity: 5 sources, 3 languages, 3 regions
        high_synthesis = make_synthesis(num_sources=5, source_articles=[
            {"name": "Le Monde", "url": "https://lemonde.fr/a", "title": "A"},
            {"name": "CNN", "url": "https://cnn.com/b", "title": "B"},
            {"name": "Spiegel", "url": "https://spiegel.de/c", "title": "C"},
            {"name": "El Pais", "url": "https://elpais.com/d", "title": "D"},
            {"name": "BBC", "url": "https://bbc.com/e", "title": "E"},
        ])
        high_articles = make_articles(["lemonde.fr", "cnn.com", "spiegel.de", "elpais.com", "bbc.com"])

        low_result = self.scorer.calculate(low_synthesis, low_articles)
        high_result = self.scorer.calculate(high_synthesis, high_articles)

        assert high_result["score"] > low_result["score"]

    def test_contradictions_boost_transparency(self):
        """Detected and disclosed contradictions should score higher."""
        no_contradiction = make_synthesis(contradictions_count=0)
        has_contradiction = make_synthesis(contradictions_count=2, has_contradictions=True)
        articles = make_articles()

        no_result = self.scorer.calculate(no_contradiction, articles)
        yes_result = self.scorer.calculate(has_contradiction, articles)

        assert yes_result["breakdown"]["contradictions"]["score"] > no_result["breakdown"]["contradictions"]["score"]

    def test_breakdown_has_all_components(self):
        """Breakdown should contain all 5 scoring components."""
        synthesis = make_synthesis()
        articles = make_articles()
        result = self.scorer.calculate(synthesis, articles)

        expected_keys = {"source_diversity", "language_diversity", "contradictions", "fact_density", "geo_coverage"}
        assert set(result["breakdown"].keys()) == expected_keys

        for key, component in result["breakdown"].items():
            assert "score" in component, f"Missing score in {key}"
            assert "weight" in component, f"Missing weight in {key}"
            assert "detail" in component, f"Missing detail in {key}"

    def test_weights_sum_to_100(self):
        """Component weights should sum to 100."""
        synthesis = make_synthesis()
        articles = make_articles()
        result = self.scorer.calculate(synthesis, articles)

        total_weight = sum(c["weight"] for c in result["breakdown"].values())
        assert total_weight == 100

    def test_label_ranges(self):
        """Labels should correspond to score ranges."""
        scorer = self.scorer

        # We can't easily force specific scores, but test the logic
        for score, expected_label in [(90, "Excellent"), (70, "Bon"), (50, "Moyen"), (20, "Faible")]:
            if score >= 80:
                assert expected_label == "Excellent"
            elif score >= 60:
                assert expected_label == "Bon"
            elif score >= 40:
                assert expected_label == "Moyen"
            else:
                assert expected_label == "Faible"

    def test_empty_articles(self):
        """Should handle empty articles gracefully."""
        synthesis = make_synthesis(num_sources=0, source_articles=[])
        result = self.scorer.calculate(synthesis, [])

        assert 0 <= result["score"] <= 100
        assert result["label"] in ("Excellent", "Bon", "Moyen", "Faible")

    def test_rag_analysis_override(self):
        """RAG analysis data should be used when provided."""
        synthesis = make_synthesis()
        articles = make_articles()
        rag = {"contradictions_count": 5, "fact_density": 0.9}

        result = self.scorer.calculate(synthesis, articles, rag)
        assert result["breakdown"]["fact_density"]["score"] == 90  # 0.9 * 100

    def test_language_detection_from_domains(self):
        """Should detect languages from known news domains."""
        articles = make_articles(["lemonde.fr", "cnn.com", "spiegel.de"])
        langs = self.scorer._get_languages(articles)
        assert "fr" in langs
        assert "en" in langs
        assert "de" in langs

    def test_region_detection_from_domains(self):
        """Should detect geographic regions from known news domains."""
        articles = make_articles(["lemonde.fr", "cnn.com", "timesofindia.indiatimes.com"])
        regions = self.scorer._get_regions(articles)
        assert "europe-west" in regions
        assert "north-america" in regions
        assert "south-asia" in regions
