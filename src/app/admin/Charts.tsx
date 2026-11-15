"use client";

import { useEffect, useId, useRef, useState } from "react";

// Small hand-made SVG charts for /admin: thin marks, one axis, a hover
// tooltip on every chart. Colors come from the CSS variables in page.tsx.

type Point = { day: string; value: number };
type LineSeries = { label: string; color: string; points: Point[] };

const fmtDay = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtNum = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(1));

function niceMax(v: number) {
  if (v <= 4) return Math.max(v, 1) <= 1 ? 1 : 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

// Charts draw at their real width, so text stays the same size everywhere.
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(200, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { box: ref, W: w };
}

const PAD = { l: 36, r: 12, t: 10, b: 24 };

function Axes({ h, max, days, W }: { h: number; max: number; days: string[]; W: number }) {
  const ticks = [0, max / 2, max];
  const innerH = h - PAD.t - PAD.b;
  const innerW = W - PAD.l - PAD.r;
  const step = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(W / 90))));
  return (
    <g className="axes">
      {ticks.map((t) => {
        const y = PAD.t + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className={t === 0 ? "baseline" : "grid"} />
            <text x={PAD.l - 6} y={y + 3.5} textAnchor="end">
              {fmtNum(t)}
            </text>
          </g>
        );
      })}
      {days.map((d, i) =>
        i % step === 0 || i === days.length - 1 ? (
          <text
            key={d}
            x={PAD.l + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW)}
            y={h - 6}
            textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}
          >
            {fmtDay(d)}
          </text>
        ) : null,
      )}
    </g>
  );
}

function useHover(n: number, W: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [i, setI] = useState<number | null>(null);
  const move = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    const t = (x - PAD.l) / (W - PAD.l - PAD.r);
    setI(Math.max(0, Math.min(n - 1, Math.round(t * (n - 1)))));
  };
  return { ref, i, move, leave: () => setI(null) };
}

function Tip({ x, h, W, children }: { x: number; h: number; W: number; children: React.ReactNode }) {
  const left = (x / W) * 100;
  return (
    <div className="tip" style={{ left: `${left}%`, top: 0, transform: `translateX(${left > 60 ? "-105%" : "5%"})`, maxHeight: h }}>
      {children}
    </div>
  );
}

export function LineChart({ series, height = 220, area = false }: { series: LineSeries[]; height?: number; area?: boolean }) {
  const { box, W } = useWidth();
  const days = series[0]?.points.map((p) => p.day) ?? [];
  const n = days.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.value))));
  const innerH = height - PAD.t - PAD.b;
  const innerW = W - PAD.l - PAD.r;
  const X = (i: number) => PAD.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const Y = (v: number) => PAD.t + innerH - (v / max) * innerH;
  const { ref: svgRef, i: hi, move, leave } = useHover(n, W);
  const gid = useId();
  return (
    <div className="chart">
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="plot" ref={box}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${height}`} onPointerMove={move} onPointerLeave={leave} role="img">
          <Axes h={height} max={max} days={days} W={W} />
          {series.map((s, si) => {
            const d = s.points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join("");
            return (
              <g key={s.label}>
                {area && si === 0 && n > 1 && (
                  <>
                    <defs>
                      <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0" stopColor={s.color} stopOpacity="0.18" />
                        <stop offset="1" stopColor={s.color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={`${d}L${X(n - 1)},${Y(0)}L${X(0)},${Y(0)}Z`} fill={`url(#${gid})`} />
                  </>
                )}
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {n === 1 && <circle cx={X(0)} cy={Y(s.points[0].value)} r={4} fill={s.color} />}
              </g>
            );
          })}
          {hi !== null && (
            <g>
              <line x1={X(hi)} x2={X(hi)} y1={PAD.t} y2={height - PAD.b} className="cross" />
              {series.map((s) => (
                <circle key={s.label} cx={X(hi!)} cy={Y(s.points[hi!].value)} r={4.5} fill={s.color} className="ring" />
              ))}
            </g>
          )}
        </svg>
        {hi !== null && (
          <Tip x={X(hi)} h={height} W={W}>
            <b>{fmtDay(days[hi])}</b>
            {series.map((s) => (
              <span key={s.label}>
                <i style={{ background: s.color }} />
                {s.label} <em>{fmtNum(s.points[hi!].value)}</em>
              </span>
            ))}
          </Tip>
        )}
      </div>
    </div>
  );
}

