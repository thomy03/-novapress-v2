# NovaPress AI - Installation & Setup Guide

## Prerequisites

### System Requirements
- **OS**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: 10GB free space
- **CPU**: 4+ cores recommended

### Software Requirements
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher (comes with Node.js)
- **Git**: Latest version
- **Python**: 3.9+ (for backend)
- **PostgreSQL**: 14+ (for database)
- **Redis**: 6+ (for caching)

## Installation Steps

### 1. Clone the Repository

```bash
# Clone via HTTPS
git clone https://github.com/thomy03/novapress-v2.git

# Or via SSH
git clone git@github.com:thomy03/novapress-v2.git

# Navigate to project directory
cd novapress-v2
```

### 2. Install Frontend Dependencies

```bash
# Install Node.js dependencies
npm install

# Or using yarn
yarn install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```bash
# Copy example environment file
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# AI Services (Optional for now)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
BGE_MODEL_PATH=/path/to/bge-m3/model

# Database (Backend)
DATABASE_URL=postgresql://novapress:password@localhost:5432/novapress_db
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_jwt_secret_key_here
ENCRYPTION_KEY=your_encryption_key_here
```

### 4. Database Setup (Backend - Optional)

If you want to run the full stack:

```bash
# Install PostgreSQL
# On Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# On macOS with Homebrew
brew install postgresql
brew services start postgresql

# Create database
createdb novapress_db

# Run migrations (when backend is ready)
# python manage.py migrate
```

### 5. Redis Setup (Backend - Optional)

```bash
# Install Redis
# On Ubuntu/Debian
sudo apt-get install redis-server

# On macOS with Homebrew
brew install redis
brew services start redis

# Test Redis connection
redis-cli ping
# Should return: PONG
```

## Running the Application

### Development Mode

```bash
# Start the frontend development server
npm run dev

# The application will be available at:
# http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start npm --name "novapress" -- start
```

### Running with Docker (Alternative)

```bash
# Build Docker image
docker build -t novapress-v2 .

# Run container
docker run -p 3000:3000 novapress-v2

# Or use Docker Compose
docker-compose up
```

## Backend Setup (Python/FastAPI)

### 1. Create Virtual Environment

```bash
# Navigate to backend directory (when available)
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

### 2. Install Python Dependencies

```bash
# Install requirements
pip install -r requirements.txt

# Or install specific packages
pip install fastapi uvicorn sqlalchemy redis
```

### 3. Run Backend Server

```bash
# Start FastAPI server
uvicorn main:app --reload --port 8000

# API will be available at:
# http://localhost:8000
# API docs at:
# http://localhost:8000/docs
```

## Verification Steps

### 1. Check Frontend

1. Open browser to http://localhost:3000
2. Verify homepage loads correctly
3. Check news ticker is animating
4. Verify responsive design on mobile view

### 2. Check Console

```bash
# No errors should appear in:
# - Browser console (F12)
# - Terminal running npm run dev
```

### 3. Test Build

```bash
# Run build to check for errors
npm run build

# Run linter
npm run lint

# Run type check
npm run type-check
```

## Common Issues & Solutions

### Issue: Port 3000 Already in Use

```bash
# Find process using port 3000
# On Windows
netstat -ano | findstr :3000
# On macOS/Linux
lsof -i :3000

# Kill the process or use different port
npm run dev -- -p 3001
```

### Issue: Module Not Found Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue: Build Errors

```bash
# Clear Next.js cache
rm -rf .next .turbo
npm run build
```

### Issue: Environment Variables Not Loading

```bash
# Ensure .env.local exists and is properly formatted
# Restart the development server after changes
npm run dev
```

## Development Tools Setup

### VS Code Extensions

Recommended extensions for development:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-python.python",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### Git Hooks (Optional)

```bash
# Install Husky for pre-commit hooks
npm install -D husky lint-staged
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint-staged"
```

## Performance Optimization

### 1. Enable Turbopack

Already configured in package.json:

```json
{
  "scripts": {
    "dev": "next dev --turbo"
  }
}
```

### 2. Production Optimizations

```bash
# Analyze bundle size
npm install -D @next/bundle-analyzer
npm run analyze
```

## Monitoring Setup

### 1. Basic Monitoring

```bash
# Install monitoring dependencies
npm install -D @sentry/nextjs
```

### 2. Configure Sentry (Optional)

```javascript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

## Deployment Preparation

### 1. Environment Variables

Ensure all production environment variables are set:

```bash
# Production .env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
# ... other production values
```

### 2. Build Optimization

```bash
# Production build with analysis
npm run build
npm run analyze
```

### 3. Health Check

```bash
# Add health check endpoint
# pages/api/health.ts or app/api/health/route.ts
```

## Next Steps

1. ✅ Frontend is running successfully
2. 🔄 Configure backend services (when ready)
3. 🔄 Set up database connections
4. 🔄 Configure AI services
5. 🔄 Implement authentication
6. 🔄 Deploy to production

## Support

### Documentation
- [README.md](../README.md) - Project overview
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture
- [ROADMAP.md](ROADMAP.md) - Development roadmap

### Troubleshooting
If you encounter issues not covered here:
1. Check the [Issues](https://github.com/thomy03/novapress-v2/issues) page
2. Search existing discussions
3. Create a new issue with details

---

**Document Version**: 1.0.0  
**Last Updated**: January 2025  
**Status**: Active Development