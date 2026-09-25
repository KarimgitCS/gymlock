import os

from dotenv import load_dotenv

load_dotenv()


def _normalize_database_url(url: str) -> str:
    # Hosted providers hand out "postgres://" or "postgresql://"; pin the psycopg2 driver explicitly.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg2://" + url[len(prefix):]
    return url


class Settings:
    database_url: str = _normalize_database_url(os.environ["DATABASE_URL"])
    jwt_secret: str = os.environ["JWT_SECRET"]
    jwt_algorithm: str = os.environ.get("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(
        os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )


settings = Settings()
