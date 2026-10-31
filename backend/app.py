"""
FastAPI сервер для агрегатора хакатонов.
Отдаёт данные из SQLite базы через REST API.

Запуск:
    uvicorn app:app --host 0.0.0.0 --port 8000 --reload

Документация API:
    http://localhost:8000/docs (Swagger UI)
    http://localhost:8000/redoc (ReDoc)
"""

import json
from typing import Optional, List
from datetime import datetime

from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

from models import get_db, Event, ParserLog, init_db
from scheduler import run_all_parsers

# Инициализация
init_db()

app = FastAPI(
    title="ХакатонАгрегатор API",
    description="API для получения данных о хакатонах для детей до 18 лет (Барнаул и онлайн)",
    version="1.0.0",
)

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Pydantic модели для ответов ===

class HackathonResponse(BaseModel):
    id: int
    title: str
    source_url: str
    source_name: str
    format: str
    location: str
    age_min: int
    age_max: int
    directions: List[str]
    description: str
    registration_deadline: str
    event_dates: str
    raw_text: str
    needs_review: bool
    date_parsed: datetime

    class Config:
        from_attributes = True


class ParserStatusResponse(BaseModel):
    parser_name: str
    status: str
    events_found: int
    events_saved: int
    error_message: str
    started_at: datetime
    finished_at: Optional[datetime]


class StatsResponse(BaseModel):
    total_events: int
    offline_events: int
    online_events: int
    needs_review: int
    sources: dict
    last_parser_run: Optional[datetime]


# === API Endpoints ===

@app.get("/")
def root():
    """Корневой endpoint"""
    return {
        "name": "ХакатонАгрегатор API",
        "version": "1.0.0",
        "description": "API для получения данных о хакатонах для детей до 18 лет",
        "docs": "/docs",
    }


@app.get("/api/hackathons", response_model=List[HackathonResponse])
def get_hackathons(
    format: Optional[str] = Query(None, description="Формат: offline или online"),
    age_min: Optional[int] = Query(None, description="Минимальный возраст участника"),
    age_max: Optional[int] = Query(None, description="Максимальный возраст участника"),
    direction: Optional[str] = Query(None, description="Направление (фильтр по направлениям)"),
    search: Optional[str] = Query(None, description="Поиск по названию и описанию"),
    source: Optional[str] = Query(None, description="Источник"),
    needs_review: Optional[bool] = Query(None, description="Требуют проверки"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Получить список хакатонов с фильтрами.
    
    Параметры:
    - format: offline/online
    - age_min/age_max: возрастной диапазон
    - direction: направление (Программирование, AR/VR, и т.д.)
    - search: текстовый поиск
    - source: название источника
    - needs_review: только требующие проверки
    """
    query = db.query(Event)
    
    # Фильтр по формату
    if format:
        query = query.filter(Event.format == format)
    
    # Фильтр по возрасту (пересечение диапазонов)
    if age_min is not None:
        query = query.filter(
            (Event.age_max >= age_min) | (Event.age_max == 0)
        )
    if age_max is not None:
        query = query.filter(
            (Event.age_min <= age_max) | (Event.age_min == 0)
        )
    
    # Фильтр по направлению
    if direction:
        query = query.filter(Event.directions.contains(direction))
    
    # Текстовый поиск
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Event.title.ilike(search_pattern)) |
            (Event.description.ilike(search_pattern)) |
            (Event.directions.ilike(search_pattern)) |
            (Event.location.ilike(search_pattern))
        )
    
    # Фильтр по источнику
    if source:
        query = query.filter(Event.source_name == source)
    
    # Фильтр по needs_review
    if needs_review is not None:
        query = query.filter(Event.needs_review == needs_review)
    
    # Сортировка (новые сначала)
    query = query.order_by(Event.date_parsed.desc())
    
    # Пагинация
    results = query.offset(offset).limit(limit).all()
    
    # Конвертируем directions из JSON-строки в список
    response = []
    for event in results:
        event_dict = {
            'id': event.id,
            'title': event.title,
            'source_url': event.source_url,
            'source_name': event.source_name,
            'format': event.format,
            'location': event.location,
            'age_min': event.age_min,
            'age_max': event.age_max,
            'directions': json.loads(event.directions) if event.directions else [],
            'description': event.description,
            'registration_deadline': event.registration_deadline,
            'event_dates': event.event_dates,
            'raw_text': event.raw_text,
            'needs_review': event.needs_review,
            'date_parsed': event.date_parsed,
        }
        response.append(event_dict)
    
    return response


@app.get("/api/hackathons/{hackathon_id}", response_model=HackathonResponse)
def get_hackathon(hackathon_id: int, db: Session = Depends(get_db)):
    """Получить конкретный хакатон по ID"""
    event = db.query(Event).filter(Event.id == hackathon_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Хакатон не найден")
    
    return {
        'id': event.id,
        'title': event.title,
        'source_url': event.source_url,
        'source_name': event.source_name,
        'format': event.format,
        'location': event.location,
        'age_min': event.age_min,
        'age_max': event.age_max,
        'directions': json.loads(event.directions) if event.directions else [],
        'description': event.description,
        'registration_deadline': event.registration_deadline,
        'event_dates': event.event_dates,
        'raw_text': event.raw_text,
        'needs_review': event.needs_review,
        'date_parsed': event.date_parsed,
    }


@app.get("/api/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Получить статистику по хакатонам"""
    total = db.query(Event).count()
    offline = db.query(Event).filter(Event.format == 'offline').count()
    online = db.query(Event).filter(Event.format == 'online').count()
    needs_review = db.query(Event).filter(Event.needs_review == True).count()
    
    # Источники
    sources = {}
    all_events = db.query(Event.source_name).distinct().all()
    for (source_name,) in all_events:
        count = db.query(Event).filter(Event.source_name == source_name).count()
        sources[source_name] = count
    
    # Последний запуск парсера
    last_run = db.query(ParserLog).order_by(ParserLog.started_at.desc()).first()
    
    return {
        "total_events": total,
        "offline_events": offline,
        "online_events": online,
        "needs_review": needs_review,
        "sources": sources,
        "last_parser_run": last_run.started_at if last_run else None,
    }


@app.post("/api/parsers/run")
def trigger_parsers():
    """Запустить парсеры вручную"""
    result = run_all_parsers()
    return {
        "status": "completed",
        "total_found": result['total_found'],
        "total_saved": result['total_saved'],
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/parsers/status")
def get_parser_status(db: Session = Depends(get_db)):
    """Получить статус последних запусков парсеров"""
    logs = db.query(ParserLog).order_by(ParserLog.started_at.desc()).limit(20).all()
    
    return [
        {
            "parser_name": log.parser_name,
            "status": log.status,
            "events_found": log.events_found,
            "events_saved": log.events_saved,
            "error_message": log.error_message,
            "started_at": log.started_at,
            "finished_at": log.finished_at,
        }
        for log in logs
    ]


@app.get("/api/directions")
def get_directions(db: Session = Depends(get_db)):
    """Получить список всех направлений"""
    events = db.query(Event.directions).all()
    all_directions = set()
    
    for (directions_json,) in events:
        if directions_json:
            try:
                directions = json.loads(directions_json)
                all_directions.update(directions)
            except json.JSONDecodeError:
                pass
    
    return sorted(list(all_directions))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
