import Link from 'next/link';
import { ArrowLeft, BellRing, Check } from 'lucide-react';
import { SubscriptionForm } from '@/features/subscription/ui/subscription-form';

type SubscribeProps = { searchParams: Promise<{ unsubscribed?: string }> };

export default async function SubscribePage({ searchParams }: SubscribeProps) {
  const { unsubscribed } = await searchParams;
  return (
    <main className="subscribe-page">
      <div className="shell">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> На главную</Link>
        <div className="subscribe-layout">
          <section className="subscribe-copy">
            <span className="subscribe-icon"><BellRing size={25} /></span>
            <p className="eyebrow">Всегда в курсе</p>
            <h1>Твой следующий<br /><span>шанс — в почте</span></h1>
            <p>Расскажи, что тебе интересно. Пришлём только актуальные соревнования для твоего возраста и любимых направлений.</p>
            <ul>{['Только проверенные мероприятия', 'Подборка по твоим интересам', 'Отписка в один клик'].map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul>
          </section>
          <section className="subscribe-panel">
            {unsubscribed && <p className="unsubscribe-message">Ты отписался от уведомлений.</p>}
            <h2>Настроить уведомления</h2><p className="subscribe-panel__lead">Заполни пару деталей — остальное мы сделаем сами.</p>
            <SubscriptionForm />
          </section>
        </div>
      </div>
    </main>
  );
}
