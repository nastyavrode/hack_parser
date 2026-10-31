"""
Фильтрация событий — определение релевантности хакатона для детей до 18 лет.
"""

import json
import re
from typing import Optional


# Ключевые слова для определения формата
OFFLINE_KEYWORDS = ["барнаул", "офлайн", "очно", "аудитория", "алтайский край"]
ONLINE_KEYWORDS = ["онлайн", "дистанционно", "удалённо", "zoom", "онлайн-формат"]

# Ключевые слова для определения возрастной категории
AGE_PATTERNS = [
    r"(\d+)\s*[–\-]\s*(\d+)\s*лет",
    r"возраст\s*[:\-]?\s*(\d+)\s*[–\-]\s*(\d+)",
    r"от\s*(\d+)\s*до\s*(\d+)\s*лет",
    r"(\d+)\s*[–\-]\s*(\d+)\s*класс",
    r"школьник(?:и|ов|ам)?\s*(\d+)\s*[–\-]\s*(\d+)",
]

# Направления, которые мы ищем
DIRECTION_KEYWORDS = {
    "Программирование": ["программирован", "код", "python", "java", "c++", "javascript"],
    "Веб-разработка": ["веб", "сайт", "html", "css", "frontend", "backend", "лендинг"],
    "Мобильные приложения": ["мобильн", "android", "ios", "app", "приложен"],
    "AR/VR": ["ar", "vr", "дополненн", "виртуальн", "реальност"],
    "GameDev": ["game", "игр", "gamejam", "game jam", "геймдев"],
    "ИИ": ["ии", "искусственн", "нейросет", "machine learning", "ml", "ai"],
    "Робототехника": ["робот", "arduino", "raspberry", "конструктор"],
    "Scratch": ["scratch", "скретч"],
    "App Inventor": ["app inventor", "mit app"],
    "Unity": ["unity"],
    "Blender": ["blender", "3d", "моделирован"],
    "Data Science": ["data science", "данны", "анализ"],
}


def is_relevant(raw_text: str, title: str = "") -> dict:
    """
    Определяет, релевантно ли событие (хакатон для детей до 18 лет).
    
    Returns:
        dict с полями:
        - relevant: bool — является ли событие релевантным
        - format: str — 'offline', 'online' или 'unknown'
        - age_min: int — минимальный возраст (0 если не определён)
        - age_max: int — максимальный возраст (0 если не определён)
        - directions: list — найденные направления
        - needs_review: bool — требуется ли ручная проверка
    """
    text = (title + " " + raw_text).lower()
    
    result = {
        "relevant": False,
        "format": "unknown",
        "age_min": 0,
        "age_max": 0,
        "directions": [],
        "needs_review": False,
    }
    
    # 1. Проверяем, что это хакатон
    hackathon_keywords = ["хакатон", "hackathon", "хакатон-марафон", "hack", "game jam", "геймджемп"]
    is_hackathon = any(kw in text for kw in hackathon_keywords)
    if not is_hackathon:
        return result
    
    # 2. Определяем формат
    offline_score = sum(1 for kw in OFFLINE_KEYWORDS if kw in text)
    online_score = sum(1 for kw in ONLINE_KEYWORDS if kw in text)
    
    if offline_score > online_score:
        result["format"] = "offline"
    elif online_score > offline_score:
        result["format"] = "online"
    else:
        result["format"] = "unknown"
    
    # 3. Извлекаем возраст
    for pattern in AGE_PATTERNS:
        match = re.search(pattern, text)
        if match:
            try:
                age_min = int(match.group(1))
                age_max = int(match.group(2))
                if age_min <= age_max and age_min >= 5 and age_max <= 25:
                    result["age_min"] = age_min
                    result["age_max"] = age_max
                    break
            except (ValueError, IndexError):
                continue
    
    # 4. Определяем направления
    found_directions = []
    for direction, keywords in DIRECTION_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                found_directions.append(direction)
                break
    result["directions"] = found_directions
    
    # 5. Определяем релевантность
    # Событие релевантно, если:
    # - это хакатон (уже проверено)
    # - возраст включает детей до 18 ИЛИ возраст не определён (нужна проверка)
    # - формат: офлайн в Барнауле ИЛИ онлайн
    
    age_ok = (
        result["age_min"] == 0 and result["age_max"] == 0  # Не определили возраст
        or result["age_min"] <= 18  # Минимальный возраст <= 18
    )
    
    format_ok = result["format"] in ("offline", "online")
    
    if age_ok and format_ok:
        result["relevant"] = True
    
    # Если не смогли определить возраст или формат — помечаем для ручной проверки
    if result["relevant"] and (result["age_min"] == 0 or result["format"] == "unknown"):
        result["needs_review"] = True
    
    # Если не нашли ни одного направления — тоже нужна проверка
    if result["relevant"] and len(result["directions"]) == 0:
        result["needs_review"] = True
    
    return result


def extract_deadline(text: str) -> Optional[str]:
    """Пытается извлечь дедлайн регистрации из текста."""
    patterns = [
        r"регистраци[яюи]\s*(?:до|—|–|-)\s*(\d{1,2}[\.\-/]\d{1,2}(?:[\.\-/]\d{2,4})?)",
        r"до\s*(\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\w*\s*\d{0,4})",
        r"дедлайн\s*[:\-]?\s*(\d{1,2}[\.\-/]\d{1,2}(?:[\.\-/]\d{2,4})?)",
    ]
    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            return match.group(1).strip()
    return None


def extract_dates(text: str) -> Optional[str]:
    """Пытается извлечь даты проведения из текста."""
    patterns = [
        r"(\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\w*\s*(?:—|–|-|по)\s*\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\w*)",
        r"(\d{1,2}[\.\-/]\d{1,2}[\.\-/]\d{2,4}\s*(?:—|–|-)\s*\d{1,2}[\.\-/]\d{1,2}[\.\-/]\d{2,4})",
    ]
    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            return match.group(1).strip()
    return None


if __name__ == "__main__":
    # Тестирование
    test_text = """
    В Кванториум.22 стартует краевой инженерный хакатон для школьников 10-17 лет.
    Направления: программирование на Python, создание сайтов, мобильная разработка.
    Регистрация до 15.02.2024. Даты проведения: 20-22 февраля 2024.
    Место: Барнаул, Кванториум.22.
    """
    
    result = is_relevant(test_text, "Краевой инженерный хакатон")
    print("Результат фильтрации:")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    deadline = extract_deadline(test_text)
    print(f"\nДедлайн: {deadline}")
    
    dates = extract_dates(test_text)
    print(f"Даты: {dates}")
