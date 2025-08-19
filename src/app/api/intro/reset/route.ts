// src/app/api/intro/reset/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // delete cookie
  res.cookies.set("intro_seen", "", { path: "/", maxAge: 0 });
  return res;
}