"""
Парсер для IT-Куб Барнаул.
Целевая страница: раздел новостей на it-cube22.ru

⚠️ Этот парсер использует Playwright, т.к. сайт может использовать 
динамическую подгрузку контента через JavaScript.

Логика:
- Загружаем страницу через Playwright (headless Chrome)
- Ищем заголовки со словами: «хакатон», «AR/VR/Mobile Fest», «регистрация»
- Извлекаем возрастные категории и треки
- Фильтруем по релевантности

⚠️ ВНИМАНИЕ: CSS-селекторы могут измениться.
Проверяйте актуальную вёрстку и обновляйте селекторы при необходимости.
"""

from typing import List, Dict
from .base import BaseParser
from filters import is_relevant, extract_deadline, extract_dates


class ItCubeParser(BaseParser):
    """Парсер новостей IT-Куб Барнаул (с Playwright для JS-рендеринга)"""
    
    def __init__(self):
        super().__init__(
            name="itcube_barnaul",
            base_url="https://it-cube22.ru"
        )
        self.news_url = "https://it-cube22.ru/news"  # Актуальный URL
    
    def parse(self) -> List[Dict]:
        """Парсинг страницы новостей IT-Куб через Playwright"""
        events = []
        
        # ⚠️ Используем Playwright т.к. сайт с динамической подгрузкой
        html = self.fetch_page(self.news_url, use_playwright=True)
        if not html:
            # Fallback на обычный requests
            self.logger.info("Playwright не сработал, пробуем обычный requests...")
            html = self.fetch_page(self.news_url, use_playwright=False)
            if not html:
                return events
        
        soup = self.parse_html(html)
        
        # Ищем карточки новостей
        # ⚠️ СЕЛЕКТОРЫ МОГУТ УСТАРЕТЬ — проверяйте реальную вёрстку!
        # Типичные варианты для IT-Куб: .news-card, .event-item, .post-item
        news_items = soup.select('.news-card, .event-item, .post-item, article, .card')
        
        if not news_items:
            self.logger.warning("Не найдены стандартные карточки. Пробуем все div с ссылками.")
            news_items = soup.select('div:has(> a[href*="news"])')
        
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
        """Парсинг одного элемента новости IT-Куб"""
        # Извлекаем заголовок
        title_el = item.select_one('h2, h3, h4, .title, .card-title, .news-title')
        if not title_el:
            return None
        
        title = title_el.get_text(strip=True)
        
        # Проверяем ключевые слова для IT-Куб
        keywords = [
            'хакатон', 'hackathon', 'ar/vr', 'mobile fest', 
            'app inventor', 'unity', 'varwin', 'blender', 'android'
        ]
        text_lower = item.get_text(strip=True).lower()
        
        if not any(kw in text_lower for kw in keywords):
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
        desc_el = item.select_one('p, .description, .excerpt, .card-text')
        description = desc_el.get_text(strip=True) if desc_el else item.get_text(strip=True)[:500]
        
        # Полный текст
        raw_text = item.get_text(separator=' ', strip=True)
        
        # Фильтрация
        filter_result = is_relevant(raw_text, title)
        
        if not filter_result['relevant']:
            return None
        
        # Специальная логика для IT-Куб: извлекаем треки
        tracks = self._extract_tracks(raw_text)
        if tracks:
            filter_result['directions'] = list(set(filter_result['directions'] + tracks))
        
        # Извлекаем даты
        deadline = extract_deadline(raw_text)
        event_dates = extract_dates(raw_text)
        
        return {
            'title': title,
            'source_url': href,
            'source_name': 'IT-Куб Барнаул',
            'format': filter_result['format'] if filter_result['format'] != 'unknown' else 'offline',
            'location': 'Барнаул, IT-Куб',
            'age_min': filter_result['age_min'],
            'age_max': filter_result['age_max'],
            'directions': filter_result['directions'],
            'description': description[:1000],
            'registration_deadline': deadline or '',
            'event_dates': event_dates or '',
            'raw_text': raw_text[:5000],
            'needs_review': filter_result['needs_review'],
        }
    
    def _extract_tracks(self, text: str) -> List[str]:
        """Извлечение треков/направлений IT-Куб"""
        tracks = []
        track_keywords = {
            'App Inventor': ['app inventor'],
            'Unity': ['unity'],
            'Varwin': ['varwin'],
            'Blender': ['blender'],
            'Android': ['android', 'android studio'],
            'AR/VR': ['ar/vr', 'дополненная реальность', 'виртуальная реальность'],
            'Mobile': ['mobile', 'мобильн'],
        }
        
        text_lower = text.lower()
        for track, keywords in track_keywords.items():
            if any(kw in text_lower for kw in keywords):
                tracks.append(track)
        
        return tracks


if __name__ == "__main__":
    parser = ItCubeParser()
    result = parser.run()
    print(f"\nРезультат: {result['count']} событий, {len(result['errors'])} ошибок")
    for event in result['events']:
        print(f"  - {event['title']}")
        print(f"    Возраст: {event['age_min']}-{event['age_max']} лет")
        print(f"    Направления: {', '.join(event['directions'])}")
