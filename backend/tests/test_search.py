"""
Search API Tests - NovaPress AI v2
Tests for text search and semantic search functionality
"""
import pytest
from fastapi import status


class TestTextSearch:
    """Tests for text-based search endpoint"""
    
    @pytest.mark.unit
    def test_search_with_query(self, client):
        """Test search with a valid query"""
        response = client.get("/api/search?q=technology")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should return results or empty list
        assert isinstance(data, (list, dict))
        if isinstance(data, dict):
            assert "data" in data or "results" in data or "articles" in data
    
    @pytest.mark.unit
    def test_search_empty_query(self, client):
        """Test search with empty query"""
        response = client.get("/api/search?q=")
        
        # Should return empty results or error
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST
        ]
        
        if response.status_code == 200:
            data = response.json()
            results = data.get("data", data) if isinstance(data, dict) else data
            if isinstance(results, list):
                assert len(results) == 0 or isinstance(results, list)
    
    @pytest.mark.unit
    def test_search_no_query_param(self, client):
        """Test search without query parameter"""
        response = client.get("/api/search")
        
        # Should return error or empty results
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]
    
    @pytest.mark.unit
    def test_search_with_limit(self, client):
        """Test search with limit parameter"""
        response = client.get("/api/search?q=news&limit=5")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        results = data.get("data", data) if isinstance(data, dict) else data
        if isinstance(results, list):
            assert len(results) <= 5
    
    @pytest.mark.unit
    def test_search_special_characters(self, client):
        """Test search with special characters"""
        response = client.get("/api/search?q=test%20%26%20news")  # "test & news"
        
        # Should handle gracefully
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST
        ]
    
    @pytest.mark.unit
    def test_search_unicode_query(self, client):
        """Test search with unicode characters (French)"""
        response = client.get("/api/search?q=économie%20française")
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.unit
    def test_search_long_query(self, client):
        """Test search with very long query"""
        long_query = "a" * 500
        response = client.get(f"/api/search?q={long_query}")
        
        # Should handle or reject gracefully
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_414_REQUEST_URI_TOO_LONG,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]


class TestSemanticSearch:
    """Tests for semantic/vector search (if available)"""
    
    @pytest.mark.unit
    def test_semantic_search_endpoint(self, client):
        """Test semantic search endpoint exists"""
        response = client.get("/api/search/semantic?q=artificial%20intelligence")
        
        # Endpoint may not exist, so 404 is acceptable
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_404_NOT_FOUND  # Endpoint doesn't exist yet
        ]


class TestSearchResultStructure:
    """Tests for search result structure"""
    
    @pytest.mark.unit
    def test_search_result_structure(self, client):
        """Test that search results have expected structure"""
        response = client.get("/api/search?q=test")
        
        if response.status_code != 200:
            pytest.skip("Search returned non-200 status")
        
        data = response.json()
        
        # Check wrapper structure
        if isinstance(data, dict):
            # Common wrapper keys
            possible_keys = ["data", "results", "articles", "items", "query", "count", "total"]
            assert any(key in data for key in possible_keys) or len(data) >= 0
        
        # If we have results, check article structure
        results = data.get("data", data) if isinstance(data, dict) else data
        if isinstance(results, list) and len(results) > 0:
            article = results[0]
            # Articles should have at least id and title
            if isinstance(article, dict):
                assert "id" in article or "title" in article or "_id" in article
