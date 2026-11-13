// Building blocks for cutting a recorded take: camera, clips, captions, dark cards, overlays.
// Demo.tsx is the per-demo script; edit this file only to change the look (theme below).
//
// Layout of a clip: the page fills the width of the frame, with a dark strip under it for the
// caption, so captions never cover the app. The camera stays on the whole page by default and
// can lean in on a small detail, at most MAX_ZOOM.
import React from 'react';
import { AbsoluteFill, Easing, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Pointer, PointerLog } from './components/Pointer';
import takeCursor from './cursor.json';
import takeMarks from './marks.json';
import takeBoxes from './boxes.json';
import takeInfo from './take.json';

export const FPS = 30;
/** Output frame. */
export const W = 1920;
export const H = 1080;
/** The take's viewport in CSS px and its device scale, as recorded (take.json from take.ts). */
export const VIEW = { w: takeInfo.width, h: takeInfo.height };
export const TAKE_SCALE = takeInfo.scale;
/** Least height of the caption strip under the page. */
export const STRIP = 120;
/** Where the page sits in the frame: as large as fits above the caption strip, centred. */
export const STAGE = (() => {
  const h = Math.min(H - STRIP, (W * VIEW.h) / VIEW.w);
  const w = (h * VIEW.w) / VIEW.h;
  return { x: (W - w) / 2, y: 0, w, h };
})();
/**
 * Deepest zoom, relative to the whole page. 1.5x shows a detail and still shows where it is;
 * deeper zooms hide the rest of the app. The take's pixels set a hard limit too (TAKE_SCALE
 * device px per CSS px, against STAGE.w / VIEW.w output px per CSS px with the whole page in view).
 */
export const MAX_ZOOM = Math.min(1.5, TAKE_SCALE / (STAGE.w / VIEW.w));
/** Narrowest camera rect, in CSS px. */
export const MIN_W = VIEW.w / MAX_ZOOM;

// Theme
// System fonts, first match wins. For identical output on every machine, load one with
// @remotion/google-fonts and put it first.
export const SANS = '"Ubuntu Sans", Ubuntu, "Segoe UI", "Helvetica Neue", "DejaVu Sans", Arial, sans-serif';
export const MONO = '"Ubuntu Sans Mono", "Ubuntu Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';
export const ACCENT = '#c4a1ff'; // light violet on dark
export const TEAL = '#5eead4';
export const INK = '#0f0a1a';
export const RIPPLE = 'rgba(128,57,223,0.75)';

export const ease = Easing.bezier(0.65, 0, 0.35, 1);
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const sec = (s: number) => Math.round(s * FPS);

// ---------------------------------------------------------------------------
// The recorder's logs. All on the take's clock, in seconds and CSS px.
export const M = takeMarks as Record<string, number>;
export type Box = { x: number; y: number; width: number; height: number };
export const B = takeBoxes as Record<string, Box | null>;
const CURSOR = takeCursor as PointerLog;

// ---------------------------------------------------------------------------
// Camera: a rect in the take's CSS px, with the viewport's aspect ratio, shown in the STAGE.
// FULL (w = VIEW.w) is the whole page, and the default.
export type Rect = { x: number; y: number; w: number };
export type Key = { t: number; r: Rect };
export const FULL: Rect = { x: 0, y: 0, w: VIEW.w };
const heightOf = (w: number) => (w * VIEW.h) / VIEW.w;

export const clampRect = (r: Rect): Rect => {
  const w = Math.min(Math.max(r.w, MIN_W), VIEW.w);
  return { w, x: Math.min(Math.max(r.x, 0), VIEW.w - w), y: Math.min(Math.max(r.y, 0), VIEW.h - heightOf(w)) };
};

type MaybeBox = Box | null | undefined;
/**
 * A rect centred on a logged box (or several), with `pad` px around it, never tighter than
 * MIN_W (MAX_ZOOM). Use it for a brief look at a small detail; most of a clip stays on FULL.
 * If the boxes don't fit at MAX_ZOOM, the rect comes out wider; at FULL, stay wide instead.
 * Pass `w` to set the width yourself; the rect stays centred on the boxes.
 */
export const fit = (boxes: MaybeBox | MaybeBox[], opts: { pad?: number; w?: number } = {}): Rect => {
  const list = (Array.isArray(boxes) ? boxes : [boxes]).filter((b): b is Box => !!b);
  if (!list.length) return FULL;
  const pad = opts.pad ?? 24;
  const x0 = Math.min(...list.map((b) => b.x)) - pad;
  const y0 = Math.min(...list.map((b) => b.y)) - pad;
  const x1 = Math.max(...list.map((b) => b.x + b.width)) + pad;
  const y1 = Math.max(...list.map((b) => b.y + b.height)) + pad;
  const w = opts.w ?? Math.max(x1 - x0, ((y1 - y0) * VIEW.w) / VIEW.h, MIN_W);
  return clampRect({ x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - heightOf(w) / 2, w });
};

