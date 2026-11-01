import { EventFormat, HackathonStatus, Prisma, PriceType } from '@prisma/client';
import { ageRanges, type HackathonFilters } from '@/entities/hackathon/model/filters';
import { directionCatalog } from '@/entities/direction/model/directions';
import { prisma } from '@/shared/lib/prisma';

export const popularDirections = directionCatalog;
const archiveStart = new Date('2025-01-01T00:00:00+07:00');
const archiveEnd = new Date('2027-01-01T00:00:00+07:00');

export async function listCurrentHackathons(filters: HackathonFilters, limit?: number) {
  const now = new Date();
  const ageRange = ageRanges.find(({ min, max }) => `${min}-${max}` === filters.age);
  const where: Prisma.HackathonWhereInput = {
    status: HackathonStatus.PUBLISHED,
    startsAt: { gte: now },
    endsAt: { gte: now },
    AND: [{ OR: [{ registrationDeadline: null }, { registrationDeadline: { gte: now } }] }],
    ...(ageRange ? { ageMin: { lte: ageRange.max }, ageMax: { gte: ageRange.min } } : {}),
    ...(filters.format ? { format: filters.format as EventFormat } : {}),
    ...(filters.price ? { priceType: filters.price as PriceType } : {}),
    ...(filters.direction ? { directions: { some: { direction: { slug: filters.direction } } } } : {}),
    ...(filters.date === 'month'
      ? { startsAt: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } }
      : {}),
  };

  if (filters.region === 'barnaul') {
    where.city = { name: { equals: 'Барнаул', mode: 'insensitive' } };
  } else if (filters.region === 'altai') {
    where.region = { name: { equals: 'Алтайский край', mode: 'insensitive' } };
  } else if (filters.region === 'russia') {
    where.country = { code: 'RU' };
  } else if (filters.region === 'international') {
    where.OR = [
      { country: { code: { not: 'RU' } }, format: { in: [EventFormat.ONLINE, EventFormat.HYBRID] } },
      { countryId: null, format: { in: [EventFormat.ONLINE, EventFormat.HYBRID] } },
    ];
  }

  if (filters.q) {
    const matches = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT h.id
      FROM "Hackathon" h
      LEFT JOIN "Organizer" o ON o.id = h."organizerId"
      LEFT JOIN "City" c ON c.id = h."cityId"
      LEFT JOIN "Region" r ON r.id = h."regionId"
      WHERE to_tsvector('russian', h.title || ' ' || h.summary || ' ' || h.description)
              @@ websearch_to_tsquery('russian', ${filters.q})
         OR to_tsvector('english', h.title || ' ' || h.summary || ' ' || h.description)
              @@ websearch_to_tsquery('english', ${filters.q})
         OR o.name ILIKE '%' || ${filters.q} || '%'
         OR c.name ILIKE '%' || ${filters.q} || '%'
         OR r.name ILIKE '%' || ${filters.q} || '%'
         OR EXISTS (
              SELECT 1 FROM "HackathonDirection" hd
              JOIN "Direction" d ON d.id = hd."directionId"
              WHERE hd."hackathonId" = h.id AND d.name ILIKE '%' || ${filters.q} || '%'
            )
         OR EXISTS (
              SELECT 1 FROM "HackathonTag" ht
              JOIN "Tag" t ON t.id = ht."tagId"
              WHERE ht."hackathonId" = h.id AND t.name ILIKE '%' || ${filters.q} || '%'
            )
         OR EXISTS (
              SELECT 1 FROM "HackathonSource" hs
              JOIN "Source" s ON s.id = hs."sourceId"
              WHERE hs."hackathonId" = h.id AND s.name ILIKE '%' || ${filters.q} || '%'
            )
    `);
    where.id = { in: matches.map(({ id }) => id) };
  }

  const orderByBySort: Record<HackathonFilters['sort'], Prisma.HackathonOrderByWithRelationInput[]> = {
    date: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
    deadline: [{ registrationDeadline: { sort: 'asc', nulls: 'last' } }, { startsAt: 'asc' }],
    popular: [{ viewCount: 'desc' }, { startsAt: 'asc' }],
    newest: [{ createdAt: 'desc' }],
  };
  const orderBy = orderByBySort[filters.sort];

  return prisma.hackathon.findMany({
    where,
    include: {
      organizer: true,
      city: { include: { region: true } },
      region: true,
      directions: { include: { direction: true } },
      sources: { include: { source: true }, take: 1 },
    },
    orderBy,
    ...(limit ? { take: limit } : {}),
  });
}

export async function getHackathonBySlug(slug: string) {
  const now = new Date();
  return prisma.hackathon.findFirst({
    where: {
      slug,
      status: HackathonStatus.PUBLISHED,
      OR: [
        {
          startsAt: { gte: now },
          endsAt: { gte: now },
          AND: [{ OR: [{ registrationDeadline: null }, { registrationDeadline: { gte: now } }] }],
        },
        { startsAt: { gte: archiveStart, lt: archiveEnd }, endsAt: { lt: now } },
      ],
    },
    include: {
      organizer: true,
      city: { include: { region: { include: { country: true } } } },
      region: { include: { country: true } },
      country: true,
      directions: { include: { direction: true } },
      tags: { include: { tag: true } },
      sources: { include: { source: true } },
    },
  });
}

export async function listArchivedHackathons() {
  return prisma.hackathon.findMany({
    where: {
      status: HackathonStatus.PUBLISHED,
      startsAt: { gte: archiveStart, lt: archiveEnd },
      endsAt: { lt: new Date() },
    },
    include: {
      organizer: true,
      city: { include: { region: true } },
      region: true,
      directions: { include: { direction: true } },
      sources: { include: { source: true }, take: 1 },
    },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getRelatedHackathons(slug: string, directionIds: string[]) {
  return prisma.hackathon.findMany({
    where: {
      slug: { not: slug },
      status: HackathonStatus.PUBLISHED,
      startsAt: { gte: new Date() },
      endsAt: { gte: new Date() },
      OR: [{ registrationDeadline: null }, { registrationDeadline: { gte: new Date() } }],
      ...(directionIds.length ? { directions: { some: { directionId: { in: directionIds } } } } : {}),
    },
    include: {
      organizer: true,
      directions: { include: { direction: true } },
      city: { include: { region: true } },
      region: true,
      sources: { include: { source: true }, take: 1 },
    },
    orderBy: { startsAt: 'asc' },
    take: 3,
  });
}
