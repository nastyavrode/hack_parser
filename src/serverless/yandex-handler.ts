import { getServerlessProviders } from '@/server/providers/providers';
import { parserErrorMessage, runProvider } from '@/server/providers/ingest';
import { prisma } from '@/shared/lib/prisma';

interface FunctionContext {
  requestId?: string;
}

export async function handler(_event: unknown, context: FunctionContext) {
  process.env.HACKTEEN_SERVERLESS = '1';
  const requestId = context.requestId ?? 'unknown';

  try {
    const configuredProviders = await getServerlessProviders();
    if (!configuredProviders.length) {
      console.warn(`[${requestId}] No serverless-compatible providers are configured.`);
      return { status: 'skipped', requestId, providers: [] };
    }

    console.info(`[${requestId}] Starting discovery: ${configuredProviders.map(({ name }) => name).join(', ')}`);
    const results = await Promise.allSettled(configuredProviders.map((provider) => runProvider(provider)));
    const providerResults = results.map((result) => {
      if (result.status === 'fulfilled') {
        const { source, foundCount, savedCount, status } = result.value;
        console.info(`[${requestId}] ${source}: ${savedCount}/${foundCount} candidates (${status})`);
        return { source, foundCount, savedCount, status };
      }

      const error = parserErrorMessage(result.reason);
      console.error(`[${requestId}] ${error}`);
      return { error, status: 'FAILED' };
    });
    const failures = providerResults.filter((result) => result.status === 'FAILED' || result.status === 'PARTIAL').length;
    const summary = { status: failures ? 'partial' : 'succeeded', requestId, providers: providerResults };
    if (failures === providerResults.length) {
      throw new Error(`[${requestId}] All ${failures} configured providers failed.`);
    }
    return summary;
  } finally {
    await prisma.$disconnect();
  }
}
