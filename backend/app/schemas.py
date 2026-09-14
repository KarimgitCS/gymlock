import datetime as dt
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_.]+$")


# --- Auth ---


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        if not USERNAME_PATTERN.match(value):
            raise ValueError(
                "Username may only contain letters, numbers, underscores, and periods"
            )
        return value


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    rest_timer_seconds: int
    created_at: dt.datetime


class SettingsUpdate(BaseModel):
    rest_timer_seconds: int = Field(ge=10, le=600)


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
