import { getConfiguredProviders } from '@/server/providers/providers';
import { parserErrorMessage, runProvider } from '@/server/providers/ingest';
import { prisma } from '@/shared/lib/prisma';

const runHour = Number(process.env.PARSER_RUN_HOUR ?? 6);
const runMinute = Number(process.env.PARSER_RUN_MINUTE ?? 0);
const timezone = process.env.PARSER_TIMEZONE ?? 'Asia/Barnaul';
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function msUntilNextRun(now = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
  const currentHour = Number(parts.hour);
  const currentMinute = Number(parts.minute);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  let target = new Date(`${date}T${String(runHour).padStart(2, '0')}:${String(runMinute).padStart(2, '0')}:00`);
  if (currentHour > runHour || (currentHour === runHour && currentMinute >= runMinute)) {
    target.setDate(target.getDate() + 1);
  }
  const targetAsUTC = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    target.getHours(),
    target.getMinutes(),
  );
  const offset = offsetAt(now);
  return Math.max(1_000, targetAsUTC - offset - now.getTime());
}

function offsetAt(date: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return representedAsUtc - date.getTime();
}

async function runAllConfiguredProviders() {
  const configuredProviders = await getConfiguredProviders();
  if (!configuredProviders.length) {
    console.warn('Automatic discovery is waiting for configured source URLs or Yandex Search API credentials.');
    return;
  }

  console.info(`Starting discovery: ${configuredProviders.map(({ name }) => name).join(', ')}`);
  const results = await Promise.allSettled(configuredProviders.map((provider) => runProvider(provider)));
  let failures = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      console.info(`[discovery] ${result.value.source}: ${result.value.savedCount}/${result.value.foundCount} candidates (${result.value.status})`);
      if (result.value.status === 'PARTIAL') failures += 1;
    } else {
      failures += 1;
      console.error(`[discovery] ${parserErrorMessage(result.reason)}`);
    }
  }
  if (failures) console.error(`Discovery finished with ${failures} provider failures. See ParserRun records for details.`);
}

async function start() {
  console.info(`HackTeen discovery worker started; scheduled daily at ${String(runHour).padStart(2, '0')}:${String(runMinute).padStart(2, '0')} ${timezone}`);
  await runAllConfiguredProviders();
  while (true) {
    const delay = msUntilNextRun();
    console.info(`Next automatic discovery in ${Math.round(delay / 60_000)} minutes`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    await runAllConfiguredProviders();
  }
}

start()
  .catch((error: unknown) => {
    console.error('Discovery worker stopped unexpectedly', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
