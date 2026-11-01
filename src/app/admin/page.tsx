import { ShieldCheck } from 'lucide-react';
import { isGithubAuthConfigured } from '@/server/auth';
import { getCurrentRole } from '@/server/auth/require-role';
import { prisma } from '@/shared/lib/prisma';
import { ModerationActions } from '@/features/admin-hackathon/ui/moderation-actions';
import { HackathonCreateForm } from '@/features/admin-hackathon/ui/hackathon-create-form';
import { HackathonEditForm } from '@/features/admin-hackathon/ui/hackathon-edit-form';
import { GithubSignInButton } from '@/features/admin-hackathon/ui/github-sign-in-button';

export const dynamic = 'force-dynamic';

function getParserRunPresentation(run: {
  status: string;
  foundCount: number;
  savedCount: number;
}) {
  if (run.status === 'SUCCEEDED' && run.foundCount === 0) {
    return { label: 'Совпадений нет', className: 'partial', count: 'Подходящих кандидатов не найдено' };
  }
  if (run.status === 'SUCCEEDED' && run.foundCount > 0 && run.savedCount === 0) {
    return { label: 'Уже добавлены', className: 'succeeded', count: `Все ${run.foundCount} подходящих кандидатов уже были в каталоге` };
  }
  const label = run.status === 'SUCCEEDED' ? 'Поиск завершён'
    : run.status === 'PARTIAL' ? 'Частично'
      : run.status === 'RUNNING' ? 'Выполняется' : 'Ошибка';
  return {
    label,
    className: run.status.toLowerCase(),
    count: `${run.savedCount} новых из ${run.foundCount} подходящих`,
  };
}

export default async function AdminPage() {
  const role = await getCurrentRole();
  const githubConfigured = isGithubAuthConfigured();
  if (!role || !['admin', 'moderator'].includes(role)) {
    return <main className="admin-page"><div className="shell"><div className="admin-locked"><ShieldCheck size={30} /><h1>Панель модерации</h1>{githubConfigured ? <><p>Войдите через GitHub с аккаунтом, которому назначена роль администратора или модератора.</p><GithubSignInButton /></> : <><p>GitHub OAuth ещё не настроен. Добавьте AUTH_GITHUB_ID и AUTH_GITHUB_SECRET в .env, затем перезапустите контейнеры.</p><code>AUTH_GITHUB_ID=...<br />AUTH_GITHUB_SECRET=...</code></>}</div></div></main>;
  }
  const events = await prisma.hackathon.findMany({
    where: { status: { in: ['PENDING', 'PUBLISHED'] } },
    include: {
      organizer: true,
      city: true,
      region: true,
      country: true,
      directions: { include: { direction: true } },
      sources: { include: { source: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });
  const parserRuns = await prisma.parserRun.findMany({
    include: { source: true },
    orderBy: { startedAt: 'desc' },
    take: 12,
  });
  return (
    <main className="admin-page"><div className="shell">
      <div className="admin-heading"><div><p className="eyebrow">Для команды HackTeen</p><h1>Модерация событий</h1><p>Публикуй проверенные события и следи за новыми заявками.</p></div><span className="role-pill">{role === 'admin' ? 'Администратор' : 'Модератор'}</span></div>
      <section className="parser-status"><div className="flex items-center justify-between gap-3"><h2 className="admin-section-title">Автоматический поиск</h2><span className="text-[10px] text-slate-500">Каждый день · {String(Number(process.env.PARSER_RUN_HOUR ?? 6)).padStart(2, '0')}:{String(Number(process.env.PARSER_RUN_MINUTE ?? 0)).padStart(2, '0')}, {process.env.PARSER_TIMEZONE ?? 'Asia/Barnaul'}</span></div>
        {parserRuns.length ? <div className="parser-runs">{parserRuns.map((run) => {
          const presentation = getParserRunPresentation(run);
          return <div className="parser-run" key={run.id}><span className={`status-pill status-pill--${presentation.className}`}>{presentation.label}</span><strong>{run.source.name}</strong><span>{presentation.count}</span><time dateTime={run.startedAt.toISOString()}>{run.startedAt.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Barnaul' })}</time>{run.error && <details className="parser-run__error"><summary>Ошибка</summary><pre>{run.error}</pre></details>}</div>;
        })}</div> : <p className="parser-status__empty">Ожидаем первый запуск парсера. Он стартует вместе с Docker-сервисом parser. Проверь YANDEX_SEARCH_API_KEY и YANDEX_CLOUD_FOLDER_ID в .env.</p>}
      </section>
      <div className="admin-layout">
        <section><h2 className="admin-section-title">Мероприятия <span>{events.length}</span></h2>
          {events.length ? <div className="admin-events">{events.map((event) => <article className="admin-event" key={event.id}>
            <div className="flex items-start justify-between gap-4"><div><span className={`status-pill status-pill--${event.status.toLowerCase()}`}>{event.status === 'PENDING' ? 'На проверке' : 'Опубликовано'}</span><h3>{event.title}</h3><p>{event.organizer?.name ?? 'Организатор не указан'} · {event.ageMin != null && event.ageMax != null ? `${event.ageMin}–${event.ageMax} лет` : 'Возраст уточняется'} · {event.directions.map(({ direction }) => direction.name).join(', ') || 'Нет направления'}</p><HackathonEditForm event={{
              id: event.id, slug: event.slug, title: event.title, summary: event.summary, description: event.description,
              ageMin: event.ageMin, ageMax: event.ageMax, startsAt: event.startsAt?.toISOString() ?? null, endsAt: event.endsAt?.toISOString() ?? null,
              registrationDeadline: event.registrationDeadline?.toISOString() ?? null, registrationUrl: event.registrationUrl,
              logoUrl: event.logoUrl, prizeDescription: event.prizeDescription, organizerName: event.organizer?.name ?? null,
              format: event.format, priceType: event.priceType, location: event.city ? 'barnaul' : event.region ? 'altai' : event.country?.code === 'RU' ? 'russia' : event.country ? 'international' : event.format === 'ONLINE' ? 'global' : 'international',
              directionSlugs: event.directions.map(({ direction }) => direction.slug),
            }} /></div><ModerationActions id={event.id} status={event.status} /></div>
            {event.sources.length > 0 && <details className="source-excerpt"><summary>Источник: {event.sources[0].source.name}</summary><a href={event.sources[0].sourceUrl} target="_blank" rel="noopener noreferrer">{event.sources[0].sourceUrl}</a><p>{event.sources[0].rawText ?? 'Исходный текст не сохранён.'}</p></details>}
          </article>)}</div> : <div className="admin-empty">Пока нет мероприятий. Добавь первое справа.</div>}
        </section>
        <aside><HackathonCreateForm /></aside>
      </div>
    </div></main>
  );
}
