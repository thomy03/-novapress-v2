"""
NovaPress AI - Prometheus Metrics Module
Exposes key metrics for monitoring pipeline health, API performance, and system status.

Metrics exposed:
- Pipeline: runs, duration, articles processed, syntheses generated
- API: request count, latency, errors by endpoint
- LLM: calls, tokens, latency, errors
- Scraping: articles fetched, sources status, errors

Usage:
    from app.core.metrics import (
        pipeline_runs_total,
        pipeline_duration_seconds,
        track_request_duration
    )

    # Track a pipeline run
    pipeline_runs_total.labels(status="success").inc()
    pipeline_duration_seconds.observe(elapsed)

    # Track API request (use as decorator or context manager)
    @track_request_duration("syntheses", "GET")
    async def get_syntheses():
        ...
"""
import time
from functools import wraps
from typing import Callable, Optional
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Info,
    REGISTRY,
    generate_latest,
    CONTENT_TYPE_LATEST,
)
from loguru import logger


# =============================================================================
# PIPELINE METRICS
# =============================================================================

pipeline_runs_total = Counter(
    "novapress_pipeline_runs_total",
    "Total number of pipeline runs",
    ["status"],  # success, failure, partial
)

pipeline_duration_seconds = Histogram(
    "novapress_pipeline_duration_seconds",
    "Pipeline execution time in seconds",
    buckets=[30, 60, 120, 300, 600, 900, 1800],  # 30s to 30min
)

pipeline_articles_processed = Counter(
    "novapress_pipeline_articles_processed_total",
    "Total articles processed by pipeline",
    ["source_type"],  # news, reddit, hackernews, arxiv, etc.
)

pipeline_syntheses_generated = Counter(
    "novapress_pipeline_syntheses_generated_total",
    "Total syntheses generated",
    ["category"],  # POLITIQUE, TECH, ECONOMIE, etc.
)

pipeline_clusters_formed = Counter(
    "novapress_pipeline_clusters_formed_total",
    "Total article clusters formed",
)

# =============================================================================
# API REQUEST METRICS
# =============================================================================

api_requests_total = Counter(
    "novapress_api_requests_total",
    "Total API requests",
    ["endpoint", "method", "status_code"],
)

