import datetime as dt
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Sync model: every row has its own integer primary key. The client generates a UUID per
# entity (`client_id`) so devices can create data offline; it is only unique within its parent
# (or within a user for top-level rows), so one user can never collide with, or overwrite,
# another user's rows by choosing an id.
#
# `updated_at` is the client's edit time in epoch milliseconds and drives last-write-wins.
# `synced_at` is the server's write time and drives incremental pulls.


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    rest_timer_seconds: Mapped[int] = mapped_column(default=90, server_default="90")
    settings_updated_at: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Preset(Base):
    __tablename__ = "presets"
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_presets_user_client"),
        Index("ix_presets_user_synced", "user_id", "synced_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    name: Mapped[str] = mapped_column(String(100))
    updated_at: Mapped[int] = mapped_column(BigInteger)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    synced_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    exercises: Mapped[list["PresetExercise"]] = relationship(
        cascade="all, delete-orphan", order_by="PresetExercise.position", passive_deletes=True
    )


class PresetExercise(Base):
    __tablename__ = "preset_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    preset_id: Mapped[int] = mapped_column(ForeignKey("presets.id", ondelete="CASCADE"), index=True)
    position: Mapped[int]
    name: Mapped[str] = mapped_column(String(255))
    sets: Mapped[int]
    reps: Mapped[int]
    weight: Mapped[float] = mapped_column(Numeric(6, 2))


class Workout(Base):
    __tablename__ = "workouts"
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_workouts_user_client"),
        Index("ix_workouts_user_synced", "user_id", "synced_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    date: Mapped[dt.date] = mapped_column(Date)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(10))
    started_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rest_ends_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    rest_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[int] = mapped_column(BigInteger)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    synced_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    exercises: Mapped[list["Exercise"]] = relationship(
        cascade="all, delete-orphan", order_by="Exercise.position", passive_deletes=True
    )


class Exercise(Base):
    __tablename__ = "exercises"
    __table_args__ = (UniqueConstraint("workout_id", "client_id", name="uq_exercises_workout_client"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workouts.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    position: Mapped[int]
    name: Mapped[str] = mapped_column(String(255))
    plan_sets: Mapped[int | None] = mapped_column(nullable=True)
    plan_reps: Mapped[int | None] = mapped_column(nullable=True)
    plan_weight: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)

    sets: Mapped[list["Set"]] = relationship(
        cascade="all, delete-orphan", order_by="Set.set_number", passive_deletes=True
    )


class Set(Base):
    __tablename__ = "sets"
    __table_args__ = (UniqueConstraint("exercise_id", "client_id", name="uq_sets_exercise_client"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    set_number: Mapped[int]
    weight: Mapped[float] = mapped_column(Numeric(6, 2))
    reps: Mapped[int]
    completed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
