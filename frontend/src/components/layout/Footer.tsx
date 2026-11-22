import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { Container } from './Container';
import { Logo } from './Logo';
import { MENUS, PREFETCH, RSS_HREF } from './menus';

const MAX_CATEGORIES = 6;

type FooterProps = {
  about?: string;
  contact?: { email?: string; githubUrl?: string };
  categories?: { name: string; slug: string }[];
};

// 목록 항목 사이는 tablet 이상에서 8px(UI §5.9). 모바일에서 링크 한 줄이 44x44 터치 타겟(UI §4.2)이 되게 한다. 데스크톱은 글자 크기만큼.
const LINK_CLASS =
  'text-footer-body text-footer-link font-jakarta hover:text-primary-text flex w-fit items-center max-tablet:min-h-11 max-tablet:min-w-11';

function LinkColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-footer-title font-jakarta text-strong mb-4 tablet:mb-6">{title}</h2>
      <ul className="flex flex-col tablet:gap-2">{children}</ul>
    </div>
  );
}

function ContactCard({ email, githubUrl }: { email?: string; githubUrl?: string }) {
  if (!email && !githubUrl) return null;
  return (
    <div className="bg-footer-card border-border flex flex-col gap-7.5 rounded-lg border p-8">
      <h2 className="text-h4 text-strong">Contact Me</h2>
      {/* 연락처는 복사 방지 예외다 (프론트엔드 §7) */}
      <div className="allow-select flex flex-col items-start gap-2">
        {email && (
          <a href={`mailto:${email}`} className={cn(LINK_CLASS, 'min-h-11 break-all')}>
            {email}
          </a>
        )}
        {githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className={cn(LINK_CLASS, 'min-h-11 min-w-11 justify-center')}
          >
            <Icon name="github" size={24} />
          </a>
        )}
      </div>
    </div>
  );
}

function CategoryColumn({ categories }: { categories: FooterProps['categories'] }) {
  const visible = categories?.slice(0, MAX_CATEGORIES) ?? [];
  if (visible.length === 0) return null;

  return (
    <LinkColumn title="Category">
      {visible.map((category) => (
        <li key={category.slug}>
          <Link
            href={`/blog?category=${encodeURIComponent(category.slug)}`}
            prefetch={PREFETCH}
            className={LINK_CLASS}
          >
            {category.name}
          </Link>
        </li>
      ))}
    </LinkColumn>
  );
}

function QuickLinkColumn() {
  return (
    <LinkColumn title="Quick Link">
      {MENUS.map((menu) => (
        <li key={menu.href}>
          <Link href={menu.href} prefetch={PREFETCH} className={LINK_CLASS}>
            {menu.label}
          </Link>
        </li>
      ))}
      <li>
        {/* 라우트가 아닌 파일이라 next/link 대신 일반 링크 */}
        <a href={RSS_HREF} className={LINK_CLASS}>
          RSS
        </a>
      </li>
    </LinkColumn>
  );
}

// >= 1280은 원본 3덩어리 폭(Info 289 · Links 495 · 카드 392)과 칸 사이 20px(UI §5.9). 칸이 없으면 나머지가 왼쪽부터 이어진다.

/**
 * 사이트 Footer (UI §5.9). 값을 받지 못한 칸은 통째로 숨긴다. 값은 API가 붙는 M2~M3에서 넘긴다.
 * role을 명시한 이유: <main> 안에 놓이면(개발 페이지 미리보기) 브라우저가 contentinfo로 보지 않는다.
 */
export function Footer({ about, contact, categories }: FooterProps) {
  return (
    <footer role="contentinfo" className="bg-footer-bg border-border border-t">
      <Container className="pt-16 pb-8">
        <div className="grid gap-10 tablet:grid-cols-2 laptop:grid-cols-[minmax(0,18rem)_auto_minmax(0,24rem)] laptop:justify-between desktop:flex desktop:justify-start desktop:gap-5">
          {about && (
            <div className="desktop:w-[289px] desktop:shrink-0">
              <h2 className="text-footer-title font-jakarta text-strong mb-4">About</h2>
              <p className="text-footer-body text-muted font-jakarta max-w-70">{about}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-6 laptop:gap-20 desktop:w-[495px] desktop:shrink-0">
            <QuickLinkColumn />
            <CategoryColumn categories={categories} />
          </div>
          <div className="tablet:col-span-2 laptop:col-span-1 desktop:w-[392px] desktop:shrink-0 empty:hidden">
            <ContactCard email={contact?.email} githubUrl={contact?.githubUrl} />
          </div>
        </div>
        <div className="border-border mt-16 flex flex-col items-center gap-2 border-t pt-8 tablet:flex-row tablet:justify-between">
          <Logo />
          <p className="text-footer-body text-muted font-jakarta text-center">
            © {new Date().getFullYear()} jblog. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
