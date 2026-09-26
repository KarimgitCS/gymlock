import datetime as dt

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import schemas, sync
from app.database import get_db
from app.deps import get_current_user
from app.models import User

router = APIRouter(tags=["data"])


class HistorySet(BaseModel):
    weight: float
    reps: int
    completed_at: dt.datetime


@router.get("/workouts", response_model=list[schemas.WorkoutData])
def list_workouts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [sync.workout_to_data(w) for w in sync.list_workouts(db, user) if not w.deleted]


@router.get("/presets", response_model=list[schemas.PresetData])
def list_presets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [sync.preset_to_data(p) for p in sync.list_presets(db, user) if not p.deleted]


@router.get("/exercises/history", response_model=list[HistorySet])
def exercise_history(
    name: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sets for an exercise name across all of the user's workouts, for progress charts."""
    return [
        HistorySet(weight=float(s.weight), reps=s.reps, completed_at=s.completed_at)
        for s in sync.history_for_exercise(db, user, name)
    ]
