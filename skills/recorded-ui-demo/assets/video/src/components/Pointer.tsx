// The mouse pointer, drawn back over the take.
//
// Chromium's screencast leaves the pointer out, so take.ts logs where the mouse was and when it
// clicked (cursor.json, in take seconds). This replays that log: an arrow that follows the
// logged path, dips while the button is down, and sends out a ring from the click point.
//
// Everything is in take seconds, so the arrow, the press and the ring land on the same frames
// as the page's reaction in the take, whatever the clip's rate.
import React, { useId } from 'react';

export type PointerLog = {
  /** Points the mouse passed through. take.ts logs one at the start and end of each glide. */
  path: { t: number; x: number; y: number }[];
  /** When each mouse-down happened. */
  clicks: number[];
};

// take.ts glides the real mouse along this curve (ease-in-out quad). Using the same one keeps
// the drawn arrow where the real mouse was, so hover states in the take line up with it.
const glideCurve = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (2 - 2 * u) ** 2 / 2);

/** Where the logged mouse was at take time `t`. Holds between glides. */
export function pointerAt(log: PointerLog, t: number): { x: number; y: number } {
  const p = log.path;
  if (!p.length) return { x: 0, y: 0 };
  if (t <= p[0].t) return p[0];
  const last = p[p.length - 1];
  if (t >= last.t) return last;
  // Last point at or before t (the path is in time order).
  let lo = 0;
  let hi = p.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = p[lo];
  const b = p[hi];
  const k = b.t > a.t ? glideCurve((t - a.t) / (b.t - a.t)) : 1;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

// take.ts holds the button for 90 ms. The arrow sinks over the first 50 ms, stays down, then
// springs back over 150 ms after release.
const DOWN_S = 0.09;
const SINK_S = 0.05;
const RELEASE_S = 0.15;
const RING_S = 0.55;

const pressDepth = (d: number) => {
  if (d < 0) return 0;
  if (d < SINK_S) return d / SINK_S;
  if (d < DOWN_S) return 1;
  return Math.max(0, 1 - (d - DOWN_S) / RELEASE_S);
};

const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;

// Arrow outline with its tip at (0, 0), in arrow units; ARROW_H units tall.
const ARROW = 'M0 0 V18.5 L4.4 14.4 L7.6 21.5 L11 20 L7.8 13 H13.8 Z';
const ARROW_H = 21.5;

export type PointerProps = {
  log: PointerLog;
  /** Take time in seconds. */
  t: number;
  /** Arrow height in px of the parent's space. Divide by the camera zoom to keep it constant on screen. */
  size?: number;
  /** Click ring colour. */
  ring?: string;
  opacity?: number;
};

export const Pointer: React.FC<PointerProps> = ({ log, t, size = 32, ring = 'rgba(70,110,230,0.75)', opacity = 1 }) => {
  const shadow = `pointer-shadow-${useId().replace(/:/g, '')}`;
  const { x, y } = pointerAt(log, t);
  const unit = size / ARROW_H;
  const recent = log.clicks.filter((c) => t >= c && t - c < RING_S);
  const sink = recent.reduce((m, c) => Math.max(m, pressDepth(t - c)), 0);

  return (
    <svg
      width={1}
      height={1}
      style={{ position: 'absolute', left: x, top: y, overflow: 'visible', opacity, pointerEvents: 'none' }}
    >
      <defs>
        <filter id={shadow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx={0} dy={1.2} stdDeviation={1.1} floodColor="#000" floodOpacity={0.35} />
        </filter>
      </defs>
      <g transform={`scale(${unit})`}>
        {recent.map((c) => {
          const u = (t - c) / RING_S;
          const r = 3 + 21 * easeOutCubic(u);
          return (
            <g key={c}>
              <circle r={r} fill={ring} fillOpacity={0.22 * (1 - u)} />
              <circle r={r} fill="none" stroke={ring} strokeWidth={2.2} strokeOpacity={(1 - u) ** 1.5} />
            </g>
          );
        })}
        <g transform={`scale(${1 - 0.15 * sink})`} filter={`url(#${shadow})`}>
          <path d={ARROW} fill="#111" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
};
