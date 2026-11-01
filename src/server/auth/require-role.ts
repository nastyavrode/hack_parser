import { auth } from '@/server/auth';
import { prisma } from '@/shared/lib/prisma';

export async function getCurrentRole() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: { select: { id: true } } },
  });

  return user?.role.id ?? null;
}

export async function hasModeratorAccess() {
  const role = await getCurrentRole();
  return role === 'admin' || role === 'moderator';
}
