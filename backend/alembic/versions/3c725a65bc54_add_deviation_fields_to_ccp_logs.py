"""add_deviation_fields_to_ccp_logs

Revision ID: 3c725a65bc54
Revises: 5e28a4a66bed
Create Date: 2026-04-28 14:53:47.475291

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c725a65bc54'
down_revision: Union[str, Sequence[str], None] = '5e28a4a66bed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add deviation management columns to ccp_monitoring_logs
    op.add_column('ccp_monitoring_logs',
        sa.Column('deviation_status', sa.String(length=50), nullable=True),
        schema='sct_iso'
    )
    op.add_column('ccp_monitoring_logs',
        sa.Column('deviation_severity', sa.String(length=20), nullable=True),
        schema='sct_iso'
    )
    op.add_column('ccp_monitoring_logs',
        sa.Column('corrective_action', sa.Text(), nullable=True),
        schema='sct_iso'
    )
    op.add_column('ccp_monitoring_logs',
        sa.Column('root_cause', sa.Text(), nullable=True),
        schema='sct_iso'
    )
    op.add_column('ccp_monitoring_logs',
        sa.Column('resolution_note', sa.Text(), nullable=True),
        schema='sct_iso'
    )
    op.add_column('ccp_monitoring_logs',
        sa.Column('handled_by', sa.UUID(), nullable=True),
        schema='sct_iso'
    )
    op.add_column('ccp_monitoring_logs',
        sa.Column('handled_at', sa.DateTime(timezone=True), nullable=True),
        schema='sct_iso'
    )
    # Add foreign key for handled_by
    op.create_foreign_key(
        'ccp_monitoring_logs_handled_by_fkey',
        'ccp_monitoring_logs',
        'users',
        ['handled_by'],
        ['id'],
        source_schema='sct_iso',
        referent_schema='sct_iso'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ccp_monitoring_logs_handled_by_fkey', 'ccp_monitoring_logs', schema='sct_iso')
    op.drop_column('ccp_monitoring_logs', 'handled_at', schema='sct_iso')
    op.drop_column('ccp_monitoring_logs', 'handled_by', schema='sct_iso')
    op.drop_column('ccp_monitoring_logs', 'resolution_note', schema='sct_iso')
    op.drop_column('ccp_monitoring_logs', 'root_cause', schema='sct_iso')
    op.drop_column('ccp_monitoring_logs', 'corrective_action', schema='sct_iso')
    op.drop_column('ccp_monitoring_logs', 'deviation_severity', schema='sct_iso')
    op.drop_column('ccp_monitoring_logs', 'deviation_status', schema='sct_iso')
