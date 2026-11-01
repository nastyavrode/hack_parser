'use client';

import { signIn } from 'next-auth/react';
import { ArrowUpRight } from 'lucide-react';

export function GithubSignInButton() {
  return (
    <button
      className="button button--primary"
      type="button"
      onClick={() => signIn('github', { callbackUrl: '/admin' })}
    >
      Войти через GitHub <ArrowUpRight size={16} />
    </button>
  );
}
