from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import User
from ..schemas import UserOut, UserUpdate
from ..utils.hashing import hash_password
from ..auth import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/me", response_model=UserOut)
def read_me(user=Depends(get_current_user)):
    return user

@router.put("/me", response_model=UserOut)
def update_me(payload: UserUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_user = db.query(User).filter(User.id == user.id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.email:
        db_user.email = payload.email
    if payload.password:
        db_user.password = hash_password(payload.password)
    db.commit()
    db.refresh(db_user)
    return db_user
