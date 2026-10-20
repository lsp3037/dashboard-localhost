'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { GridIcon, SlidersIcon } from '@/components/ui/icons';

const LINKS = [
  { href: '/', label: 'Projetos', icon: GridIcon },
  { href: '/settings', label: 'Configurações', icon: SlidersIcon },
] as const;

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' || pathname.startsWith('/projects') : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={[
              'inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-[12px] transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent',
              active
                ? 'border-hub-border-strong bg-hub-surface-raised text-hub-text'
                : 'border-transparent text-hub-text-muted hover:border-hub-border hover:text-hub-text',
            ].join(' ')}
          >
            <Icon width={13} height={13} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
