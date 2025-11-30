# OMNIKOSMOS — Orbic Intelligence (Live Orb v3)

This is a client-side audio visualizer (Orbic Intelligence v3).
It runs entirely in the browser — **no audio uploads**.

## Files
- `index.html` — main UI
- `style.css` — styles (responsive)
- `app.js` — WebAudio + orb drawing logic (client-side)
- `manifest.json` — PWA manifest
- `service-worker.js` — minimal service worker placeholder
- `favicon.svg` — centered orb icon
- `README.md` — this file

## How to deploy to GitHub Pages
1. Put these 7 files in the root of the repo (not in a subfolder).
2. Commit & push to `main`.
3. In Repo → Settings → Pages → Source set to `main` / `/ (root)` and save.
4. After deploy, open your site: `https://<username>.github.io/<repo>/`
5. If favicon or old CSS is cached, use Incognito or hard refresh (Ctrl+Shift+R) or clear site data.

## Notes
- All audio processing is done locally (Web Audio API).
- If you want PNG favicons for older browsers, I can produce `favicon-32.png` and `favicon-16.png`.
- To add automatic recording of pulses to a remote server (cloud), we must add a backend — currently no data leaves the browser.

