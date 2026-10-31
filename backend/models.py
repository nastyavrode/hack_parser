"""
SQLAlchemy модели для агрегатора хакатонов.
База данных: SQLite (hackathon_aggregator.db)
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///hackathon_aggregator.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Event(Base):
    """Модель события (хакатона)"""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(500), nullable=False)
    source_url = Column(String(1000), unique=True, nullable=False, index=True)
    source_name = Column(String(200), nullable=False)
    format = Column(String(20), nullable=False)  # 'offline' или 'online'
    location = Column(String(500), default="")
    age_min = Column(Integer, default=0)
    age_max = Column(Integer, default=0)
    directions = Column(Text, default="[]")  # JSON-массив направлений
    description = Column(Text, default="")
    registration_deadline = Column(String(50), default="")
    event_dates = Column(String(200), default="")
    raw_text = Column(Text, default="")  # Сырой текст для отладки
    needs_review = Column(Boolean, default=False)  # Требует ручной проверки
    date_parsed = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Event(id={self.id}, title='{self.title[:50]}', source='{self.source_name}')>"


class ParserLog(Base):
    """Лог запуска парсеров"""
    __tablename__ = "parser_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    parser_name = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False)  # 'success', 'error', 'partial'
    events_found = Column(Integer, default=0)
    events_saved = Column(Integer, default=0)
    error_message = Column(Text, default="")
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)


def init_db():
    """Инициализация базы данных (создание таблиц)"""
    Base.metadata.create_all(bind=engine)
    print("[DB] Таблицы созданы/проверены успешно.")


def get_db():
    """Получить сессию базы данных"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    print("[DB] База данных инициализирована: hackathon_aggregator.db")
