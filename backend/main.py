from fastapi import FastAPI
from fastapi.responses import Response

from modules.documents.router import router as documents_router
from modules.reports.router import router as reports_router

app = FastAPI(
    title="SCT-ISO.AI Backend",
    description="FastAPI architecture for ISO 22000 modules",
    version="0.1.0",
)

app.include_router(documents_router)
app.include_router(reports_router)


@app.get("/", tags=["Root"])
def root() -> dict[str, str]:
    return {
        "message": "SCT-ISO.AI Backend",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    return Response(status_code=204)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
