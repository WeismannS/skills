---
name: recorded-ui-demo
description: Make a polished demo video of a running web UI. Record one scripted Playwright take of the real app at 2x pixels on a logged clock, then cut it in Remotion with the whole page in view, brief zooms only on small details, a drawn cursor with click ripples, captions in a strip under the page, and dark title, diagram and recap cards. Use whenever the user wants a demo video, walkthrough, feature video, PR or release demo, or "a video of the UI" for an app that runs locally, even if they don't mention Playwright or Remotion. Also use when a screen recording looks blurry once zoomed, or when cursor, captions and UI changes drift out of sync.
---

# Recorded UI demos

The idea: the real app plays one continuous, scripted take. Everything that happens during the take
goes into logs: named moments, the cursor path, click times and the boxes of details worth a
closer look. Remotion then cuts the take into back-to-back clips. The whole page stays in view,
the cursor is drawn from the log, and a caption under the page explains each beat. The take is
real, so the video shows real behaviour and real data. The logs share the take's clock, so every
ripple, overlay and cut lands on the frame where the UI changes.

The template is a working skeleton, not just a stub. `record/flow.ts` and `video/src/Demo.tsx`
have commented examples of each kind of beat: typing, a button, and a change from outside the
browser shown in a terminal overlay. `video/src/kit.tsx` has the camera, clips, captions, cards
and overlays.

## When to use this, or something else

- **This skill:** the app runs locally (or at a URL a script can drive) and looks right with its own data. It suits one-off demos: a PR, a feature, an environment.
- **Rebuild the screens as React in Remotion instead** when the app can't be run, its data can't be shown, or the video is remade every release and shouldn't depend on a live app.
- **Playwright's `recordVideo` on its own** when only raw footage is needed, with no edit.

Captions are the default. For narration, record or generate a voice track afterwards, add it with
Remotion's `<Audio>`, and pace the clips to it.

## Requirements

- Node 18 or newer with npm, `ffmpeg` and `ffprobe` on PATH, and Python 3 for the checks.
- A browser for the take. `new-demo.sh` installs Playwright's bundled Chromium.
  - On a bare Linux machine, Chromium may also need system libraries: `npx playwright install-deps chromium` (needs sudo).
  - To use an installed Google Chrome instead, set `DEMO_CHANNEL=chrome` or pass `startTake({ channel: 'chrome' })`. Do that when the app plays H.264 or AAC media, which Chromium can't decode.
