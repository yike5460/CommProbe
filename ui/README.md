# Legal Tech Intelligence Dashboard - Frontend UI/UX

A comprehensive frontend application for monitoring legal technology discussions, analyzing user feedback, and providing actionable insights for product managers.

## 📋 Overview

This frontend application provides a modern, responsive dashboard for the Legal Community Feedback Collector & Analyzer system. Built with Next.js 14, Tailwind CSS, and shadcn/ui components, it offers a professional interface for product managers to access insights, analytics, and competitive intelligence.

### Key Features

- **Product Intelligence Dashboard** - KPI tracking and high-priority insights
- **Feature Discovery Explorer** - Searchable feature request database
- **Analytics & Trends** - Historical analysis and competitive intelligence
- **Operations Panel** - System monitoring and configuration
- **Smart Filtering** - Advanced search and filtering capabilities
- **Real-time Updates** - Live data refresh and notifications

## 🏗 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | Next.js 14 (App Router) | React-based full-stack framework |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Components** | shadcn/ui | High-quality React components |
| **State Management** | React Query + Zustand | Server state + global client state |
| **Charts** | Recharts | Data visualization library |
| **Deployment** | Cloudflare Pages | Edge deployment platform |
| **API Proxy** | Cloudflare Workers | API gateway and caching |

## 📁 Project Structure

```
/ui/
├── DESIGN_DOCUMENT.md           # Comprehensive UI/UX design specs
├── COMPONENT_SPECIFICATIONS.md  # Detailed component implementations
├── README.md                    # This file
└── /src/                        # Source code (to be created)
    ├── /app/                    # Next.js 14 App Router
    ├── /components/             # Reusable React components
    ├── /hooks/                  # Custom React hooks
    ├── /services/               # API integration layer
    ├── /stores/                 # State management
    ├── /types/                  # TypeScript definitions
    └── /utils/                  # Utility functions
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Access to the Supio Reddit Intelligence API

### Installation

1. **Create Next.js Project**
   ```bash
   cd ui/
   npx create-next-app@latest src --typescript --tailwind --eslint --app
   cd src/
   ```

2. **Install Dependencies**
   ```bash
   # Core dependencies
   npm install @tanstack/react-query zustand
   npm install recharts date-fns clsx tailwind-merge
   npm install @radix-ui/react-icons lucide-react

   # shadcn/ui setup
   npx shadcn-ui@latest init
   npx shadcn-ui@latest add button card dialog dropdown-menu
   npx shadcn-ui@latest add input label select slider tabs
   npx shadcn-ui@latest add table badge alert progress
   ```

3. **Environment Configuration**
   ```bash
   # .env.local
   NEXT_PUBLIC_API_URL=https://6bsn9muwfi.execute-api.us-west-2.amazonaws.com/v1
   NEXT_PUBLIC_API_KEY=your-api-key-here
   ```

4. **Start Development Server**
   ```bash
   # Default port (3000)
   npm run dev

   # Or specify a custom port
   PORT=3001 npm run dev

   # Production server with custom port
   PORT=8080 npm start
   ```

### Initial Setup Checklist

- [ ] Create Next.js project with App Router
- [ ] Install and configure shadcn/ui components
- [ ] Set up Tailwind CSS configuration
- [ ] Configure React Query for API integration
- [ ] Implement basic layout components
- [ ] Set up routing structure
- [ ] Configure environment variables

## 📚 Documentation

### Design Documents
- **[DESIGN_DOCUMENT.md](./DESIGN_DOCUMENT.md)** - Complete UI/UX design specifications
- **[COMPONENT_SPECIFICATIONS.md](./COMPONENT_SPECIFICATIONS.md)** - Detailed component implementations

### API Integration
The frontend integrates with 14 comprehensive REST endpoints:

**Core Endpoints:**
- `GET /` - API documentation
- `POST /trigger` - Start new crawl job
- `GET /status/{executionName}` - Check execution status
- `GET /executions` - List recent executions

**Data Access:**
- `GET /insights` - List insights with filtering
- `GET /insights/{insightId}` - Get insight details
- `GET /analytics/summary` - Dashboard analytics
- `GET /analytics/trends` - Historical trends
- `GET /analytics/competitors` - Competitive analysis

**Operations:**
- `GET /config` - System configuration
- `PUT /config` - Update configuration
- `GET /health` - Health check
- `DELETE /executions/{id}` - Cancel execution
- `GET /logs/{id}` - Execution logs

## 🎨 Design System

### Color Palette
```css
/* Primary Colors */
--primary-500: #0ea5e9;    /* Primary actions */
--primary-600: #0284c7;    /* Primary hover */

