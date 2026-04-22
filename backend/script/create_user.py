from __future__ import annotations

import argparse
from datetime import datetime, timezone
from uuid import uuid4

from passlib.context import CryptContext
from sqlalchemy import text

from db_session import SessionLocal

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Điền thông tin mặc định tại đây để chạy nhanh không cần truyền tham số CLI.
DEFAULT_USER = {
    "org_id": None,  # None => tự lấy org đầu tiên trong DB
    "username": "report_test_user",
    "email": "report_test_user@example.com",
    "password": "Report@123",
    "full_name": "Report Test User",
    "role_name": "Admin",  # Đặt None nếu không muốn gán role
    "inactive": True,
}


def _resolve_org_id(org_id_arg: str | None) -> str:
    if org_id_arg:
        return org_id_arg
    with SessionLocal() as db:
        row = db.execute(
            text("SELECT id FROM sct_iso.organizations ORDER BY created_at ASC LIMIT 1")
        ).first()
        if row is None:
            raise RuntimeError(
                "Không có organization trong DB. Hãy tạo organization trước hoặc truyền --org-id."
            )
        return str(row[0])


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
        if row is None:
            raise RuntimeError(
                f"Không tìm thấy role '{role_name}' cho org_id={org_id}."
            )
        return str(row[0])


def create_user(
    *,
    org_id: str,
    username: str,
    email: str,
    password: str,
    full_name: str,
    role_name: str | None,
    is_active: bool,
) -> str:
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
                raise RuntimeError(
                    f"Username/email đã tồn tại: username={duplicate[1]}, email={duplicate[2]}"
                )

            db.execute(
                text(
                    "INSERT INTO sct_iso.users "
                    "(id, org_id, role_id, username, email, password_hash, full_name, is_active, created_at, updated_at) "
                    "VALUES "
                    "(:id, :org_id, :role_id, :username, :email, :password_hash, :full_name, :is_active, :created_at, :updated_at)"
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
                    "created_at": now,
                    "updated_at": now,
                },
            )
            db.commit()
            return user_id
        except Exception:
            db.rollback()
            raise


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Tạo tài khoản user trong DB. Nếu không truyền tham số sẽ dùng DEFAULT_USER."
    )
    parser.add_argument("--org-id", dest="org_id", default=DEFAULT_USER["org_id"], help="Org ID đích")
    parser.add_argument("--username", default=DEFAULT_USER["username"], help="Tên đăng nhập")
    parser.add_argument("--email", default=DEFAULT_USER["email"], help="Email")
    parser.add_argument("--password", default=DEFAULT_USER["password"], help="Mật khẩu thô")
    parser.add_argument("--full-name", dest="full_name", default=DEFAULT_USER["full_name"], help="Họ và tên")
    parser.add_argument(
        "--role-name",
        dest="role_name",
        default=DEFAULT_USER["role_name"],
        help="Tên role cần gán (ví dụ: Admin, QA/QC). Nếu bỏ trống sẽ không gán role_id.",
    )
    parser.add_argument(
        "--inactive",
        dest="inactive",
        action="store_true",
        help="Tạo user ở trạng thái không hoạt động",
    )
    parser.set_defaults(inactive=bool(DEFAULT_USER["inactive"]))
    args = parser.parse_args()

    org_id = _resolve_org_id(args.org_id)
    user_id = create_user(
        org_id=org_id,
        username=args.username.strip(),
        email=args.email.strip(),
        password=args.password,
        full_name=args.full_name.strip(),
        role_name=args.role_name.strip() if args.role_name else None,
        is_active=not args.inactive,
    )

    print("Tạo user thành công.")
    print(f"user_id={user_id}")
    print(f"org_id={org_id}")
    print(f"username={args.username.strip()}")
    print(f"email={args.email.strip()}")
    print(f"role_name={args.role_name or '(none)'}")


if __name__ == "__main__":
    main()
