"""
FloatChat AI — Main Entrypoint

This script hooks into Uvicorn to run the FastAPI app.
We configure structlog as the global logger so Uvicorn logs 
match our beautiful pipeline logs.
"""
import sys
import uvicorn
import logging
import structlog

def setup_logging():
    """Wire standard Python logging to route through structlog."""
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(colors=True),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Hijack uvicorn loggers
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.propagate = True

if __name__ == "__main__":
    setup_logging()
    
    from src.config import settings
    
    # Reload enabled in DEV, disabled in PROD
    reload = settings.app_env.lower() in ("dev", "development")
    
    uvicorn.run(
        "src.api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=reload,
        log_level="info",
        server_header=False,
    )
