import { NextResponse } from 'next/server';
import { submitPayment } from '@/lib/server-storage';

export async function POST(req: Request) {
  try {
    const { userId, reference } = await req.json();
    if (typeof userId !== 'string' || typeof reference !== 'string' || reference.trim().length < 3) {
      return NextResponse.json({ error: 'أدخل رقم أو مرجع التحويل بشكل صحيح' }, { status: 400 });
    }
    const user = await submitPayment(userId, reference);
    return NextResponse.json({ success: true, paymentStatus: user.paymentStatus });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'تعذر تسجيل طلب الدفع' }, { status: 400 });
  }
}
