#!/usr/bin/env bash
# Contact sheet of a video:  contact-sheet.sh <video> <out.png> [every-seconds=2.5] [cols=4]
# One 640 px frame every N seconds (labelled with its time, top right), tiled; Read the PNG to
# review framing, captions and timing. Uses select, not fps=1/N: the fps filter picks frames
# about N/2 s away from the time it labels them with.
set -euo pipefail
in="$1"; out="$2"; every="${3:-2.5}"; cols="${4:-4}"
dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")"
n="$(python3 -c "import math;print(max(1, math.ceil($dur / $every)))")"
rows="$(( (n + cols - 1) / cols ))"
pick="select='isnan(prev_selected_t)+gte(t-prev_selected_t\,$every-0.001)',scale=640:-1"
label="drawtext=text='%{pts\:hms}':x=w-tw-6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.55"
sheet() { ffmpeg -v error -y -i "$in" -vf "$1,tile=${cols}x${rows}" -fps_mode vfr -frames:v 1 "$out"; }
# drawtext needs an ffmpeg built with fontconfig; without it, tile unlabelled (row-major, every N s).
if sheet "$pick,$label" 2>/dev/null; then
  echo "$out ($n frames, every $every s)"
else
  sheet "$pick"
  echo "$out ($n frames, every $every s; no time labels: this ffmpeg has no drawtext)"
fi
