from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base, UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from database.models.research import ResearchSession


class ResearchHistoryLog(Base, UUIDMixin, TimestampMixin):
    """
    Audit and Event Log ORM Model tracking agent activities and execution history.
    """
    __tablename__ = "research_history_logs"

    research_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), default="info", nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    log_metadata: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    research_session: Mapped["ResearchSession"] = relationship(
        "ResearchSession",
        back_populates="history_logs"
    )

    def __repr__(self) -> str:
        return f"<ResearchHistoryLog(id={self.id}, agent={self.agent_name}, action={self.action})>"
