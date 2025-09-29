# Cloudflare Pages Deployment Guide

## Overview

This guide covers deploying the Legal Tech Intelligence Dashboard to Cloudflare Pages using Next.js with the `@cloudflare/next-on-pages` adapter.

## Prerequisites

- Node.js 18+ (compatible with Cloudflare)
- Cloudflare account with Pages access
- Git repository connected to Cloudflare

## Project Analysis

### Current Dependencies
- **Next.js**: 15.5.4 (Latest)
- **React**: 19.1.0 (Latest)
- **TanStack Query**: 5.90.2 (API state management)
- **Radix UI Components**: Complete UI library
- **Tailwind CSS**: 4.x (Latest)
- **Zustand**: 5.0.8 (State management)

### Architecture
- **Frontend**: Next.js App Router with TypeScript
- **API Proxy**: `/api/proxy/[...path]/route.ts` for AWS API Gateway integration
- **State Management**: Zustand + TanStack Query
- **Styling**: Tailwind CSS with Radix UI components

## Implementation Steps

### 1. Install Cloudflare Adapter

```bash
cd /Users/kyiamzn/03_code/CommProbe/ui/src
npm install --save-dev @cloudflare/next-on-pages
npm install --save-dev vercel  # Required peer dependency
```

### 2. Update Next.js Configuration

The current `next.config.ts` needs Cloudflare-specific configurations:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable development indicators
  devIndicators: false,

  // Cloudflare Pages optimizations
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  distDir: 'dist',

  // Image optimization (Cloudflare doesn't support Next.js Image Optimization)
  images: {
    unoptimized: true,
  },

  // Disable server-side features not supported by Cloudflare
  poweredByHeader: false,

  // Environment variables configuration
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Webpack configuration for Cloudflare Workers compatibility
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Ensure compatibility with Cloudflare Workers runtime
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
```

### 3. Update Package.json Scripts

Add Cloudflare-specific build scripts:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "build:cf": "@cloudflare/next-on-pages",
    "preview": "npm run build:cf && wrangler pages dev .vercel/output/static",
    "deploy": "npm run build:cf && wrangler pages deploy .vercel/output/static",
    "start": "next start",
    "lint": "eslint"
  }
}
```

### 4. Environment Variables Configuration

#### Development (.env.local)
```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://6bsn9muwfi.execute-api.us-west-2.amazonaws.com/v1/
NEXT_PUBLIC_API_KEY=vPJlvaa0DS9tqxH41eNIA20Sofzb0cG719d8dd0i

# Application Configuration
NEXT_PUBLIC_APP_NAME="Legal Tech Intelligence Dashboard"
NEXT_PUBLIC_APP_VERSION="1.0.0"
NEXT_PUBLIC_ENVIRONMENT="production"

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_OPERATIONS=true
NEXT_PUBLIC_ENABLE_EXPORT=true
```

#### Cloudflare Pages Environment Variables
Configure these in Cloudflare Pages dashboard:

1. **Production Environment**:
   - `NEXT_PUBLIC_API_URL`: `https://6bsn9muwfi.execute-api.us-west-2.amazonaws.com/v1`
   - `NEXT_PUBLIC_API_KEY`: `vPJlvaa0DS9tqxH41eNIA20Sofzb0cG719d8dd0i`
   - `NEXT_PUBLIC_ENVIRONMENT`: `production`
   - `NEXT_PUBLIC_APP_NAME`: `Legal Tech Intelligence Dashboard`
   - `NEXT_PUBLIC_APP_VERSION`: `1.0.0`
   - `NEXT_PUBLIC_ENABLE_ANALYTICS`: `true`
   - `NEXT_PUBLIC_ENABLE_OPERATIONS`: `true`
   - `NEXT_PUBLIC_ENABLE_EXPORT`: `true`

### 5. API Proxy Modifications

The current API proxy needs updates for Cloudflare Workers compatibility:

```typescript
// src/app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

// Export runtime config for Cloudflare
export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, await params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, await params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, await params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, await params, 'DELETE');
}

async function handleRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  try {
    const path = params.path.join('/');
    const url = new URL(`${API_BASE_URL}/${path}`);

    // Copy query parameters
    const searchParams = request.nextUrl.searchParams;
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      'User-Agent': 'Legal-Tech-Dashboard/1.0.0',
    };

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    // Add body for POST/PUT requests
    if (method === 'POST' || method === 'PUT') {
      try {
        const body = await request.text();
        if (body) {
          requestOptions.body = body;
        }
      } catch (error) {
        console.warn('Could not read request body:', error);
      }
    }

    // Make the API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(url.toString(), {
        ...requestOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Get response data
      let data;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Return response with CORS headers
      return NextResponse.json(data, {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    console.error('Proxy error:', error);

    return NextResponse.json(
      {
        error: 'Proxy request failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
```

