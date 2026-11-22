import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

// 개발 전용 페이지다. JBLOG_DEV_PAGES=1 빌드에서만 라우트가 되고 운영 빌드에는 들어가지 않는다 (next.config.ts).
export const metadata: Metadata = {
  title: 'Components (dev)',
  robots: { index: false, follow: false },
};

// hover·focus는 마우스·키보드 없이 눈으로 볼 수 있게 같은 스타일을 고정해 보여준다.
const FIXED_FOCUS_RING = 'outline-2 outline-offset-2 outline-primary';

const COLOR_SWATCHES = [
  'bg-bg',
  'bg-bg-subtle',
  'bg-surface',
  'bg-surface-2',
  'bg-border',
  'bg-border-strong',
  'bg-strong',
  'bg-body',
  'bg-muted',
  'bg-subtle',
  'bg-nav-text',
  'bg-primary',
  'bg-primary-soft',
  'bg-input-bg',
  'bg-input-placeholder',
  'bg-footer-bg',
  'bg-footer-link',
  'bg-toggle-track',
  'bg-overlay',
];

const TYPE_SAMPLES = [
  'text-h1',
  'text-h3',
  'text-h3-bold',
  'text-h4',
  'text-b2',
  'text-b3',
  'text-b4',
  'text-b4-medium',
  'text-b5',
  'text-b5-medium',
  'type-article',
  'type-quote',
  'text-footer-logo',
  'text-footer-title',
  'text-footer-body',
  'text-footer-label',
  'text-display-hero',
  'text-display-section',
  'text-eyebrow',
  'text-intro',
  'text-exp-title',
  'text-exp-body',
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section data-testid={id} className="border-border flex flex-col gap-4 border-t py-8">
      <h2 className="text-h4 text-strong">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>;
}

export default function ComponentsPage() {
  return (
    <main className="container-site text-body py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-h3-bold text-strong">Components</h1>
        <ThemeToggle />
      </header>

      <Section id="dev-badge" title="Badge">
        <Row>
          <Badge variant="solid">solid md</Badge>
          <Badge variant="solid" size="lg">
            solid lg
          </Badge>
          <Badge variant="soft">soft md</Badge>
          <Badge variant="soft" size="lg">
            soft lg
          </Badge>
          <Badge href="#badge-link">link</Badge>
        </Row>
      </Section>

      <Section id="dev-button" title="Button">
        <Row>
          <Button variant="primary">primary</Button>
          <Button variant="outline">outline</Button>
          <Button variant="icon" aria-label="GitHub">
            <Icon name="github" />
          </Button>
          <Button variant="pillSolid">pillSolid</Button>
          <Button variant="pillOutline">pillOutline</Button>
        </Row>
        <Row>
          <Button variant="primary" className={FIXED_FOCUS_RING}>
            focus (고정)
          </Button>
          <Button variant="primary" disabled>
            disabled
          </Button>
          <Button variant="outline" disabled>
            disabled
          </Button>
          <Button asChild variant="pillOutline">
            <a href="#button-link">asChild 링크</a>
          </Button>
        </Row>
      </Section>

      <Section id="dev-avatar" title="Avatar">
        <Row>
          <Avatar alt="Jason" size={28} />
          <Avatar alt="Jason" size={36} />
          <Avatar alt="홍길동" size={48} />
          <Avatar alt="Jason" size={80} />
        </Row>
      </Section>

      <Section id="dev-input" title="Input">
        <div className="flex max-w-80 flex-col gap-4">
          <Input label="이메일" placeholder="you@example.com" />
          <Input label="포커스 (고정)" className={FIXED_FOCUS_RING} placeholder="focus" />
          <Input label="오류" defaultValue="abc" error="올바른 이메일을 입력하세요" />
          <Input label="비활성" disabled placeholder="disabled" />
        </div>
      </Section>

      <Section id="dev-searchinput" title="SearchInput">
        <div className="flex max-w-80 flex-col gap-4">
          <SearchInput placeholder="Search" />
          <SearchInput placeholder="포커스 (고정)" className={FIXED_FOCUS_RING} />
        </div>
      </Section>

      <Section id="dev-themetoggle" title="ThemeToggle">
        <ThemeToggle />
      </Section>

      <Section id="dev-icon" title="Icon">
        <Row>
          <Icon name="search" label="검색" size={24} />
          <Icon name="mail" size={24} />
          <Icon name="sun" size={24} />
          <Icon name="moon" size={24} />
          <Icon name="github" label="GitHub" size={24} />
          <Icon name="x" size={24} />
          <Icon name="youtube" size={24} />
        </Row>
      </Section>

      <Section id="dev-tokens" title="Tokens">
        <div className="grid grid-cols-2 gap-2 tablet:grid-cols-4 laptop:grid-cols-6">
          {COLOR_SWATCHES.map((swatch) => (
            <div key={swatch} className="text-b5 flex flex-col gap-1">
              <div className={`${swatch} border-border h-10 rounded-md border`} />
              <span className="break-all">{swatch.replace('bg-', '')}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {TYPE_SAMPLES.map((typeClass) => (
            <p key={typeClass} className={`${typeClass} text-strong`}>
              {typeClass} 가나다 Abc
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-display-section text-gradient-primary">text-gradient-primary</p>
          <p className="text-display-section text-gradient-orange">PROJECTS</p>
          <p className="text-display-section text-gradient-blue">EXPERIENCE</p>
        </div>
      </Section>
    </main>
  );
}
