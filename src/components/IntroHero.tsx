"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import Link from "next/link";

/* ---------------- helpers ---------------- */

type Pt = [number, number];        // x,y tuple
type Series = Pt[];

/* ---------------- helpers ---------------- */

function rand(n: number, m: number) {
  return Math.random() * (m - n) + n;
}

function makeSeries(len = 64): Series {
  // build a synthetic “price path” then normalize 0..1
  const pts: Series = Array.from({ length: len }, (_ , i) => [i, 0] as Pt);
  let v = 0;
  for (let i = 0; i < len; i++) {
    v += rand(-1.2, 1.8);
    pts[i][1] = v;
  }

  // normalize Y
  const ys = pts.map((p) => p[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys) || 1;
  return pts.map(([x, y]) => [x, (y - min) / (max - min)] as Pt);
}

function toPath(series: Series, width: number, height: number, pad = 8) {
  const w = width - pad * 2;
  const h = height - pad * 2;
  const n = Math.max(series.length - 1, 1);

  const parts: string[] = [];
  series.forEach(([x, y], i) => {
    const px = pad + (x / n) * w;
    const py = pad + (1 - y) * h;
    parts.push(`${i === 0 ? "M" : "L"}${px},${py}`);
  });
  return parts.join(" ");
}

/* ---------------- main ---------------- */

const TAGLINES = [
  "Read the tape. Before it moves.",
  "LLM-powered sentiment — minus the fluff.",
  "Price, context, catalysts. One tight answer.",
  "Signals, not scrolls.",
];

const TICKERS = [
  "AAPL","NVDA","MSFT","AMZN","META","GOOGL","AVGO","JPM","XOM","UNH",
  "LMT","TSLA","COST","NFLX","LIN","PEP","ADBE","AMD","LLY","V"
];

export default function IntroHero() {
  const [w, setW] = useState(960);
  const [h, setH] = useState(320);
  const [series, setSeries] = useState<[number, number][]>(makeSeries());
  const [nextSeries, setNextSeries] = useState<[number, number][]>(makeSeries());
  const [tagIdx, setTagIdx] = useState(0);
  const controls = useAnimation();
  const svgRef = useRef<SVGSVGElement>(null);

  // resize observer for crisp SVG
  useEffect(() => {
    function onResize() {
      const el = svgRef.current?.parentElement;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setW(Math.max(320, Math.floor(rect.width)));
      setH(Math.max(220, Math.floor(rect.height)));
    }
    onResize();
    const ro = new ResizeObserver(onResize);
    if (svgRef.current?.parentElement) ro.observe(svgRef.current.parentElement);
    return () => ro.disconnect();
  }, []);

  // morph the path every few seconds
  useEffect(() => {
    const id = setInterval(() => {
      setNextSeries(makeSeries());
      controls.start({ opacity: [1, 0.2, 1] , transition: { duration: 1.4, ease: "easeInOut" }});
    }, 3200);
    return () => clearInterval(id);
  }, [controls]);

  // rotate tagline
  useEffect(() => {
    const id = setInterval(() => setTagIdx((i) => (i + 1) % TAGLINES.length), 2400);
    return () => clearInterval(id);
  }, []);

  // compute paths
  const d1 = useMemo(() => toPath(series, w, h, 12), [series, w, h]);
  const d2 = useMemo(() => toPath(nextSeries, w, h, 12), [nextSeries, w, h]);

  // blend series on every morph tick
  useEffect(() => {
    // simple linear blend to “arrive” at nextSeries
    const BLEND_STEPS = 24;
    let step = 0;
    const id = setInterval(() => {
      step++;
      const t = step / BLEND_STEPS;
      const blended = series.map((p, i) => {
        const nx = nextSeries[i]?.[1] ?? p[1];
        return [i, p[1] * (1 - t) + nx * t] as [number, number];
      });
      setSeries(blended);
      if (step >= BLEND_STEPS) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d2]);

  // set cookie on click
  function setSeenCookie() {
    document.cookie = "sx_seen_intro=1; path=/; max-age=" + 60 * 60 * 24 * 365;
  }

  return (
    <section className="relative w-full">
      {/* particle field */}
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]">
        <canvas ref={useParticles()} className="w-full h-full opacity-50" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-5 pt-20 sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1 text-[11px] uppercase tracking-widest text-cyan-200/90">
            SentimentX • Alpha
          </div>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Markets, distilled.
          </h1>

          <div className="relative mt-4 h-7 sm:h-8">
            <AnimatePresence mode="wait">
              <motion.p
                key={tagIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="text-balance text-sm sm:text-base text-slate-300"
              >
                {TAGLINES[tagIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* animated “price path” */}
        <div className="mt-10 w-full rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/40 to-slate-950/40 p-3 sm:p-4 shadow-2xl">
          <div className="h-[220px] sm:h-[300px]">
            <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              {/* grid */}
              {[...Array(6)].map((_, i) => (
                <line key={`g${i}`} x1="0" x2={w} y1={(h / 6) * i} y2={(h / 6) * i} stroke="rgba(100,116,139,0.15)" strokeWidth="1" />
              ))}
              {/* morphing path */}
              <motion.path
                d={d1}
                stroke="url(#grad)"
                strokeWidth="3"
                fill="none"
                animate={controls}
                className="filter drop-shadow-[0_0_8px_rgba(56,189,248,0.35)]"
              />
            </svg>
          </div>

          {/* running tickers */}
          <div className="relative mt-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
            <div
              className="whitespace-nowrap py-2 text-xs text-slate-300"
              style={{ animation: "marquee 24s linear infinite" }}
            >
              {[...TICKERS, ...TICKERS].map((t, i) => (
                <span key={i} className="mx-4 inline-flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{t}</span>
                  <span className="tabular-nums">{(100 + Math.round(rand(-250, 250)) / 10).toFixed(2)}</span>
                  <span className={rand(-1, 1) > 0 ? "text-emerald-400" : "text-rose-400"}>
                    {`${rand(-3, 3).toFixed(2)}%`}
                  </span>
                  <span className="text-slate-600">|</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* actions */}
        <div className="mt-8 flex w-full max-w-md flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/"
            onClick={setSeenCookie}
            className="inline-flex w-full items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-3 text-sm font-medium text-cyan-100 hover:bg-cyan-400/15 sm:w-auto"
          >
            Next
          </Link>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-5 py-3 text-sm text-slate-200 hover:bg-slate-800 sm:w-auto"
          >
            Create account
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

/* ---------------- tiny particle field (canvas) ---------------- */

function useParticles() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let w = (canvas.width = canvas.offsetWidth || canvas.parentElement?.clientWidth || 1200);
    let h = (canvas.height = canvas.offsetHeight || canvas.parentElement?.clientHeight || 420);

    const N = Math.round((w * h) / 14000); // density responsive
    const pts = new Array(N).fill(0).map(() => ({
      x: rand(0, w), y: rand(0, h), vx: rand(-0.3, 0.3), vy: rand(-0.25, 0.25)
    }));

    const DPR = Math.min(2, window.devicePixelRatio || 1);
    function resize() {
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    function frame() {
      ctx.clearRect(0, 0, w, h);
      // draw links
      for (let i = 0; i < N; i++) {
        const a = pts[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < -10) a.x = w + 10; if (a.x > w + 10) a.x = -10;
        if (a.y < -10) a.y = h + 10; if (a.y > h + 10) a.y = -10;
        for (let j = i + 1; j < N; j++) {
          const b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 120 * 120) {
            const alpha = 1 - d2 / (120 * 120);
            ctx.strokeStyle = `rgba(56,189,248,${0.08 * alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // point
        ctx.fillStyle = "rgba(56,189,248,0.35)";
        ctx.fillRect(a.x, a.y, 1.6, 1.6);
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return ref;
}