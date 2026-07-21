from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from config import settings
from database.session import get_async_db
from database.models.user import User
from schemas.auth import Token, LoginRequest, RegisterRequest
from schemas.user import UserRead
from utils.security import verify_password, get_password_hash, create_access_token
from utils.logger import logger

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_async_db)):
    """
    Register a new user account with email and password.
    """
    stmt = select(User).where(User.email == payload.email)
    res = await db.execute(stmt)
    existing_user = res.scalars().first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    hashed = get_password_hash(payload.password)
    user = User(
        email=payload.email,
        hashed_password=hashed,
        full_name=payload.full_name,
        is_active=True,
        is_superuser=False
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"[Auth] Registered new user: {user.email}")
    return user


@router.post("/login", response_model=Token)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_async_db)):
    """
    Authenticate user and return JWT access token.
    """
    stmt = select(User).where(User.email == payload.email)
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account."
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        subject=user.id,
        email=user.email,
        expires_delta=access_token_expires
    )

    logger.info(f"[Auth] User logged in: {user.email}")
    return Token(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
