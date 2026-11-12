// Where things land in the output:  npm run timeline [-- <take seconds> ...] [-- --clicks]
// Prints each item's output range (and the take range a clip plays), then maps take times
// (or every logged click) to output time and frame, for grabbing frames to check.
import { ITEMS } from './src/Demo';
import { FPS } from './src/kit';
import cursor from './src/cursor.json';

const rows: { name: string; from: number; dur: number; src?: number; rate?: number }[] = [];
let at = 0;
for (const it of ITEMS) {
  rows.push({ name: it.name, from: at, dur: it.dur, src: it.clip?.src, rate: it.clip?.rate ?? 1 });
  at += it.dur;
}
const s = (f: number) => (f / FPS).toFixed(2).padStart(6);
for (const r of rows) {
  const take = r.src === undefined ? '' : `  take ${r.src.toFixed(2)}-${(r.src + (r.dur / FPS) * (r.rate ?? 1)).toFixed(2)}${r.rate !== 1 ? ` at ${r.rate}x` : ''}`;
  console.log(`${r.name.padEnd(10)} out ${s(r.from)}-${s(r.from + r.dur)}  frames ${r.from}-${r.from + r.dur - 1}${take}`);
}
console.log(`total ${s(at)} s, ${at} frames`);

const args = process.argv.slice(2);
const times = args.includes('--clicks') ? (cursor as { clicks: number[] }).clicks : args.map(Number).filter((n) => !Number.isNaN(n));
for (const t of times) {
  const r = rows.find((r) => r.src !== undefined && t >= r.src && t < r.src + (r.dur / FPS) * (r.rate ?? 1));
  if (!r) {
    console.log(`take ${t.toFixed(2)} s: not in any clip`);
    continue;
  }
  const f = Math.round(r.from + ((t - r.src!) / (r.rate ?? 1)) * FPS);
  console.log(`take ${t.toFixed(2)} s -> out ${s(f)} s, frame ${f} (${r.name})`);
}
