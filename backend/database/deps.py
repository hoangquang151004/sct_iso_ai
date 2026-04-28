"""
database/deps.py — FastAPI dependency for getting a DB session.
"""
from database import db_manager


def get_db():
    yield from db_manager.get_db()
