import { Hackathon } from '../types';

interface HackathonCardProps {
  hackathon: Hackathon;
}

export default function HackathonCard({ hackathon }: HackathonCardProps) {
  const formatLabel = hackathon.format === 'offline' ? '📍 Офлайн' : '🌐 Онлайн';
  const formatColor = hackathon.format === 'offline' 
    ? 'bg-blue-100 text-blue-800 border-blue-200' 
    : 'bg-green-100 text-green-800 border-green-200';

  return (
    <div className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 border-l-4 ${
      hackathon.needs_review ? 'border-l-yellow-500' : 'border-l-indigo-500'
    } overflow-hidden`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold text-gray-900 leading-tight">
            {hackathon.title}
          </h3>
          {hackathon.needs_review && (
            <span className="shrink-0 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
              ⚠️ Проверка
            </span>
          )}
        </div>

        {/* Source & Format */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
            {hackathon.source_name}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${formatColor}`}>
            {formatLabel}
          </span>
          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
            {hackathon.age_min > 0 ? `${hackathon.age_min}–${hackathon.age_max} лет` : 'Возраст не указан'}
          </span>
        </div>

        {/* Location */}
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">📍 {hackathon.location}</span>
        </p>

        {/* Description */}
        <p className="text-sm text-gray-700 mb-4 line-clamp-3">
          {hackathon.description}
        </p>

        {/* Directions */}
        {hackathon.directions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {hackathon.directions.map((dir: string) => (
              <span
                key={dir}
                className="px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100"
              >
                {dir}
              </span>
            ))}
          </div>
        )}

        {/* Dates & Deadline */}
        <div className="flex flex-col sm:flex-row gap-2 text-sm border-t pt-3 border-gray-100">
          <div className="flex items-center gap-1.5 text-gray-600">
            <span>📅</span>
            <span>{hackathon.event_dates || 'Дата не указана'}</span>
          </div>
          {hackathon.registration_deadline && (
            <div className="flex items-center gap-1.5 text-red-600 font-medium">
              <span>⏰</span>
              <span>Регистрация до: {hackathon.registration_deadline}</span>
            </div>
          )}
        </div>

        {/* Source Link */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <a
            href={hackathon.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
          >
            Источник
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
