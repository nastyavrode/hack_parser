import { createHash } from 'node:crypto';
import { HackathonStatus, ParserRunStatus, Prisma } from '@prisma/client';
import type { Hackathon, HackathonProvider } from '@/entities/hackathon/model/provider';
import { prisma } from '@/shared/lib/prisma';
import { resolveLocation } from '@/server/services/locations';

function makeSlug(title: string, url: string) {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'event';
  return `${slug}-${createHash('sha256').update(url).digest('hex').slice(0, 8)}`;
}

async function saveCandidate(event: Hackathon, sourceId: string) {
  const existing = await prisma.hackathonSource.findUnique({
    where: { sourceId_sourceUrl: { sourceId, sourceUrl: event.sourceUrl } },
    include: { hackathon: true },
  });
  const duplicate = existing ?? await prisma.hackathonSource.findFirst({
    where: { sourceUrl: event.sourceUrl },
    include: { hackathon: true },
  });
  if (duplicate) {
    if (existing) {
      await prisma.hackathonSource.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), rawText: event.rawText },
      });
    } else {
      await prisma.hackathonSource.create({
        data: { sourceId, hackathonId: duplicate.hackathonId, sourceUrl: event.sourceUrl, rawText: event.rawText },
      });
    }
    if (event.archiveCandidate && duplicate.hackathon.status === HackathonStatus.PENDING) {
      await prisma.hackathon.update({
        where: { id: duplicate.hackathonId },
        data: { status: HackathonStatus.PUBLISHED, publishedAt: new Date() },
      });
      return true;
    }
    return false;
  }

  const location = event.location ? await resolveLocation(event.location) : undefined;
  if (location?.error) throw new Error(location.error);
  const directionRecords = await prisma.direction.findMany({
    where: { slug: { in: event.directions } },
    select: { id: true },
  });
  await prisma.hackathon.create({
    data: {
      slug: makeSlug(event.title, event.sourceUrl),
      title: event.title,
      summary: event.summary || event.title,
      description: event.description || event.title,
      format: event.format,
      ageMin: event.ageMin,
      ageMax: event.ageMax,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      registrationDeadline: event.registrationDeadline,
      registrationUrl: event.registrationUrl,
      priceType: event.priceType,
      status: event.archiveCandidate ? HackathonStatus.PUBLISHED : HackathonStatus.PENDING,
      publishedAt: event.archiveCandidate ? new Date() : null,
      city: location?.cityId ? { connect: { id: location.cityId } } : undefined,
      region: location?.regionId ? { connect: { id: location.regionId } } : undefined,
      country: location?.countryId ? { connect: { id: location.countryId } } : undefined,
      directions: { create: directionRecords.map(({ id }) => ({ directionId: id })) },
      sources: { create: { sourceId, sourceUrl: event.sourceUrl, rawText: event.rawText } },
    },
  });
  return true;
}

export async function runProvider(provider: HackathonProvider) {
  const source = await prisma.source.upsert({
    where: { providerKey: provider.key },
    create: { providerKey: provider.key, name: provider.name },
    update: { name: provider.name },
  });
  const run = await prisma.parserRun.create({ data: { sourceId: source.id } });
  try {
    const events = await provider.fetchEvents();
    let savedCount = 0;
    const errors: string[] = [];
    for (const event of events) {
      try {
          const eventSource = event.sourceProviderKey
            ? await prisma.source.upsert({
                where: { providerKey: event.sourceProviderKey },
                create: { providerKey: event.sourceProviderKey, name: event.sourceName },
                update: { name: event.sourceName },
              })
            : source;
          if (await saveCandidate(event, eventSource.id)) savedCount += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        errors.push(`${event.sourceUrl}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    const status = errors.length ? ParserRunStatus.PARTIAL : ParserRunStatus.SUCCEEDED;
    await prisma.parserRun.update({
      where: { id: run.id },
      data: { status, foundCount: events.length, savedCount, error: errors.length ? errors.slice(0, 25).join('\n') : null, finishedAt: new Date() },
    });
    return { source: provider.name, foundCount: events.length, savedCount, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка парсера';
    await prisma.parserRun.update({
      where: { id: run.id },
      data: { status: ParserRunStatus.FAILED, error: message, finishedAt: new Date() },
    });
    throw new Error(`${provider.name}: ${message}`, { cause: error });
  }
}

export function parserErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Неизвестная ошибка парсера';
}
