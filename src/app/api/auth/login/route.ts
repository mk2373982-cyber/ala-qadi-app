import { NextResponse } from 'next/server';
import { userSessionCookie, createUserSession, verifyUserPassword } from '@/lib/server-storage';
import { AuthRateLimitUnavailableError, isAuthRateLimited } from '@/lib/auth-rate-limit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = body?.phone;
    const password = body?.password;

    if (typeof phone !== 'string' || typeof password !== 'string' || !phone.trim() || !password) {
      return NextResponse.json({ error: 'يرجى إدخال الهاتف وكلمة المرور' }, { status: 400 });
    }
    if (phone.length > 32 || password.length > 128) {
      return NextResponse.json({ error: 'البيانات المدخلة غير صالحة' }, { status: 400 });
    }

    if (await isAuthRateLimited(req, {
      bucket: 'login',
      windowSeconds: 15 * 60,
      perIp: 40,
      identity: phone,
      perIdentity: 8,
    })) {
      return NextResponse.json({ error: 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.' }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '900' },
      });
    }

    const user = await verifyUserPassword(phone, password.trim());
    if (!user) {
      return NextResponse.json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' }, { status: 401 });
    }

    // Keep expired users signed in so they can see renewal options; local financial data remains on-device.
    let status = user.status;
    if (status === 'active' && user.endDate) {
      const now = new Date();
      const end = new Date(user.endDate);
      if (now > end) {
        status = 'expired';
      }
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        status: status,
        plan: user.plan,
        startDate: user.startDate,
        endDate: user.endDate,
        isTrial: user.isTrial,
        createdAt: user.createdAt,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
    response.headers.append('Set-Cookie', userSessionCookie(createUserSession(user.id)));
    return response;
  } catch (error: any) {
    const status = error instanceof AuthRateLimitUnavailableError ? 503 : 500;
    return NextResponse.json({ error: error.message || 'فشل تسجيل الدخول' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
