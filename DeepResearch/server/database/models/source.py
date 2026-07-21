from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from database.models.research import ResearchSession


class Source(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Academic and Web Source ORM Model collected during research exploration.
    """
    __tablename__ = "sources"

    research_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # tavily, arxiv, wikipedia, etc.
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_metadata: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    research_session: Mapped["ResearchSession"] = relationship(
        "ResearchSession",
        back_populates="sources"
    )

    def __repr__(self) -> str:
        return f"<Source(id={self.id}, provider={self.provider}, title={self.title[:30]!r})>"
