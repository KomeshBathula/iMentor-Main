from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from database.models.research import ResearchSession


class Report(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Generated Final Research Report ORM Model (Markdown, HTML, PDF, DOCX formats).
    """
    __tablename__ = "reports"

    research_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    content_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pdf_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    docx_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    bibliography: Mapped[dict] = mapped_column(JSON, default=list, nullable=False)
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    research_session: Mapped["ResearchSession"] = relationship(
        "ResearchSession",
        back_populates="reports"
    )

    def __repr__(self) -> str:
        return f"<Report(id={self.id}, title={self.title[:30]!r}, word_count={self.word_count})>"
