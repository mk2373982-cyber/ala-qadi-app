import { NextResponse } from 'next/server';
import { activateSubscriptionWithCode } from '@/lib/server-storage';

export async function POST(req: Request) {
  try {
    const { userId, code } = await req.json();
    if (typeof userId !== 'string' || typeof code !== 'string' || code.trim().length < 4 || code.length > 32) {
      return NextResponse.json({ error: 'أدخل كود التفعيل.' }, { status: 400 });
    }
    const user = await activateSubscriptionWithCode(userId, code);
    return NextResponse.json({ success: true, user: { status: user.status, plan: user.plan, startDate: user.startDate, endDate: user.endDate } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'تعذر تفعيل الاشتراك.' }, { status: 400 });
  }
}
