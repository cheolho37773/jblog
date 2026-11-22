import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

const AVATAR_SRC = '/avatar-dummy.png';

describe('Avatar', () => {
  it('이미지가 있으면 alt를 이름으로 가진 이미지로 보인다', () => {
    render(<Avatar src={AVATAR_SRC} alt="홍길동" />);

    expect(screen.getByRole('img', { name: '홍길동' })).toBeInTheDocument();
  });

  it('이미지가 없으면 alt의 첫 글자를 이니셜로 보여준다', () => {
    render(<Avatar alt="홍길동" />);

    expect(screen.getByText('홍')).toBeInTheDocument();
  });

  it('이미지가 없어도 alt가 접근 가능한 이름으로 남는다', () => {
    render(<Avatar alt="홍길동" />);

    expect(screen.getByRole('img', { name: '홍길동' })).toBeInTheDocument();
  });

  it('영문 alt의 이니셜은 첫 글자(대문자)이다', () => {
    render(<Avatar alt="Jason" />);

    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('size(28~80)를 지정하면 그 크기로 렌더된다', () => {
    const { container } = render(<Avatar alt="홍길동" size={80} />);

    const root = container.firstElementChild as HTMLElement;
    const sized = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].some(
      (element) =>
        element.style.width === '80px' ||
        element.getAttribute('width') === '80' ||
        /\b(size|w)-(80|\[80px\])\b/.test(element.className),
    );
    expect(sized).toBe(true);
  });
});
