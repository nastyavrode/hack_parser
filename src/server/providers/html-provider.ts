import { load } from 'cheerio';
import type { Hackathon, HackathonProvider } from '@/entities/hackathon/model/provider';
import { directionCatalog } from '@/entities/direction/model/directions';

const CARD_SELECTORS = 'article, .event-card, .event, .hackathon, .card, [class*="event-item"]';

export abstract class HtmlProvider implements HackathonProvider {
  abstract readonly key: string;
  abstract readonly name: string;
  protected abstract readonly urlEnvironmentVariable: string;
  protected usesBrowser = false;

  isConfigured() {
    return Boolean(process.env[this.urlEnvironmentVariable]);
  }

  async fetchEvents(): Promise<Hackathon[]> {
    const url = process.env[this.urlEnvironmentVariable];
    if (!url) throw new Error(`${this.urlEnvironmentVariable} не настроена`);
    const pageUrl = new URL(url);
    if (!['https:', 'http:'].includes(pageUrl.protocol)) throw new Error(`${this.urlEnvironmentVariable} должна содержать HTTP(S) URL`);

    const html = this.usesBrowser ? await this.fetchRenderedPage(pageUrl.toString()) : await this.fetchPage(pageUrl.toString());
    const $ = load(html);
    const candidates = $(CARD_SELECTORS).toArray();
    const entries = candidates.length ? candidates : $('a[href]').toArray();
    const seen = new Set<string>();
    const events: Hackathon[] = [];

    for (const element of entries) {
      const card = $(element);
      const link = element.tagName === 'a' ? card : card.find('a[href]').first();
      const href = link.attr('href');
      let eventUrl: URL;
      try {
        eventUrl = href ? new URL(href, pageUrl) : pageUrl;
      } catch {
        console.warn(`${this.name}: ignored malformed event link`);
        continue;
      }
      if (!['https:', 'http:'].includes(eventUrl.protocol)) continue;
      const sourceUrl = eventUrl.toString();
      const rawText = card.text().replace(/\s+/g, ' ').trim();
      const title = card.find('h1,h2,h3,h4').first().text().trim() || link.text().trim();
      if (!title || title.length < 5 || rawText.length < 15 || seen.has(sourceUrl)) continue;
      seen.add(sourceUrl);
      events.push(toEvent({
        title,
        sourceUrl,
        sourceName: this.name,
        rawText,
        registrationUrl: sourceUrl,
      }));
    }

    return events;
  }

  protected async fetchPage(url: string) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'HackTeenAggregator/1.0 (+https://hackteen.ru; event discovery)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`${this.name}: HTTP ${response.status} при загрузке ${url}`);
    return response.text();
  }

  private async fetchRenderedPage(url: string) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ userAgent: 'HackTeenAggregator/1.0 (+https://hackteen.ru; event discovery)' });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
      await page.locator('body').waitFor({ timeout: 10_000 });
      return await page.content();
    } finally {
      await browser.close();
    }
  }
}

export function toEvent(input: {
  title: string;
  sourceUrl: string;
  sourceName: string;
  rawText: string;
  registrationUrl?: string | null;
}): Hackathon {
  const age = input.rawText.match(/(?:от\s*)?(\d{1,2})\s*(?:[-–—]\s*|\s+до\s+)(\d{1,2})\s*(?:лет|года|years?)/i);
  const ageMin = age ? Number(age[1]) : null;
  const ageMax = age ? Number(age[2]) : null;
  const monthNumbers: Record<string, number> = {
    января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
    июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
  };
  const monthPattern = Object.keys(monthNumbers).join('|');
  const dates = [...input.rawText.matchAll(
    new RegExp(`\\b(20\\d{2})[-./](\\d{1,2})[-./](\\d{1,2})\\b|\\b(\\d{1,2})[./](\\d{1,2})[./](20\\d{2})\\b|\\b(\\d{1,2})\\s+(${monthPattern})\\s+(20\\d{2})\\b`, 'giu'),
  )].map((match) => {
      const monthName = match[8]?.toLowerCase();
      const namedMonth = monthName
        ? Object.entries(monthNumbers).find(([pattern]) => new RegExp(`^${pattern}$`, 'u').test(monthName))?.[1]
        : undefined;
      const year = Number(match[1] ?? match[6] ?? match[9]);
      const month = Number(match[2] ?? match[5] ?? namedMonth);
      const day = Number(match[3] ?? match[4] ?? match[7]);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
    }).filter((date): date is Date => date !== null);
  const startsAt = dates[0] ?? null;
  const endsAt = dates[1] ?? startsAt;
  const format = /гибрид|hybrid/i.test(input.rawText) ? 'HYBRID'
    : /онлайн|online|дистанцион/i.test(input.rawText) ? 'ONLINE'
      : /очно|офлайн|offline|in person/i.test(input.rawText) ? 'OFFLINE' : null;
  const directions = directionCatalog
    .filter(({ name, slug }) => new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(input.rawText) || input.rawText.toLowerCase().includes(slug.replaceAll('-', ' ')))
    .map(({ slug }) => slug);
  const free = /бесплатно|free participation/i.test(input.rawText);
  const paid = /стоимость участия|участие платное|paid participation/i.test(input.rawText);
  const location = /барнаул/i.test(input.rawText) ? 'barnaul'
    : /алтайск(?:ий край|ого края)/i.test(input.rawText) ? 'altai'
      : /международн|international/i.test(input.rawText) ? 'international'
        : /росси[яи]|russia/i.test(input.rawText) ? 'russia'
          : format === 'ONLINE' ? 'global' : null;

  return {
    title: input.title.slice(0, 240),
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName,
    summary: input.rawText.slice(0, 500) || input.title,
    description: (input.rawText || input.title).slice(0, 20_000),
    format,
    ageMin,
    ageMax,
    startsAt,
    endsAt,
    registrationDeadline: null,
    registrationUrl: input.registrationUrl ?? null,
    location,
    priceType: free ? 'FREE' : paid ? 'PAID' : 'UNKNOWN',
    directions,
    rawText: input.rawText.slice(0, 20_000),
    needsReview: !ageMin || !ageMax || !startsAt || !format || !directions.length,
  };
}
