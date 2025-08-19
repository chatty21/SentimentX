// src/app/about/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import LayoutContainer from "@/components/LayoutContainer";

export default function AboutPage() {
  const [open, setOpen] = useState(false);
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-200">
      {/* Full-bleed hero */}
      <section className="relative w-full">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_50%_-10%,rgba(59,130,246,0.25),transparent)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,0.6)_30%,rgba(2,6,23,1)_100%)]" />
        </div>

        <div className="relative py-20 md:py-24">
          <LayoutContainer>
            <p className="text-xs tracking-widest text-zinc-400 uppercase mb-3">About</p>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
              <span className="block text-zinc-100">SentimentX</span>
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300">
                <strong>Signal over noise.</strong>
              </span>
            </h1>

            <p className="mt-6 max-w-3xl text-lg text-zinc-300">
              We turn messy market inputs — news, price action, and context — into a
              <span className="text-zinc-100 font-semibold"> one-line, actionable read</span>.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm hover:bg-blue-500/20"
              >
                Open the app
              </Link>

              {/* Opens the contact overlay instead of navigating away */}
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls="contact-overlay"
              >
                Contact
              </button>
            </div>
          </LayoutContainer>
        </div>
      </section>

      {/* Content sections with the same container */}
      <section>
        <LayoutContainer className="py-10">
          <div className="grid gap-6 md:grid-cols-3">
            <Card
              title="What it does"
              blurb="A focused AI copilot for U.S. large-caps. Ask a question about any S&P 500 stock and get a crisp verdict (Buy/Hold/Sell), the why, the risks, timing, and fresh headlines."
            />
            <Card
              title="Why it’s different"
              blurb="Short answers by design. No sprawling essays. We source quick technicals + live headlines, then force an LLM to answer in a strict, readable format."
            />
            <Card
              title="Who it’s for"
              blurb="Builders, PMs, and investors who want context fast. Great for morning scans, quick checks before meetings, or validating a hunch."
            />
          </div>
        </LayoutContainer>
      </section>

      <section>
        <LayoutContainer className="py-6">
          <h2 className="text-xl font-semibold mb-4">How it works</h2>
          <ol className="space-y-3 text-zinc-300">
            <Step>Detect your ticker (AAPL, NVDA, AMZN) or remember your last one.</Step>
            <Step>Fetch quick stats &amp; technicals (price, 52-week high, RSI, MAs, vs MA).</Step>
            <Step>Pull fresh headlines (NewsAPI/Finnhub if configured), rank for relevance.</Step>
            <Step>Summarize with your chosen LLM under a strict prompt for clarity.</Step>
            <Step>Return one tight answer + links to sources. No fluff.</Step>
          </ol>
        </LayoutContainer>
      </section>

      <section>
        <LayoutContainer className="py-10">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="font-semibold mb-2">Important</h3>
            <p className="text-zinc-400">
              SentimentX is for educational purposes only. It is not investment advice and may be
              incomplete, incorrect, or outdated. Always do your own research.
            </p>
          </div>
          <div className="mt-8 mb-16">
            <Link
              href="/"
              className="inline-block rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm hover:bg-blue-500/20"
            >
              Back to app
            </Link>
          </div>
        </LayoutContainer>
      </section>

      {/* Contact overlay (advanced animated, keyboard-accessible) */}
      <ContactOverlay open={open} onClose={() => setOpen(false)} />
    </main>
  );
}

/* ---------- helpers ---------- */
function Card({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 hover:bg-zinc-900/60 transition">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed">{blurb}</p>
    </div>
  );
}
function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 h-2 w-2 flex-none rounded-full bg-emerald-400/80" />
      <p>{children}</p>
    </li>
  );
}

