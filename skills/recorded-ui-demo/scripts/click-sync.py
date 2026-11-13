#!/usr/bin/env python3
"""Check a take is on the logged clock:  click-sync.py <demo-dir>

For every logged click, prints how long until the page next repainted. On a good take that is
~50-250 ms (mousedown + 90 ms + render). Negative or near-zero gaps everywhere mean the take
runs ahead of the logs; consistently large ones mean it lags. A single large gap is usually a
click that changed nothing visible (or waited on the network), which is fine.
Also prints repaints per second, so you can see where the take is choppy.
"""
import json, sys, os, collections

d = sys.argv[1] if len(sys.argv) > 1 else '.'
frames = json.load(open(os.path.join(d, 'raw', 'frames.json')))
cur = json.load(open(os.path.join(d, 'cursor.json')))
marks = json.load(open(os.path.join(d, 'marks.json')))
ts = [f['t'] for f in frames]

print(f"{len(ts)} repaints over {ts[-1]:.1f} s")
lags = []
for c in cur['clicks']:
    nxt = [t for t in ts if t > c]
    lag = nxt[0] - c if nxt else None
    near = min(marks.items(), key=lambda kv: abs(kv[1] - c))[0] if marks else ''
    # On a page that repaints all the time (a blinking caret, an animation) the next repaint is
    # always moments away, so the gap says nothing about sync.
    busy = sum(1 for t in ts if c - 0.5 <= t < c) >= 4
    flag = '' if lag is not None and 0.03 <= lag <= 0.4 else ("  (busy page, can't judge)" if busy and lag is not None and lag < 0.03 else '  <- check')
    print(f"  click {c:6.2f}s  next repaint +{lag if lag is not None else float('nan'):.3f}s  (near mark '{near}'){flag}")
    if lag is not None:
        lags.append(lag)
if lags:
    lags.sort()
    print(f"median click->repaint {lags[len(lags)//2]*1000:.0f} ms")
per = collections.Counter(int(t) for t in ts if t >= 0)
print("repaints/s:", ' '.join(str(per.get(i, 0)) for i in range(int(ts[-1]) + 1)))
