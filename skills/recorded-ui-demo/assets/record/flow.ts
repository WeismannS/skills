/**
 * The demo's flow: one continuous take of the story, beat by beat.
 *
 *   cd record && npx tsx flow.ts
 *
 * Needs the app running. Writes ../marks.json, ../cursor.json, ../boxes.json, ../raw/take.mp4
 * and, when ../video exists, copies them into the Remotion project.
 *
 * Rules of thumb (see the skill for why):
 * - Put the app in a known state first (reset endpoint, seed, fresh login), so a re-take matches.
 * - After each state change, wait 1.5-2.5 s before the next action: the viewer needs time, and
 *   a clip can be sped up later but not slowed down.
 * - mark() once the UI has settled, and box() small details the camera may lean in on (a value,
 *   a badge, a total). The video stays on the whole page by default.
 * - Changes made from outside the browser (an API or MCP call) happen here too, between a mark
 *   before and a waitFor + mark once the page shows them.
 */
import * as path from 'path';
import { fileURLToPath } from 'url';
import { startTake } from './take';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI = 'http://localhost:5173/';

async function main() {
  // 0. Known state. Replace with the app's own reset, or delete.
  // const r = await fetch('http://localhost:3000/reset', { method: 'POST' });
  // if (!r.ok) throw new Error(`reset ${r.status}`);

  const take = await startTake({ out: OUT });
  const { page: p } = take;
  try {
    // 1. Landing
    await p.goto(UI);
    await p.locator('main').first().waitFor({ timeout: 30000 });
    await take.wait(2000);
    take.mark('start');
    await take.box('main', p.locator('main'));

    // 2. A form: click a field, type, submit
    // const field = p.getByPlaceholder('Search');
    // await take.glide(field, { click: true, dx: 60 });
    // await take.type('refund');
    // await p.locator('.result').first().waitFor();
    // await take.wait(2000);
    // take.mark('searched');
    // await take.box('results', p.locator('.results'));

    // 3. A button
    // await take.glide(p.getByRole('button', { name: 'Save' }), { click: true });
    // await p.getByText('Saved').waitFor();
    // await take.wait(1800);
    // take.mark('saved');

    // 4. A change from outside the browser (an agent's API call, a webhook). The cut shows it
    //    with a Terminal overlay keyed to 'call' and 'updated'; see Demo.tsx.
    // await take.glideTo(1500, 300); // park the cursor away from what will change
    // await take.wait(1200);
    // take.mark('call');
    // const res = await fetch('http://localhost:3000/api/items/42', {
    //   method: 'PATCH',
    //   headers: { 'content-type': 'application/json' },
    //   body: JSON.stringify({ status: 'done' }),
    // });
    // if (!res.ok) throw new Error(`PATCH ${res.status}`);
    // await p.getByText('done').first().waitFor(); // the page picks it up (polling, websocket...)
    // take.mark('updated');
    // await take.wait(2500);

    await take.wait(2500);
    take.mark('end');
  } finally {
    await take.finish();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
