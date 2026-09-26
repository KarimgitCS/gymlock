# End-to-end browser tests

Playwright scripts that drive the web build in a real Chromium browser.

| Script | What it covers | Needs the API |
|---|---|---|
| `guest-flow.mjs` | plan a session, guided sets, rest timer that only starts on "Set done", reload persistence, summary | no |
| `presets.mjs` | dropdown ranges, creating/editing/deleting presets | no |
| `alerts.mjs` | rest alerts in the browser: sound and vibration fire when a rest ends, screen wake lock requested and released, tab-title countdown, Settings Test alert | no |
| `sync.mjs` | two devices: sign-up uploads guest data, sign-in downloads it, deletes, last-write-wins, offline queueing, sign-out isolation, expired session | yes |

## Run them

```bash
cd mobile
npm install
npx playwright install chromium

# Terminal 1: API (from the repo root)
docker compose up --build              # http://localhost:8000

# Terminal 2: build the app against that API and serve it
EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo export --platform web --clear
npx serve -s dist -l 8082

# Terminal 3
node e2e/guest-flow.mjs
node e2e/presets.mjs
node e2e/alerts.mjs
node e2e/sync.mjs
```

Override the targets with `SITE` and `API`, for example
`SITE=https://gymlock-web.onrender.com API=https://gymlock-api.onrender.com node e2e/sync.mjs`.
`sync.mjs` creates throwaway accounts (`sync…` and `other…`). Screenshots of failures go to
`e2e-screenshots/` (override with `SHOTS`).

Use `--clear` when building: Expo caches the inlined `EXPO_PUBLIC_API_URL` and can otherwise keep an old value.
