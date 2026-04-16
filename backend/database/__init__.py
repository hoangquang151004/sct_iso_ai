from core import settings
from .get_database import DatabaseManager

db_manager = DatabaseManager(settings.database_url)

__all__ = ["db_manager"]
