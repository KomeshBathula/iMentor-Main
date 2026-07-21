from celery import Celery
from config import settings

celery_app = Celery(
    "deep_research_workers",
    broker=settings.get_celery_broker,
    backend=settings.get_celery_backend,
    include=[
        "workers.research_worker",
        "workers.report_worker",
        "workers.embedding_worker",
        "workers.cleanup_worker",
    ]
)

celery_app.conf.update(
    task_always_eager=(settings.ENVIRONMENT == "development"),
    task_eager_propagates=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1,
)
