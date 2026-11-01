import { NextResponse } from 'next/server';
import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { siteConfig } from '@/shared/config/site';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token || token.length > 128) {
    return NextResponse.json({ error: 'Ссылка отписки недействительна' }, { status: 400 });
  }
  const result = await prisma.subscription.updateMany({
    where: { token },
    data: { status: SubscriptionStatus.UNSUBSCRIBED },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Подписка не найдена' }, { status: 404 });
  return NextResponse.redirect(new URL('/subscribe?unsubscribed=1', siteConfig.url));
}
