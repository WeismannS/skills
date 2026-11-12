/**
 * Take engine for recorded UI demos (the recorded-ui-demo skill).
 *
 * Opens Chromium, records the page through its screencast at `scale` device pixels per CSS px
 * (3840x2160 for a 1920x1080 viewport), and logs everything a cut needs on one clock that
 * starts when the take starts:
 *
 *   marks.json   named moments ("saved": 12.4), the anchors for cut points
 *   cursor.json  the cursor path and click times (the cursor is not in the take; Remotion draws it)
 *   boxes.json   bounding boxes (CSS px) of the regions you will want the camera on
 *   raw/take.mp4 constant 30 fps, each frame the latest repaint at that time
 *
 * If `<out>/video` exists (a Remotion project from new-demo.sh), finish() also copies the take
 * to video/public/take.mp4 and the three JSON files to video/src/.
 *
 * Why not Playwright's recordVideo: it is 1x VP8 at ~1 Mbit/s, so text smears as soon as the
 * camera zooms in, and its timeline runs ~0.3 s off the script's clock.
 */
import { chromium, Browser, BrowserContext, Locator, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

export type Box = { x: number; y: number; width: number; height: number };

export type TakeOptions = {
  /** Demo folder. Gets marks.json, cursor.json, boxes.json, last.png and raw/. */
  out: string;
  /** CSS px. Default 1920x1080, the composition size. */
  viewport?: { width: number; height: number };
  /** Device pixels per CSS px in the take. 2 lets the camera zoom to 2x and stay sharp. */
  scale?: number;
  fps?: number;
  /** Screencast JPEG quality. */
  quality?: number;
  /**
   * Browser. Default: Playwright's bundled Chromium (`npx playwright install chromium`).
   * 'chrome' uses an installed Google Chrome, which also plays H.264/AAC media that Chromium
   * cannot. The DEMO_CHANNEL environment variable sets it too.
   */
  channel?: string;
  /** Accept confirm()/alert() dialogs so the flow never stalls. Default true. */
  acceptDialogs?: boolean;
};

export type Take = Awaited<ReturnType<typeof startTake>>;

export async function startTake(o: TakeOptions) {
  const view = o.viewport ?? { width: 1920, height: 1080 };
  const scale = o.scale ?? 2;
  const fps = o.fps ?? 30;
  const raw = path.join(o.out, 'raw');
  const framesDir = path.join(raw, 'frames');
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  // The screencast ignores the context's deviceScaleFactor: it only comes out at 2x when the
  // scale is forced on Chrome itself. Keep both so layout and screenshots agree.
  const browser: Browser = await chromium.launch({
    channel: (o.channel ?? process.env.DEMO_CHANNEL) || undefined,
    args: [`--force-device-scale-factor=${scale}`],
  });
  const context: BrowserContext = await browser.newContext({ viewport: view, deviceScaleFactor: scale });
  const page: Page = await context.newPage();
  if (o.acceptDialogs ?? true) page.on('dialog', (d) => void d.accept());

  // A JPEG each time the page repaints, stamped with its swap time. Static UIs repaint only a
  // few times a second; the encoder holds the last frame in between.
  const cdp = await context.newCDPSession(page);
  const shots: { ms: number; file: string }[] = [];
  const writes: Promise<void>[] = [];
  cdp.on('Page.screencastFrame', (e) => {
    void cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
    const file = `${String(shots.length).padStart(5, '0')}.jpg`;
    shots.push({ ms: e.metadata.timestamp ? e.metadata.timestamp * 1000 : Date.now(), file });
    writes.push(fs.promises.writeFile(path.join(framesDir, file), Buffer.from(e.data, 'base64')));
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: o.quality ?? 95,
    maxWidth: view.width * scale,
    maxHeight: view.height * scale,
    everyNthFrame: 1,
  });

  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const marks: Record<string, number> = {};
  const boxes: Record<string, Box | null> = {};
  let mx = view.width / 2;
  let my = view.height / 2;
  const cursorPath: { t: number; x: number; y: number }[] = [{ t: 0, x: mx, y: my }];
  const clicks: number[] = [];
  await page.mouse.move(mx, my);

  async function glideTo(x: number, y: number, steps = 25) {
    cursorPath.push({ t: now(), x: mx, y: my });
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await page.mouse.move(mx + (x - mx) * e, my + (y - my) * e);
      await page.waitForTimeout(16);
    }
    mx = x;
    my = y;
    cursorPath.push({ t: now(), x, y });
  }

  async function click() {
    await page.waitForTimeout(250); // let the cursor settle before the press
    clicks.push(now());
    await page.mouse.down();
    await page.waitForTimeout(90);
    await page.mouse.up();
  }

  let finished = false;

  return {
    page,
    context,
    browser,
    now,
    /** Log a named moment. Mark after the UI has settled; cut points hang off these. */
    mark(k: string) {
      marks[k] = now();
      console.log(`[${marks[k].toFixed(1)}s] ${k}`);
    },
    /** Log a region's bounding box (CSS px) for framing the camera later. */
    async box(k: string, loc: Locator) {
      boxes[k] = await loc.first().boundingBox();
    },
    glideTo,
    /** Move the cursor to an element (its centre, or dx/dy from its top-left), optionally click. */
    async glide(loc: Locator, opts: { click?: boolean; steps?: number; dx?: number; dy?: number } = {}) {
      await loc.scrollIntoViewIfNeeded();
      const b = await loc.boundingBox();
      if (!b) throw new Error(`glide: no box for ${loc}`);
      await glideTo(b.x + (opts.dx ?? b.width / 2), b.y + (opts.dy ?? b.height / 2), opts.steps);
      if (opts.click) await click();
    },
    click,
    /** Type at a readable pace into whatever has focus. */
    type: (text: string, delay = 85) => page.keyboard.type(text, { delay }),
    wait: (ms: number) => page.waitForTimeout(ms),
    /** Write the logs, stop the screencast, encode raw/take.mp4. Call it in a finally. */
    async finish() {
      if (finished) return;
      finished = true;
      const until = now() + 0.3;
      fs.writeFileSync(path.join(o.out, 'marks.json'), JSON.stringify(marks, null, 2));
      fs.writeFileSync(path.join(o.out, 'cursor.json'), JSON.stringify({ path: cursorPath, clicks }));
      fs.writeFileSync(path.join(o.out, 'boxes.json'), JSON.stringify(boxes, null, 2));
      await page.screenshot({ path: path.join(o.out, 'last.png') }).catch(() => {});
      await cdp.send('Page.stopScreencast').catch(() => {});
      await Promise.all(writes);
      await context.close();
      await browser.close();
      const frames = shots.map((s) => ({ t: (s.ms - t0) / 1000, file: s.file }));
      if (!frames.length) throw new Error('no frames captured');
      encode(raw, frames, until, fps);
      const video = path.join(o.out, 'video');
      if (fs.existsSync(video)) {
        fs.mkdirSync(path.join(video, 'public'), { recursive: true });
        fs.copyFileSync(path.join(raw, 'take.mp4'), path.join(video, 'public', 'take.mp4'));
        for (const f of ['marks.json', 'cursor.json', 'boxes.json']) fs.copyFileSync(path.join(o.out, f), path.join(video, 'src', f));
        console.log('copied the take and logs into', video);
      }
    },
  };
}

