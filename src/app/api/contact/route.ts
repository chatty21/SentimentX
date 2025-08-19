import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    // TODO: send email or pipe to your CRM
    // Example log (avoid logging PII in production)
    console.log('[contact] message', Object.fromEntries(data.entries()));

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}