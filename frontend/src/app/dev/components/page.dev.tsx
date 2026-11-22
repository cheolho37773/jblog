import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { Section as LayoutSection } from '@/components/layout/Section';
import { PageInfo } from '@/components/layout/PageInfo';
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
// 컴포넌트에 hover 스타일이 아직 없어 hover 예제는 기본과 같다. 스타일이 생기면 여기서 고정 클래스를 준다.
const FIXED_HOVER = '';

const BUTTON_VARIANTS = ['primary', 'outline', 'icon', 'pillSolid', 'pillOutline'] as const;
const BUTTON_STATES = ['default', 'hover', 'focus', 'disabled'] as const;
const STATE_CLASS: Record<(typeof BUTTON_STATES)[number], string> = {
  default: '',
  hover: FIXED_HOVER,
  focus: FIXED_FOCUS_RING,
  disabled: '',
};
// 대비 E2E가 기본 예제를 이름(GitHub)으로 찾는다.
const ICON_BUTTON_LABEL = {
  default: 'GitHub',
  hover: 'icon hover',
  focus: 'icon focus',
  disabled: 'icon disabled',
} as const;
// 연락처는 실제 값이 아닌 example.com 예시다.
const EXAMPLE_FOOTER = {
  about: '기술과 기록을 모아 두는 개인 블로그입니다.',
  contact: { email: 'hello@example.com', githubUrl: 'https://github.com/example' },
  categories: ['React', 'TypeScript', 'NestJS', 'Prisma', 'DevOps', 'Career', 'Extra'].map(
    (name) => ({ name, slug: name.toLowerCase() }),
  ),
};
const AVATAR_SIZES = [28, 40, 80];
// 외부 URL·실제 인물 사진을 쓰지 않는 단색 더미 이미지
const AVATAR_IMAGE = '/dev/avatar-dummy.png';

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
  'bg-primary-strong',
  'bg-primary-text',
  'bg-on-primary',
  'bg-danger',
  'bg-icon-button-bg',
  'bg-toggle-knob',
  'bg-toggle-knob-icon',
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

// wide: 내용이 자기 Container를 가진 컴포넌트(Footer)는 개발 페이지 컨테이너 밖(전체 폭)에 둬야 실제 폭으로 보인다.
function Section({
  id,
  title,
  wide = false,
  children,
}: {
  id: string;
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  if (wide) {
    return (
      <section data-testid={id} className="border-border border-t py-8">
        <div className="container-site mb-4">
          <h2 className="text-h4 text-strong">{title}</h2>
        </div>
        {children}
      </section>
    );
  }
  return (
    <section data-testid={id} className="border-border border-t py-8">
      <div className="container-site flex flex-col gap-4">
        <h2 className="text-h4 text-strong">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>;
}

export default function ComponentsPage() {
  return (
    <main className="text-body py-8">
      <header className="container-site flex items-center justify-between gap-4 pb-8">
        <h1 className="text-h3-bold text-strong">Components</h1>
        <ThemeToggle />
      </header>

      <Section id="dev-badge" title="Badge">
        <Row>
          <Badge variant="solid" data-example="solid-md">
            solid md
          </Badge>
          <Badge variant="solid" size="lg" data-example="solid-lg">
            solid lg
          </Badge>
          <Badge variant="soft" data-example="soft-md">
            soft md
          </Badge>
          <Badge variant="soft" size="lg" data-example="soft-lg">
            soft lg
          </Badge>
          <Badge href="#badge-link" data-example="link">
            link
          </Badge>
        </Row>
      </Section>

      <Section id="dev-button" title="Button">
        {BUTTON_VARIANTS.map((variant) => (
          <Row key={variant}>
            {BUTTON_STATES.map((state) => (
              <Button
                key={state}
                variant={variant}
                data-example={`${variant}-${state}`}
                disabled={state === 'disabled'}
                aria-label={variant === 'icon' ? ICON_BUTTON_LABEL[state] : undefined}
                className={STATE_CLASS[state]}
              >
                {variant === 'icon' ? (
                  <Icon name="github" />
                ) : state === 'default' ? (
                  variant
                ) : (
                  state
                )}
              </Button>
            ))}
          </Row>
        ))}
        <Row>
          <Button asChild variant="pillOutline">
            <a href="#button-link">asChild 링크</a>
          </Button>
          <Button asChild variant="outline" disabled>
            <a href="#button-link-disabled">asChild 비활성</a>
          </Button>
        </Row>
      </Section>

      <Section id="dev-avatar" title="Avatar">
        <Row>
          {AVATAR_SIZES.map((size) => (
            <Avatar
              key={`i${size}`}
              src={AVATAR_IMAGE}
              alt="더미 이미지"
              size={size}
              data-example={`image-${size}`}
            />
          ))}
          {AVATAR_SIZES.map((size) => (
            <Avatar key={`t${size}`} alt="Jason" size={size} data-example={`initials-${size}`} />
          ))}
          <Avatar alt="홍길동" size={48} />
        </Row>
      </Section>

      <Section id="dev-input" title="Input">
        <div className="flex max-w-80 flex-col gap-4">
          <Input label="기본" placeholder="you@example.com" data-example="default" />
          <Input label="포커스 (고정)" className={FIXED_FOCUS_RING} data-example="focus" />
          <Input
            label="오류"
            defaultValue="abc"
            error="올바른 이메일을 입력하세요"
            data-example="error"
          />
          <Input label="비활성" disabled placeholder="disabled" data-example="disabled" />
        </div>
      </Section>

      <Section id="dev-searchinput" title="SearchInput">
        <div className="flex max-w-80 flex-col gap-4">
          <SearchInput placeholder="Search" data-example="default" />
          <SearchInput
            placeholder="포커스 (고정)"
            className={FIXED_FOCUS_RING}
            data-example="focus"
          />
          <SearchInput placeholder="disabled" disabled data-example="disabled" />
        </div>
      </Section>

      <Section id="dev-themetoggle" title="ThemeToggle">
        <ThemeToggle />
      </Section>

      <Section id="dev-icon" title="Icon">
        <Row>
          <span data-example="lucide">
            <Icon name="search" size={24} />
          </span>
          <span data-example="simple">
            <Icon name="github" size={24} />
          </span>
          <span data-example="labelled">
            <Icon name="mail" label="메일" size={24} />
          </span>
          <Icon name="sun" size={24} />
          <Icon name="moon" size={24} />
          <Icon name="x" size={24} />
          <Icon name="youtube" size={24} />
        </Row>
      </Section>

      <Section id="dev-layout-navbar" title="Navbar">
        <Navbar sticky={false} />
      </Section>

      <Section id="dev-layout-footer" title="Footer (예시 값)" wide>
        <Footer {...EXAMPLE_FOOTER} />
      </Section>

      <Section id="dev-layout-footer-empty" title="Footer (값 없음)" wide>
        <Footer />
      </Section>

      <Section id="dev-layout-pageinfo" title="PageInfo">
        <PageInfo title="Blog" breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Blog' }]} />
      </Section>

      <Section id="dev-layout-sections" title="Section 간격 (연속 2개)">
        {/* 부모가 flex gap을 가지면 Section 사이 간격에 더해지므로 일반 블록으로 한 번 감싼다 */}
        <div>
          <LayoutSection data-example="section-a">
            <p>Section A</p>
          </LayoutSection>
          <LayoutSection data-example="section-b">
            <p>Section B</p>
          </LayoutSection>
          <LayoutSection title="제목 있는 Section" data-example="section-titled">
            <p>Section 내용</p>
          </LayoutSection>
        </div>
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
