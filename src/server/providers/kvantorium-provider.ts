import type { Hackathon, HackathonProvider } from '@/entities/hackathon/model/provider';
import { toEvent } from '@/server/providers/html-provider';
import { load } from 'cheerio';

const sitemapUrl = 'https://kvantorium22.ru/sitemap-feeds.xml';
const freshnessWindowMs = 90 * 24 * 60 * 60 * 1_000;
const maxSitemaps = 20;
const maxPages = 150;
const maxResponseBytes = 2_000_000;

const monthNumbers: Record<string, number> = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
};

const competitionPattern = /хакатон|конкурс|соревнован|олимпиад/iu;
const itPattern = /программирован|разработк|информационн|цифров|робототех|инженер|web|frontend|backend|python|scratch|робот|искусственн.{0,15}интеллект|машинн.{0,15}обучен|кибербезопас|мобильн.{0,15}приложен|vr|ar|xr|it\b/iu;
const closedRegistrationPattern = /регистрац\w*\s+(?:закрыт|завершен|окончена)|при[её]м\s+заявок\s+(?:закрыт|завершен|окончен)|заявки\s+больше\s+не\s+принимаются/iu;
const openRegistrationPattern = /регистрац\w*\s+(?:уже\s+)?открыт|открыт\w*\s+регистрац|начал\w*\s+регистрац|ид[её]т\s+регистрац|при[её]м\s+заявок.{0,120}(?:до|по)|заявки\s+принимаются|подать\s+заявк\w*\s+до|успейте\s+(?:зарегистрироваться|подать\s+заявку)/iu;

interface SitemapPage {
  url: string;
  lastModified: Date;
}

function isKvantoriumUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'kvantorium22.ru';
  } catch {
    return false;
  }
}

