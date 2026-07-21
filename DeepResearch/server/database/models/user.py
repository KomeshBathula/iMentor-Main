from typing import List, TYPE_CHECKING
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from database.models.research import ResearchSession


class User(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    User Account ORM Model for Authentication and Role-Based Access.
    """
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    research_sessions: Mapped[List["ResearchSession"]] = relationship(
        "ResearchSession",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, active={self.is_active})>"
