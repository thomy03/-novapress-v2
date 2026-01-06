#!/bin/bash

# NovaPress AI v2 - Quick Start Script
# Démarre tous les services nécessaires

set -e

echo "🚀 NovaPress AI v2 - Starting Backend..."

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Vérifier Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
    exit 1
fi

# Copier .env si nécessaire
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration!"
fi

# Démarrer les services
echo "🐳 Starting Docker services..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Télécharger Mistral dans Ollama
echo "🧠 Downloading Mistral LLM (this may take a while)..."
docker exec novapress_ollama ollama pull mistral:7b-instruct || true

echo ""
echo "✅ NovaPress Backend is running!"
echo ""
echo "📊 Services:"
echo "  - Backend API:  http://localhost:5000"
echo "  - API Docs:     http://localhost:5000/api/docs"
echo "  - PostgreSQL:   localhost:5432"
echo "  - Redis:        localhost:6379"
echo "  - Qdrant:       http://localhost:6333"
echo "  - Ollama:       http://localhost:11434"
echo ""
echo "📝 Logs:"
echo "  docker-compose logs -f backend"
echo ""
echo "🛑 Stop:"
echo "  docker-compose down"
echo ""
