"""add ai_evaluation to haccp_assessments

Revision ID: 243c51ab139a
Revises: cb962462da27
Create Date: 2026-05-08 09:18:00.614793

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '243c51ab139a'
down_revision: Union[str, Sequence[str], None] = 'cb962462da27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('haccp_assessments', sa.Column('ai_evaluation', sa.Text(), nullable=True), schema='sct_iso')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('haccp_assessments', 'ai_evaluation', schema='sct_iso')
    # ### end Alembic commands ###
