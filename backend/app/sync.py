"""Two-way sync between a client's local data and the server.

Each sync is one round trip: the client pushes what changed since its last sync, and the server
replies with everything that changed on the server since the client's cursor.

Conflict rule: last write wins per workout / per preset / for settings, decided by the
client-side edit time (`updated_at`, epoch ms). An incoming change older than what the server
already holds is ignored, and the client receives the newer server copy in the reply.
"""

import datetime as dt

from sqlalchemy import delete, func
from sqlalchemy.orm import Session, selectinload

from app import schemas
from app.models import Exercise, Preset, PresetExercise, Set, User, Workout

# Rows committed by concurrent requests can become visible slightly out of order, so the cursor
# handed back trails the server clock a little. Clients may see a row twice; merging is idempotent.
CURSOR_OVERLAP = dt.timedelta(seconds=5)


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


# --- push ---


def _upsert_workout(db: Session, user: User, data: schemas.WorkoutData) -> None:
    row = (
        db.query(Workout)
        .filter(Workout.user_id == user.id, Workout.client_id == data.id)
        .first()
    )
    if row is not None and row.updated_at > data.updated_at:
        return
    if row is None:
        row = Workout(user_id=user.id, client_id=data.id)
        db.add(row)
    else:
        # Children are replaced wholesale. Delete first (they get fresh surrogate keys) so the
        # (parent, client_id) unique constraints never see old and new copies together.
        db.execute(delete(Exercise).where(Exercise.workout_id == row.id))
        db.expire(row, ["exercises"])

    row.date = data.date
    row.name = data.name
    row.notes = data.notes
    row.status = data.status
    row.started_at = data.started_at
    row.finished_at = data.finished_at
    row.rest_ends_at = data.rest.ends_at if data.rest else None
    row.rest_total = data.rest.total if data.rest else None
    row.updated_at = data.updated_at
    row.deleted = False
    row.synced_at = _now()
    row.exercises = [
        Exercise(
            client_id=e.id,
            position=position,
            name=e.name,
            plan_sets=e.plan.sets if e.plan else None,
            plan_reps=e.plan.reps if e.plan else None,
            plan_weight=e.plan.weight if e.plan else None,
            sets=[
                Set(
                    client_id=s.id,
                    set_number=s.set_number,
                    weight=s.weight,
                    reps=s.reps,
                    completed_at=s.completed_at,
                )
                for s in e.sets
            ],
        )
        for position, e in enumerate(data.exercises)
    ]


def _upsert_preset(db: Session, user: User, data: schemas.PresetData) -> None:
    row = (
        db.query(Preset)
        .filter(Preset.user_id == user.id, Preset.client_id == data.id)
        .first()
    )
    if row is not None and row.updated_at > data.updated_at:
        return
    if row is None:
        row = Preset(user_id=user.id, client_id=data.id)
        db.add(row)
    else:
        db.execute(delete(PresetExercise).where(PresetExercise.preset_id == row.id))
        db.expire(row, ["exercises"])

    row.name = data.name
    row.updated_at = data.updated_at
    row.deleted = False
    row.synced_at = _now()
    row.exercises = [
        PresetExercise(position=position, name=e.name, sets=e.sets, reps=e.reps, weight=e.weight)
        for position, e in enumerate(data.exercises)
    ]


def _tombstone(db: Session, user: User, model: type[Workout] | type[Preset], data: schemas.Tombstone) -> None:
    row = (
        db.query(model)
        .filter(model.user_id == user.id, model.client_id == data.id)
        .first()
    )
    if row is None:
        # Never synced from this device, but other devices may hold their own copy (starter
        # presets share ids), so record the delete for them to pick up.
        row = model(user_id=user.id, client_id=data.id, updated_at=data.updated_at, deleted=True, synced_at=_now())
        if model is Workout:
            row.date = dt.date.today()
            row.status = "done"
        else:
            row.name = ""
        db.add(row)
        return
    if row.updated_at > data.updated_at:
        return
    child = Exercise if model is Workout else PresetExercise
    fk = child.workout_id if model is Workout else child.preset_id
    db.execute(delete(child).where(fk == row.id))
    db.expire(row, ["exercises"])
    row.deleted = True
    row.updated_at = data.updated_at
    row.synced_at = _now()


