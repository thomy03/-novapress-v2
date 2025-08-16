# NovaPress AI - Advanced News Intelligence Platform

## 🚀 Overview

NovaPress AI is a state-of-the-art news intelligence platform combining professional journalism standards with advanced AI capabilities. Built with Next.js 15, TypeScript, and modern web technologies, it delivers real-time news aggregation, intelligent synthesis, and personalized content delivery.

## 📸 Screenshots

The platform features a professional newspaper-style design inspired by leading publications like The New York Times, Le Monde, BBC News, and Financial Times.

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15.1.3 with Turbopack
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4 + Inline Styles
- **UI Components**: Custom React components
- **Images**: Dynamic content from Picsum Photos
- **Animations**: CSS keyframes for ticker and live indicators

### Backend (Planned Integration)
- **API**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy
- **AI/ML**: BGE-M3 embeddings, HDBSCAN clustering
- **Cache**: Redis
- **Search**: FAISS vector store

## 🎨 Design Philosophy

The design follows strict professional journalism standards:
- **Clean Typography**: System fonts optimized for readability
- **Minimalist Layout**: Focus on content, not decoration
- **Professional Color Scheme**: Black, white, red accents (no gradients)
- **Responsive Grid**: 12-column system adapting to all devices
- **Real-time Elements**: Live ticker, market data, breaking news

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/thomy03/novapress-v2.git
cd novapress-v2

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
# Navigate to http://localhost:3000
```

### Build for Production

```bash
# Create optimized build
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
novapress-v2/
├── app/
│   ├── page.tsx          # Main homepage component
│   ├── layout.tsx        # Root layout with metadata
│   └── globals.css       # Global styles and animations
├── public/               # Static assets
├── docs/                 # Documentation
├── package.json          # Dependencies
└── tsconfig.json        # TypeScript configuration
```

## 🌟 Key Features

### Current (Phase 6)
- ✅ Professional newspaper-style homepage
- ✅ Real-time news ticker (DERNIÈRE MINUTE)
- ✅ Responsive article grid
- ✅ Market data section
- ✅ Newsletter signup
- ✅ Multi-column footer
- ✅ Live status indicators

### Upcoming (Phase 7-10)
- 🔄 AI-powered article synthesis
- 🔄 Real-time news aggregation
- 🔄 Personalized recommendations
- 🔄 Multi-language support
- 🔄 Advanced search with filters
- 🔄 User authentication
- 🔄 Premium subscriptions

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# AI Services
OPENAI_API_KEY=your_key_here
BGE_MODEL_PATH=/models/bge-m3

# Database
DATABASE_URL=postgresql://user:pass@localhost/novapress
```

## 📝 Development Notes

### Design Decisions
1. **Inline Styles**: Used for reliability and immediate visual feedback
2. **Client Components**: Ensures interactivity and real-time updates
3. **No External Dependencies**: Minimizes complexity and build issues
4. **Professional Typography**: System fonts for optimal performance

### Known Issues & Solutions
- **CSS Module Conflicts**: Resolved by using inline styles
- **Ticker Visibility**: Fixed with explicit height (45px) and positioning
- **Build Errors**: Cleared with fresh Next.js installation

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## 📄 License

Copyright © 2025 NovaPress AI. All rights reserved.

## 🏗️ Roadmap

See [ROADMAP.md](docs/ROADMAP.md) for detailed development phases.

## 📧 Contact

For questions or support, please contact the development team.

---

**Current Version**: v2.0.0-alpha  
**Last Updated**: January 2025  
**Status**: Active Development (Phase 6/10)