/* Priority Colors */
--priority-low: #6b7280;     /* Score 1-3 */
--priority-medium: #f59e0b;  /* Score 4-6 */
--priority-high: #ef4444;    /* Score 7-8 */
--priority-critical: #dc2626; /* Score 9-10 */
```

### Typography
- **Font Family:** Inter (UI text), JetBrains Mono (code/data)
- **Scale:** xs(0.75rem) → sm(0.875rem) → base(1rem) → lg(1.125rem) → xl(1.25rem) → 2xl(1.5rem) → 3xl(1.875rem)

### Components
Built with shadcn/ui for consistency and accessibility:
- Cards for content containers
- Badges for priority scores and categories
- Data tables with sorting and filtering
- Modal dialogs for detailed views
- Charts and visualizations with Recharts

## 🔧 Development Guidelines

### Code Organization
```
/components/
├── ui/           # shadcn/ui base components
├── layout/       # Layout components (AppLayout, Sidebar)
├── dashboard/    # Dashboard-specific components
├── insights/     # Insights explorer components
├── analytics/    # Data visualization components
├── operations/   # System monitoring components
└── shared/       # Reusable utility components
```

### State Management Strategy
- **Server State:** React Query for API data, caching, and synchronization
- **Global State:** Zustand for user preferences and UI state
- **URL State:** Search params for filters and navigation state
- **Local State:** useState for component-specific state

### Performance Best Practices
- Use dynamic imports for heavy components
- Implement proper loading skeletons
- Use React.memo for expensive list renders
- Optimize images with Next.js Image component
- Implement virtual scrolling for large datasets

## 🚀 Deployment

### Cloudflare Pages Configuration

1. **Build Configuration**
   ```toml
   # wrangler.toml
   name = "supio-legal-intelligence"

   [build]
   command = "npm run build"
   destination = "out"

   [build.environment_variables]
   NEXT_PUBLIC_API_URL = "https://6bsn9muwfi.execute-api.us-west-2.amazonaws.com/v1"
   ```

2. **Deploy to Cloudflare**
   ```bash
   npm run build
   wrangler pages deploy out
   ```

### Production Checklist
- [ ] Configure environment variables
- [ ] Set up API proxy through Cloudflare Workers
- [ ] Enable edge caching for static assets
- [ ] Configure custom domain
- [ ] Set up monitoring and error tracking
- [ ] Test responsive design on all devices

## 🧪 Testing

### Testing Strategy
```bash
# Unit tests
npm test

# Component testing
npm run test:components

# E2E testing
npm run test:e2e

# Accessibility testing
npm run test:a11y
```

### Test Coverage Goals
- **Components:** 80%+ unit test coverage
- **API Integration:** Mock all API endpoints
- **User Flows:** E2E tests for critical paths
- **Accessibility:** WCAG 2.1 AA compliance

## 📱 Responsive Design

### Breakpoints
- **Mobile:** 640px and below
- **Tablet:** 641px - 1024px
- **Desktop:** 1025px and above
- **Large Desktop:** 1280px and above

### Mobile-First Approach
- Design mobile layouts first
- Progressive enhancement for larger screens
- Touch-friendly interactions
- Optimized navigation for mobile

## 🔐 Security Considerations

- API key management through environment variables
- CORS configuration for cross-origin requests
- Content Security Policy (CSP) headers
- Input validation and sanitization
- Secure authentication token handling

## 🎯 User Experience Goals

### Primary Metrics
- **Time to Insight:** < 30 seconds to find relevant feature requests
- **Filter Efficiency:** < 3 clicks to apply complex filters
- **Load Performance:** < 2 seconds initial page load
- **Mobile Usability:** Full functionality on mobile devices

### Accessibility Standards
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management for interactive elements

## 🔄 Development Workflow

### Git Workflow
```bash
# Feature development
git checkout -b feature/insights-table
git add .
git commit -m "feat: implement insights data table with filtering"
git push origin feature/insights-table
```

### Code Quality
- ESLint + Prettier for code formatting
- TypeScript for type safety
- Husky for pre-commit hooks
- Conventional commits for clear history

## 📈 Performance Monitoring

### Key Metrics
- **Core Web Vitals:** LCP, FID, CLS
- **API Response Times:** < 1 second average
- **Bundle Size:** < 500KB gzipped
- **Lighthouse Score:** 90+ performance

### Monitoring Tools
- Cloudflare Analytics for traffic insights
- React DevTools for component profiling
- Bundle analyzer for size optimization
- Performance monitoring in production

## 🤝 Contributing

### Getting Started
1. Read the design documents thoroughly
2. Set up development environment
3. Choose a component from the specifications
4. Implement following the design system
5. Write tests for new functionality
6. Submit pull request with clear description

### Code Standards
- Follow TypeScript best practices
- Use consistent naming conventions
- Write self-documenting code
- Include proper error handling
- Maintain responsive design principles

---

## 📞 Support

For questions about the frontend implementation:
- Review the design documents first
- Check component specifications for implementation details
- Refer to the main system README for overall architecture
- Open an issue for clarification or bugs

---

*Last Updated: 2025-01-16*
*Ready for implementation - Phase 1 frontend development*