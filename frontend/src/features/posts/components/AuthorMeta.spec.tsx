import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';

/**
 * M2-06 ① 단계: 지시서 "표시 규칙"·"테스트 대상 인터페이스"로 쓴 테스트다 (구현을 보기 전에 작성).
 * 구현이 아직 없는 단계에서도 typecheck가 깨지지 않게 동적 import로 불러온다 (M2-05 방식).
 * 가정: 컴포넌트는 `./AuthorMeta`의 이름 있는 export `AuthorMeta`다.
 */

interface AuthorMetaProps {
  publishedAt: string;
  readingMinutes: number;
  size?: 'md' | 'sm';
  onImage?: boolean;
}
const MODULE_PATH = './AuthorMeta';
const load = async () =>
  ((await import(/* @vite-ignore */ MODULE_PATH)) as { AuthorMeta: ComponentType<AuthorMetaProps> })
    .AuthorMeta;

async function renderMeta(props: Partial<AuthorMetaProps> = {}) {
  const AuthorMeta = await load();
  return render(
    <AuthorMeta publishedAt="2026-01-05T03:00:00.000Z" readingMinutes={5} {...props} />,
  );
}

describe('AuthorMeta', () => {
  it('날짜를 Asia/Seoul 기준 2026.01.05 형식으로 보여 준다', async () => {
    await renderMeta({ publishedAt: '2026-01-05T03:00:00.000Z' });
    expect(screen.getByText('2026.01.05')).toBeInTheDocument();
  });

  it('UTC 15:00은 서울 기준 다음 날 자정이라 다음 날짜로 보인다', async () => {
    await renderMeta({ publishedAt: '2026-01-04T15:00:00.000Z' });
    expect(screen.getByText('2026.01.05')).toBeInTheDocument();
  });

  it('UTC 14:59:59는 서울 기준으로 아직 같은 날이다', async () => {
    await renderMeta({ publishedAt: '2026-01-04T14:59:59.000Z' });
    expect(screen.getByText('2026.01.04')).toBeInTheDocument();
  });

  it('연말 UTC 경계도 서울 기준 다음 해로 넘어간다', async () => {
    await renderMeta({ publishedAt: '2025-12-31T15:00:00.000Z' });
    expect(screen.getByText('2026.01.01')).toBeInTheDocument();
  });

  it('time 요소의 dateTime은 원래 ISO 값 그대로다', async () => {
    const iso = '2026-01-04T15:00:00.000Z';
    const { container } = await renderMeta({ publishedAt: iso });
    expect(container.querySelector('time')).toHaveAttribute('datetime', iso);
  });

  it('읽는 시간을 "5 min read"로 보여 준다', async () => {
    await renderMeta({ readingMinutes: 5 });
    expect(screen.getByText('5 min read')).toBeInTheDocument();
  });

  it.each([1, 0])('readingMinutes가 %i이면 "1 min read"로 보여 준다', async (minutes) => {
    await renderMeta({ readingMinutes: minutes });
    expect(screen.getByText('1 min read')).toBeInTheDocument();
  });

  it('작성자 이름·아바타 이미지를 넣지 않는다', async () => {
    const { container } = await renderMeta();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('onImage면 글자색이 on-primary 토큰이고 아니면 아니다', async () => {
    const onImage = await renderMeta({ onImage: true });
    expect(onImage.container.innerHTML).toMatch(/text-on-primary/);
    onImage.unmount();
    const normal = await renderMeta({ onImage: false });
    expect(normal.container.innerHTML).not.toMatch(/text-on-primary/);
    expect(normal.container.innerHTML).toMatch(/text-muted/);
  });

  it('색은 hex 없이 토큰 유틸만 쓴다', async () => {
    const { container } = await renderMeta({ onImage: true });
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('size sm과 md는 서로 다른 클래스로 렌더된다', async () => {
    const md = await renderMeta({ size: 'md' });
    const mdHtml = md.container.innerHTML;
    md.unmount();
    const sm = await renderMeta({ size: 'sm' });
    expect(sm.container.innerHTML).not.toBe(mdHtml);
  });
});
