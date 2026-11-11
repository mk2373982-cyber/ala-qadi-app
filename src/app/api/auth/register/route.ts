import { NextResponse } from 'next/server';
import { createUser, createUserSession, userSessionCookie } from '@/lib/server-storage';
import { AuthRateLimitUnavailableError, isAuthRateLimited } from '@/lib/auth-rate-limit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = body?.name;
    const phone = body?.phone;
    const password = body?.password;

    if (typeof name !== 'string' || typeof phone !== 'string' || typeof password !== 'string' || !name.trim() || !phone.trim() || !password) {
      return NextResponse.json({ error: 'يرجى إدخال جميع البيانات المطلوبة' }, { status: 400 });
    }

    if (name.trim().length > 80 || phone.length > 32 || password.trim().length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'الاسم بحد أقصى 80 حرفًا، وكلمة المرور من 8 إلى 128 حرفًا.' }, { status: 400 });
    }

    if (await isAuthRateLimited(req, { bucket: 'register', windowSeconds: 60 * 60, perIp: 12 })) {
      return NextResponse.json({ error: 'تم تجاوز عدد محاولات التسجيل. حاول بعد ساعة.' }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '3600' },
      });
    }

    const newUser = await createUser(name, phone, password);

    const response = NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        status: newUser.status,
        plan: newUser.plan,
        startDate: newUser.startDate,
        endDate: newUser.endDate,
        isTrial: newUser.isTrial,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
    response.headers.append('Set-Cookie', userSessionCookie(createUserSession(newUser.id)));
    return response;
  } catch (error: any) {
    const status = error instanceof AuthRateLimitUnavailableError ? 503 : 500;
    return NextResponse.json({ error: error.message || 'حدث خطأ أثناء التسجيل' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
