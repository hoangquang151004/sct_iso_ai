from fastapi import FastAPI

# from app.modules.capa.router import router as capa_router
# from app.modules.documents.router import router as documents_router
from app.modules.haccp.router import router as haccp_router
# from app.modules.prp.router import router as prp_router
# from app.modules.reports.router import router as reports_router
from app.modules.scheduling.router import router as scheduling_router
# from app.modules.users.router import router as users_router

app = FastAPI(
    title="SCT-ISO.AI Backend",
    description="FastAPI architecture for ISO 22000 modules",
    version="0.1.0",
)

# app.include_router(users_router)
# app.include_router(documents_router)
app.include_router(haccp_router)
# app.include_router(prp_router)
# app.include_router(capa_router)
# app.include_router(reports_router)
app.include_router(scheduling_router)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
