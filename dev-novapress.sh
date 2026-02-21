#!/bin/bash
# NovaPress AI v2 - Development launcher (Linux/Mac)
# Usage: ./dev-novapress.sh [start|stop|backend|frontend]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

case "${1:-start}" in
  start)
    echo "Starting NovaPress AI v2..."

    # Start Docker services
    echo "Starting Docker services (PostgreSQL, Redis, Qdrant)..."
    docker compose -f "$BACKEND_DIR/docker-compose.yml" up -d 2>/dev/null || \
    docker-compose -f "$BACKEND_DIR/docker-compose.yml" up -d 2>/dev/null || \
    echo "Warning: Docker services not started (is Docker running?)"

    # Start backend
    echo "Starting backend..."
    cd "$BACKEND_DIR"
    if [ -d "venv" ]; then
      source venv/bin/activate
    fi
    uvicorn app.main:app --reload --host 0.0.0.0 --port 5000 &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    cd "$SCRIPT_DIR"

    # Start frontend
    echo "Starting frontend..."
    npm run dev &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"

    echo ""
    echo "NovaPress AI v2 is running!"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:5000"
    echo "  API Docs: http://localhost:5000/api/docs"
    echo ""
    echo "Press Ctrl+C to stop all services"

    # Wait for any child to exit
    wait
    ;;

  stop)
    echo "Stopping NovaPress AI v2..."
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    docker compose -f "$BACKEND_DIR/docker-compose.yml" stop 2>/dev/null || true
    echo "All services stopped."
    ;;

  backend)
    echo "Starting backend only..."
    cd "$BACKEND_DIR"
    if [ -d "venv" ]; then
      source venv/bin/activate
    fi
    uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
    ;;

  frontend)
    echo "Starting frontend only..."
    cd "$SCRIPT_DIR"
    npm run dev
    ;;

  *)
    echo "Usage: $0 [start|stop|backend|frontend]"
    exit 1
    ;;
esac
