from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from sqlalchemy import func
from .utils.jwt import SECRET_KEY, ALGORITHM
from .database import SessionLocal
from .models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or session expired. Please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    clean_email = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == clean_email).first()

    if not user:
        # Crucial for Serverless / Vercel:
        # In serverless environments, SQLite in /tmp can reset between lambdas or cold starts.
        # If the JWT was verified with our SECRET_KEY, safely auto-provision the user record
        # in the current database so subsequent queries and relations succeed.
        try:
            token_user_id = payload.get("id")
            user = User(
                id=token_user_id if isinstance(token_user_id, int) else None,
                email=clean_email,
                password=""
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            user = db.query(User).filter(func.lower(User.email) == clean_email).first()

    if not user:
        raise credentials_exception

    return user

