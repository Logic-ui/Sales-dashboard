import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Sale, SaleItem, Product
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

    discount = round(float(payload.discount or 0.0), 2)
    tax = round(float(payload.tax or 0.0), 2)
    final_amount = max(0.0, round(subtotal - discount + tax, 2))
    net_profit = round(final_amount - total_cost, 2)

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
        customer_name=payload.customer_name or "Walk-in Customer",
        customer_phone=payload.customer_phone,
        payment_method=payload.payment_method or "cash",
        discount=discount,
        tax=tax,
        total_cost=round(total_cost, 2),
        net_profit=net_profit,
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
        "customer_name": new_sale.customer_name,
        "customer_phone": new_sale.customer_phone,
        "payment_method": new_sale.payment_method,
        "subtotal": round(subtotal, 2),
        "discount": discount,
        "tax": tax,
        "amount": final_amount,
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
