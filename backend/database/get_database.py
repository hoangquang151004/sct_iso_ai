from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()


class DatabaseManager:
    def __init__(self, db_url: str):
        self.engine = create_engine(db_url, connect_args={"client_encoding": "utf8"})

        self.SessionLocal = sessionmaker(autoflush=False, bind=self.engine)

    def get_db(self):
        db = self.SessionLocal()
        try:
            yield db
        finally:
            db.close()
