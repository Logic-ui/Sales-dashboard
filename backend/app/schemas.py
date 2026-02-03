from typing import Optional
from pydantic import BaseModel
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

class SaleCreate(BaseModel):
    amount: float
    product: str

class SaleOut(BaseModel):
    id: int
    amount: float
    product: str
    created_at: datetime
    user_id: Optional[int] = None

    # Pydantic v2: use model_config to enable ORM mode via from_attributes
    model_config = {"from_attributes": True}