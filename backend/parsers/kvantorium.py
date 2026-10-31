"""
Парсер для Кванториум.22 (Барнаул).
Целевая страница: раздел «Новости» на kvantorium22.ru

Логика:
- Загружаем страницу новостей
- Ищем заголовки/текст со словами: «хакатон», «школьники», «дети»
- Извлекаем дату, описание, ссылку
- Фильтруем по релевантности (возраст до 18)

⚠️ ВНИМАНИЕ: CSS-селекторы могут измениться. 
Проверяйте актуальную вёрстку и обновляйте селекторы при необходимости.
"""

from typing import List, Dict
from .base import BaseParser
from filters import is_relevant, extract_deadline, extract_dates


class KvantoriumParser(BaseParser):
    """Парсер новостей Кванториум.22"""
    
    def __init__(self):
        super().__init__(
            name="kvantorium22",
            base_url="https://kvantorium22.ru"
        )
        self.news_url = "https://kvantorium22.ru/news"  # Актуальный URL раздела новостей
    
    def parse(self) -> List[Dict]:
        """Парсинг страницы новостей Кванториум.22"""
        events = []
        
        # Загружаем страницу новостей
        html = self.fetch_page(self.news_url)
        if not html:
            return events
        
        soup = self.parse_html(html)
        
        # Ищем карточки новостей
        # ⚠️ СЕЛЕКТОРЫ МОГУТ УСТАРЕТЬ — проверяйте реальную вёрстку!
        # Типичные варианты: .news-item, .post, article, .card
        news_items = soup.select('article, .news-item, .post, .card')
        
        if not news_items:
            # Fallback: ищем все ссылки с текстом
            self.logger.warning("Не найдены стандартные карточки новостей. Пробуем fallback.")
            news_items = soup.select('a[href*="/news/"]')
        
        self.logger.info(f"Найдено элементов: {len(news_items)}")
        
        for item in news_items:
            try:
                event = self._parse_news_item(item)
                if event:
                    events.append(event)
            except Exception as e:
                self.logger.error(f"Ошибка парсинга элемента: {e}")
                continue
        
        return events
    
    def _parse_news_item(self, item) -> Dict:
        """Парсинг одного элемента новости"""
        # Извлекаем заголовок
        # ⚠️ Селекторы для заголовка — адаптируйте под реальную вёрстку
        title_el = item.select_one('h2, h3, h4, .title, .news-title')
        if not title_el:
            return None
        
        title = title_el.get_text(strip=True)
        
        # Проверяем, содержит ли новость ключевые слова
        keywords = ['хакатон', 'hackathon', 'школьник', 'дети', 'детск']
        if not any(kw in title.lower() for kw in keywords):
            # Проверяем текст
            text_content = item.get_text(strip=True).lower()
            if not any(kw in text_content for kw in keywords):
                return None
        
        # Извлекаем ссылку
        link_el = item.select_one('a[href]')
        if link_el:
            href = link_el.get('href', '')
            if href.startswith('/'):
                href = self.base_url + href
        else:
            href = self.news_url
        
        # Извлекаем описание
        desc_el = item.select_one('p, .description, .excerpt, .text')
        description = desc_el.get_text(strip=True) if desc_el else item.get_text(strip=True)[:500]
        
        # Полный текст для фильтрации
        raw_text = item.get_text(separator=' ', strip=True)
        
        # Фильтрация
        filter_result = is_relevant(raw_text, title)
        
        if not filter_result['relevant']:
            return None
        
        # Извлекаем даты
        deadline = extract_deadline(raw_text)
        event_dates = extract_dates(raw_text)
        
        return {
            'title': title,
            'source_url': href,
            'source_name': 'Кванториум.22',
            'format': filter_result['format'] if filter_result['format'] != 'unknown' else 'offline',
            'location': 'Барнаул, Кванториум.22',
            'age_min': filter_result['age_min'],
            'age_max': filter_result['age_max'],
            'directions': filter_result['directions'],
            'description': description[:1000],
            'registration_deadline': deadline or '',
            'event_dates': event_dates or '',
            'raw_text': raw_text[:5000],  # Сохраняем сырой текст
            'needs_review': filter_result['needs_review'],
        }


if __name__ == "__main__":
    parser = KvantoriumParser()
    result = parser.run()
    print(f"\nРезультат: {result['count']} событий, {len(result['errors'])} ошибок")
    for event in result['events']:
        print(f"  - {event['title']} ({event['format']}, {event['age_min']}-{event['age_max']} лет)")
