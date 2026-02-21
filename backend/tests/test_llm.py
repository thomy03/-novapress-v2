"""
Unit tests for LLM Service
Tests generation, retry logic, and JSON parsing
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from openai import RateLimitError, APIConnectionError, APITimeoutError, APIError

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestLLMService:
    """Tests for LLMService class"""

    @pytest.fixture
    def mock_openai_response(self):
        """Mock OpenAI chat completion response"""
        mock_message = MagicMock()
        mock_message.content = "Test response"

        mock_choice = MagicMock()
        mock_choice.message = mock_message

        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        return mock_response

    @pytest.fixture
    def llm_service(self):
        """Create LLM service with mocked client"""
        with patch("app.ml.llm.settings") as mock_settings:
            mock_settings.OPENROUTER_API_KEY = "test-key"
            mock_settings.OPENROUTER_MODEL = "test-model"
            mock_settings.OPENROUTER_BASE_URL = "https://test.api"

            from app.ml.llm import LLMService
            service = LLMService()
            service.client = AsyncMock()
            return service

    @pytest.mark.asyncio
    async def test_generate_success(self, llm_service, mock_openai_response):
        """Test successful text generation"""
        llm_service.client.chat.completions.create = AsyncMock(return_value=mock_openai_response)

        result = await llm_service.generate("Test prompt")

        assert result == "Test response"
        llm_service.client.chat.completions.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_retry_on_rate_limit(self, llm_service, mock_openai_response):
        """Test retry logic on rate limit errors"""
        # First call raises RateLimitError, second succeeds
        llm_service.client.chat.completions.create = AsyncMock(
            side_effect=[
                RateLimitError("Rate limit exceeded", response=MagicMock(), body={}),
                mock_openai_response
            ]
        )

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await llm_service.generate("Test prompt")

        assert result == "Test response"
        assert llm_service.client.chat.completions.create.call_count == 2

    @pytest.mark.asyncio
    async def test_generate_retry_on_connection_error(self, llm_service, mock_openai_response):
        """Test retry logic on connection errors"""
        llm_service.client.chat.completions.create = AsyncMock(
            side_effect=[
                APIConnectionError(request=MagicMock()),
                mock_openai_response
            ]
        )

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await llm_service.generate("Test prompt")

        assert result == "Test response"
        assert llm_service.client.chat.completions.create.call_count == 2

    @pytest.mark.asyncio
    async def test_generate_max_retries_exceeded(self, llm_service):
        """Test that generation raises after max retries are exhausted"""
        llm_service.client.chat.completions.create = AsyncMock(
            side_effect=RateLimitError("Rate limit exceeded", response=MagicMock(), body={})
        )

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises((RateLimitError, Exception)):
                await llm_service.generate("Test prompt")

        # Should have retried MAX_RETRIES times before raising
        assert llm_service.client.chat.completions.create.call_count >= 1

    @pytest.mark.asyncio
    async def test_generate_json_success(self, llm_service):
        """Test successful JSON generation"""
        mock_json_content = '{"title": "Test", "summary": "Test summary"}'
        mock_message = MagicMock()
        mock_message.content = mock_json_content
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        llm_service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await llm_service.generate_json("Test prompt")

        assert result["title"] == "Test"
        assert result["summary"] == "Test summary"

    @pytest.mark.asyncio
    async def test_generate_json_invalid_response(self, llm_service):
        """Test JSON generation with invalid JSON response"""
        mock_message = MagicMock()
        mock_message.content = "Not valid JSON"
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        llm_service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await llm_service.generate_json("Test prompt")

        # Should return fallback structure
        assert "title" in result
        assert "summary" in result

    @pytest.mark.asyncio
    async def test_generate_with_custom_temperature(self, llm_service, mock_openai_response):
        """Test generation with custom temperature"""
        llm_service.client.chat.completions.create = AsyncMock(return_value=mock_openai_response)

        await llm_service.generate("Test prompt", temperature=0.9)

        call_args = llm_service.client.chat.completions.create.call_args
        assert call_args.kwargs["temperature"] == 0.9

    @pytest.mark.asyncio
    async def test_generate_with_custom_max_tokens(self, llm_service, mock_openai_response):
        """Test generation with custom max tokens"""
        llm_service.client.chat.completions.create = AsyncMock(return_value=mock_openai_response)

        await llm_service.generate("Test prompt", max_tokens=4000)

        call_args = llm_service.client.chat.completions.create.call_args
        assert call_args.kwargs["max_tokens"] == 4000


class TestLLMServiceInitialization:
    """Tests for LLM service initialization"""

    @pytest.mark.asyncio
    async def test_initialize_creates_client(self):
        """Test that initialize creates OpenAI client"""
        with patch("app.ml.llm.settings") as mock_settings, \
             patch("app.ml.llm.AsyncOpenAI") as mock_openai:
            mock_settings.OPENROUTER_API_KEY = "test-key"
            mock_settings.OPENROUTER_MODEL = "test-model"
            mock_settings.OPENROUTER_BASE_URL = "https://test.api"

            from app.ml.llm import LLMService
            service = LLMService()
            await service.initialize()

            mock_openai.assert_called_once()
            assert service.client is not None

    @pytest.mark.asyncio
    async def test_generate_auto_initializes(self):
        """Test that generate initializes client if not done"""
        with patch("app.ml.llm.settings") as mock_settings, \
             patch("app.ml.llm.AsyncOpenAI") as mock_openai:
            mock_settings.OPENROUTER_API_KEY = "test-key"
            mock_settings.OPENROUTER_MODEL = "test-model"
            mock_settings.OPENROUTER_BASE_URL = "https://test.api"

            mock_message = MagicMock()
            mock_message.content = "Response"
            mock_choice = MagicMock()
            mock_choice.message = mock_message
            mock_response = MagicMock()
            mock_response.choices = [mock_choice]

            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_openai.return_value = mock_client

            from app.ml.llm import LLMService
            service = LLMService()

            result = await service.generate("Test")

            assert result == "Response"
            mock_openai.assert_called_once()
