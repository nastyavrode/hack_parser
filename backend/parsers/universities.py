"""
Парсер для сайтов университетов (АлтГТУ, АлтГУ).
Ищет в новостях упоминания хакатонов для школьников.

Источники:
- altstu.ru — Алтайский государственный технический университет
- altgu.ru — Алтайский государственный университет

⚠️ ВНИМАНИЕ: CSS-селекторы могут измениться.
Проверяйте актуальную вёрстку и обновляйте селекторы при необходимости.
"""

from typing import List, Dict
from .base import BaseParser
from filters import is_relevant, extract_deadline, extract_dates


class UniversityParser(BaseParser):
    """Парсер новостей университетов (АлтГТУ, АлтГУ)"""
    
    def __init__(self):
        super().__init__(
            name="universities",
            base_url=""
        )
        self.sources = [
            {
                'name': 'АлтГТУ',
                'news_url': 'https://altstu.ru/news',
                'base_url': 'https://altstu.ru',
            },
            {
                'name': 'АлтГУ',
                'news_url': 'https://altgu.ru/news',
                'base_url': 'https://altgu.ru',
            },
        ]
    
    def parse(self) -> List[Dict]:
        """Парсинг новостей всех университетов"""
        all_events = []
        
        for source in self.sources:
            self.logger.info(f"Парсинг: {source['name']} ({source['news_url']})")
            self.base_url = source['base_url']
            
            events = self._parse_source(source)
            all_events.extend(events)
            
            self.logger.info(f"{source['name']}: найдено {len(events)} релевантных событий")
        
        return all_events
    
    def _parse_source(self, source: dict) -> List[Dict]:
        """Парсинг одного источника (университета)"""
        events = []
        
        html = self.fetch_page(source['news_url'])
        if not html:
            return events
        
        soup = self.parse_html(html)
        
        # ⚠️ СЕЛЕКТОРЫ МОГУТ УСТАРЕТЬ — проверяйте реальную вёрстку!
        # Университетские сайты часто используют: .news-item, .news-list__item, article
        news_items = soup.select('article, .news-item, .news-list__item, .event-item, .card')
        
        if not news_items:
            # Fallback: ищем все ссылки на новости
            news_items = soup.select('a[href*="/news/"]')
        
        for item in news_items:
            try:
                event = self._parse_news_item(item, source)
                if event:
                    events.append(event)
            except Exception as e:
                self.logger.error(f"Ошибка парсинга ({source['name']}): {e}")
                continue
        
        return events
    
    def _parse_news_item(self, item, source: dict) -> Dict:
        """Парсинг одного элемента новости университета"""
        # Заголовок
        title_el = item.select_one('h2, h3, h4, .title, a')
        if not title_el:
            return None
        
        title = title_el.get_text(strip=True)
        
        # Проверяем ключевые слова
        keywords = ['хакатон', 'hackathon', 'школьник', 'game jam', 'соревнован']
        text_lower = item.get_text(strip=True).lower()
        
        if not any(kw in text_lower for kw in keywords):
            return None
        
        # Проверяем, что для школьников/детей
        child_keywords = ['школьник', 'дет', 'учащ', '10-11 класс', '11 класс', '9-11', 'абитуриент']
        has_child_audience = any(kw in text_lower for kw in child_keywords)
        
        if not has_child_audience:
            # Если нет явного указания на детей, помечаем для проверки
            pass
        
        # Ссылка
        link_el = item.select_one('a[href]')
        if link_el:
            href = link_el.get('href', '')
            if href.startswith('/'):
                href = source['base_url'] + href
        else:
            href = source['news_url']
        
        # Описание
        desc_el = item.select_one('p, .description, .excerpt, .text, .preview-text')
        description = desc_el.get_text(strip=True) if desc_el else title
        
        # Полный текст
        raw_text = item.get_text(separator=' ', strip=True)
        
        # Фильтрация
        filter_result = is_relevant(raw_text, title)
        
        if not filter_result['relevant']:
            return None
        
        # Если нет явного указания на детскую аудиторию — нужна проверка
        if not has_child_audience:
            filter_result['needs_review'] = True
        
        # Даты
        deadline = extract_deadline(raw_text)
        event_dates = extract_dates(raw_text)
        
        return {
            'title': title,
            'source_url': href,
            'source_name': source['name'],
            'format': filter_result['format'] if filter_result['format'] != 'unknown' else 'offline',
            'location': f"Барнаул, {source['name']}",
            'age_min': filter_result['age_min'],
            'age_max': filter_result['age_max'],
            'directions': filter_result['directions'],
            'description': description[:1000],
            'registration_deadline': deadline or '',
            'event_dates': event_dates or '',
            'raw_text': raw_text[:5000],
            'needs_review': filter_result['needs_review'],
        }


if __name__ == "__main__":
    parser = UniversityParser()
    result = parser.run()
    print(f"\nРезультат: {result['count']} событий, {len(result['errors'])} ошибок")
    for event in result['events']:
        print(f"  - [{event['source_name']}] {event['title']}")
