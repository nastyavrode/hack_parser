'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { directionCatalog } from '@/entities/direction/model/directions';

type EventDraft = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  ageMin: number | null;
  ageMax: number | null;
  startsAt: string | null;
  endsAt: string | null;
  registrationDeadline: string | null;
  registrationUrl: string | null;
  logoUrl: string | null;
  prizeDescription: string | null;
  organizerName: string | null;
  format: string | null;
  priceType: string;
  location: string;
  directionSlugs: string[];
};

function localDate(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

export function HackathonEditForm({ event }: { event: EventDraft }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await fetch(`/api/hackathons/${encodeURIComponent(event.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Не удалось сохранить изменения');
    },
    onSuccess: () => router.refresh(),
  });

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const values = new FormData(formEvent.currentTarget);
    const startsAt = values.get('startsAt');
    const endsAt = values.get('endsAt');
    const deadline = values.get('registrationDeadline');
    const ageMin = String(values.get('ageMin') ?? '');
    const ageMax = String(values.get('ageMax') ?? '');
    const format = values.get('format');
    const payload = {
      slug: values.get('slug'),
      title: values.get('title'),
      summary: values.get('summary'),
      description: values.get('description'),
      ageMin: ageMin ? Number(ageMin) : undefined,
      ageMax: ageMax ? Number(ageMax) : undefined,
      startsAt: startsAt ? new Date(String(startsAt)).toISOString() : undefined,
      endsAt: endsAt ? new Date(String(endsAt)).toISOString() : undefined,
      registrationDeadline: deadline ? new Date(String(deadline)).toISOString() : null,
      registrationUrl: values.get('registrationUrl') || null,
      logoUrl: values.get('logoUrl') || null,
      prizeDescription: values.get('prizeDescription') || null,
      organizerName: values.get('organizerName') || null,
      format: format || undefined,
      priceType: values.get('priceType'),
      location: values.get('location'),
      directionSlugs: values.getAll('directions'),
    };
    setMessage('');
    try {
      await mutation.mutateAsync(payload);
      setMessage('Изменения сохранены.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить изменения');
    }
  }

  return (
    <details className="edit-event">
      <summary>Редактировать</summary>
      <form className="create-event-form" onSubmit={submit}>
        <label className="field-label">Название<input className="text-input" name="title" defaultValue={event.title} required minLength={5} maxLength={240} /></label>
        <label className="field-label">URL-адрес<input className="text-input" name="slug" defaultValue={event.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
        <label className="field-label">Короткое описание<textarea className="text-input" name="summary" defaultValue={event.summary} required minLength={20} maxLength={500} rows={2} /></label>
        <label className="field-label">Описание<textarea className="text-input" name="description" defaultValue={event.description} required minLength={40} maxLength={20000} rows={4} /></label>
        <label className="field-label">Организатор<input className="text-input" name="organizerName" defaultValue={event.organizerName ?? ''} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="field-label">Возраст от<input className="text-input" type="number" name="ageMin" min={6} max={18} defaultValue={event.ageMin ?? ''} /></label><label className="field-label">Возраст до<input className="text-input" type="number" name="ageMax" min={6} max={18} defaultValue={event.ageMax ?? ''} /></label></div>
        <div className="grid grid-cols-2 gap-3"><label className="field-label">Начало<input className="text-input" type="datetime-local" name="startsAt" defaultValue={localDate(event.startsAt)} /></label><label className="field-label">Окончание<input className="text-input" type="datetime-local" name="endsAt" defaultValue={localDate(event.endsAt)} /></label></div>
        <label className="field-label">Дедлайн регистрации<input className="text-input" type="datetime-local" name="registrationDeadline" defaultValue={localDate(event.registrationDeadline)} /></label>
        <label className="field-label">Ссылка регистрации<input className="text-input" type="url" name="registrationUrl" defaultValue={event.registrationUrl ?? ''} /></label>
        <label className="field-label">Логотип<input className="text-input" type="url" name="logoUrl" defaultValue={event.logoUrl ?? ''} /></label>
        <label className="field-label">Призовой фонд<input className="text-input" name="prizeDescription" defaultValue={event.prizeDescription ?? ''} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="field-label">Формат<select className="text-input" name="format" defaultValue={event.format ?? ''}><option value="">Не указан</option><option value="ONLINE">Онлайн</option><option value="OFFLINE">Очно</option><option value="HYBRID">Гибрид</option></select></label><label className="field-label">Стоимость<select className="text-input" name="priceType" defaultValue={event.priceType}><option value="UNKNOWN">Неизвестно</option><option value="FREE">Бесплатно</option><option value="PAID">Платно</option></select></label></div>
        <label className="field-label">Локация<select className="text-input" name="location" defaultValue={event.location}><option value="barnaul">Барнаул</option><option value="altai">Алтайский край</option><option value="russia">Россия</option><option value="international">Международное</option><option value="global">Онлайн без региона</option></select></label>
        <fieldset><legend className="field-label mb-2">Направления</legend><div className="direction-checkboxes">{directionCatalog.map(({ slug, name }) => <label key={slug}><input type="checkbox" name="directions" value={slug} defaultChecked={event.directionSlugs.includes(slug)} />{name}</label>)}</div></fieldset>
        <button type="submit" className="button button--primary w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Сохраняем…' : 'Сохранить изменения'}</button>
        {message && <p className="text-xs text-slate-600" role="status">{message}</p>}
      </form>
    </details>
  );
}
