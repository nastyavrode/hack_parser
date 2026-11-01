'use client';

import { useRouter } from 'next/navigation';
import { Check, EyeOff, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

export function ModerationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: async ({ method, body }: { method: 'PATCH' | 'DELETE'; body?: object }) => {
      const response = await fetch(`/api/hackathons/${encodeURIComponent(id)}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? 'Действие не выполнено');
      }
    },
    onSuccess: () => router.refresh(),
  });

  async function update(method: 'PATCH' | 'DELETE', body?: object) {
    try {
      await mutation.mutateAsync({ method, body });
    } catch { /* mutation.error is rendered below */ }
  }

  return (
    <div className="moderation-actions">
      {status === 'PENDING' && <button className="moderation-button moderation-button--approve" disabled={mutation.isPending} onClick={() => update('PATCH', { status: 'PUBLISHED' })}><Check size={15} />Опубликовать</button>}
      {status === 'PENDING' && <button className="moderation-button" disabled={mutation.isPending} onClick={() => update('PATCH', { status: 'REJECTED' })}>Отклонить</button>}
      {status === 'PUBLISHED' && <button className="moderation-button" disabled={mutation.isPending} onClick={() => update('PATCH', { status: 'PENDING' })}><EyeOff size={15} />Снять с публикации</button>}
      <button className="moderation-button moderation-button--delete" disabled={mutation.isPending} onClick={() => update('DELETE')} aria-label="Удалить мероприятие"><Trash2 size={15} /></button>
      {mutation.error && <span className="moderation-error" role="alert">{mutation.error.message}</span>}
    </div>
  );
}
