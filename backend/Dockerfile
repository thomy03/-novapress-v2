# NovaPress AI v2 - Backend Dockerfile
# Python FastAPI with ML models (BGE-M3, spaCy)
# Multi-stage build for smaller production image

# ============== BUILDER STAGE ==============
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download spaCy French model into venv
RUN python -m spacy download fr_core_news_lg

# ============== PRODUCTION STAGE ==============
FROM python:3.11-slim AS production

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash novapress

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY --chown=novapress:novapress . .

# Create necessary directories
RUN mkdir -p /app/data /app/models && \
    chown -R novapress:novapress /app/data /app/models

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=5000

# Switch to non-root user
USER novapress

# Expose port
EXPOSE 5000

# Health check (ML models need time to load)
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run FastAPI with production settings
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "1"]
