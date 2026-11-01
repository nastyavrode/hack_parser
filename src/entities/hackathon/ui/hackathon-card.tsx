import Link from 'next/link';
import { ArrowUpRight, CalendarDays, MapPin, Trophy } from 'lucide-react';
import type { listCurrentHackathons } from '@/server/services/hackathons';

type Hackathon = Awaited<ReturnType<typeof listCurrentHackathons>>[number];

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Barnaul',
});

export function HackathonCard({ hackathon }: { hackathon: Hackathon }) {
  const directions = hackathon.directions.map(({ direction }) => direction.name);

  return (
    <article className="event-card group">
      <div className="event-card__topline">
        <div className="organizer-mark">{hackathon.logoUrl ? <img src={hackathon.logoUrl} alt="" /> : hackathon.organizer?.name.slice(0, 1) ?? 'H'}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{hackathon.organizer?.name ?? 'Организатор'}</p>
          <p className="text-xs text-slate-500">{hackathon.format === 'ONLINE' ? 'Онлайн' : hackathon.format === 'HYBRID' ? 'Гибрид' : hackathon.format === 'OFFLINE' ? 'Очно' : 'Формат уточняется'}</p>
        </div>
        <Link href={`/hackathons/${hackathon.slug}`} prefetch={false} className="icon-link ml-auto" aria-label={`Подробнее: ${hackathon.title}`}>
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <Link href={`/hackathons/${hackathon.slug}`} prefetch={false} className="block">
        <h3 className="event-card__title">{hackathon.title}</h3>
        <p className="event-card__summary">{hackathon.summary}</p>
      </Link>
      <div className="mt-5 flex flex-wrap gap-2">
        {directions.slice(0, 3).map((direction) => <span className="tag" key={direction}>{direction}</span>)}
        {directions.length > 3 && <span className="tag tag--muted">+{directions.length - 3}</span>}
      </div>
      <div className="event-card__meta">
        <span><CalendarDays size={15} />{hackathon.startsAt ? dateFormatter.format(hackathon.startsAt) : 'Дата уточняется'}{hackathon.endsAt && hackathon.startsAt && dateFormatter.format(hackathon.endsAt) !== dateFormatter.format(hackathon.startsAt) ? ` — ${dateFormatter.format(hackathon.endsAt)}` : ''}</span>
        <span><MapPin size={15} />{hackathon.city?.name ?? hackathon.region?.name ?? (hackathon.format === 'ONLINE' ? 'Из любой точки' : 'Место уточняется')}</span>
        {hackathon.registrationDeadline && <span><CalendarDays size={15} />До {dateFormatter.format(hackathon.registrationDeadline)}</span>}
        {hackathon.prizeDescription && <span title={hackathon.prizeDescription}><Trophy size={15} />{hackathon.prizeDescription}</span>}
      </div>
      <div className="event-card__bottom">
        <span className="age-pill">{hackathon.ageMin != null && hackathon.ageMax != null ? `${hackathon.ageMin}–${hackathon.ageMax} лет` : 'Возраст уточняется'}</span>
        {hackathon.priceType === 'FREE' && <span className="free-pill">Бесплатно</span>}
        {hackathon.priceType === 'PAID' && <span className="paid-pill">Платно</span>}
        <Link href={`/hackathons/${hackathon.slug}`} prefetch={false} className="text-link ml-auto">Подробнее <ArrowUpRight size={14} /></Link>
      </div>
    </article>
  );
}
