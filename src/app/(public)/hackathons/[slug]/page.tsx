import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, MapPin, Trophy, Users } from 'lucide-react';
import { getHackathonBySlug, getRelatedHackathons } from '@/server/services/hackathons';
import { siteConfig } from '@/shared/config/site';
import { prisma } from '@/shared/lib/prisma';
import { HackathonCard } from '@/entities/hackathon/ui/hackathon-card';

type PageProps = { params: Promise<{ slug: string }> };
const longDate = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Barnaul',
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getHackathonBySlug(slug);
  if (!event) return { title: 'Мероприятие не найдено' };
  return {
    title: event.title,
    description: event.summary,
    openGraph: { title: event.title, description: event.summary, type: 'article', images: event.logoUrl ? [event.logoUrl] : undefined },
  };
}

export default async function HackathonPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await getHackathonBySlug(slug);
  if (!event) notFound();
  if (!event.startsAt || !event.endsAt) notFound();
  const isArchived = event.endsAt < new Date();
  await prisma.hackathon.update({ where: { id: event.id }, data: { viewCount: { increment: 1 } } });

  const directions = event.directions.map(({ direction }) => direction);
  const related = await getRelatedHackathons(slug, directions.map(({ id }) => id));
  const location = [event.city?.name, event.city?.region.name ?? event.region?.name, event.country?.name].filter(Boolean).join(', ')
    || (event.format === 'ONLINE' ? 'Онлайн — из любой точки' : 'Место проведения уточняется');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationEvent',
    name: event.title,
    description: event.summary,
    startDate: event.startsAt.toISOString(),
    endDate: event.endsAt.toISOString(),
    eventAttendanceMode: event.format === 'ONLINE' ? 'https://schema.org/OnlineEventAttendanceMode' : event.format === 'HYBRID' ? 'https://schema.org/MixedEventAttendanceMode' : event.format === 'OFFLINE' ? 'https://schema.org/OfflineEventAttendanceMode' : undefined,
    eventStatus: isArchived ? 'https://schema.org/EventCompleted' : 'https://schema.org/EventScheduled',
    url: `${siteConfig.url}/hackathons/${encodeURIComponent(event.slug)}`,
    organizer: event.organizer ? { '@type': 'Organization', name: event.organizer.name, url: event.organizer.websiteUrl ?? undefined } : undefined,
    location: event.format === 'ONLINE' ? { '@type': 'VirtualLocation', url: event.registrationUrl ?? siteConfig.url } : { '@type': 'Place', name: location },
  };

  return (
    <main className="detail-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="shell">
        <Link href={isArchived ? '/archive' : '/#events'} className="back-link"><ArrowLeft size={16} />{isArchived ? ' Архив мероприятий' : ' Все мероприятия'}</Link>
        <div className="detail-layout">
          <article className="detail-main">
            <div className="detail-banner">
              <span className="detail-banner__orb detail-banner__orb--one" /><span className="detail-banner__orb detail-banner__orb--two" />
              <span className="detail-banner__logo">{event.logoUrl ? <img src={event.logoUrl} alt="" /> : event.organizer?.name.slice(0, 1) ?? 'H'}</span>
              <span className="detail-banner__label">{isArchived ? 'HackTeen · архив мероприятий' : 'HackTeen · событие для школьников'}</span>
            </div>
            <div className="detail-content">
              <div className="flex flex-wrap gap-2"><span className="age-pill">{event.ageMin != null && event.ageMax != null ? `${event.ageMin}–${event.ageMax} лет` : 'Возраст уточняется'}</span><span className="format-pill">{event.format === 'ONLINE' ? 'Онлайн' : event.format === 'HYBRID' ? 'Гибрид' : event.format === 'OFFLINE' ? 'Очно' : 'Формат уточняется'}</span>{event.priceType === 'FREE' && <span className="free-pill">Бесплатно</span>}</div>
              <h1 className="detail-title">{event.title}</h1>
              <p className="detail-summary">{event.summary}</p>
              <div className="detail-facts"><span><CalendarDays size={17} />{event.startsAt ? longDate.format(event.startsAt) : 'Дата уточняется'}{event.endsAt && event.startsAt && event.endsAt.getTime() !== event.startsAt.getTime() ? ` — ${longDate.format(event.endsAt)}` : ''}</span><span><MapPin size={17} />{location}</span><span><Users size={17} />{event.ageMin != null && event.ageMax != null ? `Участники ${event.ageMin}–${event.ageMax} лет` : 'Возраст уточняется'}</span></div>
              <section className="detail-section"><h2>О мероприятии</h2><p className="whitespace-pre-line">{event.description}</p></section>
              {event.requirements && <section className="detail-section"><h2>Требования к участникам</h2><p className="whitespace-pre-line">{event.requirements}</p></section>}
              {!!directions.length && <section className="detail-section"><h2>Направления</h2><div className="mt-4 flex flex-wrap gap-2">{directions.map(({ id, name, slug }) => <Link className="tag" href={`/?direction=${slug}#events`} key={id}>{name}</Link>)}</div></section>}
              {!!event.tags.length && <section className="detail-section"><h2>Теги</h2><div className="mt-4 flex flex-wrap gap-2">{event.tags.map(({ tag }) => <span className="tag tag--muted" key={tag.id}>{tag.name}</span>)}</div></section>}
              {event.sources.length > 0 && <p className="source-note">Источник: <a href={event.sources[0].sourceUrl} target="_blank" rel="noopener noreferrer">{event.sources[0].source.name} <ArrowUpRight size={13} /></a></p>}
            </div>
          </article>
          <aside className="detail-aside">
            <div className="register-card">
              <p className="eyebrow">{isArchived ? 'Архивное событие' : 'Успей зарегистрироваться'}</p>
              <h2>{isArchived ? 'Мероприятие завершено' : event.registrationDeadline ? `До ${longDate.format(event.registrationDeadline)}` : 'Регистрация открыта'}</h2>
              <p>{isArchived ? 'Сохранили информацию о мероприятии для истории и поиска похожих возможностей.' : 'Проверь подробности и условия на странице организатора.'}</p>
              {!isArchived && (event.registrationUrl ? <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" className="button button--primary w-full">Перейти к регистрации <ArrowUpRight size={16} /></a> : <span className="button button--disabled w-full">Ссылка скоро появится</span>)}
              <div className="register-card__divider" />
              <div className="organizer-info"><span className="organizer-mark">{event.organizer?.name.slice(0, 1) ?? 'H'}</span><div><span className="text-xs text-slate-500">Организатор</span><strong>{event.organizer?.name ?? 'Не указан'}</strong></div></div>
              {event.prizeDescription && <div className="register-note"><Trophy size={17} /><span>{event.prizeDescription}</span></div>}
              {event.registrationDeadline && <div className="register-note"><Clock3 size={17} /><span>Регистрация до {longDate.format(event.registrationDeadline)}</span></div>}
            </div>
          </aside>
        </div>
        {!!related.length && <section className="related-section"><div className="section-heading"><div><p className="eyebrow">Тебе также может понравиться</p><h2>Похожие мероприятия</h2></div></div><div className="event-grid">{related.map((item) => <HackathonCard key={item.id} hackathon={item} />)}</div></section>}
      </div>
    </main>
  );
}
