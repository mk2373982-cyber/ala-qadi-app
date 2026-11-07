import { NextResponse } from 'next/server';
import { createUser, findUserByPhone } from '@/lib/server-storage';

export async function POST(req: Request) {
  try {
    const { name, phone, password } = await req.json();

    if (!name || !phone || !password) {
      return NextResponse.json({ error: 'يرجى إدخال جميع البيانات المطلوبة' }, { status: 400 });
    }

    if (password.length < 3) {
      return NextResponse.json({ error: 'كلمة المرور يجب ألا تقل عن 3 أحرف' }, { status: 400 });
    }

    const existing = findUserByPhone(phone);
    if (existing) {
      return NextResponse.json({ error: 'رقم الهاتف مسجل بالفعل' }, { status: 400 });
    }

    const newUser = createUser(name, phone, password);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        status: newUser.status,
        plan: newUser.plan,
        startDate: newUser.startDate,
        endDate: newUser.endDate,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'حدث خطأ أثناء التسجيل' }, { status: 500 });
  }
}
