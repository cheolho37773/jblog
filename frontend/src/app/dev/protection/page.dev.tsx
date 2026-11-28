import type { Metadata } from 'next';
import { Footer } from '@/components/layout/Footer';
import { ProtectedShell } from '@/components/protection/ProtectedShell';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CodeBlock } from '@/lib/markdown/CodeBlock';

// 개발 전용 페이지다. JBLOG_DEV_PAGES=1 빌드에서만 라우트가 되고 운영 빌드에는 들어가지 않는다 (next.config.ts).
export const metadata: Metadata = {
  title: 'Protection (dev)',
  robots: { index: false, follow: false },
};

// 연락처 예외·주소 복사를 실제 (site) 화면에서는 볼 수 없어(연락처 값은 M4) 예시 값으로 보여 준다.
const EXAMPLE_CONTACT = { email: 'hello@example.com', githubUrl: 'https://github.com/example' };

const CODE_LINES = ['const greeting = "hello";', 'console.log(greeting);'];

const BODY_TEXT =
  '이 문단은 복사 방지가 적용된 본문입니다. 트리플클릭이나 드래그로 선택할 수 없고, 복사 단축키와 우클릭 메뉴도 막힙니다.';

/** SiteChrome과 같은 ProtectedShell을 써서, 실제 사이트와 같은 보호 동작을 확인하는 페이지 */
export default function ProtectionPreviewPage() {
  return (
    <ProtectedShell>
      <main className="text-body container-site flex flex-col gap-8 py-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-h3-bold text-strong">Protection</h1>
          <ThemeToggle />
        </header>

        <p data-testid="protection-body">{BODY_TEXT}</p>

        <div data-testid="protection-contact" className="allow-select flex flex-col gap-1">
          <p data-testid="protection-contact-email">{EXAMPLE_CONTACT.email}</p>
          <p>github.com/example</p>
        </div>

        <p data-testid="protection-mixed">
          <span data-testid="protection-mixed-contact" className="allow-select">
            연락처 문구입니다.
          </span>{' '}
          <span data-testid="protection-mixed-body">
            이어지는 본문 문구입니다. 연락처에서 여기까지 걸쳐 선택하면 복사가 막힙니다.
          </span>
        </p>

        <label className="flex flex-col gap-2">
          <span>검색 입력 (복사·붙여넣기 예외)</span>
          <input
            data-testid="protection-search"
            type="search"
            placeholder="검색어를 입력하세요"
            className="bg-input-bg text-strong rounded-md px-4 py-3"
          />
        </label>

        <div data-testid="protection-code">
          <CodeBlock>
            <code>
              <span className="line">{CODE_LINES[0]}</span>
              {'\n'}
              <span className="line">{CODE_LINES[1]}</span>
            </code>
          </CodeBlock>
        </div>
      </main>
      <Footer contact={EXAMPLE_CONTACT} />
    </ProtectedShell>
  );
}
