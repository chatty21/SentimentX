import { NextResponse } from "next/server";

export async function GET() {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  const diag = {
    hasKey: !!key,
    keyPrefix: key ? key.slice(0, 12) + "…" : null,
    siteUrl: process.env.OPENROUTER_SITE_URL || null,
    appName: process.env.OPENROUTER_APP_NAME || null,
  };

  try {
    const r = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const text = await r.text();
    return NextResponse.json({ diag, status: r.status, body: text.slice(0, 4000) });
  } catch (e: any) {
    return NextResponse.json({ diag, error: e?.message || String(e) }, { status: 500 });
  }
}