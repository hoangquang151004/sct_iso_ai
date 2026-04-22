"""rbac/auth/audit baseline on sct_iso schema

Revision ID: 0001_rbac_baseline
Revises:
Create Date: 2026-04-22 00:00:00
"""
from __future__ import annotations

from alembic import op


revision = "0001_rbac_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS sct_iso;")
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sct_iso.organizations (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            name varchar(255) NOT NULL,
            code varchar(50) UNIQUE NOT NULL,
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sct_iso.roles (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            org_id uuid NULL REFERENCES sct_iso.organizations(id) ON DELETE CASCADE,
            name varchar(100) NOT NULL,
            description text NULL,
            is_system boolean NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sct_iso.users (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            org_id uuid NOT NULL REFERENCES sct_iso.organizations(id) ON DELETE CASCADE,
            role_id uuid NULL REFERENCES sct_iso.roles(id),
            username varchar(100) UNIQUE NOT NULL,
            email varchar(150) UNIQUE NOT NULL,
            password_hash text NOT NULL,
            full_name varchar(200) NOT NULL,
            department varchar(100) NULL,
            position varchar(100) NULL,
            phone varchar(20) NULL,
            avatar_url text NULL,
            is_active boolean NOT NULL DEFAULT true,
            token_version integer NOT NULL DEFAULT 0,
            disabled_at timestamptz NULL,
            must_change_password boolean NOT NULL DEFAULT false,
            last_login timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sct_iso.permissions (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            code varchar(120) UNIQUE NOT NULL,
            description text NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sct_iso.user_roles (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id uuid NOT NULL REFERENCES sct_iso.users(id) ON DELETE CASCADE,
            role_id uuid NOT NULL REFERENCES sct_iso.roles(id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_roles'
            ) THEN
                ALTER TABLE sct_iso.user_roles
                ADD CONSTRAINT uq_user_roles UNIQUE (user_id, role_id);
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sct_iso.role_permissions (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            role_id uuid NOT NULL REFERENCES sct_iso.roles(id) ON DELETE CASCADE,
            permission_id uuid NOT NULL REFERENCES sct_iso.permissions(id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_role_permissions'
            ) THEN
                ALTER TABLE sct_iso.role_permissions
                ADD CONSTRAINT uq_role_permissions UNIQUE (role_id, permission_id);
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sct_iso.refresh_tokens (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id uuid NOT NULL REFERENCES sct_iso.users(id) ON DELETE CASCADE,
            token_hash varchar(128) UNIQUE NOT NULL,
            user_agent varchar(512) NULL,
            ip varchar(64) NULL,
            device_label varchar(128) NULL,
            last_used_at timestamptz NULL,
            expires_at timestamptz NOT NULL,
            revoked_at timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sct_iso.audit_log (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            org_id uuid NOT NULL REFERENCES sct_iso.organizations(id) ON DELETE CASCADE,
            actor_user_id uuid NULL REFERENCES sct_iso.users(id) ON DELETE SET NULL,
            action varchar(150) NOT NULL,
            target_type varchar(100) NULL,
            target_id varchar(100) NULL,
            request_id varchar(64) NULL,
            ip varchar(64) NULL,
            user_agent varchar(512) NULL,
            payload jsonb NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_audit_log_org_created_at
        ON sct_iso.audit_log (org_id, created_at DESC);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_audit_log_actor_created_at
        ON sct_iso.audit_log (actor_user_id, created_at DESC);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_audit_log_action_created_at
        ON sct_iso.audit_log (action, created_at DESC);
        """
    )

    op.execute(
        """
        ALTER TABLE sct_iso.users
        ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
        """
    )
    op.execute(
        """
        ALTER TABLE sct_iso.users
        ADD COLUMN IF NOT EXISTS disabled_at timestamptz NULL;
        """
    )
    op.execute(
        """
        ALTER TABLE sct_iso.users
        ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_roles_org_name'
            ) THEN
                ALTER TABLE sct_iso.roles
                ADD CONSTRAINT uq_roles_org_name UNIQUE (org_id, name);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS sct_iso.ix_audit_log_action_created_at;")
    op.execute("DROP INDEX IF EXISTS sct_iso.ix_audit_log_actor_created_at;")
    op.execute("DROP INDEX IF EXISTS sct_iso.ix_audit_log_org_created_at;")
    op.execute("DROP TABLE IF EXISTS sct_iso.audit_log;")
    op.execute("DROP TABLE IF EXISTS sct_iso.refresh_tokens;")
    op.execute("DROP TABLE IF EXISTS sct_iso.role_permissions;")
    op.execute("DROP TABLE IF EXISTS sct_iso.user_roles;")
    op.execute("DROP TABLE IF EXISTS sct_iso.permissions;")
