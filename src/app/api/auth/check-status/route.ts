import { NextResponse } from 'next/server';
import { findUserById } from '@/lib/server-storage';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'معرف المستخدم غير موجود' }, { status: 400 });
    }

    const user = findUserById(userId);
    if (!user) {
      return NextResponse.json({ status: 'revoked', message: 'تم إيقاف أو حذف الحساب' });
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
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