/** Camera position at `t` seconds into a clip: holds on each key, eases between them. */
export const camAt = (t: number, keys: Key[]): Rect => {
  if (t <= keys[0].t) return clampRect(keys[0].r);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.t) {
      const p = ease((t - a.t) / Math.max(0.001, b.t - a.t));
      const ra = clampRect(a.r);
      const rb = clampRect(b.r);
      return { x: ra.x + (rb.x - ra.x) * p, y: ra.y + (rb.y - ra.y) * p, w: ra.w + (rb.w - ra.w) * p };
    }
  }
  return clampRect(keys[keys.length - 1].r);
};

// ---------------------------------------------------------------------------
export const Fade: React.FC<{ dur: number; inF?: number; outF?: number; bg?: string; children: React.ReactNode }> = ({ dur, inF = 8, outF = 8, bg = '#fff', children }) => {
  const f = useCurrentFrame();
  const fi = inF ? interpolate(f, [0, inF], [0, 1], clamp) : 1;
  const fo = outF ? interpolate(f, [dur - outF, dur], [1, 0], clamp) : 1;
  return <AbsoluteFill style={{ opacity: Math.min(fi, fo), background: bg }}>{children}</AbsoluteFill>;
};

/** One line in the strip under the page, with an optional act tag. Never covers the app. */
export const Caption: React.FC<{ text: string; dur: number; part?: string }> = ({ text, dur, part }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [6, 16, dur - 10, dur], [0, 1, 1, 0], clamp);
  const y = interpolate(f, [6, 18], [10, 0], { ...clamp, easing: ease });
  const top = STAGE.y + STAGE.h;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        height: H - top,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        opacity: o,
        transform: `translateY(${y}px)`,
        color: '#fff',
        fontFamily: SANS,
        fontSize: 36,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {part ? (
        <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 1, color: ACCENT, border: `2px solid ${ACCENT}`, borderRadius: 10, padding: '3px 10px' }}>{part}</span>
      ) : null}
      <span>{text}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Clips. A clip plays [src, src + dur * rate) of the take, in take seconds.
export type ClipSpec = {
  src: number;
  dur: number;
  /** Playback speed. 1.2-1.4 tightens slow stretches; above ~1.5 typing looks frantic. */
  rate?: number;
  /** Camera keys, `t` in clip seconds (output time). */
  keys: Key[];
  caption: string;
  /** Short tag shown in the caption, e.g. the act: SEARCH, EDIT. */
  part?: string;
  fadeIn?: boolean;
  fadeOut?: boolean;
  /** Drawn over the take, given the take time, e.g. a terminal showing an API call. */
  overlay?: (t: number) => React.ReactNode;
};

/**
 * Back-to-back clips from cut points. cuts[i] is where clip i starts in the take and cuts[i+1]
 * where it ends, so nothing is skipped or shown twice; each clip's length follows from its rate.
 */
export const cutClips = (cuts: number[], specs: Omit<ClipSpec, 'src' | 'dur'>[]): ClipSpec[] => {
  if (cuts.length !== specs.length + 1) throw new Error(`cutClips: ${specs.length} clips need ${specs.length + 1} cuts, got ${cuts.length}`);
  return specs.map((c, i) => ({ ...c, src: cuts[i], dur: (cuts[i + 1] - cuts[i]) / (c.rate ?? 1) }));
};

export const Clip: React.FC<{ c: ClipSpec }> = ({ c }) => {
  const f = useCurrentFrame();
  const rate = c.rate ?? 1;
  const t = f / FPS;
  const r = camAt(t, c.keys);
  const s = STAGE.w / r.w; // output px per CSS px
  const takeT = c.src + t * rate;
  const durF = sec(c.dur);
  return (
    <Fade dur={durF} inF={c.fadeIn ? 8 : 0} outF={c.fadeOut ? 8 : 0} bg={INK}>
      <div style={{ position: 'absolute', left: STAGE.x, top: STAGE.y, width: STAGE.w, height: STAGE.h, overflow: 'hidden', background: '#fff' }}>
        {/* Sized to the zoom, not CSS-scaled, so the 2x take is sampled directly. */}
        <OffthreadVideo
          src={staticFile('take.mp4')}
          trimBefore={Math.round(c.src * FPS)}
          playbackRate={rate}
          muted
          style={{ position: 'absolute', left: -r.x * s, top: -r.y * s, width: VIEW.w * s, height: VIEW.h * s }}
        />
        <div style={{ position: 'absolute', width: VIEW.w, height: VIEW.h, transformOrigin: '0 0', transform: `scale(${s}) translate(${-r.x}px, ${-r.y}px)` }}>
          {/* Inside the zoomed layer so it follows the camera; size / s keeps it the same on screen. */}
          <Pointer log={CURSOR} t={takeT} size={30 / s} ring={RIPPLE} />
        </div>
      </div>
      {c.overlay?.(takeT)}
      <Caption text={c.caption} dur={durF} part={c.part} />
    </Fade>
  );
};