// Repaints on the take's clock -> constant fps: each output frame shows the latest repaint.
function encode(raw: string, frames: { t: number; file: string }[], until: number, fps: number) {
  fs.writeFileSync(path.join(raw, 'frames.json'), JSON.stringify(frames));
  const runs: { file: string; n: number }[] = [];
  let k = 0;
  for (let i = 0; i < Math.ceil(until * fps); i++) {
    while (k + 1 < frames.length && frames[k + 1].t <= i / fps) k++;
    const last = runs[runs.length - 1];
    if (last && last.file === frames[k].file) last.n++;
    else runs.push({ file: frames[k].file, n: 1 });
  }
  const list = runs.map((r) => `file 'frames/${r.file}'\nduration ${(r.n / fps).toFixed(6)}`);
  list.push(`file 'frames/${runs[runs.length - 1].file}'`); // concat drops the last duration otherwise
  fs.writeFileSync(path.join(raw, 'frames.txt'), list.join('\n') + '\n');
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    throw new Error(`ffmpeg is not on PATH; install it, then encode with: ffmpeg -f concat -safe 0 -i ${path.join(raw, 'frames.txt')} ...`);
  }
  execFileSync(
    'ffmpeg',
    ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(raw, 'frames.txt'),
      '-vf', `fps=${fps},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-g', String(fps),
      '-movflags', '+faststart', path.join(raw, 'take.mp4')],
    { stdio: 'inherit' },
  );
  console.log('take', path.join(raw, 'take.mp4'), `(${frames.length} repaints, ${until.toFixed(1)} s)`);
}
