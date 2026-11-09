import { NextResponse } from 'next/server';
import { clearUserSessionCookie } from '@/lib/server-storage';

export async function POST() {
  return NextResponse.json({ success: true }, {
    headers: {
      'Cache-Control': 'no-store',
      'Set-Cookie': clearUserSessionCookie(),
    },
  });
}
