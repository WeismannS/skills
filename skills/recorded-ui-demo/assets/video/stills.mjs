// Several stills from one bundle, so checking frames is cheap (the CLI re-bundles per still):
//   node stills.mjs <frame> [t=<seconds>] ...   -> out/still-<frame>.png
// Frames and seconds are output time; `npm run timeline -- <take seconds>` converts take times.
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node stills.mjs <frame|t=seconds> ...');
  process.exit(2);
}
fs.mkdirSync('out', { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'Demo' });
for (const a of args) {
  const frame = a.startsWith('t=') ? Math.round(parseFloat(a.slice(2)) * composition.fps) : parseInt(a, 10);
  const output = path.resolve(`out/still-${frame}.png`);
  await renderStill({ serveUrl, composition, frame, output, imageFormat: 'png' });
  console.log(output);
}
