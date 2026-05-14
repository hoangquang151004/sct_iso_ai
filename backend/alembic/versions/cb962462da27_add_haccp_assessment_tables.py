"""add_haccp_assessment_tables

Revision ID: cb962462da27
Revises: 50fbc80d5199
Create Date: 2026-05-07 14:33:16.849649

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cb962462da27'
down_revision: Union[str, Sequence[str], None] = '50fbc80d5199'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Tạo bảng haccp_assessments (Phiếu đánh giá HACCP)
    op.create_table(
        'haccp_assessments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('haccp_plan_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='DRAFT'),
        sa.Column('assessment_date', sa.Date(), nullable=True),
        sa.Column('overall_result', sa.String(length=50), nullable=True),
        sa.Column('overall_note', sa.Text(), nullable=True),
        sa.Column('submitted_by', sa.UUID(), nullable=True),
        sa.Column('reviewed_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['sct_iso.organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['haccp_plan_id'], ['sct_iso.haccp_plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submitted_by'], ['sct_iso.users.id']),
        sa.ForeignKeyConstraint(['reviewed_by'], ['sct_iso.users.id']),
        sa.PrimaryKeyConstraint('id'),
        schema='sct_iso'
    )

    # Tạo bảng haccp_assessment_items (Chi tiết từng hạng mục đánh giá)
    op.create_table(
        'haccp_assessment_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('assessment_id', sa.UUID(), nullable=False),
        sa.Column('item_type', sa.String(length=50), nullable=False),
        sa.Column('ref_id', sa.UUID(), nullable=True),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('expected_value', sa.Text(), nullable=True),
        sa.Column('actual_value', sa.Text(), nullable=True),
        sa.Column('result', sa.String(length=50), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('evidence_url', sa.Text(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['assessment_id'], ['sct_iso.haccp_assessments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='sct_iso'
    )

    # Index cho truy vấn nhanh
    op.create_index(
        'ix_haccp_assessments_org_id', 'haccp_assessments',
        ['org_id'], unique=False, schema='sct_iso'
    )
    op.create_index(
        'ix_haccp_assessments_haccp_plan_id', 'haccp_assessments',
        ['haccp_plan_id'], unique=False, schema='sct_iso'
    )
    op.create_index(
        'ix_haccp_assessments_status', 'haccp_assessments',
        ['status'], unique=False, schema='sct_iso'
    )
    op.create_index(
        'ix_haccp_assessment_items_assessment_id', 'haccp_assessment_items',
        ['assessment_id'], unique=False, schema='sct_iso'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_haccp_assessment_items_assessment_id', table_name='haccp_assessment_items', schema='sct_iso')
    op.drop_index('ix_haccp_assessments_status', table_name='haccp_assessments', schema='sct_iso')
    op.drop_index('ix_haccp_assessments_haccp_plan_id', table_name='haccp_assessments', schema='sct_iso')
    op.drop_index('ix_haccp_assessments_org_id', table_name='haccp_assessments', schema='sct_iso')
    op.drop_table('haccp_assessment_items', schema='sct_iso')
    op.drop_table('haccp_assessments', schema='sct_iso')
