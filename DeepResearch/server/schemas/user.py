from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field


class UserBase(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    full_name: Optional[str] = Field(None, description="User full name")
    is_active: bool = Field(True, description="Active account status")
    is_superuser: bool = Field(False, description="Superuser privilege status")


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="User password")


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = Field(None, description="Updated user email")
    full_name: Optional[str] = Field(None, description="Updated full name")
    password: Optional[str] = Field(None, min_length=6, description="Updated password")
    is_active: Optional[bool] = Field(None, description="Updated active status")


class UserRead(UserBase):
    id: str = Field(..., description="Unique UUID string of the user")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
