import { NextResponse } from 'next/server';
import { getSystemData } from '@/lib/server-storage';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    const data = getSystemData();
    if (password === data.settings.adminPassword) {
      return NextResponse.json({
        success: true,
        token: 'admin_authenticated_session',
      });
    }

    return NextResponse.json({ error: 'كلمة مرور الأدمن غير صحيحة' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
