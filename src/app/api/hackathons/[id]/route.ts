import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { EventFormat, HackathonStatus, Prisma, PriceType } from '@prisma/client';
import { hackathonPatchSchema } from '@/entities/hackathon/model/dto';
import { hasModeratorAccess } from '@/server/auth/require-role';
import { resolveLocation } from '@/server/services/locations';
import { notifyMatchingSubscriptions } from '@/server/services/subscription-notifications';
import { prisma } from '@/shared/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const role = await hasModeratorAccess();
    const now = new Date();
    const event = await prisma.hackathon.findFirst({
      where: {
        id,
        ...(role ? {} : {
          status: HackathonStatus.PUBLISHED,
          OR: [
            {
              startsAt: { gte: now },
              endsAt: { gte: now },
              AND: [{ OR: [{ registrationDeadline: null }, { registrationDeadline: { gte: now } }] }],
            },
            { startsAt: { gte: new Date('2025-01-01T00:00:00+07:00'), lt: new Date('2027-01-01T00:00:00+07:00') }, endsAt: { lt: now } },
          ],
        }),
      },
      include: { organizer: true, city: true, directions: { include: { direction: true } }, sources: { include: { source: true } } },
    });
    if (!event) return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 });
    return NextResponse.json({
      data: {
        ...event,
        sources: event.sources.map(({ rawText: _rawText, ...source }) => source),
      },
    });
  } catch (error) {
    console.error('Failed to load hackathon', error);
    return NextResponse.json({ error: 'Не удалось загрузить мероприятие' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await hasModeratorAccess())) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  const { id } = await params;
  try {
    const input = hackathonPatchSchema.parse(await request.json());
    const location = input.location ? await resolveLocation(input.location) : undefined;
    if (location?.error) return NextResponse.json({ error: location.error }, { status: 400 });
    const directions = input.directionSlugs
      ? await prisma.direction.findMany({ where: { slug: { in: input.directionSlugs } }, select: { id: true } })
      : undefined;
    if (input.directionSlugs && directions!.length !== new Set(input.directionSlugs).size) {
      return NextResponse.json({ error: 'Одно или несколько направлений не найдены' }, { status: 400 });
    }
    const previous = await prisma.hackathon.findUnique({
      where: { id },
      select: { status: true, ageMin: true, ageMax: true, startsAt: true, endsAt: true, format: true, registrationDeadline: true },
    });
    if (!previous) return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 });
    if (input.status === 'PUBLISHED') {
      const ageMin = input.ageMin ?? previous.ageMin;
      const ageMax = input.ageMax ?? previous.ageMax;
      const startsAt = input.startsAt ? new Date(input.startsAt) : previous.startsAt;
      const endsAt = input.endsAt ? new Date(input.endsAt) : previous.endsAt;
      const registrationDeadline = input.registrationDeadline === undefined
        ? previous.registrationDeadline
        : input.registrationDeadline ? new Date(input.registrationDeadline) : null;
      const format = input.format ?? previous.format;
      const issues: string[] = [];
      if (ageMin == null || ageMax == null) issues.push('укажи возраст участников');
      else if (ageMin < 6 || ageMax > 18 || ageMin > ageMax) issues.push('проверь диапазон возраста (от 6 до 18 лет)');
      if (!format) issues.push('укажи формат участия');
      if (!startsAt || !endsAt) issues.push('укажи даты начала и окончания');
      else if (startsAt > endsAt) issues.push('дата окончания должна быть не раньше даты начала');
      else if (endsAt < new Date()) issues.push('дата окончания уже прошла');
      if (registrationDeadline && registrationDeadline < new Date()) issues.push('дедлайн регистрации уже прошёл');
      if (issues.length) {
        return NextResponse.json({ error: `Для публикации: ${issues.join('; ')}.` }, { status: 400 });
      }
    }

    const { directionSlugs: _directionSlugs, organizerName, location: _location, ...fields } = input;
    const event = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.hackathon.update({
        where: { id },
        data: {
          ...fields,
          format: input.format as EventFormat | undefined,
          priceType: input.priceType as PriceType | undefined,
          startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
          endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
          registrationDeadline: input.registrationDeadline ? new Date(input.registrationDeadline) : input.registrationDeadline,
          status: input.status as HackathonStatus | undefined,
          publishedAt: input.status === 'PUBLISHED' ? new Date() : undefined,
          logoUrl: input.logoUrl,
          prizeDescription: input.prizeDescription,
          ...(location ? {
            city: location.cityId ? { connect: { id: location.cityId } } : { disconnect: true },
            region: location.regionId ? { connect: { id: location.regionId } } : { disconnect: true },
            country: location.countryId ? { connect: { id: location.countryId } } : { disconnect: true },
          } : {}),
          organizer: organizerName
            ? { connectOrCreate: { where: { name: organizerName }, create: { name: organizerName } } }
            : organizerName === null ? { disconnect: true } : undefined,
          ...(directions ? { directions: { deleteMany: {}, create: directions.map(({ id: directionId }) => ({ directionId })) } } : {}),
        },
      });
      await transaction.moderationLog.create({
        data: { hackathonId: id, action: input.status ?? 'UPDATED', note: null },
      });
      return updated;
    });
    const notifications = previous.status !== HackathonStatus.PUBLISHED && event.status === HackathonStatus.PUBLISHED
      ? await notifyMatchingSubscriptions(event.id)
      : undefined;
    return NextResponse.json({ data: event, notifications });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Некорректные данные мероприятия', details: error.flatten() }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Тело запроса должно быть валидным JSON' }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'Мероприятие с таким URL уже существует' }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 });
    console.error('Failed to update hackathon', error);
    return NextResponse.json({ error: 'Не удалось обновить мероприятие' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!(await hasModeratorAccess())) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  const { id } = await params;
  try {
    const event = await prisma.$transaction(async (transaction) => {
      const archived = await transaction.hackathon.update({
        where: { id },
        data: { status: HackathonStatus.ARCHIVED },
        select: { id: true },
      });
      await transaction.moderationLog.create({ data: { hackathonId: id, action: 'ARCHIVED' } });
      return archived;
    });
    return NextResponse.json({ data: event });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return NextResponse.json({ error: 'Мероприятие не найдено' }, { status: 404 });
    console.error('Failed to archive hackathon', error);
    return NextResponse.json({ error: 'Не удалось удалить мероприятие' }, { status: 500 });
  }
}
