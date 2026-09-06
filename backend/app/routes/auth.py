from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import SessionLocal
from ..models import User
from ..schemas import UserCreate, Token
from ..utils.hashing import hash_password, verify_password
from ..utils.jwt import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/register")
@router.post("/register/")
def register(user: UserCreate, db: Session = Depends(get_db)):
    if not user.email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    clean_email = user.email.strip().lower()
    if "@" not in clean_email or len(clean_email) < 3:
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if user already exists (case-insensitive)
    db_user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already in use")
    
    # Validate password
    if not user.password or len(user.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Create and save user
    try:
        new_user = User(email=clean_email, password=hash_password(user.password))
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"message": "User registered successfully", "user_id": new_user.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")

@router.post("/login", response_model=Token)
@router.post("/login/", response_model=Token)
def login(user: UserCreate, db: Session = Depends(get_db)):

    if not user.email or not user.password:
        raise HTTPException(status_code=400, detail="Please provide both email and password")
        
    clean_email = user.email.strip().lower()
    db_user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": db_user.email, "id": db_user.id})
    return {"access_token": token, "token_type": "bearer"}

