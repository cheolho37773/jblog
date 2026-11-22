import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('접근 가능한 이름이 "jblog 홈"인 홈(/) 링크이다', () => {
    render(<Logo />);

    expect(screen.getByRole('link', { name: 'jblog 홈' })).toHaveAttribute('href', '/');
  });

  it('글자 로고 "jblog"를 보여준다', () => {
    render(<Logo />);

    expect(screen.getByRole('link', { name: 'jblog 홈' })).toHaveTextContent('jblog');
  });
});
