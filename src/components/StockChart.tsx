"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  Decimation,
  ChartOptions,
  ChartData,
} from "chart.js";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  Decimation
);

type Props = {
  data: number[];
  dates?: string[];
  label?: string;
  height?: number;
};

export default function StockChart({
  data,
  dates,
  label = "Closing Price",
  height = 260,
}: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [gradient, setGradient] = useState<string | CanvasGradient>("rgba(59, 130, 246, 0.15)");

  // Early return if no data
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-sm text-slate-500 border rounded-md p-3">
        No price series available.
      </div>
    );
  }

  // Build gradient *after* mount so canvas context is available
  useEffect(() => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, "rgba(59, 130, 246, 0.35)");
        g.addColorStop(1, "rgba(59, 130, 246, 0.02)");
        setGradient(g);
      }
    }
  }, [data.length]); // recalc if data size changes

  const labels = useMemo(
    () =>
      Array.isArray(dates) && dates.length === data.length
        ? dates
        : Array.from({ length: data.length }, (_, i) => `Day ${i + 1}`),
    [dates, data.length]
  );

  const chartData: ChartData<"line"> = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label,
          data,
          borderColor: "#3b82f6",
          backgroundColor: gradient,
          pointRadius: 0,
          borderWidth: 1.8,
          tension: 0.25,
          fill: true,
        },
      ],
    }),
    [labels, data, label, gradient]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        decimation: {
          enabled: true,
          algorithm: "lttb",
          samples: 250,
        },
        legend: {
          display: true,
          position: "top",
          labels: { usePointStyle: true, boxWidth: 6, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              return `${ctx.dataset.label}: ${
                typeof v === "number" ? v.toFixed(2) : v
              }`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, color: "#64748b" },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#64748b" },
          grid: { color: "rgba(148,163,184,0.2)" },
        },
      },
    }),
    []
  );

  return (
    <div ref={canvasRef} style={{ height }} className="w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}