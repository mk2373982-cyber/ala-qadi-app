import { NextResponse } from 'next/server';
import { getSignupCampaignStatus } from '@/lib/server-storage';

export async function GET() {
  try {
    return NextResponse.json(await getSignupCampaignStatus(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'تعذر التحقق من العرض الحالي.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
