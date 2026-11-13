/**
 * Look at the UI before writing the flow: a screenshot of a page and the boxes of candidate
 * regions, so the story and the camera rects can be planned from what is really there.
 *
 *   npx tsx explore.ts <url> [selector ...]     -> ../explore/<n>.png, boxes printed
 *
 * Uses the same browser and page size as the take (1440x720): bundled Chromium, or
 * DEMO_CHANNEL=chrome for Google Chrome. If the flow passes another viewport, change it here too.
 *
 * Read the screenshot. Box the regions you might zoom on, and prefer small ones (a field, a
 * panel header, a row): a tall box makes a wide camera rect. For pages behind clicks, copy a
 * few steps from flow.ts in here, or pass a deep link.
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'explore');
const [url, ...selectors] = process.argv.slice(2);
if (!url) {
  console.error('usage: npx tsx explore.ts <url> [selector ...]');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.DEMO_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 720 } });
await page.goto(url);
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(1000);
const n = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length + 1;
const shot = path.join(OUT, `${String(n).padStart(2, '0')}.png`);
await page.screenshot({ path: shot });
console.log(shot);
for (const sel of selectors) {
  const loc = page.locator(sel);
  const count = await loc.count();
  const b = count ? await loc.first().boundingBox() : null;
  console.log(`${sel.padEnd(32)} ${count} match${count === 1 ? '' : 'es'}  ${b ? `x ${Math.round(b.x)} y ${Math.round(b.y)} w ${Math.round(b.width)} h ${Math.round(b.height)}` : '-'}`);
}
await browser.close();
