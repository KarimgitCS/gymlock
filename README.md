# GymLock

A workout tracking mobile app — log workouts, track sets/reps/weights over time, view progress charts, and use a built-in rest timer between sets. Built as a portfolio project focused on a rock-solid, well-architected full-stack app (no ML/analytics layer — the differentiator here is clean architecture, not modeling).

## Stack

| Layer    | Tech                                              |
|----------|----------------------------------------------------|
| Mobile   | React Native via Expo                              |
| Backend  | FastAPI (Python)                                   |
| Database | PostgreSQL (Supabase in production, Docker locally) |
| Auth     | JWT (password hashing + signed tokens)             |
| Packaging | Docker (API image + local compose stack)          |
| Dev tooling | Expo Go (live device preview during development) |

## MVP feature set

- No login: the app opens straight to your workouts, and everything is stored on the device (browser storage on the web, app storage on phones), so each device keeps its own data
- Saved sessions (presets): tap Start workout, pick a saved session such as Push Day, and a new workout opens pre-filled with its exercises, sets, reps and weight. Create, edit and delete your own presets (three starters are included)
- Log workouts made up of exercises, each with sets (weight × reps), chosen from scrolling dropdowns instead of typing: sets 1–8, reps 1–16, weight 5–300 lb in 5 lb steps
- Basic progress charts (e.g. weight/volume over time per exercise)
- Rest timer between sets — uses the set-completion timestamp plus React Native's `AppState` API (rather than just a running in-app timer), so it stays accurate even if the app is backgrounded
- Configurable default rest timer, saved on the device
- GymLock logo and a vivid, colorful dark theme

Explicitly out of scope for the MVP: an exercise library/database, and any ML or analytics layer.

## Project structure

```
gymlock/
  backend/     FastAPI + PostgreSQL API
  mobile/      Expo (React Native) app
```

The two live in one repo but are independently runnable — the API has no dependency on the mobile app and could serve a web client later.

## Prerequisites

Install and confirm each of these before starting:

- **Git** — `git --version`
- **Python 3.11+** — `python3 --version`
- **PostgreSQL** — `brew install postgresql@16` (Mac/Homebrew)
- **Node.js 18+** — `node --version`
- **Expo Go** — install on your phone from the App Store / Play Store (needed to preview the app live during development by scanning a QR code — no native build tooling required)

## Setup

### 1. Clone & scaffold

```bash
git clone <this-repo-url> gymlock
cd gymlock
```

### 2. Database

```bash
brew services start postgresql@16
createdb gymlock_dev
```

Verify it worked:

```bash
psql gymlock_dev
\q
```

### 3. Backend (`backend/`)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/` (see `.env.example`):

```
DATABASE_URL=postgresql://localhost/gymlock_dev
JWT_SECRET=<generate a random secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

Apply migrations and run the API:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

The API will be live at `http://localhost:8000` (interactive docs at `/docs`).

### 4. Mobile app (`mobile/`)

```bash
cd mobile
npm install
```

Point the app at your local API — set the base URL in your app config/env to your machine's LAN IP (not `localhost`, since your phone is a separate device on the network), e.g. `http://192.168.1.x:8000`.

Start the dev server:

```bash
npx expo start
```

Scan the QR code with your phone's camera (iOS) or the Expo Go app (Android) to load the app live.

## Data model

| Table    | Key fields                                                       |
|----------|--------------------------------------------------------------------|
| User     | id, username, hashed_password, rest_timer_seconds, created_at     |
| Workout  | id, user_id (FK), date, notes                                     |
| Exercise | id, workout_id (FK), name, order                                  |
| Set      | id, exercise_id (FK), weight, reps, set_number, completed_at       |

## API surface (backend)

- `POST /auth/signup` — create account (username + password)
- `POST /auth/login` — returns JWT
- `GET /auth/me` — current user's profile and settings
- `PATCH /auth/me` — update settings (e.g. `rest_timer_seconds`)
- `GET /workouts` — list current user's workouts
- `POST /workouts` — create a workout
- `POST /workouts/{id}/exercises` — add an exercise to a workout
- `POST /exercises/{id}/sets` — log a set (weight, reps)
- `GET /exercises/{id}/history` — historical sets for a single exercise instance
- `GET /exercises/history?name=<name>` — sets for `<name>` across all of the user's workouts, for progress charts (exercises are scoped to one workout each, so this aggregates by name)

