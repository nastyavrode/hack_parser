import type { HackathonProvider } from '@/entities/hackathon/model/provider';
import { HtmlProvider } from '@/server/providers/html-provider';
import { KvantoriumProvider } from '@/server/providers/kvantorium-provider';
import { YandexArchiveProvider, YandexSearchProvider } from '@/server/providers/yandex-search-provider';
import { VkProvider } from '@/server/providers/vk-provider';
import { ParserRunStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

export class TimepadProvider extends HtmlProvider {
  readonly key = 'timepad';
  readonly name = 'Timepad';
  protected readonly urlEnvironmentVariable = 'HACKTEEN_TIMEPAD_URL';
}
export class LeaderIdProvider extends HtmlProvider {
  readonly key = 'leader_id';
  readonly name = 'Leader-ID';
  protected readonly urlEnvironmentVariable = 'HACKTEEN_LEADER_ID_URL';
}
export class DevpostProvider extends HtmlProvider {
  readonly key = 'devpost';
  readonly name = 'Devpost';
  protected readonly urlEnvironmentVariable = 'HACKTEEN_DEVPOST_URL';
}
export class HackathonsComProvider extends HtmlProvider {
  readonly key = 'hackathons_com';
  readonly name = 'Hackathons.com';
  protected readonly urlEnvironmentVariable = 'HACKTEEN_HACKATHONS_COM_URL';
}
export class TelegramProvider extends HtmlProvider {
  readonly key = 'telegram';
  readonly name = 'Telegram';
  protected readonly urlEnvironmentVariable = 'HACKTEEN_TELEGRAM_URL';
}
export class DvizheniePervykhProvider extends HtmlProvider {
  readonly key = 'dvizhenie_pervykh';
  readonly name = 'Движение Первых';
  protected readonly urlEnvironmentVariable = 'HACKTEEN_DVIZHENIE_PERVYKH_URL';
}
export class SiriusProvider extends HtmlProvider {
  readonly key = 'sirius';
  readonly name = 'Сириус';
  protected readonly urlEnvironmentVariable = 'HACKTEEN_SIRIUS_URL';
  protected usesBrowser = true;
}

export const providers: HackathonProvider[] = [
  new TimepadProvider(),
  new LeaderIdProvider(),
  new DevpostProvider(),
  new HackathonsComProvider(),
  new TelegramProvider(),
  new VkProvider(),
  new KvantoriumProvider(),
  new DvizheniePervykhProvider(),
  new SiriusProvider(),
  new YandexSearchProvider(),
  new YandexArchiveProvider(),
];

export async function getConfiguredProviders() {
  const archiveSource = await prisma.source.findUnique({
    where: { providerKey: 'yandex_archive' },
    select: { parserRuns: { where: { status: ParserRunStatus.SUCCEEDED }, take: 1, select: { id: true } } },
  });
  const archiveBackfillCompleted = Boolean(archiveSource?.parserRuns.length);
  return providers.filter((provider) =>
    (provider.isConfigured?.() ?? true)
    && !(provider.key === 'yandex_archive' && archiveBackfillCompleted));
}

export async function getServerlessProviders() {
  const configuredProviders = await getConfiguredProviders();
  const browserProviders = new Set(['vk', 'sirius']);
  const providersWithoutBrowser = configuredProviders.filter((provider) => !browserProviders.has(provider.key));
  const skippedProviders = configuredProviders.filter((provider) => browserProviders.has(provider.key));
  if (skippedProviders.length) {
    console.warn(`Yandex Cloud Function has no headless browser; skipped providers: ${skippedProviders.map(({ name }) => name).join(', ')}`);
  }
  return providersWithoutBrowser;
}
