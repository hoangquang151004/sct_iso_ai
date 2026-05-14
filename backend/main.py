from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from core.config import settings
from core.rate_limit import limiter
from modules import api_router
from modules.auth.bootstrap import seed_rbac_defaults

app = FastAPI(
    title="SCT-ISO.AI Backend",
    description="FastAPI architecture for ISO 22000 modules",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

app.include_router(api_router)
uploads_dir = Path(__file__).resolve().parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.on_event("startup")
def startup_event() -> None:
    seed_rbac_defaults()


@app.exception_handler(HTTPException)
def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict) and "error_code" in detail:
        payload = detail
    elif isinstance(detail, str):
        payload = {
            "message": detail,
            "error_code": "BAD_REQUEST",
            "request_id": str(uuid4()),
            "fields": [],
        }
    else:
        payload = {
            "message": "Yêu cầu không hợp lệ.",
            "error_code": "BAD_REQUEST",
            "request_id": str(uuid4()),
            "fields": [],
        }
    return JSONResponse(status_code=exc.status_code, content={"detail": payload})


@app.exception_handler(RequestValidationError)
def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    fields = []
    for item in exc.errors():
        location = ".".join(str(part) for part in item.get("loc", []))
        fields.append({"field": location, "message": item.get("msg", "")})
    payload = {
        "message": "Dữ liệu đầu vào không hợp lệ.",
        "error_code": "VALIDATION_ERROR",
        "request_id": str(uuid4()),
        "fields": fields,
    }
    return JSONResponse(status_code=422, content={"detail": payload})


@app.exception_handler(RateLimitExceeded)
def rate_limit_exceeded_handler(_: Request, __: RateLimitExceeded) -> JSONResponse:
    payload = {
        "message": "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
        "error_code": "RATE_LIMITED",
        "request_id": str(uuid4()),
        "fields": [],
    }
    return JSONResponse(status_code=429, content={"detail": payload})


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
