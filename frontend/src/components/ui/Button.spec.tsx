import { createEvent, fireEvent, render, screen } from '@testing-library/react';
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

// Codex M1-03 r1 #1: asChild가 부모 속성·이벤트를 자식에 합성하고, 비활성 링크의 이동을 막는다.
describe('Button asChild 합성', () => {
  it('부모의 aria-label·data-*·onClick이 자식 링크에 전달된다', async () => {
    const onClick = vi.fn();
    render(
      <Button asChild variant="icon" aria-label="GitHub 열기" data-track="gh" onClick={onClick}>
        <a href="/github">링크</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'GitHub 열기' });
    expect(link).toHaveAttribute('data-track', 'gh');
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('자식에 지정한 onClick도 함께 호출된다', async () => {
    const parentClick = vi.fn();
    const childClick = vi.fn();
    render(
      <Button asChild onClick={parentClick}>
        <a href="/x" onClick={childClick}>
          이동
        </a>
      </Button>,
    );

    await userEvent.click(screen.getByRole('link', { name: '이동' }));

    expect(parentClick).toHaveBeenCalledTimes(1);
    expect(childClick).toHaveBeenCalledTimes(1);
  });

  it('활성 링크는 aria-disabled가 없고 클릭의 기본 이동을 막지 않는다', () => {
    render(
      <Button asChild>
        <a href="/x">이동</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: '이동' });
    const click = createEvent.click(link);
    fireEvent(link, click);

    expect(link).not.toHaveAttribute('aria-disabled', 'true');
    expect(click.defaultPrevented).toBe(false);
  });

  it('disabled이면 링크가 aria-disabled="true"이고 탭 순서에서 빠지며 href는 유지된다', () => {
    render(
      <Button asChild disabled>
        <a href="/x">이동</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: '이동' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(link).toHaveAttribute('href', '/x');
  });

  it('disabled 링크를 클릭해도 부모 onClick이 호출되지 않고 기본 이동이 차단된다', () => {
    const onClick = vi.fn();
    render(
      <Button asChild disabled onClick={onClick}>
        <a href="/x">이동</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: '이동' });
    const click = createEvent.click(link, { cancelable: true });
    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled 링크에서 Enter 키의 기본 동작도 차단된다', () => {
    render(
      <Button asChild disabled>
        <a href="/x">이동</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: '이동' });
    const enter = createEvent.keyDown(link, { key: 'Enter', cancelable: true });
    fireEvent(link, enter);

    expect(enter.defaultPrevented).toBe(true);
  });
});
