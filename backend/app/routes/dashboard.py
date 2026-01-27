from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from ..database import SessionLocal
from ..models import Sale
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

    today = db.query(func.sum(Sale.amount)).filter(
        Sale.created_at >= now.replace(hour=0, minute=0, second=0)
    ).scalar() or 0

    week = db.query(func.sum(Sale.amount)).filter(
        Sale.created_at >= now - timedelta(days=7)
    ).scalar() or 0

    month = db.query(func.sum(Sale.amount)).filter(
        Sale.created_at >= now.replace(day=1)
    ).scalar() or 0

    year = db.query(func.sum(Sale.amount)).filter(
        Sale.created_at >= now.replace(month=1, day=1)
    ).scalar() or 0

    return {
        "today": today,
        "week": week,
        "month": month,
        "year": year
    }

@router.get("/chart-data")
def chart_data(db: Session = Depends(get_db), user=Depends(get_current_user)):
    data = (
        db.query(func.date(Sale.created_at), func.sum(Sale.amount))
        .group_by(func.date(Sale.created_at))
        .order_by(func.date(Sale.created_at))
        .all()
    )
    return [{"date": d, "total": t} for d, t in data]
