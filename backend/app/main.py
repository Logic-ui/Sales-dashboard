import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .database import Base, engine, repair_legacy_sale_owners
from .routes import auth, sales, dashboard, users

Base.metadata.create_all(bind=engine)
repair_legacy_sale_owners()

app = FastAPI(title="Sales Dashboard API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_build_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "build"))
if not os.path.exists(frontend_build_dir):
    frontend_build_dir = os.path.abspath("frontend/build")

index_file = os.path.join(frontend_build_dir, "index.html")

# SPA Middleware: Return index.html for direct browser navigation
@app.middleware("http")
async def spa_middleware(request: Request, call_next):
    if request.method == "GET" and "text/html" in request.headers.get("accept", ""):
        path = request.url.path
        if not path.startswith(("/docs", "/redoc", "/openapi.json", "/static", "/favicon", "/manifest", "/ping")):
            if os.path.exists(index_file):
                return FileResponse(index_file)
    return await call_next(request)

app.include_router(auth.router)
app.include_router(sales.router)
app.include_router(dashboard.router)
app.include_router(users.router)

# Simple health endpoint for quick checks
@app.get("/ping")
def ping():
    return {"status": "ok"}

if os.path.exists(frontend_build_dir):
    static_dir = os.path.join(frontend_build_dir, "static")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path in ("docs", "redoc", "openapi.json"):
            return {"detail": "Not Found"}
        file_path = os.path.join(frontend_build_dir, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"detail": "Not Found"}
