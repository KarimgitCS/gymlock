from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models import User

bearer_scheme = HTTPBearer()


@dataclass
class Auth:
    user: User
    token_payload: dict


def get_auth(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Auth:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise credentials_exception
    try:
        user = db.get(User, int(payload["sub"]))
    except (TypeError, ValueError):
        raise credentials_exception
    if user is None:
        raise credentials_exception
    return Auth(user=user, token_payload=payload)


def get_current_user(auth: Auth = Depends(get_auth)) -> User:
    return auth.user