All routes except signup/login require a valid JWT in the `Authorization` header (`Bearer <token>`).

## Mobile app structure

- **Local storage** — workouts, exercises, sets and settings are saved on the device via AsyncStorage (`mobile/src/storage`, `WorkoutsContext`, `SettingsContext`); there is no login
- **Start / presets** — Start workout opens the saved sessions (`app/start.tsx`); presets are created and edited in `app/preset/[id].tsx` and stored on the device (`src/presets`)
- **Workout logging screen** — each exercise shows `Set N of M` from its plan, with weight and reps dropdowns (`src/components/NumberPicker.tsx`, ranges in `src/constants.ts`)
- **Rest timer** — starts on set completion; timestamp-based so it survives the app being backgrounded, using `AppState` to reconcile elapsed time on foreground
- **Progress screen** — charts of weight/volume per exercise over time

## Running with Docker (local)

The API and a Postgres database run in containers, so nothing needs installing besides Docker:

```bash
docker compose up --build      # API on http://localhost:8000, Postgres on localhost:5433
docker compose down -v         # stop and wipe the local database
```

`backend/Dockerfile` is the same image used in production. It runs `alembic upgrade head` on start, then serves the API with uvicorn on `$PORT`. Dependencies in `backend/requirements.txt` are pinned to tested versions.

## Deployment

**The app itself is local-first and no longer calls the API.** The FastAPI backend and Supabase database below remain in the repo and deployed, but nothing in the mobile/web client uses them right now.

Everything runs on free tiers with no expiring trial:

| Piece | Where | Notes |
|---|---|---|
| Website | Render **Static Site** `gymlock-web` | Built from `mobile/` with `npx expo export --platform web`; live at `https://gymlock-web.onrender.com`. Data lives in each visitor's browser storage |
| API | Render **Web Service** `gymlock-api` (Docker runtime, `backend/Dockerfile`) | Live at `https://gymlock-api.onrender.com` (docs at `/docs`); auto-deploys on push to `main` |
| Database | **Supabase** Postgres (free plan) | Reached through Supabase's IPv4 session pooler (Render's free tier has no IPv6) |

- **Website:** the same Expo codebase as the mobile app. The auth token is kept in `localStorage` on web and SecureStore on native (`mobile/src/auth/tokenStorage.ts`). Static sites don't rewrite unknown paths, so the build copies `index.html` to `404.html`: deep links like `/progress` render, but with an HTTP 404 status. A `/*` → `/index.html` rewrite rule in the Render dashboard makes them return 200.
- **Database:** `DATABASE_URL` is the Supabase pooler connection string (`postgresql://postgres.<ref>:<password>@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require`). Row level security is enabled on every table (migration `9c1e4b7a2d10`) so Supabase's auto-generated REST API can't expose them; the API connects as the table owner, which bypasses RLS.
- **API environment:** `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`.
- **Free-tier behavior:** the Render web service spins down when idle, so the first request after a quiet period is slow. Supabase pauses free projects after about a week of inactivity and they can be resumed from the dashboard.

To point the mobile app at the deployed API instead of a local backend, set in `mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://gymlock-api.onrender.com
```

## Getting it on your iPhone

**During development:** use Expo Go (see step 4 above) — free, instant, no restrictions, this is how you'll preview the app as you build it.

**As a standalone installed app icon (no dev server needed):** Apple doesn't allow a free, permanent install outside the App Store, but there are two free routes:

1. **Xcode + free Apple ID** — build locally (`npx expo run:ios`) and install via Xcode using your regular Apple ID at no cost. The install expires after 7 days and needs reconnecting to your Mac to refresh — reasonable while still actively developing.
2. **SideStore** — one-time setup from a computer, then refreshes automatically over Wi-Fi with no computer needed afterward. More setup effort, but closest to a "just works" free daily-use install. Best done once the app is stable.

Apple's paid Developer Program ($99/year) removes the 7-day limit entirely, but isn't required for either option above.

## Roadmap

1. Project setup & tooling
2. Backend: models & database
3. Backend: JWT auth
4. Backend: workout logging endpoints
5. Mobile: scaffold Expo app
6. Mobile: auth screens
7. Mobile: workout logging screens
8. Mobile: rest timer
9. Mobile: progress charts
10. Polish, test, push to GitHub, and install on-device
