import { NextResponse } from 'next/server';
import { getSystemData } from '@/lib/server-storage';

export async function GET() {
  try {
    const data = getSystemData();
    // Return only public payment info, not admin password!
    return NextResponse.json({
      paymentPhone: data.settings.paymentPhone,
      paymentInstapay: data.settings.paymentInstapay,
      whatsappNumber: data.settings.whatsappNumber,
      pricingNote: data.settings.pricingNote,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
