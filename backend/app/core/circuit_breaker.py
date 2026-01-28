"""
Circuit Breaker Pattern Implementation
Prevents cascading failures when external APIs are down

States:
- CLOSED: Normal operation, requests pass through
- OPEN: Circuit is tripped, requests fail immediately
- HALF_OPEN: Testing if service is recovered
"""
import asyncio
import time
from enum import Enum
from typing import Callable, Any, Optional
from dataclasses import dataclass, field
from loguru import logger


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker"""
    failure_threshold: int = 5  # Number of failures before opening
    success_threshold: int = 2  # Successes needed to close from half-open
    timeout: float = 60.0  # Seconds to wait before half-open
    half_open_max_calls: int = 3  # Max calls allowed in half-open state


@dataclass
class CircuitBreakerStats:
    """Statistics for monitoring"""
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    rejected_calls: int = 0
    state_changes: int = 0
    last_failure_time: Optional[float] = None
    last_success_time: Optional[float] = None


class CircuitBreaker:
    """
    Circuit breaker for external API calls.

    Usage:
        breaker = CircuitBreaker("openrouter")
        result = await breaker.call(async_function, *args, **kwargs)
    """

    def __init__(self, name: str, config: Optional[CircuitBreakerConfig] = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[float] = None
        self.half_open_calls = 0
        self.stats = CircuitBreakerStats()
        self._lock = asyncio.Lock()

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function through circuit breaker.
        Raises CircuitOpenError if circuit is open.
        """
        async with self._lock:
            self.stats.total_calls += 1

            if self.state == CircuitState.OPEN:
                if self._should_try_reset():
                    self._transition_to_half_open()
                else:
                    self.stats.rejected_calls += 1
                    raise CircuitOpenError(
                        f"Circuit '{self.name}' is OPEN. "
                        f"Retry after {self._time_until_retry():.1f}s"
                    )

            if self.state == CircuitState.HALF_OPEN:
                if self.half_open_calls >= self.config.half_open_max_calls:
                    self.stats.rejected_calls += 1
                    raise CircuitOpenError(
                        f"Circuit '{self.name}' is HALF_OPEN and at max capacity"
                    )
                self.half_open_calls += 1

        try:
            result = await func(*args, **kwargs)
            await self._on_success()
            return result
        except Exception as e:
            await self._on_failure(e)
            raise

    async def _on_success(self):
        """Handle successful call"""
        async with self._lock:
            self.stats.successful_calls += 1
            self.stats.last_success_time = time.time()

            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.config.success_threshold:
                    self._transition_to_closed()
            else:
                self.failure_count = 0

    async def _on_failure(self, error: Exception):
        """Handle failed call"""
        async with self._lock:
            self.stats.failed_calls += 1
            self.stats.last_failure_time = time.time()
            self.failure_count += 1
            self.last_failure_time = time.time()

            logger.warning(
                f"Circuit '{self.name}' failure {self.failure_count}/{self.config.failure_threshold}: {error}"
            )

            if self.state == CircuitState.HALF_OPEN:
                self._transition_to_open()
            elif self.failure_count >= self.config.failure_threshold:
                self._transition_to_open()

    def _should_try_reset(self) -> bool:
        """Check if enough time has passed to try half-open"""
        if self.last_failure_time is None:
            return True
        return (time.time() - self.last_failure_time) >= self.config.timeout

    def _time_until_retry(self) -> float:
        """Get seconds until retry is allowed"""
        if self.last_failure_time is None:
            return 0.0
        elapsed = time.time() - self.last_failure_time
        return max(0.0, self.config.timeout - elapsed)

    def _transition_to_open(self):
        """Transition to OPEN state"""
        prev_state = self.state
        self.state = CircuitState.OPEN
        self.success_count = 0
        self.half_open_calls = 0
        self.stats.state_changes += 1
        logger.warning(
            f"⚡ Circuit '{self.name}' transitioned from {prev_state.value} to OPEN"
        )

    def _transition_to_half_open(self):
        """Transition to HALF_OPEN state"""
        prev_state = self.state
        self.state = CircuitState.HALF_OPEN
        self.success_count = 0
        self.half_open_calls = 0
        self.stats.state_changes += 1
        logger.info(
            f"🔄 Circuit '{self.name}' transitioned from {prev_state.value} to HALF_OPEN"
        )

    def _transition_to_closed(self):
        """Transition to CLOSED state"""
        prev_state = self.state
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.half_open_calls = 0
        self.stats.state_changes += 1
        logger.success(
            f"✅ Circuit '{self.name}' transitioned from {prev_state.value} to CLOSED"
        )

    def get_status(self) -> dict:
        """Get current circuit status"""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "time_until_retry": self._time_until_retry() if self.state == CircuitState.OPEN else 0,
            "stats": {
                "total_calls": self.stats.total_calls,
                "successful_calls": self.stats.successful_calls,
                "failed_calls": self.stats.failed_calls,
                "rejected_calls": self.stats.rejected_calls,
                "state_changes": self.stats.state_changes,
            }
        }


class CircuitOpenError(Exception):
    """Raised when circuit is open and rejecting calls"""
    pass


# Global circuit breaker instances for external APIs
_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str, config: Optional[CircuitBreakerConfig] = None) -> CircuitBreaker:
    """
    Get or create a circuit breaker by name.

    Available breakers:
    - openrouter: For OpenRouter LLM API
    - perplexity: For Perplexity search API
    - xai: For xAI Grok API
    """
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name, config)
    return _circuit_breakers[name]


def get_all_circuit_statuses() -> dict:
    """Get status of all circuit breakers"""
    return {name: breaker.get_status() for name, breaker in _circuit_breakers.items()}


# Pre-configure circuit breakers for known APIs
def init_circuit_breakers():
    """Initialize circuit breakers with appropriate configs"""
    # OpenRouter - main LLM, higher threshold since it's critical
    get_circuit_breaker("openrouter", CircuitBreakerConfig(
        failure_threshold=5,
        success_threshold=2,
        timeout=60.0,
    ))

    # Perplexity - optional enrichment, lower threshold
    get_circuit_breaker("perplexity", CircuitBreakerConfig(
        failure_threshold=3,
        success_threshold=1,
        timeout=30.0,
    ))

    # xAI Grok - optional enrichment, lower threshold
    get_circuit_breaker("xai", CircuitBreakerConfig(
        failure_threshold=3,
        success_threshold=1,
        timeout=30.0,
    ))

    logger.info("🔌 Circuit breakers initialized for external APIs")
