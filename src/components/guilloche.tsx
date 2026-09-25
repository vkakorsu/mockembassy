/**
 * Passport-style security print: overlapping rosette curves generated from
 * sums of sines, rendered once on the server as a lightweight SVG.
 */
export function Guilloche({ className = "", rings = 18, seed = 7 }: { className?: string; rings?: number; seed?: number }) {
  const paths: string[] = [];
  const cx = 300;
  const cy = 300;
  for (let r = 0; r < rings; r++) {
    const base = 70 + r * 12;
    const pts: string[] = [];
    for (let i = 0; i <= 360; i += 2) {
      const t = (i * Math.PI) / 180;
      const rad = base + 18 * Math.sin(seed * t + r * 0.35) + 7 * Math.sin((seed + 5) * t);
      pts.push(`${(cx + rad * Math.cos(t)).toFixed(1)},${(cy + rad * Math.sin(t)).toFixed(1)}`);
    }
    paths.push(`M${pts.join("L")}Z`);
  }
  return (
    <svg viewBox="0 0 600 600" aria-hidden className={className} fill="none">
      {paths.map((d, i) => (
        <path key={i} d={d} stroke="currentColor" strokeWidth={0.7} />
      ))}
    </svg>
  );
}

/** A decorative machine-readable-zone line, as printed at the bottom of a passport. */
export function Mrz({ lines, className = "" }: { lines: string[]; className?: string }) {
  return (
    <div aria-hidden className={`overflow-hidden whitespace-nowrap font-mono text-[11px] leading-5 tracking-[0.2em] text-muted ${className}`}>
      {lines.map((l) => (
        <div key={l}>{l.toUpperCase().replace(/ /g, "<").padEnd(44, "<")}</div>
      ))}
    </div>
  );
}
