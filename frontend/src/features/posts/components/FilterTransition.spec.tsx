import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterLinks, FilterTransitionProvider, PendingListSlot } from './FilterTransition';

// M2-07 ③: 칩 전환 표시(프론트 §6.2). 태그 해제 칩은 E2E로 지연을 만들 수 없어 여기서 확인한다.
const NAVIGATION_MS = 200;
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// 가로채지 않은 클릭이 jsdom에서 실제 이동을 시도하지 않도록 바깥에서 기본 동작을 막고, 그 전 상태를 기록한다.
const preventedBeforeOutside: boolean[] = [];

function renderChips(links: React.ReactNode) {
  preventedBeforeOutside.length = 0;
  return render(
    <div
      onClick={(event) => {
        preventedBeforeOutside.push(event.defaultPrevented);
        event.preventDefault();
      }}
    >
      <FilterTransitionProvider>
        <FilterLinks>{links}</FilterLinks>
        <PendingListSlot>
          <ul aria-label="글 목록" />
        </PendingListSlot>
      </FilterTransitionProvider>
    </div>,
  );
}

describe('FilterLinks · PendingListSlot', () => {
  beforeEach(() => push.mockReset());

  it('평소에는 목록 자리를 그대로 보여 주고 스켈레톤은 없다', () => {
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- 라우터 없이 FilterLinks의 클릭 가로채기만 보려고 일부러 일반 <a>를 쓴다
    renderChips(<a href="/blog?category=frontend">프론트엔드</a>);
    expect(screen.getByRole('list', { name: '글 목록' })).toBeInTheDocument();
    expect(screen.queryByTestId('blog-loading-grid')).not.toBeInTheDocument();
  });

  it('칩 링크를 누르면 기본 이동을 막고 그 href로 router.push한다', () => {
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- 라우터 없이 FilterLinks의 클릭 가로채기만 보려고 일부러 일반 <a>를 쓴다
    renderChips(<a href="/blog?category=frontend">프론트엔드</a>);
    fireEvent.click(screen.getByRole('link', { name: '프론트엔드' }));
    expect(preventedBeforeOutside).toEqual([true]);
    expect(push).toHaveBeenCalledExactlyOnceWith('/blog?category=frontend');
  });

  it('태그 해제 칩(/blog)도 같은 전환으로 간다', () => {
    renderChips(
      // eslint-disable-next-line @next/next/no-html-link-for-pages -- 라우터 없이 FilterLinks의 클릭 가로채기만 보려고 일부러 일반 <a>를 쓴다
      <a href="/blog">
        <span aria-hidden="true">✕</span>#Next.js 필터 해제
      </a>,
    );
    // 안쪽 요소를 눌러도 가장 가까운 링크로 처리한다.
    fireEvent.click(screen.getByText('✕'));
    expect(push).toHaveBeenCalledExactlyOnceWith('/blog');
  });

  it('전환 중에는 목록 자리가 스켈레톤 9개로 바뀐다', async () => {
    push.mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, NAVIGATION_MS)),
    );
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- 라우터 없이 FilterLinks의 클릭 가로채기만 보려고 일부러 일반 <a>를 쓴다
    renderChips(<a href="/blog?category=frontend">프론트엔드</a>);

    // 이동이 끝나지 않은 채로 남아 있어야 하므로 act를 기다리지 않는다.
    fireEvent.click(screen.getByRole('link', { name: '프론트엔드' }));
    await screen.findByTestId('blog-loading-grid');
    const grid = screen.getByTestId('blog-loading-grid');
    expect(grid.children).toHaveLength(9);
    expect(screen.queryByRole('list', { name: '글 목록' })).not.toBeInTheDocument();
    // 칩은 그대로다.
    expect(screen.getByRole('link', { name: '프론트엔드' })).toBeInTheDocument();
    await screen.findByRole('list', { name: '글 목록' });
    expect(screen.queryByTestId('blog-loading-grid')).not.toBeInTheDocument();
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
    ['가운데 버튼', { button: 1 }],
  ])('%s 클릭은 가로채지 않는다(새 탭 등 브라우저 기본 동작)', (_, init) => {
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- 라우터 없이 FilterLinks의 클릭 가로채기만 보려고 일부러 일반 <a>를 쓴다
    renderChips(<a href="/blog?category=frontend">프론트엔드</a>);
    fireEvent.click(screen.getByRole('link', { name: '프론트엔드' }), init);
    expect(preventedBeforeOutside).toEqual([false]);
    expect(push).not.toHaveBeenCalled();
  });

  it('target이 있는 링크는 가로채지 않는다', () => {
    renderChips(
      <a href="/blog" target="_blank">
        새 탭
      </a>,
    );
    fireEvent.click(screen.getByRole('link', { name: '새 탭' }));
    expect(preventedBeforeOutside).toEqual([false]);
    expect(push).not.toHaveBeenCalled();
  });
});
