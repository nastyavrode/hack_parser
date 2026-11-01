import type { Hackathon, HackathonProvider } from '@/entities/hackathon/model/provider';
import { toEvent } from '@/server/providers/html-provider';
import { load } from 'cheerio';
import { ParserRunStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

const FRESHNESS_DAYS = 90;
const MAX_PAGE_BYTES = 1_000_000;
const approvedDomains = [
  'kvantorium22.ru',
  'itcube22.ru',
  'altstu.ru',
  'asu.ru',
  'altspu.ru',
  'xn--80aa3anexr8c.xn--p1acf',
  'vk.com',
  'vk.ru',
  't.me',
  'timepad.ru',
  'leader-id.ru',
  'allcups.ru',
] as const;

const searchQueries = [
  'site:kvantorium22.ru (хакатон | конкурс | олимпиада | соревнование) ("регистрация открыта" | "прием заявок" | "приём заявок" | "заявки принимаются")',
  'site:itcube22.ru (хакатон | конкурс | олимпиада | соревнование) ("регистрация открыта" | "прием заявок" | "приём заявок" | "заявки принимаются")',
  'site:altstu.ru (школьники | школьников | дети) (хакатон | конкурс | олимпиада | соревнование) ("регистрация открыта" | "прием заявок" | "приём заявок")',
  'site:asu.ru (школьники | школьников | дети) (хакатон | конкурс | олимпиада | соревнование) ("регистрация открыта" | "прием заявок" | "приём заявок")',
  'site:altspu.ru (школьники | школьников | дети) (хакатон | конкурс | олимпиада | соревнование) ("регистрация открыта" | "прием заявок" | "приём заявок")',
  'site:xn--80aa3anexr8c.xn--p1acf (Алтай | Барнаул | школьники) (конкурс | хакатон | олимпиада) ("регистрация открыта" | "прием заявок" | "приём заявок")',
  'site:vk.com (Барнаул | Алтай) (школьники | школьников) (хакатон | конкурс | олимпиада) ("регистрация открыта" | "прием заявок" | "приём заявок")',
  'site:vk.ru (Барнаул | Алтай) (школьники | школьников) (хакатон | конкурс | олимпиада) ("регистрация открыта" | "прием заявок" | "приём заявок")',
  'site:t.me (Барнаул | Алтай) (школьники | школьников) (хакатон | конкурс | олимпиада) ("регистрация открыта" | "прием заявок" | "приём заявок")',
  'site:timepad.ru (Барнаул | онлайн) (школьники | школьников) (хакатон | конкурс | олимпиада) ("регистрация открыта" | "прием заявок" | "приём заявок")',
  'site:leader-id.ru (школьники | школьников) (хакатон | конкурс | олимпиада) ("регистрация открыта" | "прием заявок" | "приём заявок")',
  'site:allcups.ru (школьники | школьников) (хакатон | конкурс | олимпиада) ("регистрация открыта" | "прием заявок" | "приём заявок")',
] as const;

const archiveSearchQueries = [
  'site:kvantorium22.ru (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026) (школьники | школьников | дети | подростки | учащиеся)',
  'site:itcube22.ru (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026) (школьники | школьников | дети | подростки | учащиеся)',
  'site:altstu.ru (школьники | школьников | дети | подростки) (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026) (программирование | IT | цифровой | робототехника)',
  'site:asu.ru (школьники | школьников | дети | подростки) (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026) (программирование | IT | цифровой | робототехника)',
  'site:altspu.ru (школьники | школьников | дети | подростки) (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026) (программирование | IT | цифровой | робототехника)',
  'site:xn--80aa3anexr8c.xn--p1acf (Алтай | Барнаул) (школьники | школьников | дети | подростки) (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026)',
  'site:vk.ru (Барнаул | Алтай) (школьники | школьников | дети | подростки) (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026)',
  'site:vk.com (Барнаул | Алтай) (школьники | школьников | дети | подростки) (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026)',
  'site:t.me (Барнаул | Алтай) (школьники | школьников | дети | подростки) (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026)',
  'site:timepad.ru (Барнаул | онлайн) (школьники | школьников | дети | подростки) (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026)',
  'site:leader-id.ru (школьники | школьников | дети | подростки) (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026)',
  'site:allcups.ru (школьники | школьников | дети | подростки) (хакатон | конкурс | олимпиада | соревнование) (2025 | 2026)',
] as const;

const positiveRegistration = /регистрац\w*\s+(?:уже\s+)?открыт|открыт\w*\s+регистрац|начал\w*\s+регистрац|ид[её]т\s+регистрац|при[её]м\s+заявок\s+(?:открыт|до|продл[её]н)|при[её]м\s+заявок.{0,80}(?:до|по)(?:\s|$|[.,])|заявки\s+принимаются|ид[её]т\s+набор\s+(?:участник|команд)|подать\s+заявк\w*\s+до|успейте\s+(?:зарегистрироваться|подать\s+заявку)|регистрация\s+до|registration\s+(?:is\s+)?open|applications?\s+(?:are\s+)?open|apply\s+now/i;
const closedRegistration = /регистрац\w*\s+(?:закрыт|завершен|окончена)|при[её]м\s+заявок\s+(?:закрыт|завершен|окончен)|заявки\s+больше\s+не\s+принимаются|registration\s+(?:is\s+)?closed|applications?\s+(?:are\s+)?closed/i;
const eventDatePattern = /\b(?:20\d{2}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[./]\d{1,2}[./]20\d{2}|\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+20\d{2})?)(?=$|[\s,.])/giu;

