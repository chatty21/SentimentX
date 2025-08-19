// src/app/api/auth/verify/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, token } = await req.json().catch(() => ({} as any));
    if (!email || !token) {
      return NextResponse.json(
        { error: "Email and code required" },
        { status: 400 }
      );
    }

    // ⚠️ Use your server client that writes Set-Cookie via Next’s cookies() helper
    const supabase = await supabaseServer();

    // Try both flows: existing user (“email”) then first-time (“signup”)
    let lastErr: string | null = null;
    for (const type of ["email", "signup"] as const) {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type,
      });
      if (!error) {
        // Cookie is set by supabaseServer’s cookie adapter; nothing to forward
        return NextResponse.json({ ok: true, user: data.user ?? null });
      }
      lastErr = error.message;
    }

    return NextResponse.json(
      { error: lastErr || "Invalid code" },
      { status: 400 }
    );
  } catch (e: any) {
    console.error("POST /api/auth/verify failed:", e);
    return NextResponse.json(
      { error: "Server error verifying code" },
      { status: 500 }
    );
  }
}