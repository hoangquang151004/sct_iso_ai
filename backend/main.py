from fastapi import FastAPI

from modules import api_router

app = FastAPI(
    title="SCT-ISO.AI Backend",
    description="FastAPI architecture for ISO 22000 modules",
    version="0.1.0",
)

app.include_router(api_router)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
