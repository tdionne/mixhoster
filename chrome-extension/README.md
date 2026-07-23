# Mixhoster Recovery Helper (Chrome extension)

Watches network requests while you browse your own Mixcloud mixes,
captures the `.m3u8` stream URL automatically, and either runs the
recovery for you directly ("Launch remux") or builds the
`scripts/recover-mix.sh` command to paste into your terminal.

Not published to the Chrome Web Store; load it unpacked for personal use.

## Install

1. Go to `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `chrome-extension/` folder.

## Use

1. Open one of your mixes on mixcloud.com and press play (this is what
   triggers the `.m3u8` request).
2. Click the extension icon. It shows a badge with the number of stream
   URLs captured on that tab, and opens the helper in its own small
   window — separate from the toolbar dropdown, so it stays open (and any
   in-progress "Launch remux" keeps running) even if you switch tabs.
3. The popup pre-fills a title/date guess from the page and a slug —
   correct them if needed.
4. Either:
   - Click **Launch remux** to download, transcode, upload to R2, and
     update `mixes.json` automatically. This requires the local helper
     server running first — from the `mixhoster` repo root:
     ```sh
     node scripts/recover-server.js
     ```
     Leave it running in a terminal while you work through your mixes.
   - Or click **Copy recover-mix.sh command** and run it yourself in a
     terminal — no server needed for this path.

Captures are cleared automatically each time the tab navigates to a new
page, so switching to a different mix starts fresh.

## Why a local server instead of running things directly

Extensions can't execute shell commands on their own — `recover-server.js`
is a small localhost-only bridge that does. It only answers requests whose
origin is `chrome-extension://...` (a real webpage's JavaScript can't fake
that header) and only accepts `mixcloud.stream` URLs, so a random site
you happen to have open can't use it to trigger downloads/uploads on your
machine.
