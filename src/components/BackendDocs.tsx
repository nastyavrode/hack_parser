import { useState } from 'react';

export default function BackendDocs() {
  const [activeTab, setActiveTab] = useState<'structure' | 'parser' | 'deploy' | 'api'>('structure');

  const tabs = [
    { id: 'structure' as const, label: 'Структура', icon: '📁' },
    { id: 'parser' as const, label: 'Парсеры', icon: '🕷️' },
    { id: 'api' as const, label: 'API', icon: '🔌' },
    { id: 'deploy' as const, label: 'Развёртывание', icon: '🚀' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          🐍 Python-бэкенд (архитектура)
        </h2>
        <p className="text-indigo-100 text-sm mt-1">
          Полный код бэкенда находится в папке <code className="bg-white/20 px-1.5 py-0.5 rounded">backend/</code> проекта
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === id
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'structure' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Структура проекта</h3>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`hackathon-aggregator/
├── app.py              # FastAPI сервер
├── models.py           # SQLAlchemy модели
├── scheduler.py        # APScheduler запуск парсеров
├── filters.py          # Функция is_relevant()
├── parsers/
│   ├── __init__.py
│   ├── base.py         # Базовый класс парсера
│   ├── kvantorium.py   # Кванториум.22
│   ├── itcube.py       # IT-Куб Барнаул
│   ├── universities.py # АлтГТУ, АлтГУ
│   └── aggregators.py  # hackathons.ru, habr.com
├── database.db         # SQLite (создаётся автоматически)
├── requirements.txt
└── README.md`}
            </pre>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">📋 Схема таблицы events:</h4>
              <pre className="text-sm text-blue-800 overflow-x-auto">
{`id                  INTEGER PRIMARY KEY
title               TEXT NOT NULL
source_url          TEXT UNIQUE NOT NULL
source_name         TEXT NOT NULL
format              TEXT (offline/online)
location            TEXT
age_min             INTEGER
age_max             INTEGER
directions          TEXT (JSON array)
description         TEXT
registration_deadline TEXT
event_dates         TEXT
raw_text            TEXT
needs_review        BOOLEAN DEFAULT 0
date_parsed         DATETIME DEFAULT CURRENT_TIMESTAMP`}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'parser' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Модули парсеров</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm font-medium">
                ⚠️ Селекторы могут устареть. Рекомендуется раз в месяц проверять логи парсера на наличие ошибок и при необходимости обновлять CSS-селекторы в модулях parsers/*.py
              </p>
            </div>
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">🏫 Кванториум.22</h4>
                <p className="text-sm text-gray-600">URL: kvantorium22.ru/news</p>
                <p className="text-sm text-gray-600">Логика: поиск слов «хакатон», «школьники», «дети», «Барнаул» в заголовках</p>
                <p className="text-sm text-gray-600">Библиотека: requests + BeautifulSoup</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">💻 IT-Куб Барнаул</h4>
                <p className="text-sm text-gray-600">URL: it-cube22.ru/news</p>
                <p className="text-sm text-gray-600">Логика: поиск «хакатон», «AR/VR/Mobile Fest», «регистрация»</p>
                <p className="text-sm text-gray-600">Библиотека: playwright (динамическая подгрузка)</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">🎓 Университеты (АлтГТУ, АлтГУ)</h4>
                <p className="text-sm text-gray-600">URL: altstu.ru/news, altgu.ru/news</p>
                <p className="text-sm text-gray-600">Логика: поиск упоминаний хакатонов для школьников в новостях</p>
                <p className="text-sm text-gray-600">Библиотека: requests + BeautifulSoup</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">🌐 Агрегаторы</h4>
                <p className="text-sm text-gray-600">URL: hacks-ai.ru, habr.com/hubs/hackathons</p>
                <p className="text-sm text-gray-600">Логика: онлайн-хакатоны для школьников (ИТ-прорыв, Game Jam)</p>
                <p className="text-sm text-gray-600">Библиотека: requests + BeautifulSoup</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">REST API (FastAPI)</h3>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <code className="text-sm font-mono">
                  <span className="text-green-600 font-bold">GET</span> /api/hackathons
                </code>
                <p className="text-sm text-gray-600 mt-1">Получить список хакатонов с фильтрами</p>
                <pre className="text-xs text-gray-500 mt-2 bg-white p-2 rounded">
{`Параметры: ?format=offline&age_min=10&age_max=18&direction=Программирование&search=хакатон`}
                </pre>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <code className="text-sm font-mono">
                  <span className="text-green-600 font-bold">GET</span> /api/hackathons/:id
                </code>
                <p className="text-sm text-gray-600 mt-1">Получить конкретный хакатон</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <code className="text-sm font-mono">
                  <span className="text-blue-600 font-bold">POST</span> /api/parsers/run
                </code>
                <p className="text-sm text-gray-600 mt-1">Запустить парсеры вручную</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <code className="text-sm font-mono">
                  <span className="text-green-600 font-bold">GET</span> /api/parsers/status
                </code>
                <p className="text-sm text-gray-600 mt-1">Статус последнего запуска парсеров</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deploy' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Инструкция по развёртыванию</h3>
            
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">1. Установка зависимостей</h4>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-sm overflow-x-auto">
{`cd hackathon-aggregator
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium`}
                </pre>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">2. Настройка cron (ежедневно в 06:00 по Барнаулу)</h4>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-sm overflow-x-auto">
{`# crontab -e
# Время Барнаула = UTC+7, в UTC это 23:00 предыдущего дня
0 23 * * * /usr/bin/python3 /path/to/hackathon-aggregator/scheduler.py >> /var/log/hackathon-parser.log 2>&1`}
                </pre>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">3. Запуск веб-сервера</h4>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-sm overflow-x-auto">
{`# С systemd:
sudo systemctl start hackathon-api
sudo systemctl enable hackathon-api

# Или вручную:
uvicorn app:app --host 0.0.0.0 --port 8000`}
                </pre>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">4. requirements.txt</h4>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-sm overflow-x-auto">
{`fastapi==0.109.0
uvicorn==0.27.0
sqlalchemy==2.0.25
apscheduler==3.10.4
requests==2.31.0
beautifulsoup4==4.12.3
playwright==1.41.0
lxml==5.1.0`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
