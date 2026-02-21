"""Tests for the syntheses API endpoints."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client with mocked dependencies."""
    # Mock Qdrant before importing the app
    with patch('app.db.qdrant_client.QdrantClient') as mock_qdrant_class:
        mock_qdrant = MagicMock()
        mock_qdrant_class.return_value = mock_qdrant

        from app.main import app
        return TestClient(app)


@pytest.fixture
def mock_qdrant():
    """Provide a mock Qdrant service."""
    with patch('app.api.routes.syntheses.get_qdrant_service') as mock:
        service = MagicMock()
        mock.return_value = service
        yield service


class TestSynthesesEndpoints:
    def test_health_endpoint(self, client):
        """Health endpoint should always return 200."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_get_syntheses_returns_list(self, client, mock_qdrant):
        """GET /api/syntheses should return a paginated list."""
        mock_qdrant.get_latest_syntheses.return_value = []
        response = client.get("/api/syntheses")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)

    def test_get_breaking_syntheses(self, client, mock_qdrant):
        """GET /api/syntheses/breaking should return breaking news."""
        mock_qdrant.get_breaking_syntheses.return_value = []
        response = client.get("/api/syntheses/breaking")
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "breaking"

    def test_get_brief_endpoint(self, client, mock_qdrant):
        """GET /api/syntheses/brief should return morning brief."""
        mock_qdrant.get_latest_syntheses.return_value = []
        response = client.get("/api/syntheses/brief?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "brief"
        assert len(data["data"]) <= 5

    def test_get_synthesis_not_found(self, client, mock_qdrant):
        """GET /api/syntheses/by-id/unknown should return 404."""
        mock_qdrant.get_synthesis_by_id.return_value = None
        response = client.get("/api/syntheses/by-id/nonexistent-id")
        assert response.status_code == 404

    def test_get_live_syntheses(self, client, mock_qdrant):
        """GET /api/syntheses/live should return recent syntheses."""
        mock_qdrant.get_live_syntheses.return_value = []
        response = client.get("/api/syntheses/live?hours=24")
        assert response.status_code == 200

    def test_get_category_syntheses(self, client, mock_qdrant):
        """GET /api/syntheses/category/TECH should filter by category."""
        mock_qdrant.get_syntheses_by_category.return_value = []
        response = client.get("/api/syntheses/category/TECH")
        assert response.status_code == 200
