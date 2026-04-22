import os
from dotenv import load_dotenv
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from database import Base  # ← Giả sử bạn import Base từ đây
from alembic import context

load_dotenv()

# Alembic Config object
config = context.config
config.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL"))

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ================== QUAN TRỌNG: TARGET METADATA ==================
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        schema="sct_iso",  # ← Thêm
        version_table_schema="sct_iso",  # ← Thêm
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # ================== CẤU HÌNH SCHEMA ==================
            schema="sct_iso",  # Schema chứa tất cả bảng
            version_table_schema="sct_iso",  # alembic_version nằm ở schema này
            include_schemas=True,
            compare_type=True,
            compare_server_default=True,
            # ====================================================
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
