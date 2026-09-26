from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import settings


def test_signup_returns_a_token_that_works(client):
    response = client.post("/auth/signup", json={"username": "karim", "password": "password123"})
    assert response.status_code == 201
    token = response.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "karim"
    assert me.json()["rest_timer_seconds"] == 90


def test_duplicate_username_is_rejected(client):
    body = {"username": "karim", "password": "password123"}
    assert client.post("/auth/signup", json=body).status_code == 201
    assert client.post("/auth/signup", json=body).status_code == 409


def test_signup_validation(client):
    bad = [
        {"username": "ab", "password": "password123"},
        {"username": "has space", "password": "password123"},
        {"username": "karim", "password": "short"},
        {"username": "karim", "password": "x" * 73},
        # 40 characters but 80 bytes: bcrypt would reject it, so the API must too.
        {"username": "karim", "password": "é" * 40},
    ]
    for body in bad:
        assert client.post("/auth/signup", json=body).status_code == 422, body


def test_passwords_are_stored_hashed(client):
    from app.database import SessionLocal
    from app.models import User

    client.post("/auth/signup", json={"username": "karim", "password": "password123"})
    with SessionLocal() as db:
        stored = db.query(User).one().hashed_password
    assert stored != "password123"
    assert stored.startswith("$2")


def test_login(client):
    client.post("/auth/signup", json={"username": "karim", "password": "password123"})
    ok = client.post("/auth/login", json={"username": "karim", "password": "password123"})
    assert ok.status_code == 200
    assert client.post("/auth/login", json={"username": "karim", "password": "wrong-password"}).status_code == 401
    assert client.post("/auth/login", json={"username": "nobody", "password": "password123"}).status_code == 401


def test_login_with_an_overlong_password_is_a_clean_401_not_a_crash(client):
    client.post("/auth/signup", json={"username": "karim", "password": "password123"})
    response = client.post("/auth/login", json={"username": "karim", "password": "é" * 60})
    assert response.status_code == 401


def test_protected_routes_reject_missing_and_invalid_tokens(client):
    for path in ("/auth/me", "/workouts", "/presets", "/exercises/history?name=x"):
        assert client.get(path).status_code == 403 or client.get(path).status_code == 401
        assert client.get(path, headers={"Authorization": "Bearer not.a.jwt"}).status_code == 401
    assert client.post("/sync", json={}).status_code in (401, 403)
    assert client.post("/sync", json={}, headers={"Authorization": "Bearer nope"}).status_code == 401


def test_expired_token_is_rejected(client):
    past = datetime.now(timezone.utc) - timedelta(hours=2)
    token = jwt.encode(
        {"sub": "1", "iat": int(past.timestamp()), "exp": past + timedelta(minutes=60)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_token_signed_with_another_secret_is_rejected(client):
    client.post("/auth/signup", json={"username": "karim", "password": "password123"})
    forged = jwt.encode(
        {"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, "another-secret", algorithm="HS256"
    )
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_token_for_a_deleted_user_is_rejected(client):
    from app.database import SessionLocal
    from app.models import User

    token = client.post("/auth/signup", json={"username": "karim", "password": "password123"}).json()["access_token"]
    with SessionLocal() as db:
        db.delete(db.query(User).one())
        db.commit()
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
