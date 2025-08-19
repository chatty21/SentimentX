import { NextResponse } from "next/server";
import { SP500_COMPANIES } from "@/data/sp500Companies";

// Try to read the generated JSON (public/data/sp500_companies.json).
// If it's missing, fall back to the in-repo TypeScript map.
export async function GET() {
  try {
    // public/ files are served at /, so we can fetch it locally
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/data/sp500_companies.json`).catch(() => null);

    if (res && res.ok) {
      const json = await res.json().catch(() => ({}));
      // basic shape check
      if (json && typeof json === "object" && Object.keys(json).length > 200) {
        return NextResponse.json(json, { status: 200 });
      }
    }
  } catch {
    // ignore and fall through to TS fallback
  }

  // Fallback to the TS export bundled with the app
  return NextResponse.json(SP500_COMPANIES, { status: 200 });
}