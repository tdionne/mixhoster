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
   - Update `config.js` — set `AUDIO_BASE_URL` to `https://mixes.yourdomain.com/`.

4. **Upload your mp3s**
   ```sh
   npx wrangler r2 object put mixhoster-audio/2023-06-summer-house.mp3 \
     --file=./local-mixes/2023-06-summer-house.mp3
   ```
   Repeat per file, or write a small loop over a local folder.

5. **Add cover art** — drop images in `covers/` (this repo), referenced by
   relative path in `mixes.json`. These ship with the site itself, not R2.

6. **Describe each mix** in `mixes.json`:
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
   npx wrangler pages deploy . --project-name=mixhoster
   ```
   Then in the Pages project settings, add your custom domain (e.g.
   `yourdomain.com` or `mixes-site.yourdomain.com`).

   Re-run the same deploy command any time you update `mixes.json` or add
   covers — no build step needed, it's plain static files.

## Local preview

Any static file server works, e.g.:
```sh
npx serve .
```

## Adding a new mix later

1. `wrangler r2 object put` the mp3 to the bucket.
2. Add a cover image to `covers/` if you have one.
3. Add an entry to `mixes.json`.
4. `wrangler pages deploy .`
