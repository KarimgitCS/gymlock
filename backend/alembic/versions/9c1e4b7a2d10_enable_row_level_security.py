"""enable row level security

Hosted Postgres providers such as Supabase expose the public schema through an
auto-generated REST API. The API here connects as the table owner (which bypasses
RLS), so enabling RLS with no policies blocks that side door without affecting it.

Revision ID: 9c1e4b7a2d10
Revises: 5fa6f758ae9a
"""
from alembic import op

revision = "9c1e4b7a2d10"
down_revision = "5fa6f758ae9a"
branch_labels = None
depends_on = None

TABLES = ("users", "workouts", "exercises", "sets")


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
