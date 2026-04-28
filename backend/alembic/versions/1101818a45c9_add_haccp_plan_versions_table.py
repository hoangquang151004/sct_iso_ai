"""add_haccp_plan_versions_table

Revision ID: 1101818a45c9
Revises: 3c725a65bc54
Create Date: 2026-04-28 15:12:44.622826

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1101818a45c9'
down_revision: Union[str, Sequence[str], None] = '3c725a65bc54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('haccp_plan_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('version', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('scope', sa.Text(), nullable=True),
        sa.Column('product_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['sct_iso.haccp_plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['sct_iso.products.id']),
        sa.ForeignKeyConstraint(['created_by'], ['sct_iso.users.id']),
        sa.PrimaryKeyConstraint('id'),
        schema='sct_iso'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('haccp_plan_versions', schema='sct_iso')
