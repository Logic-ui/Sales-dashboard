from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from ..database import SessionLocal
from ..models import Sale
from ..schemas import SaleCreate, SaleOut, SaleUpdate
from ..auth import get_current_user
from sqlalchemy import or_

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
    new_sale = Sale(**sale.dict(), user_id=user.id)  # Capture user_id from auth
    db.add(new_sale)
    db.commit()
    db.refresh(new_sale)
    return new_sale

@router.get("/", response_model=list[SaleOut])
def list_sales(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    mine: bool = False,
    q: str | None = Query(None, description="Search term (product)"),
    sort: str = Query("created_at", description="Sort field"),
    order: str = Query("desc", description="asc|desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
):
    query = db.query(Sale)
    if mine:
        query = query.filter(Sale.user_id == user.id)
    if q:
        qterm = f"%{q}%"
        query = query.filter(Sale.product.ilike(qterm))

    # Sorting
    if sort not in {"created_at", "amount", "product"}:
        sort = "created_at"
    order_col = getattr(Sale, sort)
    if order == "asc":
        query = query.order_by(order_col.asc())
    else:
        query = query.order_by(order_col.desc())

    # Pagination
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return {"items": items, "total": total}

@router.patch("/{sale_id}", response_model=SaleOut)
def update_sale(sale_id: int, payload: SaleUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if db_sale.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this sale")

    if payload.amount is not None:
        db_sale.amount = payload.amount
    if payload.product is not None:
        db_sale.product = payload.product

    db.commit()
    db.refresh(db_sale)
    return db_sale

@router.delete("/{sale_id}")
def delete_sale(sale_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if db_sale.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this sale")
    db.delete(db_sale)
    db.commit()
    return {"message": "Sale deleted"}
