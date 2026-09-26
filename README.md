# GymLock

A workout tracker for the web and mobile: plan a session, then lift one set at a time with a rest timer, and watch your progress per exercise. Built as a portfolio project focused on clean architecture (no ML or analytics layer).

**Live demo: [gymlock-web.onrender.com](https://gymlock-web.onrender.com)** — open it in any browser or on a phone. Nothing to install and no account needed.

## Features

- **Saved sessions (presets):** press Start workout, pick a saved session such as Push Day, and a workout opens pre-filled with its exercises, sets, reps and weight. Create, edit and delete your own presets. Three starters are included.
- **Plan first, then lift:** set up the whole workout (exercises, sets, reps, weight, rest time), press Begin, and a guided mode walks through one set at a time.
- **Rest timer that never starts by itself:** it starts only when you press **Set done**, and when it ends it waits for you. It is stored as an absolute end time, so it stays accurate through backgrounding and page reloads. On phones the end of the rest is scheduled as a local notification with the OS so it alerts you even if the app is closed; the web build uses an in-page timer with a beep.
- **Dropdowns instead of typing:** sets 1–8, reps 1–16, weight 5–300 lb in 5 lb steps, rest 15–300 s.
- **Progress charts:** max weight and volume over time for every exercise, drawn with hand-built SVG (no charting library).
- **Local-first:** no login. Workouts, presets and settings are stored on the device (browser storage on the web, app storage on phones), so each device keeps its own data.

Out of scope: an exercise library, accounts and sync, and any ML or analytics layer.

## Stack

| Layer | Tech |
|---|---|
| Client | React Native via Expo, exported as a website and a mobile app (TypeScript, Expo Router) |
| Backend API | FastAPI (Python), SQLAlchemy, Alembic |
| Database | PostgreSQL (Supabase in production, Docker locally) |
| Auth (API) | JWT with hashed passwords |
| Packaging | Docker (API image and a local compose stack) |
| Hosting | Render (static site and Docker web service) |

## Project structure

```
gymlock/
  backend/          FastAPI + PostgreSQL API (Docker, Alembic migrations)
  mobile/           Expo (React Native) app: the web and phone client
  docker-compose.yml  local API + Postgres
```

The client stores its data locally and does not call the API. The API is a complete, deployed backend (accounts, workouts, exercises, sets, per-exercise history) that could back a synced client later.

## Run the app

Requires Node.js 22.13 or newer.

```bash
git clone https://github.com/KarimgitCS/gymlock.git
cd gymlock/mobile
npm install
npx expo start --web      # in the browser
npx expo start            # or scan the QR code with Expo Go on a phone
```

To try it on a phone, install Expo Go from the App Store or Play Store and scan the QR code that `npx expo start` prints.

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
pip install -r requirements.txt
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

## Data model (API database)

| Table | Key fields |
|---|---|
| users | id, username, hashed_password, rest_timer_seconds, created_at |
| workouts | id, user_id (FK), date, notes |
| exercises | id, workout_id (FK), name, order |
| sets | id, exercise_id (FK), weight, reps, set_number, completed_at |

The client keeps the same shape locally, extended with a workout status (planned, active, done), each exercise's plan and the stored rest end time.

## API

- `POST /auth/signup` — create an account (username and password)
- `POST /auth/login` — returns a JWT
- `GET /auth/me`, `PATCH /auth/me` — profile and settings such as `rest_timer_seconds`
- `GET /workouts`, `POST /workouts` — list or create the current user's workouts
- `POST /workouts/{id}/exercises` — add an exercise to a workout
- `POST /exercises/{id}/sets` — log a set (weight, reps)
- `GET /exercises/{id}/history` — sets for one exercise instance
- `GET /exercises/history?name=Bench%20Press` — sets for an exercise name across all of the user's workouts, for progress charts
- `GET /health` — liveness check

Every route except signup, login and health requires an `Authorization: Bearer` header carrying the JWT.

## How the client is organized

- **Storage:** `mobile/src/storage`, `WorkoutsContext`, `PresetsContext` and `SettingsContext` persist everything with AsyncStorage.
- **Start and presets:** Start workout opens the saved sessions (`app/start.tsx`); presets are edited in `app/preset/[id].tsx`.
- **Workout screen** (`app/workout/[id].tsx`): a workout moves through three stages. **Planned** (`src/workout/WorkoutSetup.tsx`) edits every exercise's plan and the rest time while nothing runs. **Active** (`ActiveWorkout.tsx`) shows one set at a time with a Set done button, then the rest countdown with +30 s and Skip rest. **Done** (`WorkoutSummary.tsx`) shows the totals. Home shows a Resume card while a workout is planned or active.
- **Rest timer:** `src/hooks/useRestTimer.ts` counts down to a stored end timestamp and re-syncs with `AppState` when the app returns to the foreground; `src/timers/restAlerts.ts` schedules the end-of-rest notification on phones (`expo-notifications`) and plays a beep on the web.
- **Pickers:** `src/components/NumberPicker.tsx` is the scrolling dropdown; the ranges live in `src/constants.ts`.
- **Progress:** `app/(tabs)/progress.tsx` and `src/components/LineChart.tsx` chart weight and volume per exercise over time.

## Deployment

Everything runs on free tiers with no expiring trial:

| Piece | Where | Notes |
|---|---|---|
| Website | Render Static Site `gymlock-web` | Built from `mobile/` with `npx expo export --platform web`; live at [gymlock-web.onrender.com](https://gymlock-web.onrender.com) |
| API | Render Web Service `gymlock-api` (Docker runtime, `backend/Dockerfile`) | Live at [gymlock-api.onrender.com](https://gymlock-api.onrender.com), docs at `/docs` |
| Database | Supabase Postgres (free plan) | Reached through Supabase's IPv4 session pooler, because Render's free tier has no IPv6 |

- The website and the API auto-deploy on every push to `main`.
- **Database:** `DATABASE_URL` is the session-pooler connection string from the Supabase project's database settings. Row level security is enabled on every table (migration `9c1e4b7a2d10`) so Supabase's auto-generated REST API cannot expose them; the API connects as the table owner, which bypasses it.
- **API environment variables:** `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`.
- **Deep links on the website:** static sites don't rewrite unknown paths, so the build copies `index.html` to `404.html`. Links like `/progress` render correctly but are served with an HTTP 404 status. A `/*` to `/index.html` rewrite rule in the Render dashboard makes them return 200.
- **Free-tier behavior:** the Render API spins down when idle, so its first request after a quiet period is slow. Supabase pauses free projects after about a week of inactivity; they can be resumed from its dashboard.

## Installing on an iPhone

For development, use Expo Go (see Run the app). To install it as a standalone app icon, Apple offers two free routes:

1. **Xcode with a free Apple ID:** build locally with `npx expo run:ios` and install through Xcode. The install expires after 7 days and needs reconnecting to a Mac to refresh.
2. **SideStore:** a one-time setup from a computer, after which it refreshes automatically over Wi-Fi.

Apple's paid Developer Program ($99/year) removes the 7-day limit but isn't required for either route.
