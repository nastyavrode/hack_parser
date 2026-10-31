import { FilterState } from '../types';
import { allDirections } from '../data';

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  resultCount: number;
}

export default function FilterPanel({ filters, onFilterChange, resultCount }: FilterPanelProps) {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const toggleDirection = (dir: string) => {
    const current = filters.directions;
    if (current.includes(dir)) {
      updateFilter('directions', current.filter(d => d !== dir));
    } else {
      updateFilter('directions', [...current, dir]);
    }
  };

  const resetFilters = () => {
    onFilterChange({
      search: '',
      format: 'all',
      ageRange: [6, 18],
      directions: [],
      showNeedsReview: false,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Фильтры
        </h2>
        <button
          onClick={resetFilters}
          className="text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          Сбросить
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Название, описание, направление..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Format */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Формат</label>
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Все', icon: '📋' },
            { value: 'offline', label: 'Офлайн', icon: '📍' },
            { value: 'online', label: 'Онлайн', icon: '🌐' },
          ].map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => updateFilter('format', value as FilterState['format'])}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                filters.format === value
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Age Range */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Возраст: {filters.ageRange[0]}–{filters.ageRange[1]} лет
        </label>
        <div className="flex gap-3 items-center">
          <input
            type="range"
            min="6"
            max="18"
            value={filters.ageRange[0]}
            onChange={(e) => updateFilter('ageRange', [Number(e.target.value), filters.ageRange[1]])}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <input
            type="range"
            min="6"
            max="18"
            value={filters.ageRange[1]}
            onChange={(e) => updateFilter('ageRange', [filters.ageRange[0], Number(e.target.value)])}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
      </div>

      {/* Directions */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Направления</label>
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
          {allDirections.map((dir) => (
            <button
              key={dir}
              onClick={() => toggleDirection(dir)}
              className={`px-2 py-1 text-xs font-medium rounded-md border transition-all ${
                filters.directions.includes(dir)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {dir}
            </button>
          ))}
        </div>
      </div>

      {/* Needs Review Toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showNeedsReview}
            onChange={(e) => updateFilter('showNeedsReview', e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">Показать требующие проверки</span>
        </label>
      </div>

      {/* Result Count */}
      <div className="pt-3 border-t border-gray-100">
        <p className="text-sm text-gray-600">
          Найдено: <span className="font-bold text-indigo-600">{resultCount}</span> хакатонов
        </p>
      </div>
    </div>
  );
}
