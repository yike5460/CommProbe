import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';

export const config = {
  matcher: [
    '/slack/:path*',
    '/settings/:path*',
    '/api/proxy/:path*',
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for login-related endpoints
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Get auth token from cookie
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    // Redirect to login for page requests
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Return 401 for API requests
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify token
  const verification = await verifyAuthToken(token);

  if (!verification.valid) {
    // Clear invalid token
    const response = !pathname.startsWith('/api/')
      ? NextResponse.redirect(new URL('/login', request.url))
      : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    response.cookies.delete('auth_token');
    return response;
  }

  // Token is valid, allow request to proceed
  return NextResponse.next();
}
