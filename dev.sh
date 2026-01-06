#!/bin/bash
# NovaPress AI v2 - Development Startup Script
# Starts both Frontend (Next.js) and Backend (Flask)

echo "🚀 Starting NovaPress AI v2 Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}⚠️  Python 3 is not installed. Please install Python 3.10+${NC}"
    exit 1
fi

# Check if Node is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

# Setup Python virtual environment if not exists
if [ ! -d "backend/venv" ]; then
    echo -e "${BLUE}📦 Creating Python virtual environment...${NC}"
    python3 -m venv backend/venv
    source backend/venv/bin/activate
    pip install -r backend/requirements.txt
else
    source backend/venv/bin/activate
fi

# Install Node dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing Node.js dependencies...${NC}"
    npm install
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}🔧 Starting services...${NC}"
echo ""

# Start Backend in background
echo -e "${BLUE}🐍 Starting Backend API (Flask) on http://localhost:5000...${NC}"
(cd backend && python3 api.py) &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start Frontend
echo -e "${BLUE}⚛️  Starting Frontend (Next.js) on http://localhost:3000...${NC}"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 NovaPress AI v2 is running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BLUE}Frontend:${NC}  http://localhost:3000"
echo -e "  ${BLUE}Backend:${NC}   http://localhost:5000/api"
echo -e "  ${BLUE}API Health:${NC} http://localhost:5000/api/health"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Handle Ctrl+C gracefully
trap "echo ''; echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

# Wait for processes
wait
