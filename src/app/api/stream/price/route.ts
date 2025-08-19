// src/app/api/stream/prices/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";

function toSSE(headers: Headers) {
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("Connection", "keep-alive");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickers = (searchParams.get("tickers") || "")
    .split(/[, ]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!tickers.length) {
    return new Response("Missing tickers", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // helper to write a message
      const send = (obj: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      // heartbeat to keep proxies alive
      const ping = () => controller.enqueue(encoder.encode(": ping\n\n"));
      const pingId = setInterval(ping, 15000);

      // polling loop → reuse your existing /api/prices
      let alive = true;
      const origin = `${req.nextUrl.origin}`;
      const loop = async () => {
        while (alive) {
          try {
            const r = await fetch(`${origin}/api/prices`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ tickers }),
              cache: "no-store",
            });
            const j = await r.json().catch(() => ({}));
            send({ prices: j?.prices || {}, ts: Date.now() });
          } catch { /* ignore and keep retrying */ }
          await new Promise(res => setTimeout(res, 3000)); // ~3s updates
        }
      };
      loop();

      // close handling
      const close = () => { alive = false; clearInterval(pingId); controller.close(); };
      // @ts-ignore – not available in edge
      req.signal?.addEventListener?.("abort", close);
    },
  });

  const headers = new Headers();
  toSSE(headers);
  return new Response(stream, { headers });
}