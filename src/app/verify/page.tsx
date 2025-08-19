// src/app/verify/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Inner component: all useSearchParams() lives here (inside Suspense) */
function VerifyInner() {
  const router = useRouter();
  const sp = useSearchParams();

  // Common query keys used by email/OAuth verification flows
  const token = sp.get("token") || sp.get("code") || sp.get("otp") || "";
  const email = sp.get("email") || "";
  const next = sp.get("next") || "/";

  const [status, setStatus] = useState<"idle" | "verifying" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  // Build payload once
  const payload = useMemo(() => ({ token, email }), [token, email]);

  useEffect(() => {
    let alive = true;

    async function go() {
      if (!token) {
        setStatus("error");
        setMessage("Missing verification token.");
        return;
      }
      setStatus("verifying");
      setMessage("Verifying…");

      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });

        if (!alive) return;

        if (res.ok) {
          setStatus("ok");
          setMessage("Verified! Redirecting…");
          // brief pause so the user sees success, then continue
          setTimeout(() => router.replace(next), 900);
        } else {
          const txt = await res.text().catch(() => "");
          setStatus("error");
          setMessage(txt || "Verification failed.");
        }
      } catch (e) {
        if (!alive) return;
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Verification failed.");
      }
    }

    go();
    return () => { alive = false; };
  }, [payload, router, next, token]);

  return (
    <div className="min-h-[calc(100vh-64px)] grid place-items-center bg-gradient-to-b from-[#0a0f1c] to-[#05070d]">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-semibold">Account verification</h1>

        <p className="mt-2 text-sm text-zinc-400">
          {status === "verifying" ? "Please wait while we verify your request." : message}
        </p>

        <div className="mt-6">
          {status === "verifying" && (
            <div className="inline-flex items-center gap-2 text-zinc-300">
              <span className="h-3 w-3 animate-ping rounded-full bg-cyan-400" />
              <span>Verifying…</span>
            </div>
          )}

          {status === "ok" && (
            <button
              onClick={() => router.replace(next)}
              className="mt-2 rounded-md border border-emerald-600/40 bg-emerald-600/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-600/30"
            >
              Continue
            </button>
          )}

          {status === "error" && (
            <div className="mt-3 space-y-3">
              <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {message || "Verification failed."}
              </div>
              <button
                onClick={() => router.replace("/login")}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Back to login
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-zinc-500">
          If this wasn’t you, you can safely close this tab.
        </p>
      </div>
    </div>
  );
}

/** Page shell: Suspense wrapper required for useSearchParams() */
export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-64px)] grid place-items-center">
          <div className="text-zinc-400">Loading…</div>
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}