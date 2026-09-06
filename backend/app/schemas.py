from typing import Optional, List
from pydantic import BaseModel, Field, validator
from datetime import datetime

class UserCreate(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str

    model_config = {"from_attributes": True}

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# --- PRODUCT SCHEMAS ---

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1)
    sku: Optional[str] = None
    category: str = "General"
    cost_price: float = Field(0.0, ge=0)
    selling_price: float = Field(..., ge=0)
    stock_quantity: int = Field(0, ge=0)
    min_stock_level: int = Field(5, ge=0)
    unit: str = "pcs"
    description: Optional[str] = None

    @validator("name")
    def strip_name(cls, v):
        return v.strip()

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    cost_price: Optional[float] = Field(None, ge=0)
    selling_price: Optional[float] = Field(None, ge=0)
    stock_quantity: Optional[int] = Field(None, ge=0)
    min_stock_level: Optional[int] = Field(None, ge=0)
    unit: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ProductOut(BaseModel):
    id: int
    sku: str
    name: str
    category: str
    cost_price: float
    selling_price: float
    stock_quantity: int
    min_stock_level: int
    unit: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    user_id: Optional[int] = None
    is_low_stock: bool = False

    model_config = {"from_attributes": True}

class ProductPage(BaseModel):
    items: List[ProductOut]
    total: int

class StockAdjustRequest(BaseModel):
    quantity_change: int
    reason: Optional[str] = "Manual restock"

class InventorySummaryOut(BaseModel):
    total_products: int
    low_stock_count: int
    out_of_stock_count: int
    total_stock_units: int
    total_cost_value: float
    total_retail_value: float
    potential_profit: float

# --- POS & SALE ITEM SCHEMAS ---

class SaleItemOut(BaseModel):
    id: int
    sale_id: int
    product_id: Optional[int] = None
    product_name: str
    product_sku: Optional[str] = None
    quantity: int
    unit_price: float
    cost_price: float
    subtotal: float

    model_config = {"from_attributes": True}

class POSCartItem(BaseModel):
    product_id: int
    quantity: int = Field(1, ge=1)
    unit_price: Optional[float] = None  # overrides default if given

class POSCheckoutRequest(BaseModel):
    items: List[POSCartItem]
    customer_name: Optional[str] = "Walk-in Customer"
    customer_phone: Optional[str] = None
    payment_method: str = "cash"  # cash, card, mobile_pay, store_credit
    discount: float = Field(0.0, ge=0)
    tax: float = Field(0.0, ge=0)
    amount_tendered: Optional[float] = None
    notes: Optional[str] = None

class POSCheckoutResponse(BaseModel):
    sale_id: int
    invoice_no: str
    created_at: datetime
    customer_name: str
    customer_phone: Optional[str] = None
    payment_method: str
    subtotal: float
    discount: float
    tax: float
    amount: float
    amount_tendered: Optional[float] = None
    change_due: Optional[float] = None
    total_cost: float
    net_profit: float
    notes: Optional[str] = None
    items: List[SaleItemOut]

# --- SALE SCHEMAS ---

class SaleCreate(BaseModel):
    amount: float = Field(..., gt=0)
    product: str = Field(..., min_length=1)

    @validator("product")
    def strip_product(cls, v):
        return v.strip()

class SaleUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    product: Optional[str] = Field(None, min_length=1)
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_method: Optional[str] = None

    @validator("product")
    def strip_product(cls, v):
        return v.strip() if v is not None else v

class SaleOut(BaseModel):
    id: int
    amount: float
    product: Optional[str] = None
    invoice_no: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_method: Optional[str] = "cash"
    discount: Optional[float] = 0.0
    tax: Optional[float] = 0.0
    total_cost: Optional[float] = 0.0
    net_profit: Optional[float] = 0.0
    notes: Optional[str] = None
    created_at: datetime
    user_id: Optional[int] = None
    items: List[SaleItemOut] = []

    model_config = {"from_attributes": True}

class SalesPage(BaseModel):
    items: List[SaleOut]
    total: int