/* ---------- Contact Overlay ---------- */
function ContactOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on ESC & trap focus (very lightweight)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a,button,input,textarea,select,[tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      id="contact-overlay"
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50"
    >
      {/* Backdrop */}
      <button
        aria-label="Close contact"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className="absolute left-1/2 top-1/2 w-[min(100vw-2rem,1000px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 pointer-events-auto z-10"
      >
        {/* Animated header gradient */}
        <div className="relative h-28 overflow-hidden border-b border-zinc-800">
          <div className="absolute inset-0 pointer-events-none bg-[conic-gradient(from_0deg,rgba(59,130,246,0.2),rgba(16,185,129,0.15),rgba(59,130,246,0.2))] animate-[spin_8s_linear_infinite]" />
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(60%_60%_at_30%_30%,rgba(2,6,23,0),rgba(2,6,23,1))]" />
          <h2 className="relative z-10 px-6 pt-6 text-xl font-semibold">Contact SentimentX</h2>
          <p className="relative z-10 px-6 text-sm text-zinc-400">We usually respond within 24 hours.</p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 rounded-md border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-zinc-800">
          {/* Form */}
          <div className="col-span-1 md:col-span-3 bg-zinc-950 p-6">
            <ContactForm />
          </div>

          {/* Animated testimonials */}
          <div className="col-span-1 md:col-span-2 bg-zinc-950 p-6">
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">What users say</h3>
            <TestimonialMarquee />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const fd = new FormData(formRef.current!);
    const payload = Object.fromEntries(fd.entries());

    // Try a local API if you add one later; otherwise fall back to mailto:
    try {
      await fetch("/api/contact", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      }).catch(() => {});
    } catch {}

    // Always provide a mailto fallback that opens the user's email client
    const subject = encodeURIComponent(`[SentimentX] ${payload.subject || "Contact"}`);
    const body = encodeURIComponent(
      `Name: ${payload.name || ""}\nEmail: ${payload.email || ""}\n\n${payload.message || ""}`
    );
    window.location.href = `mailto:support@sentimentx.app?subject=${subject}&body=${body}`;
    setStatus("ok");
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Your name">
          <input name="name" required className="input" placeholder="JONH JOE" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required className="input" placeholder="you@company.com" />
        </Field>
      </div>
      <Field label="Subject">
        <input name="subject" className="input" placeholder="Partnership, demo, feedback…" />
      </Field>
      <Field label="Message">
        <textarea name="message" rows={5} required className="input resize-none" placeholder="Tell us a bit about what you need…" />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Send message"}
        </button>
        <span className="text-xs text-zinc-500">
          Or email <a className="underline" href="mailto:support@sentimentx.app">support@sentimentx.app</a>
        </span>
      </div>

      <style jsx>{`
        .input {
          @apply w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-600 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400;
        }
        textarea.input {
          @apply w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-600 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function TestimonialMarquee() {
  const items = useMemo(
    () => [
      { who: "PM, FAANG", quote: "Perfect for pre-meeting briefs. Crisp and accurate." },
      { who: "Founder", quote: "Saved me hours on market scans this quarter." },
      { who: "Trader", quote: "Fast levels + headlines in seconds. Chef’s kiss." },
      { who: "Analyst", quote: "Summaries are tight, links are clutch. Love it." },
      { who: "Engineer", quote: "Finally a finance AI that doesn’t ramble." },
    ],
    []
  );

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-zinc-950 via-transparent to-zinc-950" />
      <ul className="flex gap-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <li className="animate-marquee will-change-transform flex gap-4">
          {items.map((t, i) => (
            <Bubble key={`a-${i}`} {...t} />
          ))}
        </li>
        <li aria-hidden className="animate-marquee will-change-transform flex gap-4" style={{ animationDelay: "6s" }}>
          {items.map((t, i) => (
            <Bubble key={`b-${i}`} {...t} />
          ))}
        </li>
      </ul>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 12s linear infinite;
        }
      `}</style>
    </div>
  );
}
function Bubble({ who, quote }: { who: string; quote: string }) {
  return (
    <div className="min-w-[260px] max-w-[280px] rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-[0_0_0_1px_rgba(59,130,246,0.1)_inset]">
      <p className="text-sm text-zinc-300">“{quote}”</p>
      <p className="mt-2 text-xs text-zinc-500">— {who}</p>
    </div>
  );
}