import { NextResponse } from 'next/server';
import {
  clearLegacyUserSessionCookie,
  createUserSession,
  findUserById,
  getUserIdFromSession,
  userSessionCookie,
} from '@/lib/server-storage';

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromSession(req);
    if (!userId) {
      return NextResponse.json(
        { error: 'انتهت الجلسة، سجّل الدخول مرة أخرى.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const user = await findUserById(userId);
    if (!user) {
      const response = NextResponse.json(
        { status: 'revoked', message: 'تم إيقاف أو حذف الحساب' },
        { headers: { 'Cache-Control': 'no-store' } },
      );
      response.headers.append('Set-Cookie', clearLegacyUserSessionCookie());
      return response;
    }

    let status = user.status;
    if (status === 'active' && user.endDate) {
      const now = new Date();
      const end = new Date(user.endDate);
      if (now > end) {
        status = 'expired';
      }
    }

    const response = NextResponse.json(
      {
        status,
        plan: user.plan,
        startDate: user.startDate,
        endDate: user.endDate,
        isTrial: user.isTrial,
        createdAt: user.createdAt,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    response.headers.append('Set-Cookie', clearLegacyUserSessionCookie());
    response.headers.append('Set-Cookie', userSessionCookie(createUserSession(userId)));
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
