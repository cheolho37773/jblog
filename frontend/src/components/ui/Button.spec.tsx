import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

const VARIANTS = ['primary', 'outline', 'icon', 'pillSolid', 'pillOutline'] as const;
const HEX_COLOR = /#[0-9a-f]{3,8}\b/i;

function classNameOfVariant(variant: (typeof VARIANTS)[number]): string {
  const { unmount } = render(
    <Button variant={variant} aria-label="버튼">
      버튼
    </Button>,
  );
  const className = screen.getByRole('button').className;
  unmount();
  return className;
}

describe('Button', () => {
  it('기본은 button 요소이고 폼을 제출하지 않도록 type="button"이다', () => {
    render(<Button>저장</Button>);

    expect(screen.getByRole('button', { name: '저장' })).toHaveAttribute('type', 'button');
  });

  it('5개 variant가 모두 서로 다른 클래스로 렌더된다', () => {
    const classNames = VARIANTS.map(classNameOfVariant);

    expect(new Set(classNames).size).toBe(VARIANTS.length);
  });

  it('색은 디자인 토큰 유틸만 쓰고 hex를 쓰지 않는다', () => {
    for (const variant of VARIANTS) {
      expect(classNameOfVariant(variant)).not.toMatch(HEX_COLOR);
    }
  });

  it('클릭하면 onClick이 호출된다', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>저장</Button>);

    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled이면 비활성이고 클릭해도 onClick이 호출되지 않는다', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        저장
      </Button>,
    );

    const button = screen.getByRole('button', { name: '저장' });
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('icon variant는 접근 가능한 이름을 aria-label로 받는다', () => {
    render(<Button variant="icon" aria-label="메뉴 열기" />);

    expect(screen.getByRole('button', { name: '메뉴 열기' })).toBeInTheDocument();
  });

  it('asChild이면 자식 링크 하나만 렌더하고 button이 중첩되지 않는다', () => {
    const { container } = render(
      <Button asChild variant="outline">
        <a href="/about">소개</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: '소개' })).toHaveAttribute('href', '/about');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(container.querySelector('a a, button a, a button')).toBeNull();
  });

  it('asChild여도 variant 클래스가 링크에 적용된다', () => {
    render(
      <Button asChild variant="pillSolid">
        <a href="/about">소개</a>
      </Button>,
    );

    expect(screen.getByRole('link').className).toBe(classNameOfVariant('pillSolid'));
  });
});
