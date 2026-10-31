"""
Планировщик запуска парсеров.
Использует APScheduler для ежедневного запуска в 06:00 по времени Барнаула (UTC+7).

Запуск:
    python scheduler.py          # Запуск планировщика (работает постоянно)
    python scheduler.py --once   # Запустить парсеры один раз и выйти

Настройка cron (альтернатива APScheduler):
    0 23 * * * /usr/bin/python3 /path/to/scheduler.py --once
    (23:00 UTC = 06:00 UTC+7 Барнаул)
"""

import sys
import json
import logging
from datetime import datetime
from typing import List, Dict

from sqlalchemy.exc import IntegrityError

from models import SessionLocal, Event, ParserLog, init_db
from parsers import ALL_PARSERS

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [SCHEDULER] %(levelname)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('scheduler.log', encoding='utf-8'),
    ]
)
logger = logging.getLogger(__name__)


def save_events_to_db(events: List[Dict], parser_name: str) -> int:
    """
    Сохранение событий в базу данных.
    Пропускает дубликаты (по source_url).
    
    Returns:
        Количество сохранённых событий
    """
    db = SessionLocal()
    saved_count = 0
    
    try:
        for event_data in events:
            try:
                # Проверяем, есть ли уже такое событие
                existing = db.query(Event).filter(
                    Event.source_url == event_data['source_url']
                ).first()
                
                if existing:
                    logger.debug(f"Пропуск дубликата: {event_data['title'][:50]}")
                    continue
                
                # Создаём новое событие
                event = Event(
                    title=event_data['title'],
                    source_url=event_data['source_url'],
                    source_name=event_data['source_name'],
                    format=event_data['format'],
                    location=event_data.get('location', ''),
                    age_min=event_data.get('age_min', 0),
                    age_max=event_data.get('age_max', 0),
                    directions=json.dumps(event_data.get('directions', []), ensure_ascii=False),
                    description=event_data.get('description', ''),
                    registration_deadline=event_data.get('registration_deadline', ''),
                    event_dates=event_data.get('event_dates', ''),
                    raw_text=event_data.get('raw_text', ''),
                    needs_review=event_data.get('needs_review', False),
                    date_parsed=datetime.utcnow(),
                )
                
                db.add(event)
                saved_count += 1
                
            except IntegrityError:
                db.rollback()
                logger.warning(f"Дубликат (IntegrityError): {event_data.get('source_url', 'unknown')}")
                continue
            except Exception as e:
                logger.error(f"Ошибка сохранения события: {e}")
                continue
        
        db.commit()
        logger.info(f"Сохранено {saved_count} новых событий от {parser_name}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка коммита: {e}")
    finally:
        db.close()
    
    return saved_count


def log_parser_run(parser_name: str, status: str, events_found: int, events_saved: int, error_msg: str = ""):
    """Запись лога запуска парсера в БД"""
    db = SessionLocal()
    try:
        log = ParserLog(
            parser_name=parser_name,
            status=status,
            events_found=events_found,
            events_saved=events_saved,
            error_message=error_msg,
            started_at=datetime.utcnow(),
            finished_at=datetime.utcnow(),
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Ошибка записи лога: {e}")
    finally:
        db.close()


def run_all_parsers():
    """Запуск всех парсеров и сохранение результатов"""
    logger.info("=" * 60)
    logger.info("ЗАПУСК ПАРСЕРОВ — " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    logger.info("=" * 60)
    
    total_events = 0
    total_saved = 0
    
    for ParserClass in ALL_PARSERS:
        parser = ParserClass()
        logger.info(f"\n--- Парсер: {parser.name} ---")
        
        result = parser.run()
        
        # Сохраняем события
        saved = save_events_to_db(result['events'], parser.name)
        
        # Логируем
        error_msg = "; ".join(result['errors']) if result['errors'] else ""
        log_parser_run(
            parser_name=parser.name,
            status=result['status'],
            events_found=result['count'],
            events_saved=saved,
            error_msg=error_msg,
        )
        
        total_events += result['count']
        total_saved += saved
        
        logger.info(
            f"[{parser.name}] Найдено: {result['count']}, "
            f"Сохранено: {saved}, Ошибок: {len(result['errors'])}"
        )
    
    logger.info("\n" + "=" * 60)
    logger.info(f"ИТОГО: Найдено {total_events}, Сохранено {total_saved}")
    logger.info("=" * 60)
    
    return {"total_found": total_events, "total_saved": total_saved}


def start_scheduler():
    """Запуск APScheduler для ежедневного выполнения"""
    try:
        from apscheduler.schedulers.blocking import BlockingScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        logger.error("APScheduler не установлен. Установите: pip install apscheduler")
        logger.info("Или используйте cron: 0 23 * * * python3 /path/to/scheduler.py --once")
        sys.exit(1)
    
    scheduler = BlockingScheduler()
    
    # Расписание: 06:00 по Барнаулу (UTC+7) = 23:00 UTC предыдущего дня
    # В UTC это 23:00
    scheduler.add_job(
        run_all_parsers,
        trigger=CronTrigger(hour=23, minute=0),  # 23:00 UTC = 06:00 Барнаул
        id='daily_parse',
        name='Ежедневный запуск парсеров',
        replace_existing=True,
    )
    
    logger.info("Планировщик запущен. Парсеры будут выполняться ежедневно в 06:00 (Барнаул, UTC+7)")
    logger.info("Для остановки нажмите Ctrl+C")
    
    # Запускаем один раз сразу при старте
    logger.info("Выполняем первый запуск парсеров...")
    run_all_parsers()
    
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Планировщик остановлен.")


if __name__ == "__main__":
    # Инициализация БД
    init_db()
    
    if "--once" in sys.argv:
        # Однократный запуск (для cron)
        run_all_parsers()
    else:
        # Запуск планировщика
        start_scheduler()