### 6. Cloudflare Pages Configuration

Create `wrangler.toml` in project root:

```toml
name = "legal-tech-dashboard"
compatibility_date = "2024-01-15"
compatibility_flags = ["nodejs_compat"]

[build]
command = "npm run build:cf"
destination = ".vercel/output/static"

[[pages_build_output_dir]]
```

### 7. Build Configuration

Create `.vercelignore`:

```
node_modules
.env.local
.env
dist
.next
```

### 8. TypeScript Configuration Updates

Update `tsconfig.json` for better Cloudflare compatibility:

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es6", "webworker"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Deployment Process

### Option 1: Automatic Git Deployment

1. **Connect Repository**:
   - Go to Cloudflare Pages dashboard
   - Click "Create a project"
   - Connect your Git repository
   - Select the `ui/src` folder as root directory

2. **Build Settings**:
   - Framework preset: `Next.js (Static HTML Export)`
   - Build command: `npm run build:cf`
   - Build output directory: `.vercel/output/static`
   - Root directory: `ui/src`

3. **Environment Variables**:
   - Add all `NEXT_PUBLIC_*` variables in Cloudflare Pages settings

### Option 2: Manual CLI Deployment

```bash
# Install Wrangler CLI
npm install -g @cloudflare/wrangler

# Login to Cloudflare
wrangler login

# Build and deploy
cd /Users/kyiamzn/03_code/CommProbe/ui/src
npm run build:cf
wrangler pages deploy .vercel/output/static --project-name legal-tech-dashboard
```

## Validation Steps

### 1. Local Build Test
```bash
cd /Users/kyiamzn/03_code/CommProbe/ui/src
npm install @cloudflare/next-on-pages
npx @cloudflare/next-on-pages@1
```

### 2. Local Preview
```bash
npm run preview
```

### 3. Production Testing
```bash
# Test all critical endpoints
curl https://your-app.pages.dev/api/proxy/
curl https://your-app.pages.dev/api/proxy/insights?limit=5
curl https://your-app.pages.dev/api/proxy/analytics/summary
```

## Potential Issues & Solutions

### 1. **Edge Runtime Compatibility**
- **Issue**: Some Node.js APIs not available in Workers
- **Solution**: Use Web APIs instead of Node.js APIs

### 2. **Large Bundle Size**
- **Issue**: Worker size limits (1MB compressed)
- **Solution**: Implement code splitting and lazy loading

### 3. **Environment Variables**
- **Issue**: Environment variables not available at build time
- **Solution**: Use `NEXT_PUBLIC_` prefix for client-side variables

### 4. **API Proxy Timeout**
- **Issue**: Long-running API calls timing out
- **Solution**: Implement request timeout and retry logic

### 5. **Static Asset Handling**
- **Issue**: Static assets not loading properly
- **Solution**: Use Cloudflare CDN with proper caching headers

## Performance Optimizations

### 1. **Caching Strategy**
```javascript
// Add to next.config.ts
const nextConfig = {
  headers: async () => [
    {
      source: '/api/proxy/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, s-maxage=60, stale-while-revalidate=300',
        },
      ],
    },
  ],
};
```

### 2. **Bundle Optimization**
```javascript
// Add to next.config.ts
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};
```

## Security Considerations

1. **API Key Protection**: Ensure API keys are only in environment variables
2. **CORS Configuration**: Properly configure CORS headers
3. **Content Security Policy**: Implement CSP headers
4. **Rate Limiting**: Consider implementing rate limiting in the proxy

## Monitoring & Debugging

1. **Cloudflare Analytics**: Monitor performance and errors
2. **Worker Logs**: Use `wrangler tail` for real-time logs
3. **Error Tracking**: Consider integrating Sentry or similar
4. **Performance Monitoring**: Use Cloudflare Web Analytics

## Post-Deployment Checklist

- [ ] Verify all pages load correctly
- [ ] Test API proxy functionality
- [ ] Validate environment variables
- [ ] Check mobile responsiveness
- [ ] Test all user flows
- [ ] Verify analytics tracking
- [ ] Confirm CORS headers
- [ ] Test error handling
- [ ] Validate performance metrics
- [ ] Setup monitoring and alerts

## Rollback Strategy

If deployment fails:

1. **Immediate**: Revert to previous Cloudflare Pages deployment
2. **Code Issues**: Roll back Git commit and redeploy
3. **Configuration**: Restore previous environment variables
4. **DNS**: Keep existing DNS pointing to working version

## Next Steps

After successful deployment:

1. **Custom Domain**: Configure custom domain in Cloudflare
2. **SSL/TLS**: Ensure proper SSL configuration
3. **Performance**: Optimize based on real-world usage
4. **Monitoring**: Set up alerts and monitoring
5. **CI/CD**: Implement automated deployment pipeline