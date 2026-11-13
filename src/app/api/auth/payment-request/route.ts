import { NextResponse } from 'next/server';

// Kept as a retired endpoint for clients with an older cached app version.
export async function POST() {
  return NextResponse.json(
    { error: 'طريقة الدفع اتحدثت. أرسل صورة التحويل عبر واتساب.' },
    { status: 410 },
  );
}
