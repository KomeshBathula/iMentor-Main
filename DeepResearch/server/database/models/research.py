from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from database.models.user import User
    from database.models.planner import ResearchPlan
    from database.models.source import Source
    from database.models.report import Report
    from database.models.history import ResearchHistoryLog


class ResearchSession(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Research Session ORM Model representing an autonomous deep research run.
    """
    __tablename__ = "research_sessions"

    user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    nature: Mapped[str] = mapped_column(String(50), default="General", nullable=False)
    depth: Mapped[str] = mapped_column(String(50), default="Balanced", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued", index=True, nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_stage: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    requirements: Mapped[dict] = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="research_sessions")
    plan: Mapped[Optional["ResearchPlan"]] = relationship(
        "ResearchPlan",
        back_populates="research_session",
        uselist=False,
        cascade="all, delete-orphan"
    )
    sources: Mapped[List["Source"]] = relationship(
        "Source",
        back_populates="research_session",
        cascade="all, delete-orphan"
    )
    reports: Mapped[List["Report"]] = relationship(
        "Report",
        back_populates="research_session",
        cascade="all, delete-orphan"
    )
    history_logs: Mapped[List["ResearchHistoryLog"]] = relationship(
        "ResearchHistoryLog",
        back_populates="research_session",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ResearchSession(id={self.id}, query={self.query[:30]!r}, status={self.status})>"
