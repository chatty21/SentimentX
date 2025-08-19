// src/app/api/auth/session/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, session: data.session ?? null });
}