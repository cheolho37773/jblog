'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { MENUS, PREFETCH, type Menu } from './menus';

function isActive(pathname: string, menu: Menu): boolean {
  if (menu.match === 'exact') return pathname === menu.href;
  if (menu.match === 'prefix') {
    // 경로 단위로 비교한다. 문자열 접두어로 비교하면 /blogger가 Blog로 잡힌다.
    return pathname === menu.href || pathname.startsWith(`${menu.href}/`);
  }
  return false;
}

type NavLinksProps = {
  'aria-label'?: string;
  className?: string;
  listClassName?: string;
  linkClassName?: string;
  /** 링크를 눌렀을 때 (모바일 메뉴를 닫는 데 쓴다) */
  onNavigate?: () => void;
};

export function NavLinks({
  'aria-label': ariaLabel = '주요 메뉴',
  className,
  listClassName,
  linkClassName,
  onNavigate,
}: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ul className={cn('flex', listClassName)}>
        {MENUS.map((menu) => {
          const active = isActive(pathname, menu);
          return (
            <li key={menu.href}>
              <Link
                href={menu.href}
                prefetch={PREFETCH}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
                className={cn(
                  'text-b4 text-nav-text hover:text-primary-text inline-flex min-h-11 items-center',
                  active && 'text-primary-text font-medium',
                  linkClassName,
                )}
              >
                {menu.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
