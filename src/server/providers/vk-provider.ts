import type { Hackathon, HackathonProvider } from '@/entities/hackathon/model/provider';
import { toEvent } from '@/server/providers/html-provider';

const defaultCommunityUrls = ['https://vk.ru/kvant22'];
const freshnessWindowMs = 90 * 24 * 60 * 60 * 1_000;
const openRegistrationPattern = /регистрац[а-яё]*\s+(?:уже\s+)?открыт|открыт[а-яё]*\s+регистрац|начал[а-яё]*\s+регистрац|ид[её]т\s+регистрац|при[её]м\s+заявок.{0,100}(?:до|по)(?:\s|$|[.,])|заявки\s+принимаются|подать\s+заявк[а-яё]*\s+до/iu;
const closedRegistrationPattern = /регистрац[а-яё]*\s+(?:закрыт|завершен|окончена)|при[её]м\s+заявок\s+(?:закрыт|завершен|окончен)|заявки\s+больше\s+не\s+принимаются/iu;

const monthNumbers: Record<string, number> = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
};

const shortMonthNumbers: Record<string, number> = {
  янв: 1, фев: 2, мар: 3, апр: 4, май: 5, июн: 6,
  июл: 7, авг: 8, сен: 9, окт: 10, ноя: 11, дек: 12,
};

function parseDate(day: number, month: number, year: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

export function parseVkPostDate(value: string, now = new Date()) {
  const normalized = value.toLocaleLowerCase('ru-RU').trim();
  if (normalized === 'сегодня') return new Date(now);
  if (normalized === 'вчера') return new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const relative = normalized.match(/(\d+)\s*(?:д|дн(?:я|ей)?|час(?:а|ов)?|мин(?:ут(?:ы|у)?)?)\s+назад/u);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = normalized.includes('час') ? 60 * 60 * 1_000
      : normalized.includes('мин') ? 60 * 1_000 : 24 * 60 * 60 * 1_000;
    return new Date(now.getTime() - amount * unit);
  }
  const full = normalized.match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(20\d{2}))?(?=\s|$|[.,])/u);
  const abbreviated = normalized.match(/\b(\d{1,2})\s+(янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)(?:[а-я]*)?(?:\s+(20\d{2}))?(?=\s|$|[.,])/u);
  const match = full ?? abbreviated;
  if (!match) return null;
  const month = full ? monthNumbers[match[2]] : shortMonthNumbers[match[2].slice(0, 3)];
  let year = Number(match[3] ?? now.getFullYear());
  let date = parseDate(Number(match[1]), month, year);
  if (!date) return null;
  if (!match[3] && date > now) {
    year -= 1;
    date = parseDate(Number(match[1]), month, year);
  }
  return date;
}

function parseEventRange(text: string, now = new Date()) {
  const match = text.toLocaleLowerCase('ru-RU').match(/\b(\d{1,2})\s*[–—-]\s*(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(20\d{2}))?(?=\s|$|[.,])/u);
  if (!match) return null;
  const month = monthNumbers[match[3]];
  let year = Number(match[4] ?? now.getFullYear());
  let startsAt = parseDate(Number(match[1]), month, year);
  let endsAt = parseDate(Number(match[2]), month, year);
  if (!startsAt || !endsAt) return null;
  if (!match[4] && endsAt < now && now.getMonth() >= 10 && month <= 3) {
    year += 1;
    startsAt = parseDate(Number(match[1]), month, year);
    endsAt = parseDate(Number(match[2]), month, year);
  }
  return startsAt && endsAt ? { startsAt, endsAt } : null;
}

function parseRegistrationDeadline(text: string, now = new Date()) {
  const deadlineMatch = text.match(/(?:при[её]м\s+заявок|регистрац[а-яё]*|заявки).{0,100}?(?:до|по)\s+(\d{1,2}[./]\d{1,2}[./]20\d{2}|\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+20\d{2})?)/iu);
  if (!deadlineMatch) return null;
  const value = deadlineMatch[1];
  const numeric = value.match(/^(\d{1,2})[./](\d{1,2})[./](20\d{2})$/);
  if (numeric) return parseDate(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]));
  const russian = value.toLocaleLowerCase('ru-RU').match(/^(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(20\d{2}))?$/u);
  if (!russian) return null;
  let year = Number(russian[3] ?? now.getFullYear());
  let date = parseDate(Number(russian[1]), monthNumbers[russian[2]], year);
  if (!date) return null;
  if (!russian[3] && date < now && now.getMonth() >= 10 && monthNumbers[russian[2]] <= 3) {
    year += 1;
    date = parseDate(Number(russian[1]), monthNumbers[russian[2]], year);
  }
  return date;
}

