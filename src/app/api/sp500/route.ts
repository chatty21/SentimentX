// src/app/api/sp500/route.ts
import { NextResponse } from "next/server";
import { SP500_COMPANIES } from "@/data/sp500Companies";

export async function GET() {
  // Returns: { [TICKER]: "Company Name", ... }
  return NextResponse.json(SP500_COMPANIES);
}