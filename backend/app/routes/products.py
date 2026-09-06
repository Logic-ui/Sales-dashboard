import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import datetime

from ..database import SessionLocal
from ..models import Product
from ..schemas import (
    ProductCreate,
    ProductUpdate,
    ProductOut,
    ProductPage,
    StockAdjustRequest,
    InventorySummaryOut,
)
from ..auth import get_current_user

router = APIRouter(prefix="/products", tags=["Products"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_sku(db: Session, prefix="PRD") -> str:
    """Generate a clean unique SKU like PRD-1001"""
    count = db.query(Product).count() + 1
    candidate = f"{prefix}-{count:04d}"
    # Ensure uniqueness
    if db.query(Product).filter(Product.sku == candidate).first():
        candidate = f"{prefix}-{count:04d}-{uuid.uuid4().hex[:4].upper()}"
    return candidate

def enrich_product_out(p: Product) -> dict:
    data = {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "category": p.category or "General",
        "cost_price": round(float(p.cost_price or 0.0), 2),
        "selling_price": round(float(p.selling_price or 0.0), 2),
        "stock_quantity": int(p.stock_quantity or 0),
        "min_stock_level": int(p.min_stock_level if p.min_stock_level is not None else 5),
        "unit": p.unit or "pcs",
        "description": p.description,
        "is_active": bool(p.is_active),
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "user_id": p.user_id,
        "is_low_stock": (p.stock_quantity or 0) <= (p.min_stock_level if p.min_stock_level is not None else 5),
    }
    return data

@router.get("", response_model=ProductPage)
@router.get("/", response_model=ProductPage)
def list_products(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    q: Optional[str] = Query(None, description="Search term for name or SKU"),
    category: Optional[str] = Query(None, description="Filter by category"),
    low_stock_only: bool = Query(False, description="Filter only low stock products"),
    sort: str = Query("name", description="Sort field: name, stock_quantity, selling_price, created_at"),
    order: str = Query("asc", description="asc | desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    query = db.query(Product).filter(Product.is_active == True)

    if q:
        qterm = f"%{q.strip()}%"
        query = query.filter(or_(Product.name.ilike(qterm), Product.sku.ilike(qterm)))

    if category and category != "All":
        query = query.filter(Product.category == category)

    if low_stock_only:
        query = query.filter(Product.stock_quantity <= Product.min_stock_level)

    # Sorting
    sort_fields = {
        "name": Product.name,
        "stock_quantity": Product.stock_quantity,
        "selling_price": Product.selling_price,
        "created_at": Product.created_at,
    }
    sort_col = sort_fields.get(sort, Product.name)
    if order == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    return {"items": [enrich_product_out(p) for p in items], "total": total}

@router.get("/summary/metrics", response_model=InventorySummaryOut)
def inventory_summary(db: Session = Depends(get_db), user=Depends(get_current_user)):
    products = db.query(Product).filter(Product.is_active == True).all()

    total_products = len(products)
    low_stock_count = 0
    out_of_stock_count = 0
    total_stock_units = 0
    total_cost_value = 0.0
    total_retail_value = 0.0

    for p in products:
        stock = p.stock_quantity or 0
        min_stock = p.min_stock_level if p.min_stock_level is not None else 5
        cost = p.cost_price or 0.0
        retail = p.selling_price or 0.0

        total_stock_units += stock
        total_cost_value += stock * cost
        total_retail_value += stock * retail

        if stock == 0:
            out_of_stock_count += 1
        elif stock <= min_stock:
            low_stock_count += 1

    potential_profit = total_retail_value - total_cost_value

    return {
        "total_products": total_products,
        "low_stock_count": low_stock_count,
        "out_of_stock_count": out_of_stock_count,
        "total_stock_units": total_stock_units,
        "total_cost_value": round(total_cost_value, 2),
        "total_retail_value": round(total_retail_value, 2),
        "potential_profit": round(potential_profit, 2),
    }

@router.get("/categories")
def get_categories(db: Session = Depends(get_db), user=Depends(get_current_user)):
    cats = (
        db.query(Product.category)
        .filter(Product.is_active == True)
        .distinct()
        .all()
    )
    categories = [c[0] for c in cats if c[0]]
    if "General" not in categories:
        categories.insert(0, "General")
    return sorted(list(set(categories)))

@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return enrich_product_out(prod)

@router.post("", response_model=ProductOut)
@router.post("/", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    sku = payload.sku.strip() if payload.sku and payload.sku.strip() else generate_sku(db)

    # Check for duplicate SKU
    existing = db.query(Product).filter(Product.sku == sku).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Product with SKU '{sku}' already exists")

    new_prod = Product(
        sku=sku,
        name=payload.name,
        category=payload.category or "General",
        cost_price=payload.cost_price,
        selling_price=payload.selling_price,
        stock_quantity=payload.stock_quantity,
        min_stock_level=payload.min_stock_level,
        unit=payload.unit or "pcs",
        description=payload.description,
        is_active=True,
        user_id=user.id,
    )
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)
    return enrich_product_out(new_prod)

@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.sku is not None:
        sku = payload.sku.strip()
        if sku and sku != prod.sku:
            existing = db.query(Product).filter(Product.sku == sku).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"SKU '{sku}' is already in use")
            prod.sku = sku

    if payload.name is not None:
        prod.name = payload.name.strip()
    if payload.category is not None:
        prod.category = payload.category.strip()
    if payload.cost_price is not None:
        prod.cost_price = payload.cost_price
    if payload.selling_price is not None:
        prod.selling_price = payload.selling_price
    if payload.stock_quantity is not None:
        prod.stock_quantity = payload.stock_quantity
    if payload.min_stock_level is not None:
        prod.min_stock_level = payload.min_stock_level
    if payload.unit is not None:
        prod.unit = payload.unit.strip()
    if payload.description is not None:
        prod.description = payload.description.strip()
    if payload.is_active is not None:
        prod.is_active = payload.is_active

    prod.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(prod)
    return enrich_product_out(prod)

@router.post("/{product_id}/adjust-stock", response_model=ProductOut)
def adjust_stock(
    product_id: int,
    payload: StockAdjustRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    new_stock = max(0, (prod.stock_quantity or 0) + payload.quantity_change)
    prod.stock_quantity = new_stock
    prod.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(prod)
    return enrich_product_out(prod)

@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    # Soft delete
    prod.is_active = False
    db.commit()
    return {"message": "Product deleted successfully"}
