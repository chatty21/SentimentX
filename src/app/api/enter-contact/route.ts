import { NextResponse } from 'next/server';

export async function GET() {
  const res = NextResponse.redirect(new URL('/contact', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  // 2-minute gate cookie
  res.cookies.set('sx_contact_gate', '1', { httpOnly: true, maxAge: 120, path: '/' });
  return res;
}