from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import datetime

from ..database import SessionLocal
from ..models import Customer, Sale
from ..schemas import (
    CustomerCreate,
    CustomerUpdate,
    CustomerOut,
    CustomerPage,
    StoreCreditPaymentRequest,
)
from ..auth import get_current_user

router = APIRouter(prefix="/customers", tags=["Customers"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def update_customer_tier(c: Customer):
    spent = c.total_spent or 0.0
    if spent >= 1000:
        c.tier = "VIP Gold"
    elif spent >= 500:
        c.tier = "Gold"
    elif spent >= 150:
        c.tier = "Silver"
    else:
        c.tier = "Bronze"

@router.get("", response_model=CustomerPage)
@router.get("/", response_model=CustomerPage)
def list_customers(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    q: Optional[str] = Query(None, description="Search term for name or phone"),
    has_tab: bool = Query(False, description="Only show customers with pending store credit/tab"),
    sort: str = Query("name", description="Sort field: name, total_spent, store_credit_balance, loyalty_points"),
    order: str = Query("asc", description="asc | desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    query = db.query(Customer).filter(Customer.is_active == True)

    if q:
        qterm = f"%{q.strip()}%"
        query = query.filter(or_(Customer.name.ilike(qterm), Customer.phone.ilike(qterm), Customer.email.ilike(qterm)))

    if has_tab:
        query = query.filter(Customer.store_credit_balance > 0)

    sort_cols = {
        "name": Customer.name,
        "total_spent": Customer.total_spent,
        "store_credit_balance": Customer.store_credit_balance,
        "loyalty_points": Customer.loyalty_points,
        "created_at": Customer.created_at,
    }
    col = sort_cols.get(sort, Customer.name)
    if order == "desc":
        query = query.order_by(col.desc())
    else:
        query = query.order_by(col.asc())

    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    return {"items": items, "total": total}

@router.get("/summary/metrics")
def customer_metrics(db: Session = Depends(get_db), user=Depends(get_current_user)):
    customers = db.query(Customer).filter(Customer.is_active == True).all()
    total_customers = len(customers)
    total_points = sum(c.loyalty_points or 0 for c in customers)
    total_tabs_debt = sum(c.store_credit_balance or 0.0 for c in customers)
    vip_count = sum(1 for c in customers if c.tier in ("Gold", "VIP Gold", "VIP"))

    return {
        "total_customers": total_customers,
        "total_loyalty_points": total_points,
        "total_tabs_debt": round(float(total_tabs_debt), 2),
        "vip_customers_count": vip_count,
    }

@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c

@router.post("", response_model=CustomerOut)
@router.post("/", response_model=CustomerOut)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    phone = payload.phone.strip() if payload.phone else None
    if phone:
        existing = db.query(Customer).filter(Customer.phone == phone, Customer.is_active == True).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Customer with phone {phone} already exists")

    new_customer = Customer(
        name=payload.name,
        phone=phone,
        email=payload.email.strip() if payload.email else None,
        address=payload.address.strip() if payload.address else None,
        notes=payload.notes,
        loyalty_points=10,  # Welcome bonus 10 loyalty points!
        store_credit_balance=0.0,
        total_spent=0.0,
        tier="Bronze",
        is_active=True,
        user_id=user.id,
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer

@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    if payload.name is not None:
        c.name = payload.name.strip()
    if payload.phone is not None:
        c.phone = payload.phone.strip() or None
    if payload.email is not None:
        c.email = payload.email.strip() or None
    if payload.address is not None:
        c.address = payload.address.strip() or None
    if payload.notes is not None:
        c.notes = payload.notes
    if payload.is_active is not None:
        c.is_active = payload.is_active

    db.commit()
    db.refresh(c)
    return c

@router.post("/{customer_id}/pay-tab", response_model=CustomerOut)
def pay_store_tab(
    customer_id: int,
    payload: StoreCreditPaymentRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    new_balance = max(0.0, (c.store_credit_balance or 0.0) - payload.amount)
    c.store_credit_balance = round(new_balance, 2)

    # Record settlement note
    note_line = f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M')}] Tab payment: -${payload.amount:.2f} ({payload.notes or 'Settled'})"
    c.notes = (c.notes + "\n" + note_line) if c.notes else note_line

    db.commit()
    db.refresh(c)
    return c