export function parseVkPostCandidate(input: {
  postUrl: string;
  publishedText: string;
  bodyText: string;
  now?: Date;
}): Hackathon | null {
  const now = input.now ?? new Date();
  const publishedAt = parseVkPostDate(input.publishedText, now);
  if (!publishedAt || publishedAt > now || now.getTime() - publishedAt.getTime() > freshnessWindowMs) return null;

  const rawText = input.bodyText.replace(/\s+/g, ' ').trim();
  if (closedRegistrationPattern.test(rawText) || !openRegistrationPattern.test(rawText)) return null;
  const range = parseEventRange(rawText, now);
  if (!range || range.startsAt <= now || range.endsAt < now) return null;
  const registrationDeadline = parseRegistrationDeadline(rawText, now);
  if (registrationDeadline) {
    const deadlineDay = new Date(registrationDeadline);
    deadlineDay.setUTCHours(16, 59, 59, 999);
    if (deadlineDay < now) return null;
    registrationDeadline.setUTCHours(16, 59, 59, 999);
  }

  const title = rawText.split(/(?<=[.!?])\s+/u)[0].slice(0, 240);
  if (!/хакатон|конкурс|соревнован|олимпиад/i.test(title)) return null;
  const base = toEvent({
    title,
    sourceUrl: input.postUrl,
    sourceName: 'VK',
    rawText,
    registrationUrl: input.postUrl,
  });
  base.ageMin = base.ageMin == null ? null : Math.max(6, base.ageMin);
  base.ageMax = base.ageMax == null ? null : Math.min(18, base.ageMax);
  if (base.ageMin != null && base.ageMax != null && base.ageMin > base.ageMax) return null;
  base.startsAt = range.startsAt;
  base.endsAt = range.endsAt;
  base.registrationDeadline = registrationDeadline;
  base.sourceProviderKey = 'vk';
  base.sourceName = 'VK';
  return base;
}

export class VkProvider implements HackathonProvider {
  readonly key = 'vk';
  readonly name = 'VK · Кванториум Барнаул';

  isConfigured() {
    return true;
  }

  async fetchEvents(): Promise<Hackathon[]> {
    const configuredUrls = (process.env.HACKTEEN_VK_URL ?? '').split(',').map((url) => url.trim()).filter(Boolean);
    const configuredPostUrls = (process.env.HACKTEEN_VK_POST_URLS ?? '').split(',').map((url) => url.trim()).filter(Boolean);
    const urls = [...(configuredUrls.length ? configuredUrls : defaultCommunityUrls), ...configuredPostUrls];
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const found = new Map<string, Hackathon>();
    try {
      for (const communityUrl of urls) {
        const url = new URL(communityUrl);
        if (url.protocol !== 'https:' || !['vk.ru', 'vk.com'].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
          throw new Error(`HACKTEEN_VK_URL должен содержать HTTPS-адрес сообщества VK, получено: ${communityUrl}`);
        }
        const isPostUrl = /^\/wall-?\d+_\d+(?:\/|$)/u.test(url.pathname);
        const page = await browser.newPage({
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          locale: 'ru-RU',
        });
        try {
          await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20_000 });
          await page.locator('body').waitFor({ timeout: 8_000 });
          const cards = page.locator('[data-testid="post"], article, .wall_post, .feed_row');
          await cards.first().waitFor({ state: 'attached', timeout: 8_000 }).catch(() => undefined);
          const postCount = await cards.count();
          if (!postCount) {
            console.warn(`${this.name}: VK не отдал публичные посты для ${url.hostname}${url.pathname}; источник пропущен.`);
            continue;
          }
          if (!isPostUrl) {
            let previousCount = postCount;
            let unchangedScrolls = 0;
            for (let scroll = 0; scroll < 15; scroll += 1) {
              if (previousCount >= 100 || unchangedScrolls >= 3) break;
              await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
              await page.waitForTimeout(1_000);
              const currentCount = await cards.count();
              unchangedScrolls = currentCount === previousCount ? unchangedScrolls + 1 : 0;
              previousCount = currentCount;
            }
          }
          const finalCount = await cards.count();
          for (let index = 0; index < finalCount; index += 1) {
            const expandButton = cards.nth(index).locator('[data-testid="showmoretext-after"]');
            if (await expandButton.count()) {
              await expandButton.evaluate((element) => (element as HTMLElement).click());
              await page.waitForTimeout(100);
            }
          }
          const posts = await cards.evaluateAll((elements) => elements.map((element) => {
            const dateLink = element.querySelector('[data-testid="post_date_block_preview"], .PostDateBlock__root a');
            const content = element.querySelector('[data-testid="post-content-container"], [data-testid="post_text"], .wall_post_text, [class*="post_text"]');
            return {
              postUrl: dateLink instanceof HTMLAnchorElement ? dateLink.href : '',
              publishedText: dateLink?.textContent?.trim() ?? '',
              bodyText: content?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            };
          }));
          for (const post of posts) {
            if (!post.postUrl || !post.bodyText) continue;
            const candidate = parseVkPostCandidate({ ...post, now: new Date() });
            if (candidate) found.set(candidate.sourceUrl, candidate);
          }
        } catch (error) {
          console.warn(`${this.name}: не удалось прочитать ${url.hostname}${url.pathname}: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
        } finally {
          await page.close();
        }
      }
      return [...found.values()];
    } finally {
      await browser.close();
    }
  }
}
