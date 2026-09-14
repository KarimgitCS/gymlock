from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Exercise, Set, User, Workout
from app.schemas import SetCreate, SetOut

router = APIRouter(tags=["exercises"])


def _get_owned_exercise(exercise_id: int, user: User, db: Session) -> Exercise:
    exercise = (
        db.query(Exercise)
        .join(Workout)
        .filter(Exercise.id == exercise_id, Workout.user_id == user.id)
        .first()
    )
    if exercise is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found"
        )
    return exercise


@router.post(
    "/exercises/{exercise_id}/sets",
    response_model=SetOut,
    status_code=status.HTTP_201_CREATED,
)
def log_set(
    exercise_id: int,
    payload: SetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_owned_exercise(exercise_id, user, db)
    next_set_number = (
        db.query(func.count(Set.id)).filter(Set.exercise_id == exercise_id).scalar()
        + 1
    )
    new_set = Set(
        exercise_id=exercise_id,
        weight=payload.weight,
        reps=payload.reps,
        set_number=next_set_number,
    )
    db.add(new_set)
    db.commit()
    db.refresh(new_set)
    return new_set


@router.get("/exercises/{exercise_id}/history", response_model=list[SetOut])
def exercise_history(
    exercise_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_owned_exercise(exercise_id, user, db)
    return (
        db.query(Set)
        .filter(Set.exercise_id == exercise_id)
        .order_by(Set.completed_at.asc())
        .all()
    )


@router.get("/exercises/history", response_model=list[SetOut])
def exercise_history_by_name(
    name: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """All sets across every workout for exercises matching `name` (case-insensitive).

    Exercise rows are scoped to a single workout, so progress-over-time charts need
    this cross-workout aggregation rather than the single-exercise history above.
    """
    return (
        db.query(Set)
        .join(Exercise)
        .join(Workout)
        .filter(Workout.user_id == user.id, func.lower(Exercise.name) == name.lower())
        .order_by(Set.completed_at.asc())
        .all()
    )
