# Orbic Intelligence — Live Orb (v3.1)

A privacy-first client-side live orb that measures microphone energy (volume) and frequency to display a responsive orb and store "pulses" locally.

## Files
- `index.html` — main UI (Live, Gallery, Settings)
- `style.css` — styling
- `app.js` — main logic: audio, drawing, gallery persistence
- `manifest.json` — PWA manifest
- `service-worker.js` — basic static cache
- `favicon.svg` — simple orb icon
- `README.md` — this file

## Quick start
1. Commit all files to `main`.
2. Ensure GitHub Pages is configured to build from `main` (root).
3. Open the GitHub Pages URL (e.g. `https://<user>.github.io/<repo>/`) and allow microphone access when prompted.
4. Click **Start Mic** to see the orb respond. Use **Create Pulse** to save a pulse to local storage.

## Notes
- Audio processing is local (in-browser) — micro audio is not uploaded.
- Pulse data is saved in `localStorage` under `orbic_pulses_v3`.
- Service Worker caches static assets; update cache version string to force a refresh when you change assets.

## Future ideas
- Add theme presets, export/import gallery to cloud, configurable sharing endpoints.
- Add small onboarding modal to calibrate sensitivity on first run.

Made with ❤️ — privacy-first.