// ---------------------------------------------------------------------------
// The whole video: items played one after another.
export type Item = { name: string; dur: number; node: (dur: number) => React.ReactNode; clip?: ClipSpec };
export const clipItems = (clips: ClipSpec[]): Item[] => clips.map((c, i) => ({ name: `Clip ${i + 1}`, dur: sec(c.dur), node: () => <Clip c={c} />, clip: c }));
export const totalFrames = (items: Item[]) => items.reduce((n, it) => n + it.dur, 0);
export const Timeline: React.FC<{ items: Item[] }> = ({ items }) => {
  let at = 0;
  return (
    <AbsoluteFill style={{ background: INK }}>
      {items.map((it) => {
        const from = at;
        at += it.dur;
        return (
          <Sequence key={it.name} name={it.name} from={from} durationInFrames={it.dur}>
            {it.node(it.dur)}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Dark cards: title, diagram, recap.
export const Backdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 20% 10%, #2e1452 0%, ${INK} 62%)`, color: '#fff', fontFamily: SANS }}>{children}</AbsoluteFill>
);

/** Fade and slide up, starting at frame `at`. */
export const rise = (f: number, at: number) => ({
  opacity: interpolate(f, [at, at + 14], [0, 1], clamp),
  transform: `translateY(${interpolate(f, [at, at + 18], [24, 0], { ...clamp, easing: ease })}px)`,
});

export const Kicker: React.FC<{ f: number; children: React.ReactNode }> = ({ f, children }) => (
  <div style={{ position: 'absolute', top: 56, left: 100, ...rise(f, 0), fontFamily: MONO, color: ACCENT, fontSize: 28, letterSpacing: 1.5 }}>{children}</div>
);

export const TitleCard: React.FC<{ dur: number; kicker: string; title: string; sub: string; parts?: string[] }> = ({ dur, kicker, title, sub, parts = [] }) => {
  const f = useCurrentFrame();
  return (
    <Fade dur={dur} inF={10} outF={10} bg={INK}>
      <Backdrop>
        <AbsoluteFill style={{ justifyContent: 'center', padding: '0 180px' }}>
          <div style={{ ...rise(f, 4), fontFamily: MONO, color: ACCENT, fontSize: 30, letterSpacing: 2 }}>{kicker}</div>
          <div style={{ ...rise(f, 12), fontSize: 104, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>{title}</div>
          <div style={{ ...rise(f, 24), fontSize: 46, color: '#d6cce6', marginTop: 30, lineHeight: 1.3 }}>{sub}</div>
          <div style={{ display: 'flex', gap: 46, marginTop: 56 }}>
            {parts.map((p, i) => (
              <div key={p} style={{ ...rise(f, 40 + i * 8), fontSize: 32, color: '#ece6f5' }}>
                <span style={{ fontFamily: MONO, color: ACCENT, marginRight: 14 }}>{i + 1}</span>
                {p}
              </div>
            ))}
          </div>
        </AbsoluteFill>
      </Backdrop>
    </Fade>
  );
};

/** A box in a diagram card. Absolute px on the 1920x1080 frame; appears at frame `at`. */
export const Node: React.FC<{ x: number; y: number; w: number; h: number; head: string; sub: string; f: number; at: number; tone?: string }> = ({ x, y, w, h, head, sub, f, at, tone = ACCENT }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      ...rise(f, at),
      background: '#160f24',
      border: `2px solid ${tone}`,
      borderRadius: 18,
      boxShadow: '0 24px 50px rgba(0,0,0,0.45)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 30px',
    }}
  >
    <div style={{ fontSize: 36, fontWeight: 700 }}>{head}</div>
    <div style={{ fontFamily: MONO, fontSize: 24, color: '#b9adcc', marginTop: 8 }}>{sub}</div>
  </div>
);

/** An arrow that draws itself from (x1,y1) to (x2,y2) starting at frame `at`. */
export const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; f: number; at: number; tone?: string }> = ({ x1, y1, x2, y2, f, at, tone = ACCENT }) => {
  const p = interpolate(f, [at, at + 16], [0, 1], { ...clamp, easing: ease });
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <div style={{ position: 'absolute', left: x1, top: y1 - 2, width: len * p, height: 4, background: tone, transformOrigin: '0 50%', transform: `rotate(${ang}deg)`, borderRadius: 2 }}>
      {p > 0.98 && (
        <div style={{ position: 'absolute', right: -4, top: -9, width: 0, height: 0, borderTop: '11px solid transparent', borderBottom: '11px solid transparent', borderLeft: `18px solid ${tone}` }} />
      )}
    </div>
  );
};

/** Mono text on a diagram; centred on x by default. */
export const Label: React.FC<{ x: number; y: number; f: number; at: number; children: React.ReactNode; align?: 'left' | 'center' }> = ({ x, y, f, at, children, align = 'center' }) => (
  <div
    style={{
      position: 'absolute',
      left: align === 'center' ? x - 300 : x,
      top: y,
      width: align === 'center' ? 600 : 700,
      textAlign: align,
      ...rise(f, at),
      fontFamily: MONO,
      fontSize: 24,
      lineHeight: 1.45,
      color: '#ece6f5',
    }}
  >
    {children}
  </div>
);

export const Tok: React.FC<{ children: React.ReactNode; tone?: string }> = ({ children, tone = ACCENT }) => <span style={{ color: tone }}>{children}</span>;

export const RecapCard: React.FC<{ dur: number; items: { head: string; body: string; mono?: boolean }[]; footer?: string }> = ({ dur, items, footer }) => {
  const f = useCurrentFrame();
  return (
    <Fade dur={dur} inF={10} outF={14} bg={INK}>
      <Backdrop>
        <AbsoluteFill style={{ justifyContent: 'center', padding: '0 180px' }}>
          <div style={{ ...rise(f, 2), fontFamily: MONO, color: ACCENT, fontSize: 30, letterSpacing: 2 }}>RECAP</div>
          {items.map((it, i) => (
            <div key={it.head} style={{ ...rise(f, 6 + i * 8), display: 'flex', gap: 28, alignItems: 'baseline', marginTop: 30 }}>
              <div style={{ fontFamily: MONO, color: ACCENT, fontSize: 34, minWidth: 40 }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 46, fontWeight: 600 }}>{it.head}</div>
                <div style={{ fontSize: 32, color: '#d6cce6', marginTop: 6, fontFamily: it.mono ? MONO : SANS }}>{it.body}</div>
              </div>
            </div>
          ))}
          {footer ? <div style={{ ...rise(f, 10 + items.length * 8), fontFamily: MONO, color: '#9d90b3', fontSize: 26, marginTop: 56 }}>{footer}</div> : null}
        </AbsoluteFill>
      </Backdrop>
    </Fade>
  );
};

// ---------------------------------------------------------------------------
/**
 * A terminal panel over the take, for something that happens outside the browser (an API or
 * MCP call). `t` is the take time from the clip's overlay; it slides in at `at` and the reply
 * line shows at `replyAt`. Key both to marks so the reply lands before the page changes.
 * x, y and w are output px; put it over empty space, away from what is about to change.
 */
export const Terminal: React.FC<{ t: number; at: number; replyAt: number; title: string; request: React.ReactNode[]; reply: React.ReactNode; x?: number; y?: number; w?: number }> = ({
  t,
  at,
  replyAt,
  title,
  request,
  reply,
  x = 360,
  y = 500,
  w = 1200,
}) => {
  const show = interpolate(t, [at - 0.25, at + 0.05], [0, 1], clamp);
  const r = interpolate(t, [replyAt - 0.15, replyAt + 0.1], [0, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        opacity: show,
        transform: `translateY(${(1 - show) * 24}px)`,
        background: '#130d1f',
        borderRadius: 18,
        border: '1px solid #2c2140',
        boxShadow: '0 30px 60px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        fontFamily: MONO,
        fontSize: 26,
        lineHeight: 1.55,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 22px', background: '#1c1430', borderBottom: '1px solid #2c2140' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <div style={{ marginLeft: 14, fontSize: 22, color: '#a89bbd' }}>{title}</div>
      </div>
      <div style={{ padding: '16px 26px', color: '#e5e0ee' }}>
        {request.map((line, i) => (
          <div key={i} style={{ whiteSpace: 'pre', color: i ? '#c9c0d8' : undefined }}>
            {line}
          </div>
        ))}
        <div style={{ whiteSpace: 'pre', opacity: r }}>{reply}</div>
      </div>
    </div>
  );
};
