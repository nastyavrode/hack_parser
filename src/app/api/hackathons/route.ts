import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { EventFormat, HackathonStatus, PriceType, Prisma } from '@prisma/client';
import { parseHackathonFilters } from '@/entities/hackathon/model/filters';
import { hackathonMutationSchema } from '@/entities/hackathon/model/dto';
import { hasModeratorAccess } from '@/server/auth/require-role';
import { listCurrentHackathons } from '@/server/services/hackathons';
import { resolveLocation } from '@/server/services/locations';
import { notifyMatchingSubscriptions } from '@/server/services/subscription-notifications';
import { prisma } from '@/shared/lib/prisma';

export async function GET(request: Request) {
  try {
    const filters = parseHackathonFilters(new URL(request.url).searchParams);
    const events = await listCurrentHackathons(filters);
    const data = events.map(({ sources, ...event }) => ({
      ...event,
      sources: sources.map(({ rawText: _rawText, ...source }) => source),
    }));
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Некорректные параметры фильтрации', details: error.flatten() }, { status: 400 });
    }
    console.error('Failed to list hackathons', error);
    return NextResponse.json({ error: 'Не удалось загрузить мероприятия' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await hasModeratorAccess())) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });

  try {
    const input = hackathonMutationSchema.parse(await request.json());
    const directions = await prisma.direction.findMany({ where: { slug: { in: input.directionSlugs } }, select: { id: true } });
    if (directions.length !== new Set(input.directionSlugs).size) {
      return NextResponse.json({ error: 'Одно или несколько направлений не найдены' }, { status: 400 });
    }
    if (input.status === 'PUBLISHED' && (new Date(input.endsAt) < new Date() || !input.format
      || (input.registrationDeadline && new Date(input.registrationDeadline) < new Date()))) {
      return NextResponse.json({ error: 'Для публикации укажи формат и актуальные даты' }, { status: 400 });
    }
    const location = await resolveLocation(input.location);
    if (location.error) return NextResponse.json({ error: location.error }, { status: 400 });
    const event = await prisma.hackathon.create({
      data: {
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        description: input.description,
        requirements: input.requirements,
        format: input.format as EventFormat,
        priceType: input.priceType as PriceType,
        ageMin: input.ageMin,
        ageMax: input.ageMax,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        registrationDeadline: input.registrationDeadline ? new Date(input.registrationDeadline) : null,
        registrationUrl: input.registrationUrl,
        logoUrl: input.logoUrl,
        prizeDescription: input.prizeDescription,
        status: (input.status as HackathonStatus | undefined) ?? HackathonStatus.PENDING,
        publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
        organizer: input.organizerName ? { connectOrCreate: { where: { name: input.organizerName }, create: { name: input.organizerName } } } : undefined,
        city: location.cityId ? { connect: { id: location.cityId } } : undefined,
        region: location.regionId ? { connect: { id: location.regionId } } : undefined,
        country: location.countryId ? { connect: { id: location.countryId } } : undefined,
        directions: { create: directions.map(({ id }) => ({ directionId: id })) },
      },
    });
    const notifications = event.status === HackathonStatus.PUBLISHED
      ? await notifyMatchingSubscriptions(event.id)
      : undefined;
    return NextResponse.json({ data: event, notifications }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Некорректные данные мероприятия', details: error.flatten() }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Тело запроса должно быть валидным JSON' }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Мероприятие с таким URL уже существует' }, { status: 409 });
    }
    console.error('Failed to create hackathon', error);
    return NextResponse.json({ error: 'Не удалось создать мероприятие' }, { status: 500 });
  }
}
