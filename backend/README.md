# ХакатонАгрегатор — Бэкенд

Автоматизированный агрегатор хакатонов для детей до 18 лет (Барнаул офлайн + онлайн).

## 📁 Структура проекта

```
hackathon-aggregator/
├── app.py              # FastAPI сервер (REST API)
├── models.py           # SQLAlchemy модели (SQLite)
├── scheduler.py        # APScheduler (ежедневный запуск парсеров)
├── filters.py          # Функция is_relevant() — фильтрация событий
├── parsers/
│   ├── __init__.py     # Список всех парсеров
│   ├── base.py         # Базовый класс парсера (requests + playwright)
│   ├── kvantorium.py   # Кванториум.22 (Барнаул)
│   ├── itcube.py       # IT-Куб Барнаул (с Playwright)
│   ├── universities.py # АлтГТУ, АлтГУ
│   └── aggregators.py  # hacks-ai.ru, habr.com
├── requirements.txt    # Python-зависимости
└── README.md           # Этот файл
```

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd hackathon-aggregator

# Создаём виртуальное окружение
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# или: venv\Scripts\activate  # Windows

# Устанавливаем зависимости
pip install -r requirements.txt

# Устанавливаем браузер для Playwright (для динамических сайтов)
playwright install chromium
```

### 2. Инициализация базы данных

```bash
python models.py
```

Это создаст файл `hackathon_aggregator.db` с таблицами `events` и `parser_logs`.

### 3. Запуск парсеров (однократно)

```bash
python scheduler.py --once
```

### 4. Запуск веб-сервера (API)

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Документация API: http://localhost:8000/docs

### 5. Запуск планировщика (постоянно)

```bash
python scheduler.py
```

Планировщик будет запускать парсеры ежедневно в 06:00 по времени Барнаула.

## ⏰ Настройка cron (альтернатива APScheduler)

Если не хотите запускать планировщик постоянно, используйте cron:

```bash
# Открываем crontab
crontab -e

# Добавляем строку (23:00 UTC = 06:00 Барнаул, UTC+7):
0 23 * * * /path/to/venv/bin/python /path/to/hackathon-aggregator/scheduler.py --once >> /var/log/hackathon-parser.log 2>&1
```

## 🕷️ Парсеры

| Парсер | Источник | Библиотека | Описание |
|--------|----------|------------|----------|
| `kvantorium.py` | kvantorium22.ru | requests + BS4 | Новости и мероприятия Кванториум.22 |
| `itcube.py` | it-cube22.ru | **Playwright** | IT-Куб (JS-рендеринг) |
| `universities.py` | altstu.ru, altgu.ru | requests + BS4 | Новости университетов |
| `aggregators.py` | hacks-ai.ru, habr.com | requests + BS4 | Агрегаторы хакатонов |

### ⚠️ Важно: CSS-селекторы

Селекторы могут устареть при изменении вёрстки сайтов. Рекомендуется:
1. Раз в месяц проверять логи парсера на наличие ошибок
2. При необходимости обновлять CSS-селекторы в модулях `parsers/*.py`
3. Использовать поле `raw_text` для отладки (сохраняет сырой текст страницы)

## 🔌 API Endpoints

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/hackathons` | Список хакатонов с фильтрами |
| GET | `/api/hackathons/{id}` | Конкретный хакатон |
| GET | `/api/stats` | Статистика |
| GET | `/api/directions` | Список направлений |
| POST | `/api/parsers/run` | Запустить парсеры |
| GET | `/api/parsers/status` | Статус парсеров |

### Примеры запросов

```bash
# Все хакатоны
curl http://localhost:8000/api/hackathons

# Только офлайн в Барнауле
curl "http://localhost:8000/api/hackathons?format=offline"

# Для возраста 10-14 лет
curl "http://localhost:8000/api/hackathons?age_min=10&age_max=14"

# По направлению
curl "http://localhost:8000/api/hackathons?direction=Программирование"

# Поиск
curl "http://localhost:8000/api/hackathons?search=робототехника"
```

## 📊 Схема базы данных (SQLite)

```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    source_url TEXT UNIQUE NOT NULL,
    source_name TEXT NOT NULL,
    format TEXT NOT NULL,          -- 'offline' или 'online'
    location TEXT DEFAULT '',
    age_min INTEGER DEFAULT 0,
    age_max INTEGER DEFAULT 0,
    directions TEXT DEFAULT '[]',  -- JSON-массив
    description TEXT DEFAULT '',
    registration_deadline TEXT DEFAULT '',
    event_dates TEXT DEFAULT '',
    raw_text TEXT DEFAULT '',      -- Сырой текст для отладки
    needs_review BOOLEAN DEFAULT 0,
    date_parsed DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE parser_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parser_name TEXT NOT NULL,
    status TEXT NOT NULL,          -- 'success', 'error', 'partial'
    events_found INTEGER DEFAULT 0,
    events_saved INTEGER DEFAULT 0,
    error_message TEXT DEFAULT '',
    started_at DATETIME,
    finished_at DATETIME
);
```

## 🔧 Добавление нового парсера

1. Создайте файл `parsers/new_source.py`
2. Наследуйте от `BaseParser`
3. Реализуйте метод `parse() -> List[Dict]`
4. Добавьте класс в `parsers/__init__.py` (список `ALL_PARSERS`)

```python
from .base import BaseParser
from filters import is_relevant

class NewSourceParser(BaseParser):
    def __init__(self):
        super().__init__(name="new_source", base_url="https://example.com")
    
    def parse(self) -> List[Dict]:
        html = self.fetch_page(self.base_url + "/events")
        if not html:
            return []
        
        soup = self.parse_html(html)
        events = []
        
        for item in soup.select('.event-card'):
            raw_text = item.get_text(separator=' ', strip=True)
            filter_result = is_relevant(raw_text)
            
            if filter_result['relevant']:
                events.append({
                    'title': item.select_one('h2').text.strip(),
                    'source_url': item.select_one('a')['href'],
                    'source_name': 'Новый источник',
                    'format': filter_result['format'],
                    # ... остальные поля
                    'raw_text': raw_text,
                })
        
        return events
```

## 📝 Лицензия

MIT
