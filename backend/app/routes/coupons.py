from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import SessionLocal
from ..models import Coupon
from ..schemas import (
    CouponCreate,
    CouponOut,
    CouponValidateRequest,
    CouponValidateResponse,
)
from ..auth import get_current_user

router = APIRouter(prefix="/coupons", tags=["Coupons"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("", response_model=list[CouponOut])
@router.get("/", response_model=list[CouponOut])
def list_coupons(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Coupon).filter(Coupon.is_active == True).order_by(Coupon.created_at.desc()).all()

@router.post("", response_model=CouponOut)
@router.post("/", response_model=CouponOut)
def create_coupon(payload: CouponCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    code = payload.code.strip().upper()
    existing = db.query(Coupon).filter(Coupon.code == code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Coupon with code '{code}' already exists")

    new_coupon = Coupon(
        code=code,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        min_purchase=payload.min_purchase,
        max_discount=payload.max_discount,
        is_active=True,
        user_id=user.id,
    )
    db.add(new_coupon)
    db.commit()
    db.refresh(new_coupon)
    return new_coupon

@router.post("/validate", response_model=CouponValidateResponse)
def validate_coupon(payload: CouponValidateRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    code = payload.code.strip().upper()
    coupon = db.query(Coupon).filter(Coupon.code == code, Coupon.is_active == True).first()
    if not coupon:
        return {
            "valid": False,
            "code": code,
            "discount_type": "percent",
            "discount_value": 0.0,
            "calculated_discount": 0.0,
            "message": f"Coupon '{code}' is invalid or expired",
        }

    if payload.subtotal < (coupon.min_purchase or 0.0):
        return {
            "valid": False,
            "code": code,
            "discount_type": coupon.discount_type,
            "discount_value": coupon.discount_value,
            "calculated_discount": 0.0,
            "message": f"Coupon requires a minimum order of ${coupon.min_purchase:.2f}",
        }

    discount = 0.0
    if coupon.discount_type == "percent":
        discount = round((payload.subtotal * coupon.discount_value) / 100.0, 2)
        if coupon.max_discount:
            discount = min(discount, float(coupon.max_discount))
    else:
        discount = min(payload.subtotal, float(coupon.discount_value))

    return {
        "valid": True,
        "code": code,
        "discount_type": coupon.discount_type,
        "discount_value": coupon.discount_value,
        "calculated_discount": discount,
        "message": f"Applied! Save ${discount:.2f} with '{code}'",
    }

@router.delete("/{coupon_id}")
def delete_coupon(coupon_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Coupon not found")
    c.is_active = False
    db.commit()
    return {"message": "Coupon deactivated"}
