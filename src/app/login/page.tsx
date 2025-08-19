// src/app/login/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/* ---------------- Icons (unchanged) ---------------- */
const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 31.7 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.4 2.9l5.7-5.7C33.5 6.2 28.9 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10.2 0 19-7.4 19-20 0-1.1-.1-2.2-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.4 16.4 18.9 13 24 13c2.8 0 5.4 1.1 7.4 2.9l5.7-5.7C33.5 6.2 28.9 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.1C29.2 35.3 26.8 36 24 36c-5.3 0-9.8-3.4-11.4-8.1l-6.6 5.1C9.4 39.7 16.1 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.3 3.9-5.1 7-11.3 7-5.3 0-9.8-3.4-11.4-8.1l-6.6 5.1C9.4 39.7 16.1 44 24 44c10.2 0 19-7.4 19-20 0-1.1-.1-2.2-.4-3.5z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.5-1.4-1.9-1.4-1.9-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.6-1.4-5.6-6.2 0-1.4.5-2.6 1.2-3.6-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.4 1.3a11.7 11.7 0 0 1 6.2 0C17.1 4.6 18 4.9 18 4.9c.6 1.7.2 3 .1 3.3.8 1 1.2 2.2 1.2 3.6 0 4.8-2.9 5.9-5.6 6.2.5.4.9 1.1.9 2.2v3.2c0 .3.2.7.8.6A12 12 0 0 0 12 .5z"/>
  </svg>
);

/* ---------------- helpers ---------------- */
function getOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

/** Inner component: ALL hooks that use useSearchParams live here */
function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/about";

  const [loading, setLoading] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Build OAuth callback
  const redirectTo = useMemo(() => {
    const url = new URL("/api/auth/callback", getOrigin());
    if (next) url.searchParams.set("next", next);
    return url.toString();
  }, [next]);

  // Already logged in? bounce to `next`
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { credentials: "include" });
        const j = r.ok ? await r.json() : null;
        if (alive && j?.session?.user?.email) router.replace(next || "/about");
      } catch {/* ignore */}
    })();
    return () => { alive = false; };
  }, [router, next]);

  async function startOAuth(provider: "google" | "github") {
    setError(null);
    setLoading(provider);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: provider === "google"
            ? { access_type: "offline", prompt: "consent" }
            : {},
        },
      });
      if (error) throw error;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not start sign-in.";
      setError(msg);
      setLoading(null);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "g") { e.preventDefault(); startOAuth("google"); }
      if (k === "h") { e.preventDefault(); startOAuth("github"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------- UI (unchanged) ---------------- */
  return (
    <div className="relative min-h-[calc(100vh-64px)] flex items-center justify-center overflow-hidden">
      {/* animated bg */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl animate-pulse" />
      </div>

      <div className="w-full max-w-[440px] rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Sign in to SentimentX to get quick, actionable reads on S&amp;P 500 names.
        </p>

        <div className="mt-6 grid gap-3">
          <button
            onClick={() => startOAuth("google")}
            disabled={loading !== null}
            className="group inline-flex items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium hover:bg-zinc-800 disabled:opacity-60"
          >
            <GoogleIcon />
            {loading === "google" ? "Connecting to Google…" : "Continue with Google"}
            <span className="ml-auto hidden text-[10px] text-zinc-500 group-hover:block">⌘G</span>
          </button>

          <button
            onClick={() => startOAuth("github")}
            disabled={loading !== null}
            className="group inline-flex items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium hover:bg-zinc-800 disabled:opacity-60"
          >
            <GitHubIcon />
            {loading === "github" ? "Connecting to GitHub…" : "Continue with GitHub"}
            <span className="ml-auto hidden text-[10px] text-zinc-500 group-hover:block">⌘H</span>
          </button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-zinc-500">
          <div className="h-px flex-1 bg-zinc-800" />
          <span>What you get</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <ul className="space-y-2 text-sm text-zinc-400">
          <li>• One-line verdicts with risks &amp; catalysts</li>
          <li>• Headlines + technicals distilled</li>
          <li>• No spam. You control your data.</li>
        </ul>

        {error ? (
          <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <p className="mt-6 text-[11px] leading-relaxed text-zinc-500">
          By continuing, you agree to our educational use terms. Markets are risky; nothing here is investment advice.
        </p>
      </div>
    </div>
  );
}

/** Page shell: wraps Inner in Suspense (required for useSearchParams) */
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-64px)] grid place-items-center">
        <div className="text-zinc-400">Loading…</div>
      </div>
    }>
      <LoginInner />
    </Suspense>
  );
}