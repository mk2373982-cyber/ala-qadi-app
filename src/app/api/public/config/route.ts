import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/server-storage';

export async function GET() {
  try {
    const settings = await getSettings();
    // Return only public payment info, not admin password!
    return NextResponse.json({
      paymentPhone: settings.paymentPhone,
      paymentInstapay: settings.paymentInstapay,
      instapayLink: settings.instapayLink,
      whatsappNumber: settings.whatsappNumber,
      pricingNote: settings.pricingNote,
    });
  } catch (error) {
    console.error('public config request failed:', error);
    return NextResponse.json(
      { error: 'تعذر تحميل إعدادات الدفع. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}
