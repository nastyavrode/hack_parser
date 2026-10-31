import { useState, useMemo } from 'react';
import { FilterState } from './types';
import { demoHackathons } from './data';
import HackathonCard from './components/HackathonCard';
import FilterPanel from './components/FilterPanel';
import BackendDocs from './components/BackendDocs';

function App() {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    format: 'all',
    ageRange: [6, 18],
    directions: [],
    showNeedsReview: false,
  });

  const [showBackend, setShowBackend] = useState(false);

  const filteredHackathons = useMemo(() => {
    return demoHackathons.filter((h) => {
      // Search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          h.title.toLowerCase().includes(searchLower) ||
          h.description.toLowerCase().includes(searchLower) ||
          h.directions.some((d) => d.toLowerCase().includes(searchLower)) ||
          h.source_name.toLowerCase().includes(searchLower) ||
          h.location.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Format
      if (filters.format !== 'all' && h.format !== filters.format) return false;

      // Age range - hackathon should overlap with filter range
      if (h.age_min > 0 && h.age_max > 0) {
        if (h.age_max < filters.ageRange[0] || h.age_min > filters.ageRange[1]) return false;
      }

      // Directions
      if (filters.directions.length > 0) {
        const hasMatchingDirection = filters.directions.some((d) =>
          h.directions.some((hd) => hd.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(hd.toLowerCase()))
        );
        if (!hasMatchingDirection) return false;
      }

      // Needs review filter
      if (!filters.showNeedsReview && h.needs_review) return false;

      return true;
    });
  }, [filters]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">🏆</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">ХакатонАгрегатор</h1>
                <p className="text-xs text-gray-500">Хакатоны для детей до 18 лет • Барнаул и онлайн</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBackend(!showBackend)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  showBackend
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🐍 Бэкенд
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-700">Парсер активен</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-indigo-600 font-bold text-lg">{demoHackathons.filter(h => !h.needs_review).length}</span>
              <span className="text-gray-600">хакатонов</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-bold text-lg">{demoHackathons.filter(h => h.format === 'offline').length}</span>
              <span className="text-gray-600">офлайн</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-bold text-lg">{demoHackathons.filter(h => h.format === 'online').length}</span>
              <span className="text-gray-600">онлайн</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-600 font-bold text-lg">{demoHackathons.filter(h => h.needs_review).length}</span>
              <span className="text-gray-600">требуют проверки</span>
            </div>
            <div className="ml-auto text-xs text-gray-500">
              Обновлено: {new Date().toLocaleDateString('ru-RU')}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showBackend ? (
          <BackendDocs />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Filters */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <FilterPanel
                  filters={filters}
                  onFilterChange={setFilters}
                  resultCount={filteredHackathons.length}
                />
              </div>
            </div>

            {/* Hackathon Cards */}
            <div className="lg:col-span-3">
              {filteredHackathons.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <div className="text-5xl mb-4">🔍</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Ничего не найдено</h3>
                  <p className="text-gray-600">Попробуйте изменить параметры фильтрации</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredHackathons.map((hackathon) => (
                    <HackathonCard key={hackathon.id} hackathon={hackathon} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">ХакатонАгрегатор</span> — автоматический сбор информации о хакатонах для детей
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Источники: Кванториум.22, IT-Куб, АлтГТУ, АлтГУ</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              Данные обновляются автоматически ежедневно в 06:00 по времени Барнаула (UTC+7). 
              Парсеры могут не распознать некоторые события — такие карточки помечены ⚠️ и требуют ручной проверки.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
