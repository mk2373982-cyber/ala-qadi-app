import { NextResponse } from 'next/server';
import { userSessionCookie, createUserSession, verifyUserPassword } from '@/lib/server-storage';

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

    const user = await verifyUserPassword(phone, password.trim());
    if (!user) {
      return NextResponse.json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' }, { status: 401 });
    }

    if (user.status === 'active' && user.endDate && Date.now() > new Date(user.endDate).getTime()) {
      return NextResponse.json({ error: 'انتهى الاشتراك، يرجى تجديده للمتابعة' }, { status: 403 });
    }

    // Check expiration if user has an end date
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
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
    response.headers.append('Set-Cookie', userSessionCookie(createUserSession(user.id)));
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'فشل تسجيل الدخول' }, { status: 500 });
  }
}
