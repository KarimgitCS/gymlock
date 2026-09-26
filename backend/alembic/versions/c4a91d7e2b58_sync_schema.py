"""sync schema: presets, client ids, workout stages, last-write-wins timestamps

Replaces the original single-device workouts/exercises/sets tables with a schema that can sync
between devices. The old tables held no production data (the client was local-only), so they
are dropped rather than converted.

Revision ID: c4a91d7e2b58
Revises: 9c1e4b7a2d10
"""
import sqlalchemy as sa
from alembic import op

revision = "c4a91d7e2b58"
down_revision = "9c1e4b7a2d10"
branch_labels = None
depends_on = None

NEW_TABLES = ("presets", "preset_exercises", "workouts", "exercises", "sets")


def upgrade() -> None:
    op.drop_table("sets")
    op.drop_table("exercises")
    op.drop_table("workouts")

    op.add_column(
        "users",
        sa.Column("settings_updated_at", sa.BigInteger(), server_default="0", nullable=False),
    )

    op.create_table(
        "presets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "client_id", name="uq_presets_user_client"),
    )
    op.create_index("ix_presets_user_synced", "presets", ["user_id", "synced_at"])

    op.create_table(
        "preset_exercises",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("preset_id", sa.Integer(), sa.ForeignKey("presets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("sets", sa.Integer(), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.Column("weight", sa.Numeric(6, 2), nullable=False),
    )
    op.create_index("ix_preset_exercises_preset_id", "preset_exercises", ["preset_id"])

    op.create_table(
        "workouts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("name", sa.String(100), nullable=True),
        sa.Column("notes", sa.String(1000), nullable=True),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rest_ends_at", sa.BigInteger(), nullable=True),
        sa.Column("rest_total", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "client_id", name="uq_workouts_user_client"),
    )
    op.create_index("ix_workouts_user_synced", "workouts", ["user_id", "synced_at"])

    op.create_table(
        "exercises",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workout_id", sa.Integer(), sa.ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("plan_sets", sa.Integer(), nullable=True),
        sa.Column("plan_reps", sa.Integer(), nullable=True),
        sa.Column("plan_weight", sa.Numeric(6, 2), nullable=True),
        sa.UniqueConstraint("workout_id", "client_id", name="uq_exercises_workout_client"),
    )
    op.create_index("ix_exercises_workout_id", "exercises", ["workout_id"])

    op.create_table(
        "sets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("exercise_id", sa.Integer(), sa.ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("set_number", sa.Integer(), nullable=False),
        sa.Column("weight", sa.Numeric(6, 2), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("exercise_id", "client_id", name="uq_sets_exercise_client"),
    )
    op.create_index("ix_sets_exercise_id", "sets", ["exercise_id"])

    # Supabase exposes the public schema over its REST API; RLS with no policies blocks that
    # route while the API (which connects as the table owner) is unaffected.
    for table in NEW_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in reversed(NEW_TABLES):
        op.drop_table(table)
    op.drop_column("users", "settings_updated_at")

    op.create_table(
        "workouts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), server_default=sa.func.current_date(), nullable=False),
        sa.Column("notes", sa.String(1000), nullable=True),
    )
    op.create_table(
        "exercises",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workout_id", sa.Integer(), sa.ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
    )
    op.create_table(
        "sets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("exercise_id", sa.Integer(), sa.ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False),
        sa.Column("weight", sa.Numeric(6, 2), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.Column("set_number", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    for table in ("workouts", "exercises", "sets"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
