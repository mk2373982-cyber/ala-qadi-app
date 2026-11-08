import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: true }, {
    headers: { 'Set-Cookie': `ala_qaddi_admin=; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Strict; Path=/api/admin; Max-Age=0` },
  });
}
