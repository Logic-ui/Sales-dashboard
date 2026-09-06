from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import Optional
from ..database import SessionLocal
from ..models import Sale, Product
from ..auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/summary")
def sales_summary(db: Session = Depends(get_db), user=Depends(get_current_user)):
    now = datetime.utcnow()

    # Time-window sums
    today = db.query(func.sum(Sale.amount)).filter(
        Sale.created_at >= now.replace(hour=0, minute=0, second=0)
    ).scalar() or 0.0

    week = db.query(func.sum(Sale.amount)).filter(
        Sale.created_at >= now - timedelta(days=7)
    ).scalar() or 0.0

    month = db.query(func.sum(Sale.amount)).filter(
        Sale.created_at >= now.replace(day=1, hour=0, minute=0, second=0)
    ).scalar() or 0.0

    year = db.query(func.sum(Sale.amount)).filter(
        Sale.created_at >= now.replace(month=1, day=1, hour=0, minute=0, second=0)
    ).scalar() or 0.0

    # Lifetime aggregates
    total_revenue = db.query(func.sum(Sale.amount)).scalar() or 0.0
    total_orders = db.query(func.count(Sale.id)).scalar() or 0
    avg_order_value = (total_revenue / total_orders) if total_orders > 0 else 0.0

    # Profit metrics
    total_profit = db.query(func.sum(Sale.net_profit)).scalar() or 0.0
    total_cost = db.query(func.sum(Sale.total_cost)).scalar() or 0.0
    profit_margin = ((total_profit / total_revenue) * 100) if total_revenue > 0 else 0.0

    # Inventory alerts
    total_products = db.query(Product).filter(Product.is_active == True).count()
    low_stock_count = db.query(Product).filter(
        Product.is_active == True,
        Product.stock_quantity <= Product.min_stock_level,
    ).count()

    # Best selling product
    top_prod = db.query(Sale.product, func.sum(Sale.amount).label("sum_amt")) \
        .group_by(Sale.product) \
        .order_by(desc("sum_amt")) \
        .first()
    top_product_name = top_prod[0] if top_prod else "N/A"

    return {
        "today": round(float(today), 2),
        "week": round(float(week), 2),
        "month": round(float(month), 2),
        "year": round(float(year), 2),
        "total_revenue": round(float(total_revenue), 2),
        "total_orders": total_orders,
        "avg_order_value": round(float(avg_order_value), 2),
        "total_profit": round(float(total_profit), 2),
        "total_cost": round(float(total_cost), 2),
        "profit_margin": round(float(profit_margin), 1),
        "total_products": total_products,
        "low_stock_count": low_stock_count,
        "top_product": top_product_name,
    }

@router.get("/chart-data")
def chart_data(
    days: Optional[int] = None,
    db: Session = Depends(get_db), 
    user=Depends(get_current_user)
):
    query = db.query(
        func.date(Sale.created_at).label("date"),
        func.sum(Sale.amount).label("total"),
        func.count(Sale.id).label("count")
    )

    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(Sale.created_at >= cutoff)

    data = (
        query.group_by(func.date(Sale.created_at))
        .order_by(func.date(Sale.created_at).asc())
        .all()
    )

    return [
        {
            "date": str(d.date),
            "total": round(float(d.total), 2) if d.total else 0.0,
            "count": int(d.count) if d.count else 0
        }
        for d in data
    ]

@router.get("/product-breakdown")
def product_breakdown(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Return top products by sales amount and count for donut / bar charts"""
    results = (
        db.query(
            Sale.product,
            func.sum(Sale.amount).label("total"),
            func.count(Sale.id).label("count")
        )
        .group_by(Sale.product)
        .order_by(desc("total"))
        .limit(8)
        .all()
    )

    total_sum = sum(float(r.total or 0) for r in results) or 1.0

    return [
        {
            "product": r.product,
            "total": round(float(r.total), 2) if r.total else 0.0,
            "count": int(r.count),
            "percentage": round((float(r.total or 0) / total_sum) * 100, 1)
        }
        for r in results
    ]

@router.get("/recent-activity")
def recent_activity(limit: int = 6, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Return recent transactions for the dashboard live feed"""
    sales = (
        db.query(Sale)
        .order_by(Sale.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "product": s.product,
            "amount": round(float(s.amount), 2),
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "user_id": s.user_id,
        }
        for s in sales
    ]
