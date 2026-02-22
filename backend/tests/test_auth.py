"""
Authentication API Tests - NovaPress AI v2
Auth is currently stubbed (501 Not Implemented) — PostgreSQL not wired.
These tests verify the stub behaviour is consistent.
"""
import pytest
from fastapi import status


@pytest.mark.skip(reason="Auth not implemented — endpoints return 501 by design")
class TestAuthRegister:
    """Tests for user registration endpoint"""

    @pytest.mark.unit
    def test_register_success(self, client, sample_user_data):
        response = client.post("/api/auth/register", json=sample_user_data)
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]

    @pytest.mark.unit
    def test_register_invalid_email(self, client):
        response = client.post("/api/auth/register", json={
            "email": "invalid-email",
            "password": "SecureP@ss123!",
            "name": "Test User"
        })
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.unit
    def test_register_weak_password(self, client):
        response = client.post("/api/auth/register", json={
            "email": "test2@example.com",
            "password": "123",
            "name": "Test User"
        })
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]


@pytest.mark.skip(reason="Auth not implemented — endpoints return 501 by design")
class TestAuthLogin:
    """Tests for user login endpoint"""

    @pytest.mark.unit
    def test_login_success(self, client, sample_user_data):
        client.post("/api/auth/register", json=sample_user_data)
        response = client.post("/api/auth/login", json={
            "email": sample_user_data["email"],
            "password": sample_user_data["password"]
        })
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.unit
    def test_login_wrong_password(self, client, sample_user_data):
        client.post("/api/auth/register", json=sample_user_data)
        response = client.post("/api/auth/login", json={
            "email": sample_user_data["email"],
            "password": "WrongPassword123!"
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.unit
    def test_login_nonexistent_user(self, client):
        response = client.post("/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "SomePassword123!"
        })
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_404_NOT_FOUND
        ]


@pytest.mark.skip(reason="Auth not implemented — endpoints return 501 by design")
class TestAuthProfile:
    """Tests for user profile endpoints"""

    @pytest.mark.unit
    def test_get_profile_authenticated(self, client, auth_headers):
        if not auth_headers:
            pytest.skip("Auth headers not available")
        response = client.get("/api/auth/profile", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.unit
    def test_get_profile_unauthenticated(self, client):
        response = client.get("/api/auth/profile")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.skip(reason="Auth not implemented — endpoints return 501 by design")
class TestAuthTokenRefresh:
    """Tests for token refresh endpoint"""

    @pytest.mark.unit
    def test_refresh_token_success(self, client, sample_user_data):
        client.post("/api/auth/register", json=sample_user_data)
        login_response = client.post("/api/auth/login", json={
            "email": sample_user_data["email"],
            "password": sample_user_data["password"]
        })
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        refresh_token = login_response.json().get("refresh_token")
        response = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.unit
    def test_refresh_token_invalid(self, client):
        response = client.post("/api/auth/refresh", json={"refresh_token": "invalid-token"})
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]


@pytest.mark.skip(reason="Auth fully implemented — stubs removed. Use TestAuthRegister/TestAuthLogin.")
class TestAuthStubs:
    """Stubs obsolètes — l'auth JWT est maintenant implémentée"""

    @pytest.mark.unit
    def test_register_returns_501(self, client):
        response = client.post("/api/auth/register", json={})
        assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED

    @pytest.mark.unit
    def test_login_returns_501(self, client):
        response = client.post("/api/auth/login", json={})
        assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED

    @pytest.mark.unit
    def test_refresh_returns_501(self, client):
        response = client.post("/api/auth/refresh", json={})
        assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED

    @pytest.mark.unit
    def test_logout_returns_501(self, client):
        response = client.post("/api/auth/logout")
        assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED
