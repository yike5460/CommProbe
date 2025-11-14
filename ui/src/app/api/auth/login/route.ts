import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, generateAuthToken } from '@/lib/auth';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password required' },
        { status: 400 }
      );
    }

    // Validate credentials against server-side env variables
    const isValid = validateCredentials(username, password);

    if (!isValid) {
      // Add delay to prevent brute force
      await new Promise(resolve => setTimeout(resolve, 1000));

      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate secure token
    const token = await generateAuthToken(username);

    // Create response with HttpOnly cookie
    const response = NextResponse.json({
      success: true,
      username,
    });

    // Set HttpOnly cookie (secure, not accessible via JavaScript)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
