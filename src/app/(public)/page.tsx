import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Code2, Compass, MapPin, Search, Sparkles } from 'lucide-react';
import { HackathonCard } from '@/entities/hackathon/ui/hackathon-card';
import { parseHackathonFilters } from '@/entities/hackathon/model/filters';
import { directionCatalog } from '@/entities/direction/model/directions';
import { listCurrentHackathons } from '@/server/services/hackathons';

export const dynamic = 'force-dynamic';

type HomeProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function toSearchParams(params: Record<string, string | string[] | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') searchParams.set(key, value);
  }
  return searchParams;
}

const categoryIcons = ['✳', '⌘', '◈', '▧', '◉', '✦', '↗', '⬡'];

export default async function HomePage({ searchParams }: HomeProps) {
  const filters = parseHackathonFilters(toSearchParams(await searchParams));
  const [results, recent] = await Promise.all([
    listCurrentHackathons(filters),
    listCurrentHackathons({ ...filters, q: '', direction: undefined, age: undefined, region: undefined, format: undefined, price: undefined, date: undefined, sort: 'newest' }, 4),
  ]);
  const featuredDirections = directionCatalog.filter(({ slug }) =>
    ['web-development', 'python', 'ai-machine-learning', 'game-development', 'robotics', 'ui-ux-design', 'mobile-development', 'cybersecurity'].includes(slug),
  );
  const hasFilters = Object.entries(filters).some(([key, value]) => key !== 'sort' && value);

  return (
    <main>
      <section className="hero">
        <div className="hero__glow hero__glow--one" />
        <div className="hero__glow hero__glow--two" />
        <div className="shell hero__content">
          <div className="hero__eyebrow"><span className="live-dot" />Твоя точка входа в IT</div>
          <h1>Найди свой следующий<br /><span>хакатон</span><i className="hero__spark">✳</i></h1>
          <p className="hero__subtitle">Актуальные IT-соревнования для школьников.<br className="hidden sm:block" /> От первой идеи до проекта, которым можно гордиться.</p>
          <form action="/" className="hero-search">
            <Search size={21} className="shrink-0 text-slate-400" />
            <input name="q" defaultValue={filters.q} type="search" placeholder="Например, Python, робототехника, дизайн..." aria-label="Поиск мероприятий" />
            <button type="submit" className="button button--primary">Найти хакатон <ArrowRight size={16} /></button>
          </form>
          <div className="hero__quick-links">
            <span>Популярное:</span>
            {['Python', 'Игры', 'Робототехника', 'Дизайн'].map((label, index) => {
              const slugs = ['python', 'game-development', 'robotics', 'ui-ux-design'];
              return <Link key={label} href={`/?direction=${slugs[index]}#events`}>{label}</Link>;
            })}
          </div>
          <a href="#events" className="hero__scroll"><span>Исследовать события</span><ArrowDown size={16} /></a>
        </div>
        <div className="hero__orbit hero__orbit--one"><Code2 size={26} /></div>
        <div className="hero__orbit hero__orbit--two"><Sparkles size={24} /></div>
        <div className="hero__orbit hero__orbit--three">01</div>
      </section>

      <section id="directions" className="shell section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Найди свой трек</p><h2>Что тебе интересно?</h2></div>
          <Link className="text-link" href="/#events">Все направления <ArrowUpRight size={15} /></Link>
        </div>
        <div className="category-grid">
          {featuredDirections.map(({ slug, name }, index) => (
            <Link href={`/?direction=${slug}#events`} key={slug} className="category-card">
              <span className={`category-icon category-icon--${index % 4}`}>{categoryIcons[index]}</span>
              <span className="category-card__label">{name}</span>
              <ArrowUpRight className="category-arrow" size={16} />
            </Link>
          ))}
        </div>
      </section>

      <section id="events" className="events-section">
        <div className="shell section-block">
          <div className="section-heading section-heading--events">
            <div><p className="eyebrow"><span className="live-dot" />Подобрали для тебя</p><h2>{hasFilters ? 'Результаты поиска' : 'Ближайшие события'}</h2></div>
            <div className="event-count"><span>{results.length}</span> событий найдено</div>
          </div>
          <form action="/#events" className="filters-bar">
            <label className="filter-search"><Search size={16} /><input type="search" name="q" defaultValue={filters.q} placeholder="Поиск мероприятий" /></label>
            <select name="age" defaultValue={filters.age ?? ''} aria-label="Возраст"><option value="">Любой возраст</option><option value="6-10">6–10 лет</option><option value="11-13">11–13 лет</option><option value="14-16">14–16 лет</option><option value="17-18">17–18 лет</option></select>
            <select name="direction" defaultValue={filters.direction ?? ''} aria-label="Направление"><option value="">Любое направление</option>{directionCatalog.map(({ slug, name }) => <option value={slug} key={slug}>{name}</option>)}</select>
            <select name="format" defaultValue={filters.format ?? ''} aria-label="Формат"><option value="">Любой формат</option><option value="ONLINE">Онлайн</option><option value="OFFLINE">Очно</option><option value="HYBRID">Гибрид</option></select>
            <select name="region" defaultValue={filters.region ?? ''} aria-label="Регион"><option value="">Вся Россия и мир</option><option value="barnaul">Барнаул</option><option value="altai">Алтайский край</option><option value="russia">Россия</option><option value="international">Международные</option></select>
            <select name="price" defaultValue={filters.price ?? ''} aria-label="Стоимость"><option value="">Любая стоимость</option><option value="FREE">Бесплатно</option><option value="PAID">Платно</option></select>
            <select name="date" defaultValue={filters.date ?? ''} aria-label="Дата"><option value="">Любая дата</option><option value="upcoming">Предстоящие</option><option value="month">В течение месяца</option></select>
            <select name="sort" defaultValue={filters.sort} aria-label="Сортировка"><option value="date">Сначала ближайшие</option><option value="deadline">Дедлайн регистрации</option><option value="popular">Популярные</option><option value="newest">Недавно добавлены</option></select>
            <button className="filter-submit" type="submit"><ChevronDown size={15} /> Применить</button>
          </form>
          {results.length ? (
            <div className="event-grid">{results.map((hackathon) => <HackathonCard key={hackathon.id} hackathon={hackathon} />)}</div>
          ) : (
            <div className="empty-state"><span className="empty-state__icon"><Compass size={28} /></span><h3>Пока нет подходящих событий</h3><p>Попробуй изменить фильтры или подпишись — мы сообщим, когда появится новое соревнование.</p><Link className="button button--primary" href="/subscribe">Получать уведомления <ArrowRight size={16} /></Link></div>
          )}
        </div>
      </section>

      <section className="shell section-block section-block--compact">
        <div className="promo-card">
          <div className="promo-card__content"><p className="eyebrow">Не пропусти свой шанс</p><h2>Новые возможности<br />приходят первыми</h2><p>Выбери возраст и интересы — пришлём письмо, когда найдём подходящий хакатон.</p><Link href="/subscribe" className="button button--white">Настроить уведомления <ArrowRight size={16} /></Link></div>
          <div className="promo-card__art" aria-hidden="true"><div className="promo-ring promo-ring--outer" /><div className="promo-ring promo-ring--inner" /><span><Sparkles size={34} /></span><b>ТВОЙ<br />СЛЕДУЮЩИЙ<br />ШАГ</b></div>
        </div>
      </section>

      <section className="shell section-block section-block--compact">
        <div className="section-heading"><div><p className="eyebrow">Добавлены недавно</p><h2>Свежие возможности</h2></div><Link className="text-link" href="/?sort=newest#events">Смотреть все <ArrowUpRight size={15} /></Link></div>
        {recent.length ? <div className="event-grid">{recent.map((hackathon) => <HackathonCard key={hackathon.id} hackathon={hackathon} />)}</div> : (
          <div className="recent-empty"><CalendarDays size={18} /><span>Мероприятия появятся здесь после проверки организаторами.</span><MapPin size={16} className="ml-auto hidden sm:block" /> <span className="hidden text-slate-500 sm:block">Барнаул · Алтайский край · Онлайн</span></div>
        )}
      </section>
    </main>
  );
}
