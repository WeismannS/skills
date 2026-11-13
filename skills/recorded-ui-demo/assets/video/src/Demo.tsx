// The demo's script: cards, camera rects, cut points and captions. Building blocks are in kit.tsx.
// The take (public/take.mp4) and its logs (marks.json, cursor.json, boxes.json) come from
// ../record/flow.ts. Everything below is in take seconds and the take's CSS px (1440x720 by
// default; see take.json).
import React from 'react';
import { useCurrentFrame } from 'remotion';
import {
  Arrow, B, Backdrop, Caption, Fade, FULL, INK, Item, Kicker, Label, M, Node, RecapCard, Rect, TEAL, TitleCard, Timeline, Tok,
  clipItems, cutClips, fit, sec, totalFrames,
} from './kit';

export { FPS } from './kit';

// ---------------------------------------------------------------------------
// Camera rects. The whole page (FULL) is the default: viewers should see the feature, where it
// lives and what changed. Lean in only on a detail too small to read wide (a value, a badge, a
// total), at most 1.5x (fit() won't go tighter), hold it briefly, then go back to FULL.
const PAGE: Rect = FULL;
const DETAIL: Rect = fit(B.main);

// ---------------------------------------------------------------------------
// Cut points, tied to the nearest mark so a re-take lines up without retuning. Clip i plays
// CUTS[i] -> CUTS[i + 1].
const CUTS = [
  M.start - 0.8, // page settled
  M.start + 3, // replace with real marks, e.g. M.saved - 1.2
  M.end + 0.2,
];

const CLIPS = cutClips(CUTS, [
  {
    part: 'START',
    fadeIn: true,
    keys: [{ t: 0, r: PAGE }],
    caption: 'One line on what the viewer is looking at.',
  },
  {
    part: 'START',
    fadeOut: true,
    // Wide, a short look at the detail that changed, back to wide.
    keys: [{ t: 0, r: PAGE }, { t: 1.2, r: PAGE }, { t: 2.1, r: DETAIL }, { t: 4.1, r: DETAIL }, { t: 5, r: PAGE }],
    caption: 'What changed, and why it matters.',
  },
  // A change from outside the browser (flow.ts beat 4): the request slides in at 'call' and the
  // reply lands just before the page changes. Import Terminal from './kit'.
  // {
  //   part: 'AGENT',
  //   keys: [{ t: 0, r: PAGE }],
  //   caption: 'An agent marks the item done; the page picks it up on its own.',
  //   overlay: (t) => (
  //     <Terminal t={t} at={M.call} replyAt={Math.min(M.call + 0.35, M.updated - 0.1)} title="agent"
  //       request={['PATCH /api/items/42', '{ "status": "done" }']} reply={<Tok tone={TEAL}>200 OK</Tok>} />
  //   ),
  // },
]);

// ---------------------------------------------------------------------------
// Cards
const DiagramCard: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  return (
    <Fade dur={dur} inF={10} outF={10} bg={INK}>
      <Backdrop>
        <Kicker f={f}>HOW IT CONNECTS</Kicker>
        <Node x={100} y={360} w={430} h={170} head="Browser" sub="the UI · :5173" f={f} at={6} />
        <Arrow x1={530} y1={445} x2={1385} y2={445} f={f} at={20} />
        <Node x={1395} y={360} w={425} h={170} head="Server" sub=":3000" f={f} at={30} tone={TEAL} />
        <Label x={958} y={480} f={f} at={40}>
          <Tok>/api/*</Tok> what the UI calls
        </Label>
      </Backdrop>
      <Caption text="One line on how the pieces fit." dur={dur} part="SETUP" />
    </Fade>
  );
};

export const ITEMS: Item[] = [
  { name: 'Title', dur: sec(4.5), node: (d) => <TitleCard dur={d} kicker="PRODUCT · area" title="What this demo shows" sub="One sentence of context." parts={['First act', 'Second act']} /> },
  { name: 'Diagram', dur: sec(7), node: (d) => <DiagramCard dur={d} /> },
  ...clipItems(CLIPS),
  {
    name: 'Recap',
    dur: sec(6.5),
    node: (d) => (
      <RecapCard
        dur={d}
        items={[
          { head: 'First thing shown', body: 'One line' },
          { head: 'Run it', body: 'npm install && npm run dev', mono: true },
        ]}
        footer="repo · PR"
      />
    ),
  },
];

export const TOTAL_FRAMES = totalFrames(ITEMS);
export const Demo: React.FC = () => <Timeline items={ITEMS} />;
