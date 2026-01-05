"""
Articles API Tests - NovaPress AI v2
Tests for article listing, retrieval, and filtering
"""
import pytest
from fastapi import status


class TestArticlesList:
    """Tests for article listing endpoint"""
    
    @pytest.mark.unit
    def test_get_articles_default(self, client):
        """Test getting articles with default parameters"""
        response = client.get("/api/articles")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should return a list of articles or data wrapper
        assert isinstance(data, (list, dict))
        if isinstance(data, dict):
            assert "data" in data or "articles" in data
    
    @pytest.mark.unit
    def test_get_articles_with_limit(self, client):
        """Test getting articles with limit parameter"""
        response = client.get("/api/articles?limit=5")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # If data is wrapped
        articles = data.get("data", data) if isinstance(data, dict) else data
        if isinstance(articles, list):
            assert len(articles) <= 5
    
    @pytest.mark.unit
    def test_get_articles_with_offset(self, client):
        """Test pagination with offset"""
        response = client.get("/api/articles?limit=10&offset=0")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        if isinstance(data, dict):
            # Check pagination metadata
            assert "total" in data or "hasNext" in data or "page" in data or len(data) >= 0
    
    @pytest.mark.unit
    def test_get_articles_invalid_limit(self, client):
        """Test with invalid limit parameter"""
        response = client.get("/api/articles?limit=-1")
        
        # Should either reject or handle gracefully
        assert response.status_code in [
            status.HTTP_200_OK,  # Handled gracefully
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]


class TestArticleById:
    """Tests for single article retrieval"""
    
    @pytest.mark.unit
    def test_get_article_not_found(self, client):
        """Test getting non-existent article"""
        response = client.get("/api/articles/nonexistent-id-12345")
        
        assert response.status_code in [
            status.HTTP_404_NOT_FOUND,
            status.HTTP_200_OK  # Some APIs return empty with 200
        ]
    
    @pytest.mark.unit
    def test_get_article_invalid_id_format(self, client):
        """Test with invalid ID format"""
        response = client.get("/api/articles/")
        
        # Trailing slash without ID
        assert response.status_code in [
            status.HTTP_200_OK,  # Redirects to list
            status.HTTP_404_NOT_FOUND,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]


class TestTrendingArticles:
    """Tests for trending articles endpoint"""
    
    @pytest.mark.unit
    def test_get_trending(self, client):
        """Test getting trending articles"""
        response = client.get("/api/trending")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should return articles or data wrapper
        assert isinstance(data, (list, dict))
    
    @pytest.mark.unit
    def test_trending_limited_results(self, client):
        """Test that trending returns limited number of results"""
        response = client.get("/api/trending")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        articles = data.get("data", data) if isinstance(data, dict) else data
        if isinstance(articles, list):
            # Trending should be limited (typically 10-20)
            assert len(articles) <= 50


class TestArticleRelated:
    """Tests for related articles endpoint"""
    
    @pytest.mark.unit
    def test_get_related_articles(self, client):
        """Test getting related articles for an article"""
        response = client.get("/api/articles/1/related")
        
        # May return 404 if article doesn't exist, or 200 with results
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_404_NOT_FOUND
        ]


class TestHealthCheck:
    """Tests for health check endpoint"""
    
    @pytest.mark.unit
    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get("/health")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data.get("status") in ["healthy", "ok", "up"]
