from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Exercise, User, Workout
from app.schemas import ExerciseCreate, ExerciseOut, WorkoutCreate, WorkoutOut

router = APIRouter(tags=["workouts"])


def _get_owned_workout(workout_id: int, user: User, db: Session) -> Workout:
    workout = db.get(Workout, workout_id)
    if workout is None or workout.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found"
        )
    return workout


@router.get("/workouts", response_model=list[WorkoutOut])
def list_workouts(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return (
        db.query(Workout)
        .filter(Workout.user_id == user.id)
        .order_by(Workout.date.desc())
        .all()
    )


@router.post(
    "/workouts", response_model=WorkoutOut, status_code=status.HTTP_201_CREATED
)
def create_workout(
    payload: WorkoutCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    workout = Workout(user_id=user.id, notes=payload.notes)
    if payload.date is not None:
        workout.date = payload.date
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return workout


@router.post(
    "/workouts/{workout_id}/exercises",
    response_model=ExerciseOut,
    status_code=status.HTTP_201_CREATED,
)
def add_exercise(
    workout_id: int,
    payload: ExerciseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_owned_workout(workout_id, user, db)
    exercise = Exercise(workout_id=workout_id, name=payload.name, order=payload.order)
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise
