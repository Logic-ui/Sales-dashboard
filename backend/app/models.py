from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)

    sales = relationship("Sale", back_populates="user", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="user", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="user", cascade="all, delete-orphan")
    coupons = relationship("Coupon", back_populates="user", cascade="all, delete-orphan")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    category = Column(String, default="General", index=True)
    cost_price = Column(Float, default=0.0)
    selling_price = Column(Float, default=0.0)
    stock_quantity = Column(Integer, default=0)
    min_stock_level = Column(Integer, default=5)
    unit = Column(String, default="pcs")
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user = relationship("User", back_populates="products")
    sale_items = relationship("SaleItem", back_populates="product")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    phone = Column(String, index=True, nullable=True)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    loyalty_points = Column(Integer, default=0)
    store_credit_balance = Column(Float, default=0.0)  # Tab / Debt customer owes
    total_spent = Column(Float, default=0.0)
    tier = Column(String, default="Bronze")  # Bronze, Silver, Gold, VIP
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user = relationship("User", back_populates="customers")
    sales = relationship("Sale", back_populates="customer")

class Coupon(Base):
    __tablename__ = "coupons"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    discount_type = Column(String, default="percent")  # "percent" or "fixed"
    discount_value = Column(Float, default=10.0)
    min_purchase = Column(Float, default=0.0)
    max_discount = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    used_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user = relationship("User", back_populates="coupons")

class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    product = Column(String, nullable=True)  # summary string or legacy product name
    invoice_no = Column(String, unique=True, index=True, nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String, nullable=True, default="Walk-in Customer")
    customer_phone = Column(String, nullable=True)
    payment_method = Column(String, default="cash")  # cash, card, mobile_pay, store_credit
    discount = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    net_profit = Column(Float, default=0.0)
    coupon_code = Column(String, nullable=True)
    points_earned = Column(Integer, default=0)
    points_redeemed = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="sales")
    customer = relationship("Customer", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")

class SaleItem(Base):
    __tablename__ = "sale_items"
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name = Column(String, nullable=False)
    product_sku = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0.0)
    cost_price = Column(Float, default=0.0)
    subtotal = Column(Float, default=0.0)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")

