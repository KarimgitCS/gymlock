import os
import pathlib
import uuid
from datetime import timedelta

# The app reads its settings when imported, so point it at a throwaway database first.
TEST_DB_URL = os.environ.get("TEST_DATABASE_URL", "postgresql://localhost/gymlock_test")
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["JWT_SECRET"] = "test-secret-not-used-anywhere-else"
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")

import psycopg2  # noqa: E402
import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

from app import sync  # noqa: E402
from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent


def _ensure_database() -> None:
    url = make_url(TEST_DB_URL)
    conn = psycopg2.connect(
        dbname="postgres", user=url.username, password=url.password, host=url.host, port=url.port
    )
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (url.database,))
        if cur.fetchone() is None:
            cur.execute(f'CREATE DATABASE "{url.database}"')
    conn.close()


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    """Build the schema by running the real Alembic migrations, which tests them too."""
    _ensure_database()
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    yield


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE users RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def exact_cursor(monkeypatch):
    # The real cursor trails the server clock by a few seconds; tests want exact increments.
    monkeypatch.setattr(sync, "CURSOR_OVERLAP", timedelta(0))


@pytest.fixture()
def client():
    return TestClient(app)


def _signup(client: TestClient, username: str) -> dict:
    response = client.post("/auth/signup", json={"username": username, "password": "password123"})
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture()
def alice(client):
    return _signup(client, "alice")


@pytest.fixture()
def bob(client):
    return _signup(client, "bob")


def new_id() -> str:
    return str(uuid.uuid4())


def make_workout(updated_at: int = 1000, **overrides) -> dict:
    workout = {
        "id": new_id(),
        "date": "2026-09-25",
        "name": "Push Day",
        "notes": None,
        "status": "active",
        "started_at": "2026-09-25T15:00:00Z",
        "finished_at": None,
        "rest": {"ends_at": 1_790_000_000_000, "total": 90},
        "updated_at": updated_at,
        "exercises": [
            {
                "id": new_id(),
                "name": "Bench Press",
                "plan": {"sets": 4, "reps": 8, "weight": 135},
                "sets": [
                    {
                        "id": new_id(),
                        "set_number": 1,
                        "weight": 135,
                        "reps": 8,
                        "completed_at": "2026-09-25T15:05:00Z",
                    }
                ],
            }
        ],
    }
    workout.update(overrides)
    return workout


def make_preset(updated_at: int = 1000, **overrides) -> dict:
    preset = {
        "id": new_id(),
        "name": "Leg Day",
        "updated_at": updated_at,
        "exercises": [{"name": "Squat", "sets": 4, "reps": 8, "weight": 155}],
    }
    preset.update(overrides)
    return preset
