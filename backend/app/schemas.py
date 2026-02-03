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

from pydantic import Field, validator

class SaleCreate(BaseModel):
    amount: float = Field(..., gt=0)
    product: str = Field(..., min_length=1)

    @validator("product")
    def strip_product(cls, v):
        return v.strip()

class SaleUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    product: Optional[str] = Field(None, min_length=1)

    @validator("product")
    def strip_product(cls, v):
        return v.strip() if v is not None else v

class SaleOut(BaseModel):
    id: int
    amount: float
    product: str
    created_at: datetime
    user_id: Optional[int] = None

    # Pydantic v2: use model_config to enable ORM mode via from_attributes
    model_config = {"from_attributes": True}