def apply_push(db: Session, user: User, req: schemas.SyncRequest) -> None:
    if req.settings and req.settings.updated_at >= user.settings_updated_at:
        user.rest_timer_seconds = req.settings.rest_timer_seconds
        user.settings_updated_at = req.settings.updated_at
    for preset in req.presets:
        _upsert_preset(db, user, preset)
    for workout in req.workouts:
        _upsert_workout(db, user, workout)
    for t in req.deleted_presets:
        _tombstone(db, user, Preset, t)
    for t in req.deleted_workouts:
        _tombstone(db, user, Workout, t)
    db.flush()


# --- pull ---


def workout_to_data(w: Workout) -> schemas.WorkoutData:
    return schemas.WorkoutData(
        id=w.client_id,
        date=w.date,
        name=w.name,
        notes=w.notes,
        status=w.status,  # type: ignore[arg-type]
        started_at=w.started_at,
        finished_at=w.finished_at,
        rest=(
            schemas.RestData(ends_at=w.rest_ends_at, total=w.rest_total or 0)
            if w.rest_ends_at is not None
            else None
        ),
        updated_at=w.updated_at,
        exercises=[
            schemas.ExerciseData(
                id=e.client_id,
                name=e.name,
                plan=(
                    schemas.PlanData(sets=e.plan_sets, reps=e.plan_reps, weight=float(e.plan_weight))
                    if e.plan_sets is not None and e.plan_reps is not None and e.plan_weight is not None
                    else None
                ),
                sets=[
                    schemas.SetData(
                        id=s.client_id,
                        set_number=s.set_number,
                        weight=float(s.weight),
                        reps=s.reps,
                        completed_at=s.completed_at,
                    )
                    for s in e.sets
                ],
            )
            for e in w.exercises
        ],
    )


def preset_to_data(p: Preset) -> schemas.PresetData:
    return schemas.PresetData(
        id=p.client_id,
        name=p.name,
        updated_at=p.updated_at,
        exercises=[
            schemas.PresetExerciseData(name=e.name, sets=e.sets, reps=e.reps, weight=float(e.weight))
            for e in p.exercises
        ],
    )


def list_workouts(db: Session, user: User, since: dt.datetime | None = None) -> list[Workout]:
    query = (
        db.query(Workout)
        .options(selectinload(Workout.exercises).selectinload(Exercise.sets))
        .filter(Workout.user_id == user.id)
    )
    if since is not None:
        query = query.filter(Workout.synced_at > since)
    return query.order_by(Workout.updated_at.desc()).all()


def list_presets(db: Session, user: User, since: dt.datetime | None = None) -> list[Preset]:
    query = (
        db.query(Preset)
        .options(selectinload(Preset.exercises))
        .filter(Preset.user_id == user.id)
    )
    if since is not None:
        query = query.filter(Preset.synced_at > since)
    return query.order_by(Preset.updated_at.asc()).all()


def collect_changes(db: Session, user: User, since: dt.datetime | None) -> schemas.SyncResponse:
    workouts = list_workouts(db, user, since)
    presets = list_presets(db, user, since)
    return schemas.SyncResponse(
        cursor=_now() - CURSOR_OVERLAP,
        workouts=[workout_to_data(w) for w in workouts if not w.deleted],
        presets=[preset_to_data(p) for p in presets if not p.deleted],
        deleted_workouts=[
            schemas.Tombstone(id=w.client_id, updated_at=w.updated_at) for w in workouts if w.deleted
        ],
        deleted_presets=[
            schemas.Tombstone(id=p.client_id, updated_at=p.updated_at) for p in presets if p.deleted
        ],
        settings=(
            schemas.SettingsData(
                rest_timer_seconds=user.rest_timer_seconds, updated_at=user.settings_updated_at
            )
            if user.settings_updated_at > 0
            else None
        ),
    )


def history_for_exercise(db: Session, user: User, name: str) -> list[Set]:
    """Every logged set of an exercise name across the user's workouts, oldest first."""
    return (
        db.query(Set)
        .join(Exercise, Set.exercise_id == Exercise.id)
        .join(Workout, Exercise.workout_id == Workout.id)
        .filter(
            Workout.user_id == user.id,
            Workout.deleted.is_(False),
            func.lower(Exercise.name) == name.strip().lower(),
        )
        .order_by(Set.completed_at.asc())
        .all()
    )
