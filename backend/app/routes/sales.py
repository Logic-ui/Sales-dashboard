from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from ..database import SessionLocal
from ..models import Sale
from ..schemas import SaleCreate, SaleOut
from ..auth import get_current_user

router = APIRouter(prefix="/sales", tags=["Sales"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=SaleOut)
def create_sale(
    sale: SaleCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    new_sale = Sale(**sale.dict())
    db.add(new_sale)
    db.commit()
    db.refresh(new_sale)
    return new_sale

@router.get("/", response_model=list[SaleOut])
def list_sales(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Sale).order_by(Sale.created_at.desc()).all()
