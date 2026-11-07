import { NextResponse } from 'next/server';
import { getSystemData, updateSettings } from '@/lib/server-storage';

export async function GET() {
  try {
    const data = getSystemData();
    return NextResponse.json({
      settings: data.settings,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const updated = updateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
