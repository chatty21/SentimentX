import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const symbol = (u.searchParams.get("symbol") || "").toUpperCase();
    const days = parseInt(u.searchParams.get("days") || "10", 10);
    const token = process.env.FINNHUB_API_KEY;

    if (!symbol) return NextResponse.json({ items: [] });
    if (!token)  return NextResponse.json({ items: [], error: "Missing FINNHUB_API_KEY" }, { status: 500 });

    // Finnhub company-news
    const to   = Math.floor(Date.now() / 1000);
    const from = to - days * 24 * 60 * 60;

    const r = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${new Date(from*1000).toISOString().slice(0,10)}&to=${new Date(to*1000).toISOString().slice(0,10)}&token=${token}`,
      { cache: "no-store" }
    );
    if (!r.ok) return NextResponse.json({ items: [] });

    const json = await r.json();
    const items = Array.isArray(json)
      ? json.map((n: any) => ({
          title: n?.headline || n?.title || "",
          url: n?.url,
          source: n?.source || n?.category || "",
          date: n?.datetime ? new Date(n.datetime * 1000).toISOString() : undefined,
        })).filter((x: any) => x.title)
      : [];

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) }, { status: 500 });
  }
}