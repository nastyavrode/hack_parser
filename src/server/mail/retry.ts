import { DeliveryStatus } from '@prisma/client';
import { notifyMatchingSubscriptions } from '@/server/services/subscription-notifications';
import { prisma } from '@/shared/lib/prisma';

async function retryFailedNotifications() {
  const failed = await prisma.subscriptionMatch.findMany({
    where: { status: DeliveryStatus.FAILED },
    select: { hackathonId: true },
    distinct: ['hackathonId'],
  });
  let failures = 0;
  for (const { hackathonId } of failed) {
    await prisma.subscriptionMatch.updateMany({
      where: { hackathonId, status: DeliveryStatus.FAILED },
      data: { status: DeliveryStatus.PENDING },
    });
    const result = await notifyMatchingSubscriptions(hackathonId);
    failures += result.failedCount;
    console.info(`[notifications] event ${hackathonId}: ${result.sentCount} sent, ${result.failedCount} failed`);
  }
  if (failures) process.exitCode = 1;
}

retryFailedNotifications()
  .catch((error: unknown) => {
    console.error('Failed to retry subscription emails', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
