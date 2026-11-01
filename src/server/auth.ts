import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/shared/lib/prisma';

const githubClientId = process.env.AUTH_GITHUB_ID?.trim();
const githubClientSecret = process.env.AUTH_GITHUB_SECRET?.trim();

export function isGithubAuthConfigured() {
  return Boolean(githubClientId && githubClientSecret);
}

const providers = isGithubAuthConfigured()
  ? [GitHub({ clientId: githubClientId!, clientSecret: githubClientSecret! })]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: 'database' },
  pages: {
    signIn: '/admin',
  },
  events: {
    async signIn({ user }) {
      if (!user.email) return;
      const email = user.email.trim().toLowerCase();
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const moderators = (process.env.MODERATOR_EMAILS ?? '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      const roleId = email === adminEmail ? 'admin' : moderators.includes(email) ? 'moderator' : 'user';
      await prisma.user.updateMany({ where: { email }, data: { roleId } });
    },
  },
});
