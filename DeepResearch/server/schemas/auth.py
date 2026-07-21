from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str = Field(..., description="JWT access token string")
    token_type: str = Field("bearer", description="Token type, defaults to bearer")
    expires_in: int = Field(..., description="Token validity in seconds")


class TokenData(BaseModel):
    user_id: Optional[str] = Field(None, description="Subject User ID encoded in JWT")
    email: Optional[EmailStr] = Field(None, description="User email address encoded in JWT")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="User password string")


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="User password string")
    full_name: Optional[str] = Field(None, description="Full display name of user")


class PasswordResetRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address for password reset")
