import logging
import logging.handlers
import os
import json
from datetime import datetime
from typing import Any, Dict
from crawler.config import settings

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "name": record.name,
            "level": record.levelname,
            "message": record.getMessage(),
            "filename": record.filename,
            "lineno": record.lineno
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)

def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(settings.logging.level)
    
    if logger.handlers:
        return logger

    if settings.logging.log_file:
        log_dir = os.path.dirname(settings.logging.log_file)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)

    c_handler = logging.StreamHandler()
    if settings.logging.json_format:
        c_handler.setFormatter(JSONFormatter())
    else:
        c_handler.setFormatter(logging.Formatter(settings.logging.format))
    logger.addHandler(c_handler)

    if settings.logging.log_file:
        f_handler = logging.handlers.RotatingFileHandler(
            settings.logging.log_file,
            maxBytes=10 * 1024 * 1024,
            backupCount=5
        )
        if settings.logging.json_format:
            f_handler.setFormatter(JSONFormatter())
        else:
            f_handler.setFormatter(logging.Formatter(settings.logging.format))
        logger.addHandler(f_handler)

    return logger
