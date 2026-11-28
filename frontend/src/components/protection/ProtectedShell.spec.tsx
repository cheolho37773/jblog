import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProtectedShell } from './ProtectedShell';

// 계약: components/protection/ProtectedShell.tsx가 named export ProtectedShell({ children })를 낸다.
// `.content-protected` 루트 래퍼 + CopyGuard 1회. SiteChrome과 /dev/protection이 이 컴포넌트를 함께 쓴다.

describe('ProtectedShell', () => {
  it('children을 .content-protected 래퍼 안에 둔다(main이 래퍼의 자손이어야 인쇄 CSS가 먹는다)', () => {
    render(
      <ProtectedShell>
        <main>본문</main>
      </ProtectedShell>,
    );
    const main = screen.getByRole('main');
    expect(main.closest('.content-protected')).not.toBeNull();
  });

  it('CopyGuard가 함께 마운트되어 본문 copy를 막는다', () => {
    render(
      <ProtectedShell>
        <main>
          <p>본문 문단</p>
        </main>
      </ProtectedShell>,
    );
    const paragraph = screen.getByText('본문 문단');
    window.getSelection()?.selectAllChildren(paragraph);
    const event = new Event('copy', { bubbles: true, cancelable: true });
    act(() => {
      paragraph.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByText('콘텐츠 복사가 제한되어 있습니다')).toBeInTheDocument();
  });
});
