"use client";

import { useState } from "react";

/**
 * Single-series daily bar chart: one hue, 4px rounded tops anchored to the
 * baseline, 2px gaps, hover tooltip, and a hidden table for screen readers.
 */
export function DailyBars({ data, label }: { data: { day: string; value: number }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 560;
  const H = 140;
  const gap = 2;
  const bw = W / data.length - gap;
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <figure className="doc p-5">
      <figcaption className="text-sm text-muted">{label}</figcaption>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={label}>
          <line x1={0} x2={W} y1={H} y2={H} stroke="currentColor" className="text-line" strokeWidth={1} />
          {data.map((d, i) => {
            const h = (d.value / max) * (H - 8);
            const x = i * (bw + gap);
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={x} y={0} width={bw + gap} height={H} fill="transparent" />
                {d.value > 0 && (
                  <path
                    d={`M${x},${H} V${H - h + 4} q0,-4 4,-4 H${x + bw - 4} q4,0 4,4 V${H} Z`}
                    fill="var(--ink)"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
              </g>
            );
          })}
          <text x={0} y={H + 14} className="fill-current text-[10px] text-muted">{fmt(data[0].day)}</text>
          <text x={W} y={H + 14} textAnchor="end" className="fill-current text-[10px] text-muted">{fmt(data[data.length - 1].day)}</text>
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 whitespace-nowrap rounded-[3px] border border-line bg-bg px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: `${((hover + 0.5) / data.length) * 100}%`, transform: "translate(-50%, -100%)" }}
          >
            <span className="text-muted">{fmt(data[hover].day)}</span> · <span className="font-medium tabular">{data[hover].value}</span>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
