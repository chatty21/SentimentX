import { NextResponse } from "next/server";
import { resolvePrices } from "../../prices/route";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: { ticker?: string } }
) {
  const ticker = (params?.ticker || "").toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  try {
    const { prices } = await resolvePrices([ticker]);
    const price = prices?.[ticker] ?? null;

    return NextResponse.json({
      ticker,
      price,
      asOf: Date.now(),
      source: "resolver",
    });
  } catch (err: any) {
    return NextResponse.json({
      ticker,
      price: null,
      asOf: Date.now(),
      error: err?.message || "provider error",
    });
  }
}