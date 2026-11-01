import { NextResponse } from 'next/server';
import { EventFormat, Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { subscriptionSchema } from '@/entities/hackathon/model/dto';
import { prisma } from '@/shared/lib/prisma';

export async function POST(request: Request) {
  try {
    const input = subscriptionSchema.parse(await request.json());
    const directions = await prisma.direction.findMany({
      where: { slug: { in: input.directionSlugs } },
      select: { id: true },
    });
    if (directions.length !== new Set(input.directionSlugs).size) {
      return NextResponse.json({ error: 'Выбрано неизвестное направление' }, { status: 400 });
    }
    const subscription = await prisma.subscription.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        ageMin: input.ageMin,
        ageMax: input.ageMax,
        format: input.format as EventFormat | null,
        directions: { create: directions.map(({ id }) => ({ directionId: id })) },
      },
      update: {
        ageMin: input.ageMin,
        ageMax: input.ageMax,
        format: input.format as EventFormat | null,
        status: 'ACTIVE',
        directions: { deleteMany: {}, create: directions.map(({ id }) => ({ directionId: id })) },
      },
      select: { id: true },
    });
    return NextResponse.json({ data: { id: subscription.id, message: 'Подписка сохранена' } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Проверьте введённые данные', details: error.flatten() }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Тело запроса должно быть валидным JSON' }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('Subscription persistence failed', error);
    } else {
      console.error('Failed to save subscription', error);
    }
    return NextResponse.json({ error: 'Не удалось сохранить подписку' }, { status: 500 });
  }
}
