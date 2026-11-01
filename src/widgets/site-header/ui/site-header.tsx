'use client';

import Link from 'next/link';
import { ArrowUpRight, Code2, Menu, X } from 'lucide-react';
import { useUiState } from '@/shared/lib/ui-state';

export function SiteHeader() {
  const { mobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useUiState();
  return (
    <header className="site-header">
      <div className="shell flex h-[76px] items-center justify-between">
        <Link href="/" className="brand" aria-label="HackTeen — на главную">
          <span className="brand__mark"><Code2 size={21} strokeWidth={2.5} /></span>
          <span>hack<span className="brand__accent">teen</span><small>ИТ-события для школьников</small></span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Главная навигация">
          <Link className="nav-link" href="/#events">Хакатоны</Link>
          <Link className="nav-link" href="/#directions">Направления</Link>
          <Link className="nav-link" href="/#about">О проекте</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/subscribe" className="button button--small button--outline hidden sm:inline-flex">Подписаться</Link>
          <Link href="/admin" className="button button--small button--primary hidden sm:inline-flex">Организаторам <ArrowUpRight size={15} /></Link>
          <button className="icon-link md:hidden" aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={mobileMenuOpen} onClick={toggleMobileMenu}>{mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </div>
      {mobileMenuOpen && <nav className="mobile-nav" aria-label="Мобильная навигация">{[['Хакатоны', '/#events'], ['Направления', '/#directions'], ['О проекте', '/#about'], ['Подписаться', '/subscribe']].map(([label, href]) => <Link href={href} key={href} onClick={closeMobileMenu}>{label}</Link>)}</nav>}
    </header>
  );
}
