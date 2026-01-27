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

    class Config:
        orm_mode = True
