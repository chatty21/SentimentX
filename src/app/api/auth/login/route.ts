import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({} as any));
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const supabase = await supabaseServer();

  // 🔑 OTP-only: DO NOT pass emailRedirectTo here
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true, // allow first-time signups through the same flow
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}