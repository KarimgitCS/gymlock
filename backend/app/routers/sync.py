from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas, sync
from app.core.security import create_access_token, token_age_seconds
from app.database import get_db
from app.deps import Auth, get_auth

router = APIRouter(tags=["sync"])

# Re-issue the token once it is older than this, so a session that keeps syncing stays signed in.
REFRESH_AFTER_SECONDS = 15 * 60


@router.post("/sync", response_model=schemas.SyncResponse)
def sync_endpoint(
    payload: schemas.SyncRequest,
    db: Session = Depends(get_db),
    auth: Auth = Depends(get_auth),
):
    sync.apply_push(db, auth.user, payload)
    response = sync.collect_changes(db, auth.user, payload.cursor)
    db.commit()
    if token_age_seconds(auth.token_payload) > REFRESH_AFTER_SECONDS:
        response.token = create_access_token(str(auth.user.id))
    return response
