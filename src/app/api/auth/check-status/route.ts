import { NextResponse } from 'next/server';
import { findUserById, getUserIdFromSession } from '@/lib/server-storage';

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromSession(req);
    if (!userId) {
      return NextResponse.json({ error: 'انتهت الجلسة، سجّل الدخول مرة أخرى.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json({ status: 'revoked', message: 'تم إيقاف أو حذف الحساب' }, { headers: { 'Cache-Control': 'no-store' } });
    }

    let status = user.status;
    if (status === 'active' && user.endDate) {
      const now = new Date();
      const end = new Date(user.endDate);
      if (now > end) {
        status = 'expired';
      }
    }

    return NextResponse.json({
      status,
      plan: user.plan,
      startDate: user.startDate,
      endDate: user.endDate,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
