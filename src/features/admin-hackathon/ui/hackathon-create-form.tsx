'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { directionCatalog } from '@/entities/direction/model/directions';

export function HackathonCreateForm() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const mutation = useMutation({
    mutationFn: async (payload: object) => {
      const response = await fetch('/api/hackathons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Не удалось добавить мероприятие');
      return result;
    },
    onSuccess: () => router.refresh(),
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      title: values.get('title'),
      slug: values.get('slug'),
      summary: values.get('summary'),
      description: values.get('description'),
      format: values.get('format'),
      priceType: values.get('priceType'),
      ageMin: Number(values.get('ageMin')),
      ageMax: Number(values.get('ageMax')),
      startsAt: new Date(String(values.get('startsAt'))).toISOString(),
      endsAt: new Date(String(values.get('endsAt'))).toISOString(),
      registrationDeadline: values.get('registrationDeadline') ? new Date(String(values.get('registrationDeadline'))).toISOString() : null,
      registrationUrl: values.get('registrationUrl') || null,
      logoUrl: values.get('logoUrl') || null,
      prizeDescription: values.get('prizeDescription') || null,
      organizerName: values.get('organizerName') || null,
      location: values.get('location'),
      directionSlugs: values.getAll('directions'),
    };
    setMessage('');
    try {
      await mutation.mutateAsync(payload);
      form.reset();
      setMessage('Событие добавлено в очередь модерации.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось добавить мероприятие');
    }
  }

  return (
    <form className="create-event-form" onSubmit={submit}>
      <h2>Добавить мероприятие</h2><p>Новое событие появится в публичном каталоге после публикации.</p>
      <label className="field-label">Название<input className="text-input" name="title" required minLength={5} maxLength={240} /></label>
      <label className="field-label">URL-адрес <span className="field-hint">латиницей, например python-cup</span><input className="text-input" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
      <label className="field-label">Короткое описание<textarea className="text-input" name="summary" required minLength={20} maxLength={500} rows={2} /></label>
      <label className="field-label">Описание<textarea className="text-input" name="description" required minLength={40} maxLength={20000} rows={4} /></label>
      <label className="field-label">Требования к участникам<textarea className="text-input" name="requirements" maxLength={20000} rows={2} /></label>
      <label className="field-label">Организатор<input className="text-input" name="organizerName" /></label>
      <label className="field-label">Призовой фонд<input className="text-input" name="prizeDescription" maxLength={500} placeholder="Например, гранты и подарки" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="field-label">Возраст от<input className="text-input" type="number" name="ageMin" min={6} max={18} defaultValue={11} required /></label><label className="field-label">Возраст до<input className="text-input" type="number" name="ageMax" min={6} max={18} defaultValue={18} required /></label></div>
      <div className="grid grid-cols-2 gap-3"><label className="field-label">Начало<input className="text-input" type="datetime-local" name="startsAt" required /></label><label className="field-label">Окончание<input className="text-input" type="datetime-local" name="endsAt" required /></label></div>
      <label className="field-label">Дедлайн регистрации<input className="text-input" type="datetime-local" name="registrationDeadline" /></label>
      <label className="field-label">Ссылка для регистрации<input className="text-input" name="registrationUrl" type="url" placeholder="https://" /></label>
      <label className="field-label">Логотип мероприятия<input className="text-input" name="logoUrl" type="url" placeholder="https://" /></label>
      <label className="field-label">Локация<select className="text-input" name="location"><option value="barnaul">Барнаул</option><option value="altai">Алтайский край</option><option value="russia">Россия</option><option value="international">Международное</option><option value="global">Онлайн без региона</option></select></label>
      <div className="grid grid-cols-2 gap-3"><label className="field-label">Формат<select className="text-input" name="format"><option value="ONLINE">Онлайн</option><option value="OFFLINE">Очно</option><option value="HYBRID">Гибрид</option></select></label><label className="field-label">Стоимость<select className="text-input" name="priceType"><option value="UNKNOWN">Неизвестно</option><option value="FREE">Бесплатно</option><option value="PAID">Платно</option></select></label></div>
      <fieldset><legend className="field-label mb-2">Направления</legend><div className="direction-checkboxes">{directionCatalog.map(({ slug, name }) => <label key={slug}><input type="checkbox" name="directions" value={slug} />{name}</label>)}</div></fieldset>
      <button type="submit" className="button button--primary mt-5 w-full" disabled={mutation.isPending}>{mutation.isPending ? 'Добавляем…' : 'Добавить на модерацию'} <ArrowRight size={15} /></button>
      {message && <p className="mt-3 text-sm text-slate-600" role="status">{message}</p>}
    </form>
  );
}
