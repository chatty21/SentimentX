import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut(); // clears auth cookies
  return NextResponse.json({ ok: true });
}