api_request_duration_seconds = Histogram(
    "novapress_api_request_duration_seconds",
    "API request duration in seconds",
    ["endpoint", "method"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

api_errors_total = Counter(
    "novapress_api_errors_total",
    "Total API errors",
    ["endpoint", "error_type"],
)

# =============================================================================
# LLM METRICS
# =============================================================================

llm_calls_total = Counter(
    "novapress_llm_calls_total",
    "Total LLM API calls",
    ["model", "operation"],  # operation: synthesis, persona, entities
)

llm_call_duration_seconds = Histogram(
    "novapress_llm_call_duration_seconds",
    "LLM call duration in seconds",
    ["model", "operation"],
    buckets=[1, 2, 5, 10, 20, 30, 60, 120],
)

llm_errors_total = Counter(
    "novapress_llm_errors_total",
    "Total LLM errors",
    ["model", "error_type"],  # rate_limit, timeout, api_error
)

llm_tokens_used = Counter(
    "novapress_llm_tokens_used_total",
    "Total tokens used by LLM",
    ["model", "type"],  # type: prompt, completion
)

# =============================================================================
# SCRAPING METRICS
# =============================================================================

scraping_articles_fetched = Counter(
    "novapress_scraping_articles_fetched_total",
    "Total articles fetched from sources",
    ["source"],
)

scraping_source_errors = Counter(
    "novapress_scraping_source_errors_total",
    "Total scraping errors by source",
    ["source", "error_type"],  # timeout, blocked, parse_error
)

scraping_duration_seconds = Histogram(
    "novapress_scraping_duration_seconds",
    "Scraping duration per source in seconds",
    ["source"],
    buckets=[1, 5, 10, 20, 30, 45, 60],
)

# =============================================================================
# SYSTEM GAUGES
# =============================================================================

active_websocket_connections = Gauge(
    "novapress_websocket_connections_active",
    "Number of active WebSocket connections",
)

pipeline_status = Gauge(
    "novapress_pipeline_status",
    "Current pipeline status (0=idle, 1=running, 2=error)",
)

circuit_breaker_status = Gauge(
    "novapress_circuit_breaker_status",
    "Circuit breaker status per service (0=closed, 1=open, 2=half-open)",
    ["service"],
)

qdrant_collection_size = Gauge(
    "novapress_qdrant_collection_size",
    "Number of vectors in Qdrant collection",
    ["collection"],
)

# =============================================================================
# APP INFO
# =============================================================================

app_info = Info(
    "novapress_app",
    "NovaPress application information",
)


def set_app_info(version: str, environment: str = "development"):
    """Set application info metric"""
    app_info.info({
        "version": version,
        "environment": environment,
        "name": "NovaPress AI",
    })


# =============================================================================
# HELPER FUNCTIONS & DECORATORS
# =============================================================================

def track_request_duration(endpoint: str, method: str):
    """
    Decorator to track API request duration and count.

    Usage:
        @track_request_duration("syntheses", "GET")
        async def get_syntheses():
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            status_code = "200"
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                status_code = "500"
                api_errors_total.labels(endpoint=endpoint, error_type=type(e).__name__).inc()
                raise
            finally:
                duration = time.perf_counter() - start_time
                api_request_duration_seconds.labels(endpoint=endpoint, method=method).observe(duration)
                api_requests_total.labels(endpoint=endpoint, method=method, status_code=status_code).inc()

        return wrapper
    return decorator


class PipelineMetricsContext:
    """
    Context manager for tracking pipeline execution metrics.

    Usage:
        async with PipelineMetricsContext() as metrics:
            # Run pipeline
            metrics.add_articles("news", 50)
            metrics.add_synthesis("TECH")
    """

    def __init__(self):
        self.start_time: Optional[float] = None
        self.status = "success"

    async def __aenter__(self):
        self.start_time = time.perf_counter()
        pipeline_status.set(1)  # Running
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        duration = time.perf_counter() - self.start_time
        pipeline_duration_seconds.observe(duration)

        if exc_type is not None:
            self.status = "failure"
            pipeline_status.set(2)  # Error
        else:
            pipeline_status.set(0)  # Idle

        pipeline_runs_total.labels(status=self.status).inc()
        return False  # Don't suppress exceptions

    def add_articles(self, source_type: str, count: int):
        """Record articles processed from a source"""
        pipeline_articles_processed.labels(source_type=source_type).inc(count)

    def add_synthesis(self, category: str):
        """Record a synthesis generation"""
        pipeline_syntheses_generated.labels(category=category).inc()

    def add_cluster(self):
        """Record a cluster formation"""
        pipeline_clusters_formed.inc()

    def set_partial(self):
        """Mark pipeline as partial success"""
        self.status = "partial"


class LLMMetricsContext:
    """
    Context manager for tracking LLM call metrics.

    Usage:
        async with LLMMetricsContext("gpt-4", "synthesis") as metrics:
            result = await llm.generate(...)
            metrics.set_tokens(prompt=500, completion=1000)
    """

    def __init__(self, model: str, operation: str):
        self.model = model
        self.operation = operation
        self.start_time: Optional[float] = None

    async def __aenter__(self):
        self.start_time = time.perf_counter()
        llm_calls_total.labels(model=self.model, operation=self.operation).inc()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        duration = time.perf_counter() - self.start_time
        llm_call_duration_seconds.labels(model=self.model, operation=self.operation).observe(duration)

        if exc_type is not None:
            error_type = "rate_limit" if "rate" in str(exc_val).lower() else "api_error"
            llm_errors_total.labels(model=self.model, error_type=error_type).inc()

        return False

    def set_tokens(self, prompt: int = 0, completion: int = 0):
        """Record token usage"""
        if prompt > 0:
            llm_tokens_used.labels(model=self.model, type="prompt").inc(prompt)
        if completion > 0:
            llm_tokens_used.labels(model=self.model, type="completion").inc(completion)


def generate_metrics() -> bytes:
    """Generate Prometheus metrics output"""
    return generate_latest(REGISTRY)


def get_content_type() -> str:
    """Get Prometheus content type"""
    return CONTENT_TYPE_LATEST


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def record_scraping_result(source: str, articles_count: int, duration: float, error: Optional[str] = None):
    """Record scraping results for a source"""
    scraping_duration_seconds.labels(source=source).observe(duration)

    if error:
        scraping_source_errors.labels(source=source, error_type=error).inc()
    else:
        scraping_articles_fetched.labels(source=source).inc(articles_count)


def update_circuit_breaker_status(service: str, status: int):
    """Update circuit breaker status (0=closed, 1=open, 2=half-open)"""
    circuit_breaker_status.labels(service=service).set(status)


def update_qdrant_size(collection: str, size: int):
    """Update Qdrant collection size gauge"""
    qdrant_collection_size.labels(collection=collection).set(size)


def update_websocket_connections(count: int):
    """Update active WebSocket connections gauge"""
    active_websocket_connections.set(count)
