# NovaPress AI - Technical Architecture

## System Overview

NovaPress AI implements a modern, scalable architecture designed for high-performance news processing and intelligent content delivery.

## Architecture Layers

### 1. Presentation Layer (Frontend)
```
┌─────────────────────────────────────────┐
│           Next.js 15 + React 19         │
│  ┌─────────────┬──────────┬──────────┐  │
│  │   Pages     │   API     │  Static  │  │
│  │  (app/)     │  Routes   │  Assets  │  │
│  └─────────────┴──────────┴──────────┘  │
└─────────────────────────────────────────┘
```

**Technologies:**
- Next.js 15.1.3 with App Router
- React 19 with Server Components
- TypeScript 5 for type safety
- Tailwind CSS + Inline Styles
- Turbopack for fast builds

**Key Components:**
- `app/page.tsx`: Main homepage with news grid
- `app/layout.tsx`: Root layout and metadata
- `app/globals.css`: Global styles and animations

### 2. API Layer (Backend)
```
┌─────────────────────────────────────────┐
│            FastAPI Backend              │
│  ┌──────────┬───────────┬────────────┐  │
│  │   REST   │  GraphQL  │  WebSocket │  │
│  │   API    │   (opt)   │    (WS)    │  │
│  └──────────┴───────────┴────────────┘  │
└─────────────────────────────────────────┘
```

**Technologies:**
- FastAPI for high-performance APIs
- Pydantic for data validation
- WebSockets for real-time updates
- Redis for caching and sessions

### 3. Business Logic Layer
```
┌─────────────────────────────────────────┐
│          Service Components             │
│  ┌──────────┬───────────┬────────────┐  │
│  │  News    │    AI     │   User     │  │
│  │ Aggreg.  │  Process  │  Services  │  │
│  └──────────┴───────────┴────────────┘  │
└─────────────────────────────────────────┘
```

**Services:**
- News Aggregation Service
- AI Synthesis Engine
- User Preference Manager
- Content Recommendation Engine

### 4. AI/ML Layer
```
┌─────────────────────────────────────────┐
│            AI Pipeline                  │
│  ┌──────────┬───────────┬────────────┐  │
│  │  BGE-M3  │  HDBSCAN  │    RAG     │  │
│  │ Embedder │ Clustering│   System   │  │
│  └──────────┴───────────┴────────────┘  │
└─────────────────────────────────────────┘
```

**Components:**
- BGE-M3 for multilingual embeddings
- HDBSCAN for news clustering
- FAISS for vector similarity search
- RAG for intelligent synthesis

### 5. Data Layer
```
┌─────────────────────────────────────────┐
│           Data Storage                  │
│  ┌──────────┬───────────┬────────────┐  │
│  │PostgreSQL│   Redis   │   FAISS    │  │
│  │   (DB)   │  (Cache)  │  (Vectors) │  │
│  └──────────┴───────────┴────────────┘  │
└─────────────────────────────────────────┘
```

**Databases:**
- PostgreSQL: Primary data store
- Redis: Cache and session management
- FAISS: Vector database for embeddings
- S3/MinIO: Media storage (optional)

## Data Flow

### 1. News Ingestion Pipeline
```
External Sources → Scraper → Validator → Database
                              ↓
                          Embedder → Vector Store
                              ↓
                          Clustering → Topics
```

### 2. User Request Flow
```
User Request → API Gateway → Service Layer
                                ↓
                            AI Processing
                                ↓
                            Response Cache
                                ↓
                            Client Response
```

### 3. Real-time Updates
```
News Source → WebSocket → Event Bus → Clients
                            ↓
                        Database Update
```

## Security Architecture

### Authentication & Authorization
- JWT tokens for session management
- OAuth2 for third-party integration
- Role-based access control (RBAC)
- API key management for services

### Data Protection
- TLS 1.3 for all communications
- AES-256 encryption at rest
- GDPR/CCPA compliance
- Regular security audits

## Scalability Strategy

### Horizontal Scaling
```
Load Balancer
    ├── App Server 1
    ├── App Server 2
    └── App Server N
```

### Caching Strategy
1. **Browser Cache**: Static assets
2. **CDN**: Global content delivery
3. **Redis Cache**: API responses
4. **Database Cache**: Query optimization

### Performance Targets
- Page Load: < 2 seconds
- API Response: < 200ms (cached)
- AI Processing: < 5 seconds
- WebSocket Latency: < 100ms

## Deployment Architecture

### Development
```
Local Environment
├── Next.js Dev Server (3000)
├── FastAPI Dev Server (8000)
└── Local Databases
```

### Production
```
Kubernetes Cluster
├── Frontend Pods (Next.js)
├── Backend Pods (FastAPI)
├── Worker Pods (AI/ML)
└── Database Cluster
```

### CI/CD Pipeline
```
Git Push → GitHub Actions → Build → Test → Deploy
                              ↓        ↓
                          Docker   Kubernetes
```

## Monitoring & Observability

### Metrics Collection
- Prometheus for metrics
- Grafana for visualization
- ELK Stack for logs
- Sentry for error tracking

### Key Metrics
- Request rate and latency
- Error rates and types
- AI model performance
- Database query performance
- Cache hit rates

## Technology Decisions

### Why Next.js 15?
- Server Components for performance
- App Router for modern routing
- Built-in optimization
- Excellent TypeScript support

### Why FastAPI?
- High performance (Starlette + Pydantic)
- Automatic API documentation
- Native async/await support
- Easy WebSocket integration

### Why BGE-M3?
- State-of-the-art multilingual embeddings
- Excellent performance/size ratio
- Support for 100+ languages
- Optimized for news content

### Why PostgreSQL?
- ACID compliance
- JSON support for flexible schemas
- Full-text search capabilities
- Proven scalability

## Future Enhancements

### Phase 7-8
- GraphQL API implementation
- Advanced personalization engine
- Multi-language UI support
- Mobile applications

### Phase 9-10
- Blockchain for content verification
- Federated learning for privacy
- Edge computing for latency
- Advanced NLP models

## Development Guidelines

### Code Organization
```
src/
├── components/     # Reusable UI components
├── services/       # Business logic
├── utils/          # Helper functions
├── types/          # TypeScript definitions
└── hooks/          # Custom React hooks
```

### Naming Conventions
- Components: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case

### Testing Strategy
- Unit tests: 80% coverage minimum
- Integration tests: Critical paths
- E2E tests: User journeys
- Performance tests: Load testing

---

**Document Version**: 1.0.0  
**Last Updated**: January 2025  
**Status**: Active Development