- Remotion is free for individuals and companies of up to 3 people; bigger companies need a paid company license (https://www.remotion.dev/docs/license). If the user is making the video for a larger company, mention it once.
- Disk and network the first time: Playwright's Chromium (about 280 MB, in a cache shared by every demo), and Remotion's own headless Chrome (about 90 MB, downloaded into `video/node_modules` by the first still or render).
- Tested on Linux with Node 24, Playwright 1.57 and Remotion 4.0.529. The template pins those versions.

## Pipeline

`<skill>` below is this skill's folder.

1. **Scaffold:** `bash <skill>/scripts/new-demo.sh <demo-dir>`.
   - Put the demo outside the app's repo, so the repo stays clean: for example `~/demos/<name>`, or wherever the user keeps videos. Ask if it isn't obvious.
   - It creates `record/` (`take.ts` engine, `flow.ts`, `explore.ts`) and `video/` (Remotion: `kit.tsx` + `Demo.tsx`), and installs their dependencies.
   - The first demo takes a minute or two to install. Later demos in the same parent folder hard-link Remotion from an earlier one, which takes seconds.
2. **Look, then plan the story:**
   - Read the UI's code for routes, selectors and what is worth showing.
   - Look at the real pages: `cd record && npx tsx explore.ts <url> <selector>...` saves a screenshot to `explore/` and prints the boxes of the selectors. Read the screenshots.
   - Write the beats as a list: action, what changes, the caption.
   - Size it to the request:
     - A full demo is 60–80 s: title, an optional diagram, 2–4 acts of 3–8 s clips, recap.
     - A short one (30–40 s) is a 3–4 s title, 4–6 clips and a 5 s recap, with no diagram card.
3. **Write `record/flow.ts`** (see Recording).
4. **Record:**
   - Start the app, then run `cd record && npx tsx flow.ts`.
   - Then run `python3 <skill>/scripts/click-sync.py <demo-dir>` (see Verify).
   - If `startTake` fails to launch the browser, run `npx playwright install chromium` in `record/`, or see Requirements.
5. **Cut in `video/src/Demo.tsx`:** camera rects, cut points, clips and cards (see Cutting).
6. **Check, then render:**
   - Check stills with `npm run stills -- 400 t=31.5 ...`. This takes frames or output seconds and writes `out/still-<frame>.png`. It bundles once (about 35 s), then each still takes a second or two. `remotion still` re-bundles every time, at about 50 s a frame.
   - `npm run timeline` prints where every item and clip lands in the output.
   - To check motion in one clip, render just its frames: `npx remotion render Demo out/clip.mp4 --frames=459-600`.
   - Do the full render with `npm run render`. It takes several minutes: 4–6 min for 40–75 s of video on an ordinary laptop.
     - Decoding the 4K take dominates, so a half-scale render is barely faster. Don't bother with one.
   - Then check the render (see Verify) and copy it to `<demo-dir>/<name>-demo.mp4`.
7. **Clean up:** stop what you started (see Gotchas) and put the app's data back to its seed.

## Recording

`take.ts` exposes `startTake({ out })`, which returns:
- `page`;
- `mark(name)` and `box(name, locator)`;
- `glide(locator, { click, dx, dy })`, `glideTo(x, y)`, `click()` and `scrollTo(locator)`;
- `type(text)` and `wait(ms)`;
- `finish()`, which goes in a `finally`.

`finish()` writes `marks.json`, `cursor.json`, `boxes.json`, `take.json` and `raw/take.mp4`, and copies them into `video/`.

**Why the page is 1440×720.** The video should show the whole app, readable, most of the time.
- A 1920 px page squeezed into a 1080p video is too small to read for a dense app, and that pushes the cut into zooming, which hides the rest of the app.
- 1440 px is a laptop width. It fills the 1920 px frame at 1.33 output px per CSS px, so a 13 px label comes out at about 17 px.
- 720 high leaves a 120 px strip under the page for captions, so captions never cover the app.
- To change the size, pass `viewport` to `startTake`; `take.json` carries it to the cut, and `kit.tsx` lays the page out to match. Change `explore.ts` to the same size.

**Why the take is sharp.** The take has 2 device pixels per CSS px (2880×1440).
- Playwright's built-in `recordVideo` is 1× VP8 at about 1 Mbit/s, and text smears in a 1080p video.
- `take.ts` records Chromium's screencast instead, as JPEG frames at 2× resolution. That keeps text sharp at the whole-page view and at zooms up to 1.5×.
- The screencast ignores the context's `deviceScaleFactor`. It only comes out at 2× when the browser is launched with `--force-device-scale-factor=2`. `take.ts` does both.

**Why there is one clock.** Marks, the cursor path, clicks and frame timestamps all count from the same `t0`:
- Frames are stamped with Chrome's swap time.
- The encoder builds 30 fps by holding the latest repaint at each frame.
- So the take, the drawn cursor and the overlays need no offset.

Playwright's `recordVideo` ran about 0.3 s off the script's clock. If you ever fall back to it, measure the offset; don't guess it.

**Writing the flow:**
- **Known state first.** Call the app's reset, seed or login before `startTake`, so a re-take matches the previous one and the demo doesn't leave junk behind.
- **Pacing.** After every state change, wait 1.5–2.5 s before the next action. A slow stretch can be sped up later (clip `rate`). A rushed one can't be slowed down without typing and cursor moves turning into slow motion.
- **Marks.** Call `mark()` after the UI has settled, at every beat. Cut points hang off marks, which is what lets a re-take line up without retuning.
- **Boxes.** Call `box()` on small details the camera may lean in on: a value that changes, a badge, a total, a status. `fit()` in the cut turns boxes into camera rects. Most beats need no box, because the cut stays on the whole page.
- **Scrolling.** The page is only 720 px high, so new rows and later fields are often below the fold. Use `take.scrollTo(locator)` to bring them into view with the browser's smooth scrolling, then pause, so the viewer sees the scroll. `glide()` does the same before it moves. `box()` doesn't scroll.
- **Typing.** Use `glide(field, { click: true, dx: 60 })`, then `type()` at the default 85 ms per key. Don't use `fill()`: it appears all at once, which reads as a cut.
- **Selects.** A native `<select>` opens its menu in a separate popup that usually doesn't show in the take. Glide to the select, then use `selectOption()`.
- **Changes from outside the browser** (an agent's API or MCP call, a webhook, a CLI):
  1. Make the call from the flow with `fetch`, right after a `mark('call')`.
  2. Wait until the page shows the change (`locator.waitFor`), then `mark('updated')`.
  3. In the cut, a `Terminal` overlay keyed to those two marks shows the request and reply.
- **Hover.** The mouse really moves, so hover states appear in the take, though the cursor itself doesn't. Remotion draws it from `cursor.json`.
- **Get the cursor out of the way.** After a click whose result appears under or next to the pointer (play, a menu, a summary panel), `glideTo()` a nearby empty spot. Otherwise the drawn cursor sits on the change for the whole clip.
- **Dialogs** are auto-accepted. Pass `acceptDialogs: false` to handle them yourself.

## Cutting

`Demo.tsx` is the per-demo script and `kit.tsx` holds the building blocks. Everything is in take seconds and the take's CSS px (1440×720 by default).

**Layout.** In a clip, the page fills the width of the frame, with a dark strip under it for the caption.

**Camera: wide is the default.** The viewer should see the whole screen most of the time: the feature, where it lives in the app, and what changed. A demo that zooms into every field hides the features it is meant to show, and people stop using it (that was the first real user's feedback).
- Stay on `FULL` for typing, menus, forms, lists and page changes. They read fine on the whole page.
- Lean in only when a detail is too small to read wide: a value that changed, a badge, a total, a status.
- Zoom at most 1.5× (`MAX_ZOOM`; `fit()` and the camera won't go tighter). Hold for 1.5–2.5 s, then go back to `FULL` before the next action.
- At most one zoom per clip, and keep at least half of every clip wide.
- If the subject doesn't fit whole at 1.5×, don't zoom. A zoom that cuts through the thing being explained is worse than none.

**Camera rects** are `{ x, y, w }` in CSS px with the page's aspect ratio. `FULL` (`w = 1440`) is the whole page.
- Use `fit(B.total)` or `fit([B.status, B.amount], { pad: 32 })`. It centres the logged boxes and never goes tighter than `MAX_ZOOM`.
  - `fit(B.total, { w: 1200 })` keeps the centring but sets a gentler zoom yourself.
- **Keys** are `{ t, r }` in clip seconds. Repeat a rect to hold it, and give a move 0.8–1.2 s.

**Cuts.** Clips are back-to-back:
- `CUTS[i]` is where clip *i* starts in the take, and `CUTS[i+1]` is where it ends.
- `cutClips(CUTS, specs)` derives each clip's duration from its `rate`, so nothing is skipped or shown twice.
- Write each cut as a mark plus an offset: `M.saved - 1.2`. Cut where the topic changes, typically about 0.5–1 s before the click that starts the next beat.
- A new page must never appear under a caption about the previous one. Cut before the click that opens it, or write the caption to cover both pages ("Review and save; the vendor opens on its own page").
- Use `rate` 1.2–1.4 for slow stretches such as loading or long typing. Above about 1.5, typing looks frantic.

**Captions:**
- One sentence per clip, ideally one line (about 80 characters or fewer), saying what is happening and why it matters. Don't narrate the clicks.
- `part` is a short act tag (SEARCH, EDIT, AGENT).
- Use the product's own terms, and follow any wording rules the project has.
- Captions sit in the strip under the page and never cover it. Overlays such as `Terminal` do cover the page, so put them over empty space, away from what is about to change.

**Cards:**
- `TitleCard`: 4–5 s. Kicker, title, one-line subtitle, the acts.
- A diagram card built from `Node`, `Arrow`, `Label` and `Tok`: about 7–8 s, only when how things connect matters.
- `RecapCard`: 6–7 s. What was shown and how to run it.
- Clips that start or end next to a card should set `fadeIn` or `fadeOut`.

**Sharpness in the render.** These are already set in the template; keep them:
- The `<OffthreadVideo>` is sized to the zoom (left, top, width and height), not enlarged with a CSS transform.
- Frames are captured as PNG (`setVideoImageFormat('png')`), because JPEG at the default quality softens UI text.
- The encode uses `crf 16`.

## Verify

Look at the frames yourself before calling it done; the numbers alone don't show framing problems.

- **`python3 <skill>/scripts/click-sync.py <demo-dir>`.** Every click should be followed by a repaint 30–400 ms later, typically 60–300 ms.
  - Negative or near-zero gaps everywhere mean the take and the logs are offset.
  - One large gap is usually a click that changed nothing visible.
  - It also prints repaints per second. Static UIs repaint only a few times a second, which is normal.
  - On a page that repaints constantly (a blinking caret, a spinner), the gap can't show sync and is marked "busy page". Check those clicks with stills instead.
- **`bash <skill>/scripts/contact-sheet.sh out/demo.mp4 out/sheet.png 2.5`**, then Read the PNG. Check that:
  - most frames show the whole page;
  - every zoom shows its subject whole, and none cuts through it;
  - overlays line up with the UI change;
  - no clip starts or ends mid-action;
  - nothing is repeated across a cut.
- **Text at full resolution,** once on the whole page and once at the deepest zoom:
  - Extract a frame: `ffmpeg -ss <t> -i out/demo.mp4 -frames:v 1 -vf crop=900:500:X:Y /tmp/crop.png`.
  - Read it. The app's text should be readable and crisp, with no smearing or block artefacts.
- **Click moments.** `npm run timeline -- --clicks` gives every click's output frame. Feed a few into `npm run stills`, and confirm the ripple sits on the target as the UI reacts.

## Gotchas

- **Stopping servers.** `pkill -f '<pattern>'` also matches the shell running it and kills your own command (exit 144). Find the PID by port and `kill` that: `ss -ltnp | grep :PORT` on Linux, `lsof -nP -iTCP:PORT -sTCP:LISTEN` on macOS.
- **Keep work in the demo folder,** not `/tmp`, which some systems clear on reboot.
- **Cut points past the end of the take.** The last cut must stay before the end of `raw/take.mp4`. `finish()` adds 0.3 s after the last mark; end with `M.end + 0.2`.
- **A re-take shifts every mark a little.** Cuts tied to marks absorb that. Camera keys are in clip seconds, so recheck any key timed against a specific click.
- **Overlay order.** When an external change shows up in the UI faster than expected, key the overlay's reply to `Math.min(M.call + 0.35, M.updated - 0.1)`, so the reply never appears after the page has already changed.
- **Hard-linked dependencies.** `new-demo.sh` hard-links `video/node_modules` from a sibling demo that has every dependency at the same Remotion version, which saves a long install.
  - It drops `node_modules/.cache` (webpack's cache, which gets written during renders) so the two demos don't share it.
  - Where hard links don't work (macOS `cp`, another filesystem), it runs `npm install` instead.
  - Don't `npm install` new packages into a hard-linked tree; run `rm -rf node_modules && npm install` first.
- **Data.** Only record synthetic or seed data, never real customer data or tokens. Check `last.png` and the contact sheet for anything that shouldn't be public.
