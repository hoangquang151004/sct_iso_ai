from core import settings
from .get_database import DatabaseManager
from .models import Base

db_manager = DatabaseManager(settings.database_url)

__all__ = ["db_manager","Base"]