async function fetchText(url: string) {
  if (!isKvantoriumUrl(url)) throw new Error(`Rejected non-Kvantorium URL: ${url}`);
  const response = await fetch(url, {
    headers: { Accept: 'application/xml,text/html', 'User-Agent': 'HackTeenAggregator/1.0 (event discovery)' },
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} при загрузке ${url}`);
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
    throw new Error(`Ответ превышает лимит размера: ${url}`);
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > maxResponseBytes) {
    throw new Error(`Ответ превышает лимит размера: ${url}`);
  }
  return text;
}

function parseSitemapDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function fetchRecentPages(now: Date) {
  const cutoff = new Date(now.getTime() - freshnessWindowMs);
  const pending = [sitemapUrl];
  const visited = new Set<string>();
  const pages = new Map<string, SitemapPage>();

  while (pending.length && visited.size < maxSitemaps) {
    const url = pending.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    const $ = load(await fetchText(url), { xmlMode: true });

    $('sitemapindex sitemap').each((_, sitemap) => {
      const location = $(sitemap).find('loc').first().text().trim();
      const modified = parseSitemapDate($(sitemap).find('lastmod').first().text().trim());
      if (location && modified && modified >= cutoff && isKvantoriumUrl(location)) pending.push(location);
    });

    $('urlset url').each((_, entry) => {
      const location = $(entry).find('loc').first().text().trim();
      const modified = parseSitemapDate($(entry).find('lastmod').first().text().trim());
      if (location && modified && modified >= cutoff && isKvantoriumUrl(location)
        && new URL(location).pathname.startsWith('/tpost/')) {
        pages.set(location, { url: location, lastModified: modified });
      }
    });
  }

  return [...pages.values()]
    .sort((left, right) => right.lastModified.getTime() - left.lastModified.getTime())
    .slice(0, maxPages);
}

function parseDate(day: number, month: number, year: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

function dateFromText(value: string) {
  const numeric = value.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/u);
  if (numeric) return parseDate(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]));
  const named = value.toLocaleLowerCase('ru-RU')
    .match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(20\d{2}))?\b/u);
  if (!named) return null;
  return parseDate(Number(named[1]), monthNumbers[named[2]], Number(named[3] ?? new Date().getFullYear()));
}

function eventDateFromText(text: string, now: Date) {
  const range = text.match(/\b(\d{1,2})\s*[–—-]\s*(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(20\d{2}))?\b/iu);
  if (range) {
    const month = monthNumbers[range[3].toLocaleLowerCase('ru-RU')];
    const year = Number(range[4] ?? now.getUTCFullYear());
    const startsAt = parseDate(Number(range[1]), month, year);
    const endsAt = parseDate(Number(range[2]), month, year);
    if (startsAt && endsAt && startsAt > now) return { startsAt, endsAt };
  }

  const dates = [...text.matchAll(/\b\d{1,2}[./]\d{1,2}[./]20\d{2}\b|\b\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+20\d{2})?\b/giu)];
  for (const match of dates) {
    const context = text.slice(Math.max(0, (match.index ?? 0) - 100), (match.index ?? 0) + match[0].length + 30);
    if (/регистрац|при[её]м\s+заявок|дедлайн/iu.test(context)) continue;
    const date = dateFromText(match[0]);
    if (date && date > now) return { startsAt: date, endsAt: date };
  }
  return null;
}

function registrationDeadlineFromText(text: string) {
  const match = text.match(/(?:при[её]м\s+заявок|регистрац\w*|заявки).{0,120}?(?:до|по)\s+(\d{1,2}[./]\d{1,2}[./]20\d{2}|\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+20\d{2})?)/iu);
  return match ? dateFromText(match[1]) : null;
}

async function parsePage(page: SitemapPage, now: Date): Promise<Hackathon | null> {
  try {
    const $ = load(await fetchText(page.url));
    $('script,style,noscript,svg,header,nav,footer').remove();
    const rawText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 20_000);
    const title = $('h1').first().text().replace(/\s+/g, ' ').trim()
      || $('meta[property="og:title"]').attr('content')?.trim()
      || '';
    const combinedText = `${title}. ${rawText}`;
    if (!title || !competitionPattern.test(combinedText) || !itPattern.test(combinedText)) return null;
    if (closedRegistrationPattern.test(combinedText)) return null;
    const registrationDeadline = registrationDeadlineFromText(combinedText);
    if (registrationDeadline && registrationDeadline < now) return null;
    if (!registrationDeadline && !openRegistrationPattern.test(combinedText)) return null;

    const dates = eventDateFromText(combinedText, now);
    if (!dates) return null;

    const event = toEvent({
      title,
      sourceUrl: page.url,
      sourceName: 'Кванториум.22',
      rawText,
      registrationUrl: page.url,
    });
    if (event.ageMin != null && event.ageMin > 18) return null;
    if (event.ageMin != null) event.ageMin = Math.max(6, event.ageMin);
    if (event.ageMax != null) event.ageMax = Math.min(18, event.ageMax);
    if (event.ageMin != null && event.ageMax != null && event.ageMin > event.ageMax) return null;

    event.startsAt = dates.startsAt;
    event.endsAt = dates.endsAt;
    event.registrationDeadline = registrationDeadline;
    event.location = /барнаул/iu.test(combinedText) ? 'barnaul' : event.location;
    if (event.location === 'barnaul' && !event.format) event.format = 'OFFLINE';
    event.sourceProviderKey = 'kvantorium';
    return event;
  } catch (error) {
    console.warn(`Кванториум: не удалось проверить ${page.url}: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    return null;
  }
}

export class KvantoriumProvider implements HackathonProvider {
  readonly key = 'kvantorium';
  readonly name = 'Кванториум.22 · официальный сайт';

  isConfigured() {
    return true;
  }

  async fetchEvents(): Promise<Hackathon[]> {
    const pages = await fetchRecentPages(new Date());
    const results = await Promise.all(pages.map((page) => parsePage(page, new Date())));
    const events = results.filter((event): event is Hackathon => event !== null);
    console.info(`Кванториум: проверено ${pages.length} свежих публикаций, найдено ${events.length} актуальных мероприятий.`);
    return events;
  }
}
