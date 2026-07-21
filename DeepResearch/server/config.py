import os
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Global Application Configuration Settings.
    Loaded from environment variables or .env file.
    """

    # Application Information
    APP_NAME: str = "Deep Research AI Backend"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "Production-grade multi-agent AI research engine"
    ENVIRONMENT: str = Field("development", validation_alias="ENVIRONMENT")
    DEBUG: bool = Field(True, validation_alias="DEBUG")
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = Field("super-secret-key-change-in-production-32-chars-min", validation_alias="SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS & Security
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"
    ]

    # Server Binding
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database Settings
    POSTGRES_SERVER: Optional[str] = Field(None, validation_alias="POSTGRES_SERVER")
    POSTGRES_USER: str = Field("postgres", validation_alias="POSTGRES_USER")
    POSTGRES_PASSWORD: str = Field("postgres", validation_alias="POSTGRES_PASSWORD")
    POSTGRES_DB: str = Field("deep_research", validation_alias="POSTGRES_DB")
    POSTGRES_PORT: int = Field(5432, validation_alias="POSTGRES_PORT")
    DATABASE_URL: Optional[str] = Field(None, validation_alias="DATABASE_URL")

    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL.replace("+asyncpg", "").replace("+aiosqlite", "")
        if self.POSTGRES_SERVER:
            return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        return "sqlite:///./research.db"

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.POSTGRES_SERVER:
            return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        return "sqlite+aiosqlite:///./research.db"

    # Redis Cache & Celery Broker
    REDIS_HOST: str = Field("localhost", validation_alias="REDIS_HOST")
    REDIS_PORT: int = Field(6379, validation_alias="REDIS_PORT")
    REDIS_DB: int = Field(0, validation_alias="REDIS_DB")
    REDIS_PASSWORD: Optional[str] = Field(None, validation_alias="REDIS_PASSWORD")
    REDIS_URL: Optional[str] = Field(None, validation_alias="REDIS_URL")

    @property
    def redis_connection_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        pwd_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{pwd_part}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # Celery Workers
    CELERY_BROKER_URL: Optional[str] = Field(None, validation_alias="CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND: Optional[str] = Field(None, validation_alias="CELERY_RESULT_BACKEND")

    @property
    def get_celery_broker(self) -> str:
        return self.CELERY_BROKER_URL or self.redis_connection_url

    @property
    def get_celery_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND or self.redis_connection_url

    # OpenAI & LLM Settings
    OPENAI_API_KEY: str = Field("", validation_alias="OPENAI_API_KEY")
    OPENAI_MODEL: str = Field("gpt-4o", validation_alias="OPENAI_MODEL")
    OPENAI_EMBEDDING_MODEL: str = Field("text-embedding-3-small", validation_alias="OPENAI_EMBEDDING_MODEL")

    # External Search Providers
    TAVILY_API_KEY: str = Field("", validation_alias="TAVILY_API_KEY")
    FIRECRAWL_API_KEY: str = Field("", validation_alias="FIRECRAWL_API_KEY")
    SEMANTIC_SCHOLAR_API_KEY: str = Field("", validation_alias="SEMANTIC_SCHOLAR_API_KEY")
    GITHUB_TOKEN: str = Field("", validation_alias="GITHUB_TOKEN")

    # Vector DB (ChromaDB)
    CHROMA_PERSIST_DIRECTORY: str = Field("./chroma_db", validation_alias="CHROMA_PERSIST_DIRECTORY")

    # Uploads & Storage Path
    UPLOAD_DIR: str = Field("./uploads", validation_alias="UPLOAD_DIR")
    LOG_DIR: str = Field("./logs", validation_alias="LOG_DIR")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
