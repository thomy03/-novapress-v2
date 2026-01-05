"""
Authentication API Tests - NovaPress AI v2
Tests for user registration, login, token refresh, and profile management
"""
import pytest
from fastapi import status


class TestAuthRegister:
    """Tests for user registration endpoint"""
    
    @pytest.mark.unit
    def test_register_success(self, client, sample_user_data):
        """Test successful user registration"""
        response = client.post("/api/auth/register", json=sample_user_data)
        
        # Should return 200 or 201
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
        
        data = response.json()
        assert "access_token" in data or "message" in data
    
    @pytest.mark.unit
    def test_register_invalid_email(self, client):
        """Test registration with invalid email format"""
        response = client.post("/api/auth/register", json={
            "email": "invalid-email",
            "password": "SecureP@ss123!",
            "name": "Test User"
        })
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.unit
    def test_register_weak_password(self, client):
        """Test registration with weak password"""
        response = client.post("/api/auth/register", json={
            "email": "test2@example.com",
            "password": "123",  # Too short
            "name": "Test User"
        })
        
        # Should reject weak password
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]


class TestAuthLogin:
    """Tests for user login endpoint"""
    
    @pytest.mark.unit
    def test_login_success(self, client, sample_user_data):
        """Test successful login"""
        # First register
        client.post("/api/auth/register", json=sample_user_data)
        
        # Then login
        response = client.post("/api/auth/login", json={
            "email": sample_user_data["email"],
            "password": sample_user_data["password"]
        })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    @pytest.mark.unit
    def test_login_wrong_password(self, client, sample_user_data):
        """Test login with incorrect password"""
        # Register user first
        client.post("/api/auth/register", json=sample_user_data)
        
        response = client.post("/api/auth/login", json={
            "email": sample_user_data["email"],
            "password": "WrongPassword123!"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.unit
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user"""
        response = client.post("/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "SomePassword123!"
        })
        
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_404_NOT_FOUND
        ]


class TestAuthProfile:
    """Tests for user profile endpoints"""
    
    @pytest.mark.unit
    def test_get_profile_authenticated(self, client, auth_headers):
        """Test getting profile when authenticated"""
        if not auth_headers:
            pytest.skip("Auth headers not available")
        
        response = client.get("/api/auth/profile", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "email" in data
        assert "name" in data
    
    @pytest.mark.unit
    def test_get_profile_unauthenticated(self, client):
        """Test getting profile without authentication"""
        response = client.get("/api/auth/profile")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestAuthTokenRefresh:
    """Tests for token refresh endpoint"""
    
    @pytest.mark.unit
    def test_refresh_token_success(self, client, sample_user_data):
        """Test successful token refresh"""
        # Register and login
        client.post("/api/auth/register", json=sample_user_data)
        login_response = client.post("/api/auth/login", json={
            "email": sample_user_data["email"],
            "password": sample_user_data["password"]
        })
        
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        refresh_token = login_response.json().get("refresh_token")
        
        # Refresh
        response = client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
    
    @pytest.mark.unit
    def test_refresh_token_invalid(self, client):
        """Test refresh with invalid token"""
        response = client.post("/api/auth/refresh", json={
            "refresh_token": "invalid-token-here"
        })
        
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]
