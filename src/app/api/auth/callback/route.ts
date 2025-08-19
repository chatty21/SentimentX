import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// GET /api/auth/callback?code=...&next=/about
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/about";

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // Create a server client bound to this request's cookie snapshot,
  // then exchange the code for a session and write auth cookies.
  const supabase = supabaseServer();
  const { error } = await (await supabase).auth.exchangeCodeForSession(code);

  // (Optional) you can inspect error to show a nicer message
  return NextResponse.redirect(new URL(next, url.origin));
}