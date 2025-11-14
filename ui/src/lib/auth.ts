/**
 * Server-side authentication utilities
 * Uses Web Crypto API for token generation (Edge runtime compatible)
 */

// Secret key for signing tokens (should be in environment variables)
const SECRET_KEY = process.env.AUTH_SECRET || 'commprobe-secret-key-change-in-production';

/**
 * Generate a secure random token
 */
export async function generateAuthToken(username: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify({
    username,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    iat: Date.now(),
  }));

  // Create signature using Web Crypto API
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);

  // Combine data and signature
  const token = btoa(String.fromCharCode(...new Uint8Array(data))) + '.' +
                btoa(String.fromCharCode(...new Uint8Array(signature)));

  return token;
}

/**
 * Verify an auth token
 */
export async function verifyAuthToken(token: string): Promise<{ valid: boolean; username?: string }> {
  try {
    if (!token) return { valid: false };

    const [dataB64, signatureB64] = token.split('.');
    if (!dataB64 || !signatureB64) return { valid: false };

    // Decode data
    const dataStr = atob(dataB64);
    const data = JSON.parse(dataStr);

    // Check expiration
    if (data.exp < Date.now()) {
      return { valid: false };
    }

    // Verify signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SECRET_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataBytes = Uint8Array.from(dataStr, c => c.charCodeAt(0));
    const signatureBytes = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));

    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, dataBytes);

    if (valid) {
      return { valid: true, username: data.username };
    }

    return { valid: false };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false };
  }
}

/**
 * Validate credentials against server-side environment variables
 */
export function validateCredentials(username: string, password: string): boolean {
  const validUsername = process.env.ADMIN_USERNAME || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'commprobe2024';

  return username === validUsername && password === validPassword;
}
