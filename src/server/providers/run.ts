import { getConfiguredProviders } from '@/server/providers/providers';
import { parserErrorMessage, runProvider } from '@/server/providers/ingest';

const configuredProviders = await getConfiguredProviders();
if (configuredProviders.length === 0) {
  console.error('Нет настроенных источников. Заполни YANDEX_SEARCH_API_KEY и YANDEX_CLOUD_FOLDER_ID или URL источников в .env.');
  process.exitCode = 1;
}

const results = await Promise.allSettled(configuredProviders.map((provider) => runProvider(provider)));
let failed = 0;
for (const result of results) {
  if (result.status === 'fulfilled') {
    console.info(`[parser] ${result.value.source}: ${result.value.savedCount}/${result.value.foundCount} candidates (${result.value.status})`);
    if (result.value.status === 'PARTIAL') failed += 1;
  } else {
    failed += 1;
    console.error(`[parser] ${parserErrorMessage(result.reason)}`);
  }
}
await import('@/shared/lib/prisma').then(({ prisma }) => prisma.$disconnect());
if (failed > 0) process.exitCode = 1;
