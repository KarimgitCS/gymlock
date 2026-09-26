import datetime as dt
import re
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_.]+$")


# --- Auth ---


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        if not USERNAME_PATTERN.match(value):
            raise ValueError("Username may only contain letters, numbers, underscores, and periods")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        # bcrypt only accepts up to 72 *bytes*, which can be fewer than 72 characters.
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password is too long")
        return value


class UserLogin(BaseModel):
    username: str
    password: str = Field(max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    rest_timer_seconds: int
    created_at: dt.datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Synced data (used for both requests and responses) ---
# `id` is the client-generated UUID. Timestamps named `updated_at` are the client's edit time in
# epoch milliseconds and decide last-write-wins.


class SetData(BaseModel):
    id: uuid.UUID
    set_number: int = Field(ge=1, le=1000)
    weight: float = Field(ge=0, le=5000)
    reps: int = Field(ge=0, le=1000)
    completed_at: dt.datetime


class PlanData(BaseModel):
    sets: int = Field(ge=1, le=100)
    reps: int = Field(ge=1, le=1000)
    weight: float = Field(ge=0, le=5000)


class ExerciseData(BaseModel):
    id: uuid.UUID
    name: str = Field(max_length=255)
    plan: PlanData | None = None
    sets: list[SetData] = Field(default_factory=list, max_length=200)


class RestData(BaseModel):
    ends_at: int = Field(ge=0)
    total: int = Field(ge=0, le=86400)


class WorkoutData(BaseModel):
    id: uuid.UUID
    date: dt.date
    name: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=1000)
    status: Literal["planned", "active", "done"]
    started_at: dt.datetime | None = None
    finished_at: dt.datetime | None = None
    rest: RestData | None = None
    updated_at: int = Field(ge=0)
    exercises: list[ExerciseData] = Field(default_factory=list, max_length=100)


class PresetExerciseData(BaseModel):
    name: str = Field(max_length=255)
    sets: int = Field(ge=1, le=100)
    reps: int = Field(ge=1, le=1000)
    weight: float = Field(ge=0, le=5000)


class PresetData(BaseModel):
    id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    updated_at: int = Field(ge=0)
    exercises: list[PresetExerciseData] = Field(default_factory=list, max_length=100)


class SettingsData(BaseModel):
    rest_timer_seconds: int = Field(ge=10, le=600)
    updated_at: int = Field(ge=0)


class Tombstone(BaseModel):
    id: uuid.UUID
    updated_at: int = Field(ge=0)


class SyncRequest(BaseModel):
    # Server cursor from the previous sync; omit for a full pull.
    cursor: dt.datetime | None = None
    workouts: list[WorkoutData] = Field(default_factory=list, max_length=200)
    presets: list[PresetData] = Field(default_factory=list, max_length=100)
    deleted_workouts: list[Tombstone] = Field(default_factory=list, max_length=500)
    deleted_presets: list[Tombstone] = Field(default_factory=list, max_length=500)
    settings: SettingsData | None = None


class SyncResponse(BaseModel):
    cursor: dt.datetime
    workouts: list[WorkoutData]
    presets: list[PresetData]
    deleted_workouts: list[Tombstone]
    deleted_presets: list[Tombstone]
    settings: SettingsData | None
    # A fresh token when the presented one is getting old, so an active session never expires.
    token: str | None = None