export function BarChart({ points, label, color, height = 180 }: { points: Point[]; label: string; color: string; height?: number }) {
  const { box, W } = useWidth();
  const n = points.length;
  const max = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const innerH = height - PAD.t - PAD.b;
  const innerW = W - PAD.l - PAD.r;
  const slot = innerW / Math.max(1, n);
  const bw = Math.max(1.5, Math.min(18, slot - 2));
  const X = (i: number) => PAD.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * (innerW - slot) + slot / 2);
  const { ref: svgRef, i: hi, move, leave } = useHover(n, W);
  const r = Math.min(4, bw / 2);
  return (
    <div className="chart">
      <div className="plot" ref={box}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${height}`} onPointerMove={move} onPointerLeave={leave} role="img">
          <Axes h={height} max={max} days={points.map((p) => p.day)} W={W} />
          {points.map((p, i) => {
            if (!p.value) return null;
            const bh = Math.max(1, (p.value / max) * innerH);
            const x = X(i) - bw / 2;
            const y = PAD.t + innerH - bh;
            const rr = Math.min(r, bh);
            return (
              <path
                key={p.day}
                d={`M${x},${y + bh}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + bw - rr}Q${x + bw},${y} ${x + bw},${y + rr}V${y + bh}Z`}
                fill={color}
                opacity={hi === null || hi === i ? 1 : 0.45}
              />
            );
          })}
        </svg>
        {hi !== null && (
          <Tip x={X(hi)} h={height} W={W}>
            <b>{fmtDay(points[hi].day)}</b>
            <span>
              {label} <em>{fmtNum(points[hi].value)}</em>
            </span>
          </Tip>
        )}
      </div>
    </div>
  );
}

// A tiny trend line for the small multiples.
export function Spark({ points, color }: { points: Point[]; color: string }) {
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 200;
  const hh = 44;
  const X = (i: number) => (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const Y = (v: number) => 4 + (hh - 8) * (1 - v / max);
  const [i, setI] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const d = points.map((p, k) => `${k ? "L" : "M"}${X(k).toFixed(1)},${Y(p.value).toFixed(1)}`).join("");
  return (
    <div className="spark">
      <svg
        ref={ref}
        viewBox={`0 0 ${w} ${hh}`}
        preserveAspectRatio="none"
        onPointerMove={(e) => {
          const r = ref.current?.getBoundingClientRect();
          if (r && n) setI(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
        }}
        onPointerLeave={() => setI(null)}
      >
        <line x1={0} x2={w} y1={hh - 4} y2={hh - 4} className="baseline" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {i !== null && <line x1={X(i)} x2={X(i)} y1={0} y2={hh} className="cross" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="spark-tip">{i !== null ? `${fmtDay(points[i].day)}: ${fmtNum(points[i].value)}` : " "}</div>
    </div>
  );
}

// Horizontal bars for ranked lists and distributions.
export function HBars({ rows, color, unit = "" }: { rows: { label: string; value: number; sub?: string }[]; color: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label + (r.sub ?? "")} title={`${r.label}: ${r.value.toLocaleString("en-US")}${unit}`}>
          <span className="hb-label">
            {r.label}
            {r.sub && <small>{r.sub}</small>}
          </span>
          <span className="hb-track">
            <span className="hb-bar" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: color }} />
          </span>
          <span className="hb-val">{r.value.toLocaleString("en-US")}</span>
        </li>
      ))}
    </ul>
  );
}

// Column chart for a fixed set of categories (hours, weekdays, streak lengths).
export function Columns({ rows, color, label, height = 150 }: { rows: { label: string; value: number }[]; color: string; label: string; height?: number }) {
  const { box, W } = useWidth();
  const max = niceMax(Math.max(1, ...rows.map((r) => r.value)));
  const [i, setI] = useState<number | null>(null);
  const n = rows.length;
  const innerW = W - PAD.l - PAD.r;
  const innerH = height - PAD.t - PAD.b;
  const slot = innerW / n;
  const bw = Math.min(40, slot - 2);
  return (
    <div className="chart">
      <div className="plot" ref={box}>
        <svg viewBox={`0 0 ${W} ${height}`} role="img" onPointerLeave={() => setI(null)}>
          {[0, max / 2, max].map((t) => {
            const y = PAD.t + innerH - (t / max) * innerH;
            return (
              <g key={t} className="axes">
                <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className={t === 0 ? "baseline" : "grid"} />
                <text x={PAD.l - 6} y={y + 3.5} textAnchor="end">
                  {fmtNum(t)}
                </text>
              </g>
            );
          })}
          {rows.map((r, k) => {
            const cx = PAD.l + slot * k + slot / 2;
            const bh = r.value ? Math.max(1, (r.value / max) * innerH) : 0;
            const y = PAD.t + innerH - bh;
            const rr = Math.min(4, bw / 2, bh);
            const x = cx - bw / 2;
            return (
              <g key={r.label} onPointerEnter={() => setI(k)}>
                <rect x={PAD.l + slot * k} y={PAD.t} width={slot} height={innerH} fill="transparent" />
                {bh > 0 && (
                  <path
                    d={`M${x},${y + bh}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + bw - rr}Q${x + bw},${y} ${x + bw},${y + rr}V${y + bh}Z`}
                    fill={color}
                    opacity={i === null || i === k ? 1 : 0.45}
                  />
                )}
                {(slot >= 26 || k % Math.ceil(26 / slot) === 0) && (
                  <text x={cx} y={height - 6} textAnchor="middle" className="axes-text">
                    {r.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {i !== null && (
          <Tip x={PAD.l + slot * i + slot / 2} h={height} W={W}>
            <b>{rows[i].label}</b>
            <span>
              {label} <em>{rows[i].value.toLocaleString("en-US")}</em>
            </span>
          </Tip>
        )}
      </div>
    </div>
  );
}
