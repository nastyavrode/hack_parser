"""
Базовый класс парсера с обработкой ошибок, логированием и настройками.
"""

import logging
import time
import requests
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
from datetime import datetime

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Общие настройки
DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
}

DEFAULT_TIMEOUT = 30  # секунд
DEFAULT_DELAY = 2  # задержка между запросами (сек)


class BaseParser(ABC):
    """
    Базовый класс для всех парсеров.
    
    Каждый парсер должен:
    1. Наследовать BaseParser
    2. Реализовать метод parse() -> List[Dict]
    3. Опционально переопределить настройки (timeout, headers, delay)
    """
    
    def __init__(self, name: str, base_url: str):
        self.name = name
        self.base_url = base_url
        self.logger = logging.getLogger(f"parser.{name}")
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.timeout = DEFAULT_TIMEOUT
        self.delay = DEFAULT_DELAY
        self.errors: List[str] = []
    
    def fetch_page(self, url: str, use_playwright: bool = False) -> Optional[str]:
        """
        Загрузка страницы.
        
        Args:
            url: URL для загрузки
            use_playwright: Если True, использует Playwright для JS-рендеринга
        
        Returns:
            HTML-контент страницы или None при ошибке
        """
        try:
            if use_playwright:
                return self._fetch_with_playwright(url)
            
            self.logger.info(f"Загрузка: {url}")
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            response.encoding = response.apparent_encoding or 'utf-8'
            
            time.sleep(self.delay)  # Задержка между запросами
            return response.text
            
        except requests.exceptions.Timeout:
            self.logger.error(f"Таймаут при загрузке: {url}")
            self.errors.append(f"Timeout: {url}")
            return None
        except requests.exceptions.HTTPError as e:
            self.logger.error(f"HTTP ошибка ({e.response.status_code}): {url}")
            self.errors.append(f"HTTP {e.response.status_code}: {url}")
            return None
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Ошибка запроса: {url} — {e}")
            self.errors.append(f"Request error: {url} — {e}")
            return None
    
    def _fetch_with_playwright(self, url: str) -> Optional[str]:
        """
        Загрузка страницы через Playwright (для JS-рендеринга).
        Требует: pip install playwright && playwright install chromium
        """
        try:
            from playwright.sync_api import sync_playwright
            
            self.logger.info(f"Загрузка через Playwright: {url}")
            
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.set_extra_http_headers({
                    'Accept-Language': 'ru-RU,ru;q=0.9'
                })
                page.goto(url, wait_until='networkidle', timeout=self.timeout * 1000)
                
                # Ждём, пока контент загрузится
                page.wait_for_timeout(3000)
                
                content = page.content()
                browser.close()
                return content
                
        except ImportError:
            self.logger.error("Playwright не установлен. Установите: pip install playwright && playwright install chromium")
            self.errors.append("Playwright not installed")
            return None
        except Exception as e:
            self.logger.error(f"Ошибка Playwright: {url} — {e}")
            self.errors.append(f"Playwright error: {url} — {e}")
            return None
    
    def parse_html(self, html: str) -> BeautifulSoup:
        """Парсинг HTML через BeautifulSoup"""
        return BeautifulSoup(html, 'lxml')
    
    @abstractmethod
    def parse(self) -> List[Dict]:
        """
        Основной метод парсинга.
        
        Returns:
            Список словарей с полями:
            - title: str
            - source_url: str (уникальный URL события)
            - source_name: str
            - format: str ('offline' или 'online')
            - location: str
            - age_min: int
            - age_max: int
            - directions: list[str]
            - description: str
            - registration_deadline: str
            - event_dates: str
            - raw_text: str
        """
        pass
    
    def run(self) -> Dict:
        """
        Запуск парсера с обработкой ошибок.
        
        Returns:
            dict с результатами: {events: list, errors: list, count: int}
        """
        self.logger.info(f"=== Запуск парсера: {self.name} ===")
        start_time = time.time()
        
        try:
            events = self.parse()
            elapsed = time.time() - start_time
            self.logger.info(
                f"Парсер {self.name} завершён за {elapsed:.1f}с. "
                f"Найдено событий: {len(events)}, ошибок: {len(self.errors)}"
            )
            
            return {
                "parser_name": self.name,
                "events": events,
                "errors": self.errors,
                "count": len(events),
                "elapsed_seconds": round(elapsed, 1),
                "status": "success" if not self.errors else "partial",
            }
            
        except Exception as e:
            elapsed = time.time() - start_time
            self.logger.error(f"Критическая ошибка парсера {self.name}: {e}")
            self.errors.append(f"Critical: {e}")
            
            return {
                "parser_name": self.name,
                "events": [],
                "errors": self.errors,
                "count": 0,
                "elapsed_seconds": round(elapsed, 1),
                "status": "error",
            }
