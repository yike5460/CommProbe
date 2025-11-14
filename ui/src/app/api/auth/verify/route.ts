import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const verification = await verifyAuthToken(token);

    if (verification.valid) {
      return NextResponse.json({
        authenticated: true,
        username: verification.username,
      });
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
