# GymLock

A workout tracker for the web and mobile: plan a session, then lift one set at a time with a rest timer, and watch your progress per exercise. Works fully offline on a single device, and syncs across devices when you sign in. Built as a portfolio project focused on clean architecture.

**Live demo: [gymlock-web.onrender.com](https://gymlock-web.onrender.com)** — open it in any browser or on a phone. No account needed to try it.

## Features

- **Saved sessions (presets):** press Start workout, pick a saved session such as Push Day, and a workout opens pre-filled with its exercises, sets, reps and weight. Create, edit and delete your own presets. Three starters are included.
- **Plan first, then lift:** set up the whole workout (exercises, sets, reps, weight, rest time), press Begin, and a guided mode walks through one set at a time.
- **Rest timer that never starts by itself:** it starts only when you press **Set done**, and when it ends it waits for you. It is stored as an absolute end time, so it stays accurate through backgrounding and page reloads. In the phone app the end of the rest is scheduled as a local notification with the OS, so it can alert you with the app closed. In a browser, a page can't do that, so the site keeps the screen awake during a workout and plays a sound and vibrates when the rest ends while the page is open. Settings has a **Test alert** button to check this on your own device.
- **Dropdowns instead of typing:** sets 1–8, reps 1–16, weight 5–300 lb in 5 lb steps, rest 15–300 s.
- **Progress charts:** max weight and volume over time for every exercise, drawn with hand-built SVG (no charting library).
- **Local-first with optional sync:** everything is saved on the device first, so the app is instant and works offline. Sign in (JWT) and the same data syncs through the FastAPI backend to your other devices and is backed up in Postgres. Without an account nothing leaves the device.

Out of scope: an exercise library, sharing between users, and any ML or analytics layer.

## Stack

| Layer | Tech |
|---|---|
| Client | React Native via Expo, exported as a website and a mobile app (TypeScript, Expo Router) |
| Backend API | FastAPI (Python), SQLAlchemy, Alembic |
| Database | PostgreSQL (Supabase in production, Docker locally) |
| Auth | JWT bearer tokens, bcrypt-hashed passwords |
| Packaging | Docker (API image and a local compose stack) |
| Hosting | Render (static site and Docker web service) |
| Testing | pytest (real Postgres), Node's test runner for the sync logic, Playwright browser tests, GitHub Actions CI |

## Project structure

```
gymlock/
  backend/            FastAPI + PostgreSQL API (Docker, Alembic migrations, pytest)
  mobile/             Expo (React Native) app: the web and phone client
    src/sync/         pure merge rules, API format converters, unit tests
    e2e/              Playwright browser tests
  docker-compose.yml  local API + Postgres
  .github/workflows/  CI
```

## Run the app

Requires Node.js 22.13 or newer.

```bash
git clone https://github.com/KarimgitCS/gymlock.git
cd gymlock/mobile
npm install
npx expo start --web      # in the browser
npx expo start            # or scan the QR code with Expo Go on a phone
```

The app talks to the deployed API by default. To use a local backend instead, set `EXPO_PUBLIC_API_URL=http://localhost:8000` (on a phone, use your computer's LAN address rather than `localhost`). Skipping sign-in means the API is never contacted.

## Run the backend

With Docker, nothing else needs installing:

```bash
docker compose up --build      # API on http://localhost:8000, Postgres on localhost:5433
docker compose down -v         # stop and wipe the local database
```

Or without Docker (requires Python 3.11+ and PostgreSQL):

```bash
createdb gymlock_dev
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
cat > .env <<EOF
DATABASE_URL=postgresql://localhost/gymlock_dev
JWT_SECRET=$(openssl rand -hex 32)
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
EOF
alembic upgrade head
uvicorn app.main:app --reload
```

The API is then live at `http://localhost:8000`, with interactive docs at `/docs`.

`backend/Dockerfile` is the image used in production. It runs `alembic upgrade head` on start, then serves the API with uvicorn on `$PORT`. Dependencies in `backend/requirements.txt` are pinned to tested versions.

## Tests

```bash
cd backend && python -m pytest          # API tests against a real Postgres
cd mobile && npm test                   # unit tests for the sync merge rules and data migration
cd mobile && npm run e2e                # browser tests, see mobile/e2e/README.md
```

- **Backend:** the tests run the real Alembic migrations against a throwaway `gymlock_test` database (created automatically; override with `TEST_DATABASE_URL`). They cover auth (hashing, expiry, forged and deleted-user tokens), the sync endpoint, last-write-wins conflicts, deletes, per-user isolation, validation, and token refresh.
- **Client unit tests** cover the merge logic on its own: newer edit wins, deletes versus edits, idempotency, two devices converging, and migration of older local data.
- **Browser tests** drive the built web app in Chromium: the whole guest workout flow, presets, and a two-device sync scenario (sign-up upload, sign-in download, propagation, deletes, conflict, offline queueing, sign-out isolation, expired session).
- **CI** (GitHub Actions) runs the backend tests against a Postgres service, and the type check and unit tests for the client.

## Data model (API database)

| Table | Key fields |
|---|---|
| users | id, username, hashed_password, rest_timer_seconds, settings_updated_at, created_at |
| presets / preset_exercises | preset: client_id, user_id, name; exercise: position, name, sets, reps, weight |
| workouts | client_id, user_id, date, name, status (planned, active, done), started_at, finished_at, rest_ends_at, rest_total |
| exercises | client_id, workout_id, position, name, plan_sets, plan_reps, plan_weight |
| sets | client_id, exercise_id, set_number, weight, reps, completed_at |

Every synced row also carries `updated_at` (the client's edit time, epoch ms), `deleted` (a tombstone flag) and `synced_at` (server write time). Devices create data offline, so each entity gets a UUID (`client_id`) on the device. It is only unique within its parent (or within a user), and rows have their own integer primary keys, so one user can never collide with or overwrite another user's data by choosing an id. Row level security is enabled on every table so Supabase's auto-generated REST API cannot expose them; the API connects as the table owner, which bypasses it.

## API

- `POST /auth/signup` — create an account (username and password, 8–72 characters)
- `POST /auth/login` — returns a JWT
- `GET /auth/me` — the signed-in user
- `POST /sync` — push local changes and pull everything that changed on the server (see below)
- `GET /workouts`, `GET /presets` — read the account's data
- `GET /exercises/history?name=Bench%20Press` — sets for an exercise name across all workouts
- `GET /health` — liveness check

Every route except signup, login and health requires an `Authorization: Bearer` header carrying the JWT.

## How sync works

Each device keeps its own full copy and the server keeps the account's copy. One `POST /sync` call both pushes and pulls:

1. **Push:** the client sends the workouts and presets changed since its last sync, deletes (tombstones), and the settings if changed.
2. **Merge:** for each item the newer `updated_at` wins (last write wins, per workout and per preset). An older incoming edit is ignored.
3. **Pull:** the reply contains everything that changed on the server after the client's cursor, which the client merges with the same rule.

Details worth knowing:

- **Cursor:** the server returns a cursor that trails its clock by 5 seconds, so a row committed slightly out of order is never missed. A client may see a row twice; merging is idempotent.
- **Deletes** are tombstones, so a delete on one device reaches the others, and only a newer edit can bring an item back. Starter presets share fixed ids across devices so they merge instead of duplicating.
- **Offline:** changes are queued, the header shows the state, and syncing retries with backoff and again when the connection returns or the app comes to the foreground.
- **First sign-in:** the data already on the device (guest data) becomes part of the account. Signing in on a second device downloads it.
- **Sign-out** removes the account's data from that device (after a final sync), so the next person to sign in never sees it. An **expired session** keeps local data and asks the user to sign in again.
- **Sessions:** tokens last 60 minutes and are re-issued during `/sync` once older than 15 minutes, so an active session stays signed in.
- **Where the token lives:** the OS keychain on phones; `localStorage` on the web, which is readable by any script on the page, so keep third-party scripts off the site.

## How the client is organized

- **Storage and sync:** `WorkoutsContext`, `PresetsContext` and `SettingsContext` persist to AsyncStorage through `src/sync/useSyncedCollection.ts`. `src/sync/collection.ts` holds the pure merge rules, `src/account/AccountContext.tsx` is the sync engine, and `src/api/client.ts` talks to the API. `src/storage/legacy.ts` migrates data saved before sync existed.
- **Start and presets:** Start workout opens the saved sessions (`app/start.tsx`); presets are edited in `app/preset/[id].tsx`.
- **Workout screen** (`app/workout/[id].tsx`): a workout moves through three stages. **Planned** (`src/workout/WorkoutSetup.tsx`) edits every exercise's plan and the rest time while nothing runs. **Active** (`ActiveWorkout.tsx`) shows one set at a time with a Set done button, then the rest countdown with +30 s and Skip rest. **Done** (`WorkoutSummary.tsx`) shows the totals. Home shows a Resume card while a workout is planned or active.
- **Rest timer:** `src/hooks/useRestTimer.ts` counts down to a stored end timestamp and re-syncs with `AppState` when the app returns to the foreground; `src/timers/restAlerts.ts` schedules the end-of-rest notification in the phone app (`expo-notifications`) and, on the web, plays a generated beep through an `<audio>` element (which phones play even with the silent switch on) and vibrates where supported. `expo-keep-awake` keeps the screen on during a workout.
- **Account:** `app/account.tsx` (sign in or create an account), the sync badge in the header, and the account card in Settings.
- **Pickers and charts:** `src/components/NumberPicker.tsx` is the scrolling dropdown (ranges in `src/constants.ts`); `app/(tabs)/progress.tsx` and `src/components/LineChart.tsx` draw the charts.

## Deployment

Everything runs on free tiers with no expiring trial:

| Piece | Where | Notes |
|---|---|---|
| Website | Render Static Site `gymlock-web` | Built from `mobile/` with `npx expo export --platform web`; live at [gymlock-web.onrender.com](https://gymlock-web.onrender.com) |
| API | Render Web Service `gymlock-api` (Docker runtime, `backend/Dockerfile`) | Live at [gymlock-api.onrender.com](https://gymlock-api.onrender.com), docs at `/docs` |
| Database | Supabase Postgres (free plan) | Reached through Supabase's IPv4 session pooler, because Render's free tier has no IPv6 |

- The website and the API auto-deploy on every push to `main`.
- **Database:** `DATABASE_URL` is the session-pooler connection string from the Supabase project's database settings.
- **API environment variables:** `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`.
- **Deep links on the website:** a `/*` to `/index.html` rewrite rule (Render dashboard, Redirects/Rewrites) serves the app for any path, so links like `/progress` work and return 200. Real files such as the JavaScript bundle are still served as-is.
- **Free-tier behavior:** the Render API spins down when idle, so the first sync after a quiet period can take up to a minute; the app keeps working meanwhile because it never waits on the network. Supabase pauses free projects after about a week of inactivity; they can be resumed from its dashboard.

## Known limitations

- Conflicts are resolved per workout and per preset (last write wins), not per field, so two devices editing the same workout offline keep only the newer version.
- The first sync on a new device downloads everything in one response, which is fine for personal use but not paginated.
- **Alerts on a locked phone:** a browser page cannot ring a scheduled alert once it is in the background or the phone is locked (that needs Web Push, which is not implemented). The web build covers the common case instead: the screen stays awake and the sound and vibration play while the page is open. iPhone browsers have no vibration API.
- The phone app's end-of-rest notifications use `expo-notifications` (Expo Go shows a warning that notifications are not fully supported there). They compile for iOS and Android, and the browser behavior is tested, but they have not yet been confirmed on a physical device; use Settings, then Test alert to check.
- Standalone installs on a phone use Expo Go, or `npx expo run:ios` with a free Apple ID, whose installs expire after 7 days.
