import { NextResponse } from 'next/server';
import { createAdminSession, verifyAdminPassword } from '@/lib/server-storage';
import { AuthRateLimitUnavailableError, isAuthRateLimited } from '@/lib/auth-rate-limit';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (await isAuthRateLimited(req, {
      bucket: 'admin-login',
      windowSeconds: 15 * 60,
      perIp: 8,
      identity: 'all-admins',
      perIdentity: 30,
    })) {
      return NextResponse.json({ error: 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.' }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '900' },
      });
    }

    if (typeof password === 'string' && verifyAdminPassword(password)) {
      const session = createAdminSession();
      return NextResponse.json({ success: true }, {
        headers: { 'Set-Cookie': `ala_qaddi_admin=${session}; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Strict; Path=/api/admin; Max-Age=2592000` },
      });
    }

    return NextResponse.json({ error: 'كلمة مرور الأدمن غير صحيحة' }, { status: 401 });
  } catch (error: any) {
    const status = error instanceof AuthRateLimitUnavailableError ? 503 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'حدث خطأ' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
