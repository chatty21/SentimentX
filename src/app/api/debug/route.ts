import { NextResponse } from "next/server";

export async function GET() {
  const out = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GOOGLE_CLIENT_ID_present: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET_present: !!process.env.GOOGLE_CLIENT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };
  return NextResponse.json(out);
}