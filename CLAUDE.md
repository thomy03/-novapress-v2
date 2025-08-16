# NovaPress AI v2 - Claude Context Document

## Current Project State

**Project**: NovaPress AI v2  
**Location**: `/mnt/c/Users/tkado/Documents/novapress-v2`  
**Status**: Phase 6 - Frontend Revolution (90% Complete)  
**Stack**: Next.js 15, TypeScript, Tailwind CSS, Inline Styles  
**Running**: http://localhost:3000

## Critical Context for Future Conversations

### What We're Building
NovaPress AI is a professional news intelligence platform that combines:
- Real-time news aggregation from multiple sources
- AI-powered article synthesis and clustering
- Professional newspaper-style interface (think NYT, Le Monde, BBC)
- Intelligent personalization and recommendations

### Current Implementation Status

#### ✅ Completed
1. **Professional Homepage Design**
   - Clean newspaper layout inspired by major publications
   - No gradients or amateur styling
   - Black, white, and red color scheme
   - "NOVAPRESS AI" branding (NOVA black, PRESS red, AI blue)

2. **Working Components**
   - News ticker with "DERNIÈRE MINUTE" (45px height, properly visible)
   - Article grid with real images (picsum.photos)
   - Market data section
   - Newsletter signup
   - Multi-column footer
   - Responsive design

3. **Technical Setup**
   - Next.js 15.1.3 with Turbopack
   - TypeScript configuration
   - Tailwind CSS + Inline styles (for reliability)
   - Clean project structure

#### 🔄 In Progress
- Connecting to real backend APIs
- Implementing search functionality
- User authentication system

#### 📋 Planned
- FastAPI backend integration
- BGE-M3 embeddings for AI features
- PostgreSQL database
- Redis caching
- WebSocket real-time updates

### Design Philosophy

**CRITICAL**: The user has strong opinions about design:
- ❌ NO colorful gradients
- ❌ NO amateur/childish designs  
- ❌ NO excessive animations
- ✅ Professional newspaper aesthetic
- ✅ Clean, minimalist approach
- ✅ Focus on content, not decoration

**Reference Sites**: The New York Times, Le Monde, BBC News, Financial Times

### Technical Decisions Made

1. **Inline Styles Over CSS Modules**
   - Reason: CSS modules were causing build conflicts
   - Solution: Inline styles provide immediate feedback and no conflicts

2. **Fresh Project Over Legacy**
   - Created novapress-v2 from scratch
   - Eliminated all technical debt from frontend-nova

3. **Minimal Dependencies**
   - No Framer Motion (caused errors)
   - No Lucide React (import issues)
   - Custom components only

### Known Issues & Solutions

| Issue | Solution | Status |
|-------|----------|--------|
| News ticker not visible | Set height to 45px explicitly | ✅ Fixed |
| Changes not reflecting | Created fresh project | ✅ Fixed |
| CSS module conflicts | Use inline styles | ✅ Fixed |
| Build errors with styled-jsx | Removed, using inline styles | ✅ Fixed |

### File Structure
```
novapress-v2/
├── app/
│   ├── page.tsx         # Main homepage (inline styles)
│   ├── layout.tsx       # Root layout  
│   └── globals.css      # Minimal global styles
├── docs/
│   ├── ARCHITECTURE.md  # Technical architecture
│   ├── SETUP.md        # Installation guide
│   ├── HISTORY.md      # Project history
│   └── ROADMAP.md      # Future plans
└── README.md           # Project overview
```

### Important Code Locations

- **Homepage**: `/app/page.tsx` - Contains entire frontend with inline styles
- **News Ticker**: In page.tsx, look for "DERNIÈRE MINUTE" section
- **Logo**: "NOVAPRESS AI" with color styling
- **Articles Grid**: Main content area with image cards

### User Preferences

1. **Language**: French-speaking user, appreciates French touches
2. **Quality**: Demands professional, "SOTA" (state-of-the-art) quality
3. **Feedback Style**: Direct, expects quick iterations
4. **Design Taste**: Minimalist, professional, newspaper-style

### Common Commands

```bash
# Development
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run start        # Start production server

# If issues arise
rm -rf .next .turbo  # Clear cache
npm install          # Reinstall dependencies
```

### API Endpoints (Planned)

```
GET    /api/articles      # List articles
GET    /api/articles/:id  # Get article
POST   /api/articles      # Create article
GET    /api/trending      # Trending topics
GET    /api/synthesis     # AI synthesis
WS     /ws/updates        # Real-time updates
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
OPENAI_API_KEY=xxx
DATABASE_URL=postgresql://...
```

### Phase Status

| Phase | Description | Status |
|-------|------------|--------|
| 1-5 | Foundation & Backend | ✅ Complete |
| 6 | Frontend Revolution | 🟡 90% Done |
| 7 | Backend Integration | 🔴 Planned |
| 8 | AI/ML Integration | 🔴 Planned |
| 9 | Advanced Features | 🔴 Planned |
| 10 | Mobile & Expansion | 🔴 Planned |

### Critical Reminders

1. **NEVER** add gradients or colorful designs
2. **ALWAYS** maintain professional newspaper aesthetic
3. **TEST** changes are visible before reporting completion
4. **USE** inline styles for reliability
5. **KEEP** design minimal and content-focused

### Recent History

The user was frustrated with initial "amateur" designs. After multiple iterations and seeing screenshots showing the design wasn't displaying, we:
1. Created fresh novapress-v2 project
2. Used inline styles exclusively  
3. Achieved professional newspaper look
4. Got approval: "C'est une très bonne base"

### Next Immediate Tasks

1. Connect to real backend APIs
2. Implement search functionality
3. Add user authentication
4. Deploy to production

### Success Metrics

- Page load < 2 seconds
- Professional appearance matching major news sites
- No build or styling errors
- User satisfaction with design

---

**IMPORTANT**: This document should be read at the start of every conversation about NovaPress AI v2 to maintain context and avoid repeating past mistakes.

**Last Updated**: January 2025  
**Version**: 2.0.0-alpha  
**Maintainer**: Development Team