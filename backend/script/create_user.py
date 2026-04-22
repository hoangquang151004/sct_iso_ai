from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from passlib.context import CryptContext
from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT / ".env")

from db_session import SessionLocal

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Điền thông tin mặc định tại đây để chạy nhanh không cần truyền tham số CLI.
DEFAULT_USER = {
    "org_id": "11111111-1111-1111-1111-111111111111",
    "username": "admin",
    "email": "admin@gmail.com",
    "password": "admin12345",
    "full_name": "Default Admin User",
    "role_name": "admin",  # Đặt None nếu không muốn gán role
    "inactive": False,
}


def _resolve_org_id(org_id_arg: str | None) -> str:
    preferred_org_id = org_id_arg or DEFAULT_USER["org_id"]
    with SessionLocal() as db:
        row = db.execute(
            text("SELECT id FROM sct_iso.organizations WHERE id = :org_id LIMIT 1"),
            {"org_id": preferred_org_id},
        ).first()
        if row is not None:
            return str(row[0])

        now = datetime.now(timezone.utc)
        db.execute(
            text(
                "INSERT INTO sct_iso.organizations "
                "(id, name, code, is_active, created_at, updated_at) "
                "VALUES (:id, :name, :code, :is_active, :created_at, :updated_at)"
            ),
            {
                "id": preferred_org_id,
                "name": "Default Organization",
                "code": "DEFAULT_ORG",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
        )
        db.commit()
        return preferred_org_id


def _resolve_role_id(org_id: str, role_name: str | None) -> str | None:
    if not role_name:
        return None
    with SessionLocal() as db:
        row = db.execute(
            text(
                "SELECT id FROM sct_iso.roles "
                "WHERE lower(name) = lower(:role_name) "
                "AND (org_id = :org_id OR org_id IS NULL) "
                "ORDER BY org_id NULLS LAST LIMIT 1"
            ),
            {"role_name": role_name, "org_id": org_id},
        ).first()
        if row is not None:
            return str(row[0])

        role_id = str(uuid4())
        db.execute(
            text(
                "INSERT INTO sct_iso.roles "
                "(id, org_id, name, description, is_system, created_at) "
                "VALUES (:id, :org_id, :name, :description, :is_system, :created_at)"
            ),
            {
                "id": role_id,
                "org_id": org_id,
                "name": role_name,
                "description": "Auto-created by create_user.py",
                "is_system": False,
                "created_at": datetime.now(timezone.utc),
            },
        )
        db.commit()
        return role_id


def create_user(
    *,
    org_id: str,
    username: str,
    email: str,
    password: str,
    full_name: str,
    role_name: str | None,
    is_active: bool,
) -> tuple[str, bool]:
    user_id = str(uuid4())
    role_id = _resolve_role_id(org_id, role_name)
    password_hash = pwd_context.hash(password)
    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        try:
            duplicate = db.execute(
                text(
                    "SELECT id, username, email FROM sct_iso.users "
                    "WHERE lower(username) = lower(:username) OR lower(email) = lower(:email) "
                    "LIMIT 1"
                ),
                {"username": username, "email": email},
            ).first()
            if duplicate is not None:
                return str(duplicate[0]), False

            db.execute(
                text(
                    "INSERT INTO sct_iso.users "
                    "("
                    "id, org_id, role_id, username, email, password_hash, full_name, "
                    "is_active, token_version, must_change_password, created_at, updated_at"
                    ") "
                    "VALUES "
                    "("
                    ":id, :org_id, :role_id, :username, :email, :password_hash, :full_name, "
                    ":is_active, :token_version, :must_change_password, :created_at, :updated_at"
                    ")"
                ),
                {
                    "id": user_id,
                    "org_id": org_id,
                    "role_id": role_id,
                    "username": username,
                    "email": email,
                    "password_hash": password_hash,
                    "full_name": full_name,
                    "is_active": is_active,
                    "token_version": 0,
                    "must_change_password": False,
                    "created_at": now,
                    "updated_at": now,
                },
            )
            db.commit()
            return user_id, True
        except Exception:
            db.rollback()
            raise


def main() -> None:
    # Chỉ dùng thông tin cấu hình trong DEFAULT_USER ở đầu file.
    org_id = _resolve_org_id(DEFAULT_USER["org_id"])
    user_id, created = create_user(
        org_id=org_id,
        username=DEFAULT_USER["username"].strip(),
        email=DEFAULT_USER["email"].strip(),
        password=DEFAULT_USER["password"],
        full_name=DEFAULT_USER["full_name"].strip(),
        role_name=DEFAULT_USER["role_name"].strip() if DEFAULT_USER["role_name"] else None,
        is_active=not bool(DEFAULT_USER["inactive"]),
    )

    if created:
        print("User created successfully.")
    else:
        print("User already exists. Reusing existing record.")
    print(f"user_id={user_id}")
    print(f"org_id={org_id}")
    print(f"username={DEFAULT_USER['username'].strip()}")
    print(f"email={DEFAULT_USER['email'].strip()}")
    print(f"role_name={DEFAULT_USER['role_name'] or '(none)'}")


if __name__ == "__main__":
    main()
