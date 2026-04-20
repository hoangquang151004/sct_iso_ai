from __future__ import annotations

import re
from uuid import uuid4

from fastapi import HTTPException, status


def validate_password_strength(password: str) -> None:
    if password != password.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Mật khẩu không hợp lệ.",
                "error_code": "USER_PASSWORD_WEAK",
                "request_id": str(uuid4()),
                "fields": [{"field": "password", "message": "Không được có khoảng trắng đầu/cuối."}],
            },
        )
    if len(password) < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Mật khẩu không hợp lệ.",
                "error_code": "USER_PASSWORD_WEAK",
                "request_id": str(uuid4()),
                "fields": [{"field": "password", "message": "Tối thiểu 8 ký tự, gồm chữ và số."}],
            },
        )
