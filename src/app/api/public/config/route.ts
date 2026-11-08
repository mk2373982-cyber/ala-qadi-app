import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/server-storage';

export async function GET() {
  try {
    const settings = await getSettings();
    // Return only public payment info, not admin password!
    return NextResponse.json({
      paymentPhone: settings.paymentPhone,
      paymentInstapay: settings.paymentInstapay,
      instagramUrl: settings.instagramUrl,
      whatsappNumber: settings.whatsappNumber,
      pricingNote: settings.pricingNote,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
