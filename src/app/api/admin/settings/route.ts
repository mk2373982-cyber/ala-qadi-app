import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getSettings, updateSettings, verifyAdminSession } from '@/lib/server-storage';

function authorized(req: NextRequest) {
  return verifyAdminSession(req.cookies.get('ala_qaddi_admin')?.value);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    return NextResponse.json({
      settings: await getSettings(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  try {
    const body = await req.json();
    const updated = await updateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
