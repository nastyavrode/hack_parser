import type { MetadataRoute } from 'next';
import { HackathonStatus } from '@prisma/client';
import { siteConfig } from '@/shared/config/site';
import { prisma } from '@/shared/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const events = await prisma.hackathon.findMany({
    where: {
      status: HackathonStatus.PUBLISHED,
      OR: [
        {
          endsAt: { gte: now },
          AND: [{ OR: [{ registrationDeadline: null }, { registrationDeadline: { gte: now } }] }],
        },
        {
          startsAt: { gte: new Date('2025-01-01T00:00:00+07:00'), lt: new Date('2027-01-01T00:00:00+07:00') },
          endsAt: { lt: now },
        },
      ],
    },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });
  return [
    { url: siteConfig.url, changeFrequency: 'daily', priority: 1 },
    { url: `${siteConfig.url}/subscribe`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteConfig.url}/archive`, changeFrequency: 'weekly', priority: 0.5 },
    ...events.map(({ slug, updatedAt }) => ({
      url: `${siteConfig.url}/hackathons/${encodeURIComponent(slug)}`,
      lastModified: updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
