import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

// 클래스 이름 자체가 아니라 "variant마다 다르다"와 "토큰 유틸만 쓴다"를 확인한다 (구현 자유도 유지).
const HEX_COLOR = /#[0-9a-f]{3,8}\b/i;

function classNameOf(props: Partial<React.ComponentProps<typeof Badge>>): string {
  const { unmount, container } = render(<Badge {...props}>배지</Badge>);
  const className = (container.firstElementChild as HTMLElement).className;
  unmount();
  return className;
}

describe('Badge', () => {
  it('내용을 보여준다', () => {
    render(<Badge>React</Badge>);

    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('solid와 soft는 서로 다른 클래스로 렌더된다', () => {
    expect(classNameOf({ variant: 'solid' })).not.toBe(classNameOf({ variant: 'soft' }));
  });

  it('md와 lg는 서로 다른 클래스로 렌더된다', () => {
    expect(classNameOf({ size: 'md' })).not.toBe(classNameOf({ size: 'lg' }));
  });

  it('색은 디자인 토큰 유틸만 쓰고 hex를 쓰지 않는다', () => {
    for (const variant of ['solid', 'soft'] as const) {
      const className = classNameOf({ variant });
      expect(className).toMatch(/primary/);
      expect(className).not.toMatch(HEX_COLOR);
    }
  });

  it('href가 없으면 링크가 아니다', () => {
    render(<Badge>React</Badge>);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('href가 있으면 해당 주소의 링크가 된다', () => {
    render(<Badge href="/blog?category=react">React</Badge>);

    expect(screen.getByRole('link', { name: 'React' })).toHaveAttribute(
      'href',
      '/blog?category=react',
    );
  });
});
