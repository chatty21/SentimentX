// src/app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();

      // ⬇️ capture error from Supabase v2 response
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true, // covers first-time signups
          // DO NOT set emailRedirectTo — keeps it OTP-only (no magic link)
        },
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("We emailed you a 6-digit code.");
      // choose where to land after verification (about, dashboard, etc.)
      router.push(`/verify?email=${encodeURIComponent(email)}&next=/about`);
    } catch (err: any) {
      setMsg(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center text-white">
      <form
        onSubmit={sendCode}
        className="w-[360px] max-w-[92vw] space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6"
      >
        <h1 className="text-lg font-semibold">Create your account</h1>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-2"
        />

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full rounded-md bg-blue-600 p-2 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Sending code…" : "Send 6-digit code"}
        </button>

        {msg && <p className="text-sm text-zinc-300">{msg}</p>}
        <p className="text-xs text-zinc-500">We’ll send a one-time 6-digit code (no magic links).</p>
      </form>
    </main>
  );
}