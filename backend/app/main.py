from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routes import auth, sales, dashboard, users

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sales Dashboard API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (use specific domains in production)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

app.include_router(auth.router)
app.include_router(sales.router)
app.include_router(dashboard.router)
app.include_router(users.router)

# Simple health endpoint for quick checks
@app.get("/ping")
def ping():
    return {"status": "ok"}

