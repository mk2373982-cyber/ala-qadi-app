import { NextResponse } from 'next/server';
import { clearLegacyUserSessionCookie, clearUserSessionCookie } from '@/lib/server-storage';

export async function POST() {
  const response = NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  response.headers.append('Set-Cookie', clearUserSessionCookie());
  response.headers.append('Set-Cookie', clearLegacyUserSessionCookie());
  return response;
}
