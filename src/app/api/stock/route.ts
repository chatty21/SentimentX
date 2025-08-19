import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs"; // ensure fs works in Next.js API route

export async function GET() {
  try {
    // Point to public/data instead of data
    const filePath = path.join(process.cwd(), "public", "data", "sp500_indicators.json");
    const json = await fs.readFile(filePath, "utf-8");

    return new NextResponse(json, {
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to read file" },
      { status: 500 }
    );
  }
}