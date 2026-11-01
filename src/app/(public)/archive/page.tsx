import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Archive, CalendarDays } from 'lucide-react';
import { HackathonCard } from '@/entities/hackathon/ui/hackathon-card';
import { listArchivedHackathons } from '@/server/services/hackathons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Архив мероприятий',
  description: 'Прошедшие хакатоны и IT-конкурсы для школьников, найденные HackTeen.',
};

export default async function ArchivePage() {
  const events = await listArchivedHackathons();
  const groupedEvents = events.reduce<Record<string, typeof events>>((groups, event) => {
    const year = String(event.startsAt!.getFullYear());
    (groups[year] ??= []).push(event);
    return groups;
  }, {});
  const years = Object.keys(groupedEvents).sort((a, b) => Number(b) - Number(a));

  return (
    <main className="archive-page">
      <div className="shell">
        <Link href="/#events" className="back-link"><ArrowLeft size={16} /> Актуальные мероприятия</Link>
        <div className="section-heading archive-heading">
          <div>
            <p className="eyebrow"><Archive size={14} /> История HackTeen</p>
            <h1>Архив мероприятий</h1>
            <p className="archive-description">Прошедшие хакатоны и IT-конкурсы для школьников за 2025–2026 годы.</p>
          </div>
          <div className="event-count"><span>{events.length}</span> событий в архиве</div>
        </div>
        {events.length ? years.map((year) => (
          <section className="archive-year" key={year}>
            <div className="section-heading">
              <div><p className="eyebrow"><CalendarDays size={14} /> История событий</p><h2>{year}</h2></div>
              <span className="event-count">{groupedEvents[year].length} мероприятий</span>
            </div>
            <div className="event-grid">
              {groupedEvents[year].map((hackathon) => <HackathonCard key={hackathon.id} hackathon={hackathon} />)}
            </div>
          </section>
        )) : (
          <div className="empty-state archive-empty">
            <span className="empty-state__icon"><Archive size={28} /></span>
            <h2>Архив пока пуст</h2>
            <p>Подходящие завершившиеся мероприятия появятся здесь после первичного поиска.</p>
          </div>
        )}
      </div>
    </main>
  );
}