interface YandexSearchResponse {
  rawData?: string;
}

interface YandexSearchError {
  message?: string;
  code?: number;
  details?: Array<{ message?: string }>;
}

interface StructuredEvent {
  startDate?: string;
  endDate?: string;
  offers?: { validThrough?: string } | Array<{ validThrough?: string }>;
}

function isApprovedDomain(hostname: string) {
  return approvedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function toValidDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateFromText(value: string, now = new Date()) {
  const iso = value.match(/\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\b/);
  const numeric = value.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
  const russianMonthNames: Record<string, number> = {
    января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
    июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
  };
  const russian = value.toLocaleLowerCase('ru-RU').match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(20\d{2}))?(?=$|[\s,.])/u);

  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    [, year, month, day] = iso.map(Number) as [number, number, number, number];
  } else if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    year = Number(numeric[3]);
  } else if (russian) {
    day = Number(russian[1]);
    month = russianMonthNames[russian[2]];
    year = russian[3] ? Number(russian[3]) : now.getFullYear();
    if (!russian[3]) {
      const tentative = new Date(year, month - 1, day, 23, 59, 59);
      if (tentative < now && now.getMonth() >= 10 && month <= 3) year += 1;
    }
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function dateRangeFromText(value: string, now = new Date()) {
  const monthNumbers: Record<string, number> = {
    января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
    июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
  };
  const match = value.toLocaleLowerCase('ru-RU').match(/\b(\d{1,2})\s*[–—-]\s*(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(20\d{2}))?(?=$|[\s,.])/u);
  if (!match) return null;
  const month = monthNumbers[match[3]];
  let year = Number(match[4] ?? now.getFullYear());
  let startsAt = new Date(year, month - 1, Number(match[1]));
  let endsAt = new Date(year, month - 1, Number(match[2]));
  if (!match[4] && endsAt < now && now.getMonth() >= 10 && month <= 3) {
    year += 1;
    startsAt = new Date(year, month - 1, Number(match[1]));
    endsAt = new Date(year, month - 1, Number(match[2]));
  }
  if (startsAt.getMonth() !== month - 1 || endsAt.getMonth() !== month - 1
    || startsAt.getDate() !== Number(match[1]) || endsAt.getDate() !== Number(match[2])) return null;
  return { startsAt, endsAt };
}

function socialDateFromText(value: string, now = new Date()) {
  const monthNumbers: Record<string, number> = {
    янв: 1, фев: 2, мар: 3, апр: 4, май: 5, июн: 6,
    июл: 7, авг: 8, сен: 9, окт: 10, ноя: 11, дек: 12,
  };
  const match = value.toLocaleLowerCase('ru-RU').match(/\b(\d{1,2})\s+(янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)(?:[а-я]*)?(?:\s+(20\d{2}))?(?=$|[\s,.])/u);
  if (!match) return null;
  const day = Number(match[1]);
  const month = monthNumbers[match[2]];
  let year = Number(match[3] ?? now.getFullYear());
  let date = new Date(year, month - 1, day);
  if (!match[3] && date > now) {
    year -= 1;
    date = new Date(year, month - 1, day);
  }
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function collectStructuredData($: ReturnType<typeof load>, hostname: string) {
  const structuredEvents: StructuredEvent[] = [];
  let publishedAt: Date | null = null;
  const visited = new Set<object>();

  function visit(value: unknown) {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;
    const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
    if (types.some((type) => typeof type === 'string' && /event$/i.test(type))) {
      structuredEvents.push({
        startDate: typeof record.startDate === 'string' ? record.startDate : undefined,
        endDate: typeof record.endDate === 'string' ? record.endDate : undefined,
        offers: record.offers as StructuredEvent['offers'],
      });
    }
    if (!publishedAt) {
      const dateValue = record.datePublished ?? record.dateCreated;
      if (typeof dateValue === 'string') publishedAt = toValidDate(dateValue);
    }
    Object.values(record).forEach(visit);
  }

  $('script[type="application/ld+json"]').each((_, script) => {
    const text = $(script).text().trim();
    if (!text) return;
    try {
      visit(JSON.parse(text));
    } catch (error) {
      console.warn('Yandex Search API: ignored invalid JSON-LD publication metadata', error);
    }
  });

  const metaPublishedAt = $('meta[property="article:published_time"], meta[name="datePublished"], meta[name="pubdate"], meta[name="date"], meta[name="DC.date.issued"], meta[itemprop="datePublished"], meta[itemprop="dateCreated"], time[itemprop="datePublished"], time[itemprop="dateCreated"]')
    .map((_, element) => $(element).attr('content') ?? $(element).attr('datetime'))
    .get()
    .map((value) => toValidDate(value))
    .find((value): value is Date => value !== null);
  const socialPostDate = hostname === 't.me' || hostname.endsWith('.t.me')
    || ['vk.com', 'vk.ru'].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    ? toValidDate($('time[datetime]').first().attr('datetime'))
    : null;
  const vkPostDate = ['vk.com', 'vk.ru'].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    ? socialDateFromText($('[data-testid="post_date_block_preview"], .PostDateBlock__root a').first().text())
    : null;

  return {
    structuredEvents,
    publishedAt: publishedAt ?? metaPublishedAt ?? socialPostDate ?? vkPostDate ?? null,
  };
}

function extractRegistrationDeadline(text: string) {
  for (const match of text.matchAll(eventDatePattern)) {
    const dateText = match[0];
    const start = Math.max(0, (match.index ?? 0) - 90);
    const end = Math.min(text.length, (match.index ?? 0) + dateText.length + 20);
    const context = text.slice(start, end);
    if (!/(регистрац|при[её]м\s+заявок|заявки).{0,90}(до|по|дедлайн)|(?:до|по|дедлайн).{0,90}(регистрац|при[её]м\s+заявок|заявки)/i.test(context)) continue;
    const date = dateFromText(dateText);
    if (date) return date;
  }
  return null;
}

async function fetchRenderedPage(url: string) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'ru-RU',
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.locator('body').waitFor({ timeout: 8_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function fetchEventPage(url: string) {
  let currentUrl = new URL(url);
  if (currentUrl.protocol !== 'https:' || !isApprovedDomain(currentUrl.hostname)) return null;

  try {
    let response: Response;
    for (let redirects = 0; ; redirects += 1) {
      response = await fetch(currentUrl, {
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'HackTeenAggregator/1.0 (event discovery)' },
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location || redirects >= 4) return null;
      currentUrl = new URL(location, currentUrl);
      if (currentUrl.protocol !== 'https:' || !isApprovedDomain(currentUrl.hostname)) return null;
    }
    if (!response.ok) return null;
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_PAGE_BYTES) return null;
    let html = await response.text();
    if (Buffer.byteLength(html, 'utf8') > MAX_PAGE_BYTES) return null;
    let $ = load(html);
    let structured = collectStructuredData($, currentUrl.hostname);
    if (['vk.com', 'vk.ru'].some((domain) => currentUrl.hostname === domain || currentUrl.hostname.endsWith(`.${domain}`))
      && !process.env.HACKTEEN_SERVERLESS
      && (!structured.publishedAt || /браузер устарел/i.test($('body').text()))) {
      html = await fetchRenderedPage(currentUrl.toString());
      if (Buffer.byteLength(html, 'utf8') > MAX_PAGE_BYTES) return null;
      $ = load(html);
      structured = collectStructuredData($, currentUrl.hostname);
    }
    const pageText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 20_000);
    return { pageText, ...structured };
  } catch (error) {
    console.warn(`Yandex Search API: could not verify source page ${currentUrl.hostname}: ${error instanceof Error ? error.message : 'unknown error'}`);
    return null;
  }
}

function eventDateFromStructuredData(events: StructuredEvent[], rawText: string, archive = false) {
  const now = new Date();
  const isMatchingPeriod = (startsAt: Date, endsAt: Date) => archive
    ? startsAt >= new Date('2025-01-01T00:00:00+07:00')
      && startsAt < new Date('2027-01-01T00:00:00+07:00')
      && endsAt < now
    : startsAt > now && endsAt >= now;
  for (const event of events) {
    const startsAt = toValidDate(event.startDate);
    if (!startsAt) continue;
    const offers = Array.isArray(event.offers) ? event.offers : event.offers ? [event.offers] : [];
    const deadline = offers.map(({ validThrough }) => toValidDate(validThrough)).find((date) => date !== null) ?? null;
    const endsAt = toValidDate(event.endDate) ?? startsAt;
    if (isMatchingPeriod(startsAt, endsAt) && (archive || !deadline || deadline >= now)) {
      return { startsAt, endsAt, registrationDeadline: deadline };
    }
  }

  for (const match of rawText.matchAll(/\b\d{1,2}\s*[–—-]\s*\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+20\d{2})?(?=$|[\s,.])/giu)) {
    const startsAtIndex = match.index ?? 0;
    const context = rawText.slice(Math.max(0, startsAtIndex - 100), startsAtIndex + match[0].length + 20);
    if (/регистрац|при[её]м\s+заявок|дедлайн/i.test(context)) continue;
    const range = dateRangeFromText(match[0], now);
    if (range && isMatchingPeriod(range.startsAt, range.endsAt)) {
      if (archive && !/\b20(?:25|26)\b/u.test(match[0])) continue;
      return { ...range, registrationDeadline: extractRegistrationDeadline(rawText) };
    }
  }

  const date = [...rawText.matchAll(eventDatePattern)]
    .filter((match) => {
      const start = Math.max(0, (match.index ?? 0) - 100);
      const context = rawText.slice(start, (match.index ?? 0) + match[0].length + 30);
      return !/регистрац|при[её]м\s+заявок|дедлайн/i.test(context);
    })
    .map((match) => dateFromText(match[0], now))
    .find((candidate) => candidate !== null && (archive
      ? candidate >= new Date('2025-01-01T00:00:00+07:00')
        && candidate < new Date('2027-01-01T00:00:00+07:00')
        && candidate < now
      : candidate > now));
  if (date) {
    return { startsAt: date, endsAt: date, registrationDeadline: extractRegistrationDeadline(rawText) };
  }
  return null;
}

export class YandexSearchProvider implements HackathonProvider {
  readonly key: string = 'yandex_search';
  readonly name: string = 'Yandex Search API';

  protected readonly archiveMode: boolean = false;

  isConfigured() {
    return Boolean(process.env.YANDEX_SEARCH_API_KEY && process.env.YANDEX_CLOUD_FOLDER_ID);
  }

  async fetchEvents(): Promise<Hackathon[]> {
    if (this.archiveMode) {
      const source = await prisma.source.findUnique({
        where: { providerKey: this.key },
        select: { parserRuns: { where: { status: ParserRunStatus.SUCCEEDED }, take: 1, select: { id: true } } },
      });
      if (source?.parserRuns.length) {
        console.info('Archive backfill already completed; skipping one-time 2025–2026 search.');
        return [];
      }
    }

    const apiKey = process.env.YANDEX_SEARCH_API_KEY;
    const folderId = process.env.YANDEX_CLOUD_FOLDER_ID;
    if (!apiKey || !folderId) {
      throw new Error('Для поиска заполни YANDEX_SEARCH_API_KEY и YANDEX_CLOUD_FOLDER_ID');
    }

    const found = new Map<string, Hackathon>();
    const rejected = { domain: 0, pageUnavailable: 0, publicationDate: 0, stale: 0, registration: 0, eventDate: 0, audience: 0 };
    const freshnessThreshold = new Date(Date.now() - FRESHNESS_DAYS * 24 * 60 * 60 * 1_000);
    const queries = this.archiveMode ? archiveSearchQueries : searchQueries;

    for (const [index, queryText] of queries.entries()) {
      const response = await fetch('https://searchapi.api.cloud.yandex.net/v2/web/search', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Api-Key ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'HackTeenAggregator/1.0 (event discovery)',
        },
        body: JSON.stringify({
          query: {
            searchType: 'SEARCH_TYPE_RU',
            queryText,
            familyMode: 'FAMILY_MODE_MODERATE',
            page: '0',
            fixTypoMode: 'FIX_TYPO_MODE_ON',
          },
          folderId,
          groupSpec: { groupMode: 'GROUP_MODE_FLAT', groupsOnPage: 10, docsInGroup: 1 },
          maxPassages: 3,
          l10n: 'LOCALIZATION_RU',
          responseFormat: 'FORMAT_XML',
        }),
        signal: AbortSignal.timeout(20_000),
      });

      const body = await response.text();
      if (!response.ok) {
        let detail = body.slice(0, 500);
        try {
          const error = JSON.parse(body) as YandexSearchError;
          detail = error.details?.map(({ message }) => message).filter(Boolean).join('; ')
            || error.message
            || detail;
        } catch {
          // Keep the bounded response text for non-JSON gateway errors.
        }
        throw new Error(`Yandex Search API (${response.status}): ${detail}`);
      }

      let rawData: string;
      try {
        const result = JSON.parse(body) as YandexSearchResponse;
        if (!result.rawData) throw new Error('Ответ не содержит rawData');
        rawData = Buffer.from(result.rawData, 'base64').toString('utf8');
      } catch (error) {
        throw new Error(`Не удалось разобрать ответ Yandex Search API: ${error instanceof Error ? error.message : 'неизвестный формат'}`);
      }

      const xml = load(rawData, { xmlMode: true });
      for (const document of xml('doc').toArray()) {
        const result = xml(document);
        const title = result.find('title').first().text().replace(/\s+/g, ' ').trim();
        const href = result.find('url').first().text().trim();
        const passages = result.find('passage').toArray()
          .map((passage) => xml(passage).text().replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        if (!title || !href || !passages.length) continue;

        let eventUrl: URL;
        try {
          eventUrl = new URL(href);
        } catch {
          continue;
        }
        if (eventUrl.protocol !== 'https:' || !isApprovedDomain(eventUrl.hostname)) {
          rejected.domain += 1;
          continue;
        }
        eventUrl.hash = '';
        const canonicalUrl = eventUrl.toString();
        if (found.has(canonicalUrl)) continue;

        const page = await fetchEventPage(canonicalUrl);
        if (!page) {
          rejected.pageUnavailable += 1;
          continue;
        }
        if (!this.archiveMode && !page.publishedAt) {
          rejected.publicationDate += 1;
          continue;
        }
        if (!this.archiveMode && page.publishedAt
          && (page.publishedAt < freshnessThreshold || page.publishedAt > new Date(Date.now() + 24 * 60 * 60 * 1_000))) {
          rejected.stale += 1;
          continue;
        }

        const rawText = `${title}. ${passages.join(' ')} ${page.pageText}`.replace(/\s+/g, ' ').slice(0, 20_000);
        if (!this.archiveMode && (closedRegistration.test(rawText) || !positiveRegistration.test(rawText))) {
          rejected.registration += 1;
          continue;
        }
        const eventDates = eventDateFromStructuredData(page.structuredEvents, `${title}. ${passages.join(' ')} ${page.pageText}`, this.archiveMode);
        if (!eventDates) {
          rejected.eventDate += 1;
          continue;
        }
        const registrationDeadline = eventDates.registrationDeadline ?? extractRegistrationDeadline(rawText);
        if (!this.archiveMode && registrationDeadline && registrationDeadline < new Date()) {
          rejected.registration += 1;
          continue;
        }

        if (this.archiveMode) {
          const audience = /школьник|школьниц|учащ|обучающ|дет[ейи]|подрост|юнош|реб[её]нк|возраст[еа].{0,20}(?:лет|год)/iu;
          const itTopic = /программирован|разработк|информационн|цифров|робототех|инженер|web|frontend|backend|python|scratch|робот|искусственн.{0,15}интеллект|машинн.{0,15}обучен|кибербезопас|мобильн.{0,15}приложен|vr|ar|xr|it\b/iu;
          const competition = /хакатон|конкурс|соревнован|олимпиад/iu;
          if (!competition.test(rawText) || !audience.test(rawText) || !itTopic.test(rawText)) {
            rejected.audience += 1;
            continue;
          }
        }

        const hostname = eventUrl.hostname.replace(/^www\./, '');
        const event = toEvent({
          title,
          sourceUrl: canonicalUrl,
          sourceName: hostname,
          rawText,
          registrationUrl: canonicalUrl,
        });
        if (this.archiveMode) {
          if (event.ageMin != null && event.ageMin > 18) {
            rejected.audience += 1;
            continue;
          }
          if (event.ageMin != null) event.ageMin = Math.max(6, event.ageMin);
          if (event.ageMax != null) event.ageMax = Math.min(18, event.ageMax);
          if (event.ageMin != null && event.ageMax != null && event.ageMin > event.ageMax) {
            rejected.audience += 1;
            continue;
          }
        }
        event.startsAt = eventDates.startsAt;
        event.endsAt = eventDates.endsAt;
        event.registrationDeadline = registrationDeadline;
        event.sourceProviderKey = `web_${hostname.replace(/[^a-z0-9]+/g, '_')}`;
        event.archiveCandidate = this.archiveMode;
        found.set(canonicalUrl, event);
      }

      if (index < queries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_100));
      }
    }

    console.info(this.archiveMode
      ? `Yandex archive backfill (2025–2026): ${found.size} eligible; rejected ${JSON.stringify(rejected)}`
      : `Yandex Search API filters (${FRESHNESS_DAYS} days): ${found.size} eligible; rejected ${JSON.stringify(rejected)}`);
    return [...found.values()];
  }
}

export class YandexArchiveProvider extends YandexSearchProvider {
  readonly key = 'yandex_archive';
  readonly name = 'Yandex archive backfill 2025–2026';
  protected readonly archiveMode = true;
}
