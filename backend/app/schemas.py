import datetime as dt

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Auth ---


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: dt.datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Sets ---


class SetCreate(BaseModel):
    weight: float = Field(ge=0)
    reps: int = Field(ge=0)


class SetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    weight: float
    reps: int
    set_number: int
    completed_at: dt.datetime


# --- Exercises ---


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    order: int = 0


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workout_id: int
    name: str
    order: int
    sets: list[SetOut] = []


# --- Workouts ---


class WorkoutCreate(BaseModel):
    date: dt.date | None = None
    notes: str | None = Field(default=None, max_length=1000)


class WorkoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: dt.date
    notes: str | None
    exercises: list[ExerciseOut] = []
