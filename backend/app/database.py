import os
import shutil
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")

is_serverless = os.getenv("VERCEL") == "1" or "AWS_LAMBDA_FUNCTION_NAME" in os.environ

if not DATABASE_URL:
    if is_serverless or not os.access(".", os.W_OK):
        tmp_db = "/tmp/test.db"
        if not os.path.exists(tmp_db):
            seed_candidates = [
                os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "test.db")),
                os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test.db")),
                os.path.abspath("backend/test.db"),
                os.path.abspath("test.db"),
            ]
            for seed in seed_candidates:
                if os.path.exists(seed):
                    try:
                        shutil.copy2(seed, tmp_db)
                        break
                    except Exception as e:
                        print(f"[Database] Warning: Could not copy seed db: {e}")
        DATABASE_URL = f"sqlite:///{tmp_db}"
    else:
        DATABASE_URL = "sqlite:///./test.db"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()

def repair_legacy_sale_owners():
    try:
        with engine.begin() as connection:
            if "sqlite" in DATABASE_URL:
                connection.execute(text(
                    """
                    UPDATE sales
                    SET user_id = (
                        SELECT users.id FROM users WHERE users.email = sales.user_id
                    )
                    WHERE typeof(user_id) = 'text'
                    """
                ))
                connection.execute(text(
                    "UPDATE sales SET user_id = NULL WHERE typeof(user_id) = 'text'"
                ))
    except Exception:
        pass
