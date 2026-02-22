"""
Pytest configuration and fixtures for NovaPress AI v2 tests
"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

# Import app after mocking to prevent heavy model loading
import sys
import os
from unittest.mock import MagicMock

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Pre-mock heavy ML packages unavailable in CI (must happen before any app import)
_HEAVY_MODULES = [
    "sentence_transformers",
    "torch",
    "torchvision",
    "torchaudio",
    "sklearn",
    "sklearn.preprocessing",
    "hdbscan",
    "umap",
    "umap.umap_",
    "spacy",
    "spacy.tokens",
    "spacy.lang",
    "spacy.lang.fr",
    "newspaper",
    "newspaper.article",
    "feedparser",
    "pydub",
    "telegram",
    "telegram.ext",
]
for _mod in _HEAVY_MODULES:
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def mock_embedding_service():
    """Mock the embedding service to avoid loading heavy models"""
    mock = MagicMock()
    mock.encode = MagicMock(return_value=[[0.1] * 1024])  # 1024-dim embedding
    mock.encode_async = AsyncMock(return_value=[[0.1] * 1024])
    return mock


@pytest.fixture(scope="module")
def mock_qdrant_service():
    """Mock Qdrant vector database"""
    mock = MagicMock()
    mock.search = MagicMock(return_value=[])
    mock.upsert = MagicMock(return_value=True)
    mock.get_recent_articles = MagicMock(return_value=[])
    return mock


@pytest.fixture(scope="module")
def mock_llm_service():
    """Mock LLM service for synthesis"""
    mock = AsyncMock()
    mock.generate = AsyncMock(return_value={
        "title": "Test Synthesis",
        "summary": "This is a test synthesis.",
        "key_points": ["Point 1", "Point 2"],
        "compliance_score": 85
    })
    return mock


@pytest.fixture(scope="module")
def app(mock_embedding_service, mock_qdrant_service, mock_llm_service):
    """Create FastAPI app with mocked services"""
    # Patch heavy services before importing app
    with patch("app.ml.embeddings.embedding_service", mock_embedding_service), \
         patch("app.db.qdrant_client.qdrant_service", mock_qdrant_service):
        from app.main import app as fastapi_app
        yield fastapi_app


@pytest.fixture(scope="module")
def client(app) -> Generator:
    """Synchronous test client"""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
async def async_client(app) -> AsyncGenerator:
    """Async test client for testing async endpoints"""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac


# ============= Test Data Fixtures =============

@pytest.fixture
def sample_user_data():
    """Sample user registration data"""
    return {
        "email": "test@example.com",
        "password": "SecureP@ssw0rd!",
        "name": "Test User"
    }


@pytest.fixture
def sample_article_data():
    """Sample article data"""
    return {
        "id": "test-article-1",
        "title": "Test Article Title",
        "content": "This is the content of the test article.",
        "summary": "Test summary",
        "source": "test-source.com",
        "published_at": "2026-01-05T12:00:00Z",
        "embedding": [0.1] * 1024
    }


@pytest.fixture
def auth_headers(client, sample_user_data):
    """Get auth headers with valid token"""
    # Register user
    client.post("/api/auth/register", json=sample_user_data)
    
    # Login to get token
    response = client.post("/api/auth/login", json={
        "email": sample_user_data["email"],
        "password": sample_user_data["password"]
    })
    
    if response.status_code == 200:
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    # If login fails, return empty headers (tests should handle this)
    return {}
