import { EventFormat, HackathonStatus, SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { sendHackathonNotice } from '@/server/mail/send';

export async function notifyMatchingSubscriptions(hackathonId: string) {
  const hackathon = await prisma.hackathon.findFirst({
    where: {
      id: hackathonId,
      status: HackathonStatus.PUBLISHED,
      endsAt: { gte: new Date() },
      OR: [{ registrationDeadline: null }, { registrationDeadline: { gte: new Date() } }],
    },
    include: { directions: true },
  });
  if (!hackathon) return { matchedCount: 0, sentCount: 0, failedCount: 0 };
  if (hackathon.ageMin == null || hackathon.ageMax == null) {
    console.error(`Hackathon ${hackathonId} cannot notify subscriptions until its age range is reviewed`);
    return { matchedCount: 0, sentCount: 0, failedCount: 0 };
  }

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      ageMin: { lte: hackathon.ageMax },
      ageMax: { gte: hackathon.ageMin },
      OR: [{ format: null }, { format: hackathon.format as EventFormat | null }],
      AND: [{
        OR: [
          { directions: { none: {} } },
          { directions: { some: { directionId: { in: hackathon.directions.map(({ directionId }) => directionId) } } } },
        ],
      }],
    },
    select: { id: true, email: true, token: true },
  });

  await prisma.subscriptionMatch.createMany({
    data: subscriptions.map(({ id }) => ({ subscriptionId: id, hackathonId })),
    skipDuplicates: true,
  });

  const pending = await prisma.subscriptionMatch.findMany({
    where: {
      hackathonId,
      status: { in: ['PENDING', 'FAILED'] },
      subscriptionId: { in: subscriptions.map(({ id }) => id) },
    },
    include: { subscription: { select: { email: true, token: true } } },
  });

  const results = await Promise.allSettled(pending.map(async (match) => {
    try {
      await sendHackathonNotice({
        email: match.subscription.email,
        title: hackathon.title,
        slug: hackathon.slug,
        unsubscribeToken: match.subscription.token,
      });
      await prisma.subscriptionMatch.update({
        where: { id: match.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка отправки письма';
      await prisma.subscriptionMatch.update({
        where: { id: match.id },
        data: { status: 'FAILED', attempts: { increment: 1 }, lastError: message },
      });
      throw error;
    }
  }));
  const failedCount = results.filter((result) => result.status === 'rejected').length;
  if (failedCount) console.error(`Hackathon ${hackathonId}: ${failedCount} subscription emails failed and were recorded for retry`);
  return { matchedCount: subscriptions.length, sentCount: results.length - failedCount, failedCount };
}
