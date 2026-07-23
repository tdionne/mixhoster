# mixhoster

A static list-and-player site for hosting your own DJ mixes, backed by
Cloudflare R2 (storage) and Cloudflare Pages (hosting). No server, no
database, no auth — just a JSON manifest and a bucket.

Cost at ~50GB / dozens of mixes: a few cents to ~$1/month in R2 storage,
$0 in egress (R2 doesn't charge for bandwidth out), $0 for Pages.

## One-time setup

1. **Cloudflare account** — sign up at cloudflare.com if you don't have one.

2. **Create the R2 bucket**
   ```sh
   npx wrangler login
   npx wrangler r2 bucket create mixhoster-audio
   ```

3. **Point a subdomain at the bucket** so R2 serves files directly (and
   supports HTTP range requests, which is what lets the `<audio>` scrubber
   seek without downloading the whole file):
   - Cloudflare dashboard → R2 → `mixhoster-audio` → Settings → Custom Domains
     → add e.g. `mixes.yourdomain.com` (your domain needs to already be on
     Cloudflare DNS).
   - Update `public/config.js` — set `AUDIO_BASE_URL` to `https://mixes.yourdomain.com/`.

4. **Upload your mp3s**
   ```sh
   npx wrangler r2 object put mixhoster-audio/2023-06-summer-house.mp3 \
     --file=./local-mixes/2023-06-summer-house.mp3
   ```
   Repeat per file, or write a small loop over a local folder.

5. **Add cover art** — drop images in `public/covers/`, referenced by
   relative path in `mixes.json`. These ship with the site itself, not R2.

6. **Describe each mix** in `public/mixes.json`:
   ```json
   {
     "slug": "2023-06-summer-house",
     "title": "Summer House Mix 2023",
     "date": "2023-06-15",
     "description": "A warm-up set recorded live, house and disco edits.",
     "cover": "covers/2023-06-summer-house.jpg",
     "audio": "2023-06-summer-house.mp3",
     "durationSeconds": 3600
   }
   ```
   `audio` is just the filename you uploaded to R2 — it's resolved against
   `AUDIO_BASE_URL` at page-load time.

7. **Deploy the site to Cloudflare Pages**
   ```sh
   npx wrangler pages deploy public --project-name=mixhoster
   ```
   Only the `public/` directory is deployed — `scripts/`, `README.md`, etc.
   at the repo root are never published. Then in the Pages project
   settings, add your custom domain (e.g. `yourdomain.com` or
   `mixes-site.yourdomain.com`).

   Re-run the same deploy command any time you update `mixes.json` or add
   covers — no build step needed, it's plain static files.

## Local preview

Any static file server works, e.g.:
```sh
npx serve public
```

## Adding a new mix later

1. `wrangler r2 object put` the mp3 to the bucket.
2. Add a cover image to `public/covers/` if you have one.
3. Add an entry to `public/mixes.json`.
4. `wrangler pages deploy public`

## Podcast feed (Apple Podcasts, Overcast, etc.)

```sh
node scripts/generate-feed.js
```

Regenerates `public/feed.xml` from `mixes.json`. Most podcast apps let you
follow a show directly by feed URL (`https://yourdomain.com/feed.xml`) with
no directory submission needed — good for sharing with a small group.
Spotify is the exception: it only supports subscribing through its own
catalog, which requires submitting the feed at
[Spotify for Podcasters](https://podcasters.spotify.com) and passing their
content review.

Before sharing the feed, add a square cover image (1400–3000px, jpg or
png) at `public/cover.jpg` — the script warns if it's missing but still
writes the feed. Re-run the script and redeploy any time `mixes.json`
changes.

## Recovering old mixes from Mixcloud

If a mix was taken down (e.g. after cancelling a Mixcloud subscription) but
still plays from your own account, its audio is served as HLS. Open the
mix, open your browser's dev tools Network tab, and copy the `.m3u8`
request URL. Then:

```sh
scripts/recover-mix.sh <slug> "<title>" <YYYY-MM-DD> "<m3u8-url>"
```

This downloads and transcodes the stream to mp3 (`ffmpeg` required —
`brew install ffmpeg`), uploads it to R2, and appends an entry to
`public/mixes.json`. Redeploy with `wrangler pages deploy public` when
ready.

To skip the manual dev-tools step, see `chrome-extension/` — a small
unpacked extension that captures the `.m3u8` URL for you and builds the
command above.
