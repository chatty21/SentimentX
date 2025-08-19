// src/app/welcome/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useTime, useTransform } from 'framer-motion';

const headlines = [
  'Realtime sentiment from live headlines.',
  'Technicals distilled to one line.',
  'Ask anything — get a crisp verdict.',
];

export default function WelcomePage() {
  const router = useRouter();

  // gate fancy bits after mount to avoid SSR mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // If already authenticated via Supabase cookie, bounce to "/"
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/auth/session', { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (j?.user) {
          try {
            await fetch('/api/intro/seen', { method: 'POST' });
          } catch {}
          try {
            document.cookie = 'intro_seen=1; Max-Age=31536000; Path=/; SameSite=Lax';
          } catch {}
          router.replace('/');
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const onNext = async () => {
    try {
      await fetch('/api/intro/seen', { method: 'POST' });
    } catch {}
    router.push('/login');
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060b18] text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_-10%,rgba(56,189,248,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,.55)_40%,rgba(2,6,23,1)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-20 pb-16 md:pb-20">
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-[10px] sm:text-xs tracking-[0.25em] text-zinc-400 uppercase"
        >
          SentimentX
        </motion.p>

        <HeroTitle mounted={mounted} />

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-5 max-w-2xl text-base sm:text-lg text-zinc-300"
        >
          An AI copilot for the S&amp;P 500 that turns messy markets into one-line, actionable
          reads — powered by live news, technicals, and LLMs.
        </motion.p>

        <ul className="mt-8 grid gap-3 max-w-2xl">
          {headlines.map((h, i) => (
            <RotatingLine key={h} index={i} text={h} />
          ))}
        </ul>

        <div className="mt-12">{mounted ? <SparklinePanel /> : <SparklineSkeleton />}</div>

        <div className="mt-10 md:mt-12 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onNext}
            className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-3 text-sm font-medium hover:bg-cyan-400/20 transition shadow-lg shadow-cyan-500/5"
          >
            Next
          </button>
          <button
            onClick={() => router.push('/login')}
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-medium hover:bg-zinc-900 transition"
          >
            Log in
          </button>
        </div>
      </div>
    </main>
  );
}

/* ---------- hero title ---------- */

function HeroTitle({ mounted }: { mounted: boolean }) {
  const time = useTime();
  const shimmerX = useTransform(time, [0, 4000], ['-20%', '120%'], { clamp: false });

  return (
    <div className="mt-3 sm:mt-4 relative inline-block">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="text-4xl sm:text-6xl md:text-7xl font-extrabold leading-tight"
      >
        Signal over noise
      </motion.h1>

      {mounted && (
        <motion.span
          style={{ left: shimmerX }}
          className="pointer-events-none absolute top-0 h-full w-[35%] bg-gradient-to-r from-transparent via-white/10 to-transparent blur-[6px]"
        />
      )}
    </div>
  );
}

/* ---------- rotating value lines ---------- */

function RotatingLine({ text, index }: { text: string; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 + index * 0.12, duration: 0.5 }}
      className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
    >
      <div className="relative p-3 text-sm text-zinc-300">
        <span className="absolute left-3 top-4 h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
        <span className="pl-6">{text}</span>
        <motion.span
          initial={{ x: '-20%' }}
          animate={{ x: '120%' }}
          transition={{ repeat: Infinity, duration: 3.2, ease: 'linear', delay: 0.5 + index * 0.2 }}
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        />
      </div>
    </motion.li>
  );
}

/* ---------- sparkline panel ---------- */

function SparklinePanel() {
  const points = useMemo(() => {
    const N = 90;
    const arr: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 100;
      const y = 50 + Math.sin(i / 6) * 18 + Math.cos(i / 11) * 9 + Math.sin(i * 1.7) * 3.5;
      arr.push([x, y]);
    }
    return arr;
  }, []);

  const path = useMemo(() => {
    const [h, w] = [200, 800];
    return 'M ' + points.map(([px, py]) => `${(px / 100) * w},${h - (py / 100) * h}`).join(' L ');
  }, [points]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_70%_0%,rgba(59,130,246,0.25),transparent_60%)]" />
      <svg viewBox="0 0 800 200" className="relative z-10 block h-56 w-full">
        {[0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1="0" x2="800" y1={(200 * y) / 100} y2={(200 * y) / 100} stroke="rgba(255,255,255,0.05)" />
        ))}
        <motion.path d={path} fill="none" stroke="url(#g)" strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease: 'easeInOut' }} />
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pointer-events-none absolute inset-0">
        <FloatingChip delay={0} text="RSI 52 • Neutral" />
        <FloatingChip delay={0.8} text="MA50 +1.2%" />
        <FloatingChip delay={1.4} text="Headline tone: Bullish" />
      </div>
    </div>
  );
}

function SparklineSkeleton() {
  return <div className="h-56 w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 animate-pulse" />;
}

function FloatingChip({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className="absolute right-4 top-4 rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-200 backdrop-blur"
    >
      {text}
    </motion.div>
  );
}