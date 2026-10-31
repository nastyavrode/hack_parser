"""
Парсер агрегаторов хакатонов (hackathons.ru, hacks-ai.ru, habr.com).
Ловит онлайн-события для школьников.

⚠️ ВНИМАНИЕ: CSS-селекторы могут измениться.
Проверяйте актуальную вёрстку и обновляйте селекторы при необходимости.
"""

from typing import List, Dict
from .base import BaseParser
from filters import is_relevant, extract_deadline, extract_dates


class AggregatorsParser(BaseParser):
    """Парсер агрегаторов хакатонов"""
    
    def __init__(self):
        super().__init__(
            name="aggregators",
            base_url=""
        )
        self.sources = [
            {
                'name': 'Хакатоны РФ',
                'url': 'https://hacks-ai.ru/events',
                'base_url': 'https://hacks-ai.ru',
                'type': 'static',
            },
            {
                'name': 'Хабр Хакатоны',
                'url': 'https://habr.com/ru/hubs/hackathons/articles/',
                'base_url': 'https://habr.com',
                'type': 'static',
            },
        ]
    
    def parse(self) -> List[Dict]:
        """Парсинг всех агрегаторов"""
        all_events = []
        
        for source in self.sources:
            self.logger.info(f"Парсинг агрегатора: {source['name']}")
            
            try:
                events = self._parse_source(source)
                all_events.extend(events)
                self.logger.info(f"{source['name']}: найдено {len(events)} релевантных событий")
            except Exception as e:
                self.logger.error(f"Ошибка парсинга {source['name']}: {e}")
                self.errors.append(f"{source['name']}: {e}")
        
        return all_events
    
    def _parse_source(self, source: dict) -> List[Dict]:
        """Парсинг одного агрегатора"""
        events = []
        
        use_playwright = source.get('type') == 'dynamic'
        html = self.fetch_page(source['url'], use_playwright=use_playwright)
        if not html:
            return events
        
        soup = self.parse_html(html)
        
        # ⚠️ СЕЛЕКТОРЫ МОГУТ УСТАРЕТЬ
        if 'hacks-ai' in source['url']:
            news_items = soup.select('.event-card, .hackathon-card, article, .event-item')
        elif 'habr' in source['url']:
            news_items = soup.select('article, .tm-article-snippet, .post')
        else:
            news_items = soup.select('article, .card, .event-item')
        
        for item in news_items:
            try:
                event = self._parse_item(item, source)
                if event:
                    events.append(event)
            except Exception as e:
                self.logger.error(f"Ошибка парсинга элемента: {e}")
                continue
        
        return events
    
    def _parse_item(self, item, source: dict) -> Dict:
        """Парсинг одного элемента"""
        # Заголовок
        title_el = item.select_one('h1, h2, h3, h4, .title, a.title')
        if not title_el:
            return None
        
        title = title_el.get_text(strip=True)
        
        # Проверяем ключевые слова
        keywords = ['хакатон', 'hackathon', 'game jam', 'школьник', 'ит-прорыв']
        text_lower = item.get_text(strip=True).lower()
        
        if not any(kw in text_lower for kw in keywords):
            return None
        
        # Проверяем, что для школьников
        child_keywords = ['школьник', 'дет', 'юниор', 'junior', '10-11', '14-17', '14-18']
        has_child = any(kw in text_lower for kw in child_keywords)
        
        if not has_child:
            return None  # Для агрегаторов строго фильтруем
        
        # Ссылка
        link_el = item.select_one('a[href]')
        if link_el:
            href = link_el.get('href', '')
            if href.startswith('/'):
                href = source['base_url'] + href
        else:
            href = source['url']
        
        # Описание
        desc_el = item.select_one('p, .description, .excerpt, .post__text')
        description = desc_el.get_text(strip=True) if desc_el else title
        
        # Полный текст
        raw_text = item.get_text(separator=' ', strip=True)
        
        # Фильтрация
        filter_result = is_relevant(raw_text, title)
        
        if not filter_result['relevant']:
            return None
        
        # Для агрегаторов — чаще онлайн
        if filter_result['format'] == 'unknown':
            # Проверяем ещё раз на онлайн-признаки
            if any(kw in text_lower for kw in ['онлайн', 'дистанцион', 'удалён', 'zoom']):
                filter_result['format'] = 'online'
            else:
                filter_result['needs_review'] = True
        
        # Даты
        deadline = extract_deadline(raw_text)
        event_dates = extract_dates(raw_text)
        
        return {
            'title': title,
            'source_url': href,
            'source_name': source['name'],
            'format': filter_result['format'] if filter_result['format'] != 'unknown' else 'online',
            'location': 'Онлайн' if filter_result['format'] == 'online' else 'Не определено',
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
    parser = AggregatorsParser()
    result = parser.run()
    print(f"\nРезультат: {result['count']} событий, {len(result['errors'])} ошибок")
    for event in result['events']:
        print(f"  - [{event['source_name']}] {event['title']} ({event['format']})")
