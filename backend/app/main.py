import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .database import Base, engine, repair_legacy_sale_owners, migrate_schema
from .routes import auth, sales, dashboard, users, products, pos, customers, coupons

Base.metadata.create_all(bind=engine)
migrate_schema()
repair_legacy_sale_owners()

is_serverless = os.getenv("VERCEL") == "1" or "AWS_LAMBDA_FUNCTION_NAME" in os.environ

app = FastAPI(title="Sales Dashboard API", redirect_slashes=False)

# Enable CORS for all clients (JWT Bearer tokens do not need cookies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def ensure_default_admin():
    try:
        from .database import SessionLocal
        from .models import User
        from .utils.hashing import hash_password
        db = SessionLocal()
        if db.query(User).count() == 0:
            default_user = User(
                email="admin@saleshub.com",
                password=hash_password("admin123")
            )
            db.add(default_user)
            db.commit()
            print("[Init] Created default admin user: admin@saleshub.com / admin123")
        db.close()
    except Exception as e:
        print(f"[Init] Admin seed note: {e}")

ensure_default_admin()

frontend_build_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "build"))
if not os.path.exists(frontend_build_dir):
    frontend_build_dir = os.path.abspath("frontend/build")

index_file = os.path.join(frontend_build_dir, "index.html")

# SPA Middleware: only needed when running monolithically outside serverless
if not is_serverless:
    @app.middleware("http")
    async def spa_middleware(request: Request, call_next):
        if request.method == "GET" and "text/html" in request.headers.get("accept", ""):
            path = request.url.path
            if not path.startswith(("/docs", "/redoc", "/openapi.json", "/static", "/favicon", "/manifest", "/ping", "/api")):
                if os.path.exists(index_file):
                    return FileResponse(index_file)
        return await call_next(request)

api_routers = [
    auth.router,
    sales.router,
    products.router,
    pos.router,
    customers.router,
    coupons.router,
    dashboard.router,
    users.router,
]
for r in api_routers:
    app.include_router(r)
    app.include_router(r, prefix="/api")

# Health endpoints
@app.get("/ping")
@app.get("/api/ping")
def ping():
    return {"status": "ok"}


# Only mount static files and catch-all if running locally in standalone mode
if not is_serverless and os.path.exists(frontend_build_dir):
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

