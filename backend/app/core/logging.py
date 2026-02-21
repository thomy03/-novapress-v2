"""
Structured logging configuration for NovaPress AI v2.
Uses loguru with JSON output in production for log aggregation.
"""

import sys
from loguru import logger


def setup_logging(log_level: str = "INFO", json_mode: bool = False):
    """
    Configure loguru for the application.

    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_mode: If True, output structured JSON logs (for production)
    """
    # Remove default loguru handler
    logger.remove()

    if json_mode:
        # JSON format for production (compatible with ELK, Datadog, etc.)
        logger.add(
            sys.stdout,
            level=log_level,
            format="{message}",
            serialize=True,  # loguru built-in JSON serialization
        )
    else:
        # Human-readable format for development
        logger.add(
            sys.stdout,
            level=log_level,
            format=(
                "<green>{time:HH:mm:ss}</green> | "
                "<level>{level: <8}</level> | "
                "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                "<level>{message}</level>"
            ),
            colorize=True,
        )

    # File rotation for persistent logs (always enabled)
    logger.add(
        "logs/novapress_{time:YYYY-MM-DD}.log",
        level=log_level,
        rotation="00:00",  # New file at midnight
        retention="7 days",  # Keep 7 days of logs
        compression="gz",
        serialize=json_mode,
        format=(
            "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
            "{level: <8} | "
            "{name}:{function}:{line} | "
            "{message}"
        ),
    )

    logger.info(f"Logging configured: level={log_level}, json_mode={json_mode}")
