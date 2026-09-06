import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Sale, SaleItem, Product, Customer, Coupon
from ..schemas import POSCheckoutRequest, POSCheckoutResponse, SaleItemOut
from ..auth import get_current_user

router = APIRouter(prefix="/pos", tags=["Point of Sale"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_invoice_no(db: Session) -> str:
    """Generate professional invoice number like INV-20260906-0042"""
    today_str = datetime.utcnow().strftime("%Y%m%d")
    count_today = (
        db.query(Sale)
        .filter(Sale.invoice_no.like(f"INV-{today_str}-%"))
        .count()
        + 1
    )
    return f"INV-{today_str}-{count_today:04d}"

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

@router.post("/checkout", response_model=POSCheckoutResponse)
def checkout(
    payload: POSCheckoutRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart cannot be empty")

    # Fetch and validate all products
    product_ids = [item.product_id for item in payload.items]
    products_db = db.query(Product).filter(Product.id.in_(product_ids)).all()
    products_map = {p.id: p for p in products_db}

    # Verify every product exists
    for item in payload.items:
        if item.product_id not in products_map:
            raise HTTPException(status_code=404, detail=f"Product with ID {item.product_id} not found")
        prod = products_map[item.product_id]
        if not prod.is_active:
            raise HTTPException(status_code=400, detail=f"Product '{prod.name}' is no longer active")
        if (prod.stock_quantity or 0) < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{prod.name}'. Available: {prod.stock_quantity}, Requested: {item.quantity}",
            )

    invoice_no = generate_invoice_no(db)
    subtotal = 0.0
    total_cost = 0.0
    items_to_create = []
    item_names = []

    # Process items and deduct stock
    for item in payload.items:
        prod = products_map[item.product_id]
        unit_price = item.unit_price if item.unit_price is not None else float(prod.selling_price or 0.0)
        cost_price = float(prod.cost_price or 0.0)
        line_subtotal = round(unit_price * item.quantity, 2)
        line_cost = round(cost_price * item.quantity, 2)

        subtotal += line_subtotal
        total_cost += line_cost
        item_names.append(f"{prod.name} (x{item.quantity})")

        # Deduct inventory
        prod.stock_quantity = max(0, (prod.stock_quantity or 0) - item.quantity)
        prod.updated_at = datetime.utcnow()

        sale_item = SaleItem(
            product_id=prod.id,
            product_name=prod.name,
            product_sku=prod.sku,
            quantity=item.quantity,
            unit_price=unit_price,
            cost_price=cost_price,
            subtotal=line_subtotal,
        )
        items_to_create.append(sale_item)

    # Customer resolution
    customer = None
    if payload.customer_id:
        customer = db.query(Customer).filter(Customer.id == payload.customer_id, Customer.is_active == True).first()
    elif payload.customer_phone:
        customer = db.query(Customer).filter(Customer.phone == payload.customer_phone.strip(), Customer.is_active == True).first()

    # Coupon validation
    coupon_discount = 0.0
    coupon_code = None
    if payload.coupon_code:
        clean_code = payload.coupon_code.strip().upper()
        coupon = db.query(Coupon).filter(Coupon.code == clean_code, Coupon.is_active == True).first()
        if coupon and subtotal >= (coupon.min_purchase or 0.0):
            coupon_code = coupon.code
            if coupon.discount_type == "percent":
                coupon_discount = round((subtotal * coupon.discount_value) / 100.0, 2)
                if coupon.max_discount:
                    coupon_discount = min(coupon_discount, float(coupon.max_discount))
            else:
                coupon_discount = min(subtotal, float(coupon.discount_value))
            coupon.used_count = (coupon.used_count or 0) + 1

    # Loyalty points redemption: 20 points = $1.00 discount
    points_redeemed = 0
    points_discount = 0.0
    if customer and payload.redeem_points and payload.redeem_points > 0:
        max_possible_points = min(customer.loyalty_points or 0, payload.redeem_points)
        points_redeemed = max_possible_points
        points_discount = round(points_redeemed / 20.0, 2)  # 20 pts = $1

    total_discount = round(float(payload.discount or 0.0) + coupon_discount + points_discount, 2)
    tax = round(float(payload.tax or 0.0), 2)
    final_amount = max(0.0, round(subtotal - total_discount + tax, 2))
    net_profit = round(final_amount - total_cost, 2)

    # Earn 1 loyalty point per $10 spent
    points_earned = int(final_amount // 10) if customer else 0

    # Store Tab / Credit Handling
    if customer:
        if payload.payment_method == "store_credit":
            customer.store_credit_balance = round((customer.store_credit_balance or 0.0) + final_amount, 2)

        customer.loyalty_points = max(0, (customer.loyalty_points or 0) - points_redeemed + points_earned)
        customer.total_spent = round((customer.total_spent or 0.0) + final_amount, 2)
        update_customer_tier(customer)

    change_due = None
    if payload.amount_tendered is not None:
        change_due = max(0.0, round(float(payload.amount_tendered) - final_amount, 2))

    summary_product_str = ", ".join(item_names[:3])
    if len(item_names) > 3:
        summary_product_str += f" +{len(item_names) - 3} more"

    new_sale = Sale(
        amount=final_amount,
        product=summary_product_str,
        invoice_no=invoice_no,
        customer_id=customer.id if customer else None,
        customer_name=customer.name if customer else (payload.customer_name or "Walk-in Customer"),
        customer_phone=customer.phone if customer else payload.customer_phone,
        payment_method=payload.payment_method or "cash",
        discount=total_discount,
        tax=tax,
        total_cost=round(total_cost, 2),
        net_profit=net_profit,
        coupon_code=coupon_code,
        points_earned=points_earned,
        points_redeemed=points_redeemed,
        notes=payload.notes,
        created_at=datetime.utcnow(),
        user_id=user.id,
    )
    new_sale.items = items_to_create

    db.add(new_sale)
    db.commit()
    db.refresh(new_sale)

    return {
        "sale_id": new_sale.id,
        "invoice_no": new_sale.invoice_no,
        "created_at": new_sale.created_at,
        "customer_id": new_sale.customer_id,
        "customer_name": new_sale.customer_name,
        "customer_phone": new_sale.customer_phone,
        "payment_method": new_sale.payment_method,
        "subtotal": round(subtotal, 2),
        "discount": total_discount,
        "tax": tax,
        "amount": final_amount,
        "coupon_code": new_sale.coupon_code,
        "points_earned": points_earned,
        "points_redeemed": points_redeemed,
        "customer_points_balance": customer.loyalty_points if customer else None,
        "customer_credit_balance": customer.store_credit_balance if customer else None,
        "amount_tendered": payload.amount_tendered,
        "change_due": change_due,
        "total_cost": round(total_cost, 2),
        "net_profit": net_profit,
        "notes": new_sale.notes,
        "items": [
            SaleItemOut(
                id=item.id,
                sale_id=new_sale.id,
                product_id=item.product_id,
                product_name=item.product_name,
                product_sku=item.product_sku,
                quantity=item.quantity,
                unit_price=item.unit_price,
                cost_price=item.cost_price,
                subtotal=item.subtotal,
            )
            for item in new_sale.items
        ],
    }

@router.get("/receipt/{sale_id}", response_model=POSCheckoutResponse)
def get_receipt(sale_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    items_out = []
    subtotal = 0.0
    for item in sale.items:
        items_out.append(
            SaleItemOut(
                id=item.id,
                sale_id=sale.id,
                product_id=item.product_id,
                product_name=item.product_name,
                product_sku=item.product_sku,
                quantity=item.quantity,
                unit_price=item.unit_price,
                cost_price=item.cost_price,
                subtotal=item.subtotal,
            )
        )
        subtotal += item.subtotal

    if not items_out and sale.product:
        # Backward compatibility for legacy single-item sale
        subtotal = sale.amount

    return {
        "sale_id": sale.id,
        "invoice_no": sale.invoice_no or f"INV-LEGACY-{sale.id:04d}",
        "created_at": sale.created_at,
        "customer_name": sale.customer_name or "Customer",
        "customer_phone": sale.customer_phone,
        "payment_method": sale.payment_method or "cash",
        "subtotal": round(subtotal or sale.amount, 2),
        "discount": round(sale.discount or 0.0, 2),
        "tax": round(sale.tax or 0.0, 2),
        "amount": round(sale.amount, 2),
        "amount_tendered": None,
        "change_due": None,
        "total_cost": round(sale.total_cost or 0.0, 2),
        "net_profit": round(sale.net_profit or 0.0, 2),
        "notes": sale.notes,
        "items": items_out,
    }
