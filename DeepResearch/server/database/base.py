import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def generate_uuid_str() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    """
    SQLAlchemy 2.x Declarative Base Class.
    """
    pass


class TimestampMixin:
    """
    Mixin for created_at and updated_at timestamps.
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )


class UUIDMixin:
    """
    Mixin for UUID primary key.
    """
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid_str,
        nullable=False
    )


class SoftDeleteMixin:
    """
    Mixin for soft deletion support.
    """
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    def soft_delete(self) -> None:
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()
