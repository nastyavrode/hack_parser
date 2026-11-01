import Link from 'next/link';
import { ArrowUpRight, Code2 } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="site-footer" id="about">
      <div className="shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" className="brand">
            <span className="brand__mark"><Code2 size={19} /></span>
            <span>hack<span className="brand__accent">teen</span><small>ИТ-события для школьников</small></span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-6 text-slate-500">Помогаем школьникам находить соревнования, единомышленников и проекты, которые меняют мир.</p>
        </div>
        <div>
          <p className="footer-heading">Исследуй</p>
          <Link href="/#events" className="footer-link">Все мероприятия</Link>
          <Link href="/archive" className="footer-link">Архив мероприятий</Link>
          <Link href="/#directions" className="footer-link">Направления</Link>
          <Link href="/subscribe" className="footer-link">Уведомления о новых событиях</Link>
        </div>
        <div>
          <p className="footer-heading">Для организаторов</p>
          <Link href="/admin" className="footer-link">Добавить мероприятие <ArrowUpRight size={14} /></Link>
          <p className="mt-4 text-xs leading-5 text-slate-500">События проверяются модераторами. Регистрация проходит на сайте организатора.</p>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© {new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Barnaul' }).format(new Date())} HackTeen</span><span>Создано для тех, кто хочет создавать</span></div>
    </footer>
  );
}
