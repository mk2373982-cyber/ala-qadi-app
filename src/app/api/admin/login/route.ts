import { NextResponse } from 'next/server';
import { createAdminSession, verifyAdminPassword } from '@/lib/server-storage';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (typeof password === 'string' && verifyAdminPassword(password)) {
      const session = createAdminSession();
      return NextResponse.json({ success: true }, {
        headers: { 'Set-Cookie': `ala_qaddi_admin=${session}; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Strict; Path=/api/admin; Max-Age=2592000` },
      });
    }

    return NextResponse.json({ error: 'كلمة مرور الأدمن غير صحيحة' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'حدث خطأ' }, { status: 500 });
  }
}
