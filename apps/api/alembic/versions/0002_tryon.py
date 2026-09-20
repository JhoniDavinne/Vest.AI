"""try-on: products.flat_image_url + tryon_jobs (somente metadados)

Revision ID: 4b2a7c9e1d06
Revises: 07f07de8bcbe
Create Date: 2026-09-20 18:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "4b2a7c9e1d06"
down_revision = "07f07de8bcbe"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("products", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("flat_image_url", sa.String(length=400), nullable=False, server_default="")
        )

    op.create_table(
        "tryon_jobs",
        sa.Column("analysis_id", sa.String(length=32), nullable=False),
        sa.Column("product_id", sa.String(length=32), nullable=False),
        sa.Column("sku", sa.String(length=80), nullable=False),
        sa.Column("size", sa.String(length=12), nullable=False),
        sa.Column("cloth_type", sa.String(length=16), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("model_version", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("consent", sa.Boolean(), nullable=False),
        sa.Column("cache_key", sa.String(length=64), nullable=True),
        sa.Column("result_ref", sa.String(length=80), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(length=48), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["fit_analyses.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("tryon_jobs", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_tryon_jobs_analysis_id"), ["analysis_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_tryon_jobs_product_id"), ["product_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_tryon_jobs_status"), ["status"], unique=False)
        batch_op.create_index(batch_op.f("ix_tryon_jobs_cache_key"), ["cache_key"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("tryon_jobs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_tryon_jobs_cache_key"))
        batch_op.drop_index(batch_op.f("ix_tryon_jobs_status"))
        batch_op.drop_index(batch_op.f("ix_tryon_jobs_product_id"))
        batch_op.drop_index(batch_op.f("ix_tryon_jobs_analysis_id"))
    op.drop_table("tryon_jobs")

    with op.batch_alter_table("products", schema=None) as batch_op:
        batch_op.drop_column("flat_image_url")
