from pydantic import BaseModel
from datetime import datetime

class UserCreate(BaseModel):
    email: str
    password: str

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

    # Pydantic v2: use model_config to enable ORM mode via from_attributes
    model_config = {"from_attributes": True}
