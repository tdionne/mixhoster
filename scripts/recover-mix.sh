#!/bin/sh
# Recover one mix from a Mixcloud HLS URL: download, transcode to mp3,
# upload to R2, and append an entry to mixes.json.
#
# Usage: scripts/recover-mix.sh <slug> <title> <YYYY-MM-DD> <m3u8-url>
set -e

if [ $# -ne 4 ]; then
  echo "Usage: $0 <slug> <title> <YYYY-MM-DD> <m3u8-url>" >&2
  exit 1
fi

SLUG=$1
TITLE=$2
DATE=$3
URL=$4

cd "$(dirname "$0")/.."

OUT="$HOME/Downloads/$SLUG.mp3"

echo "Downloading + transcoding to $OUT ..."
ffmpeg -y -i "$URL" -c:a libmp3lame -q:a 2 "$OUT"

DURATION=$(afinfo "$OUT" | awk '/estimated duration/ {print int($3)}')

echo "Uploading to R2 as music/$SLUG.mp3 ..."
npx wrangler r2 object put "music/$SLUG.mp3" --file="$OUT" --content-type=audio/mpeg --remote

python3 - "$SLUG" "$TITLE" "$DATE" "$DURATION" <<'PYEOF'
import json, sys

slug, title, date, duration = sys.argv[1:5]
with open("public/mixes.json") as f:
    mixes = json.load(f)

mixes.append({
    "slug": slug,
    "title": title,
    "date": date,
    "description": "",
    "audio": f"{slug}.mp3",
    "durationSeconds": int(duration),
})

with open("public/mixes.json", "w") as f:
    json.dump(mixes, f, indent=2)
    f.write("\n")
PYEOF

echo "Added \"$TITLE\" ($DATE) to mixes.json and uploaded to R2."
echo "Run 'npx wrangler pages deploy public' when you're ready to publish."
