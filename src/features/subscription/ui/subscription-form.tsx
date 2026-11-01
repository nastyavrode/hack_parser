'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { directionCatalog } from '@/entities/direction/model/directions';

const directionOptions = directionCatalog.filter(({ slug }) =>
  ['web-development', 'python', 'ai-machine-learning', 'game-development', 'robotics', 'ui-ux-design'].includes(slug),
);

export function SubscriptionForm() {
  const [message, setMessage] = useState('');
  const mutation = useMutation({
    mutationFn: async (payload: {
      email: FormDataEntryValue | null;
      ageMin: number;
      ageMax: number;
      format: FormDataEntryValue | null;
      directionSlugs: FormDataEntryValue[];
    }) => {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Не удалось сохранить подписку');
      return data;
    },
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const ageRange = String(formData.get('ageRange')).split('-').map(Number);
    try {
      await mutation.mutateAsync({
      email: formData.get('email'),
      ageMin: ageRange[0],
      ageMax: ageRange[1],
      format: formData.get('format') || null,
      directionSlugs: formData.getAll('directions'),
      });
      setMessage('Готово! Будем присылать подходящие мероприятия на почту.');
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить подписку');
    }
  }

  return (
    <form id="subscription-form" className="subscription-form" onSubmit={submit}>
      <label className="field-label" htmlFor="subscription-email">Электронная почта</label>
      <input id="subscription-email" name="email" type="email" required maxLength={254} placeholder="you@example.com" className="text-input" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="subscription-age">Возраст участника</label>
          <select id="subscription-age" name="ageRange" className="text-input" defaultValue="11-13">
            <option value="6-10">6–10 лет</option><option value="11-13">11–13 лет</option><option value="14-16">14–16 лет</option><option value="17-18">17–18 лет</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Будут выбраны мероприятия, где подходит этот возраст.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="subscription-format">Формат</label>
          <select id="subscription-format" name="format" className="text-input" defaultValue="">
            <option value="">Любой формат</option><option value="ONLINE">Онлайн</option><option value="OFFLINE">Очно</option><option value="HYBRID">Гибрид</option>
          </select>
        </div>
      </div>
      <fieldset className="mt-5">
        <legend className="field-label mb-3">Интересующие направления</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {directionOptions.map(({ slug, name }) => (
            <label key={slug} className="checkbox-option"><input type="checkbox" name="directions" value={slug} /><span>{name}</span></label>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Если ничего не выбрано, уведомим обо всех направлениях.</p>
      </fieldset>
      <button type="submit" className="button button--primary mt-6 w-full" disabled={mutation.isPending}>
        {mutation.isPending ? 'Сохраняем…' : 'Подписаться на обновления'} <ArrowRight size={16} />
      </button>
      {message && <p className="mt-4 flex items-start gap-2 text-sm text-slate-700" role="status"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={17} />{message}</p>}
      <p className="mt-4 text-center text-xs leading-5 text-slate-500">Никакого спама — только подходящие события. Отписаться можно в любой момент.</p>
    </form>
  );
}
