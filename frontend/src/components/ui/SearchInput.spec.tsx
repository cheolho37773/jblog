import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from './SearchInput';

const HEX_COLOR = /#[0-9a-f]{3,8}\b/i;

describe('SearchInput', () => {
  it('searchbox 역할이고 aria-label이 접근 가능한 이름이 된다', () => {
    render(<SearchInput aria-label="글 검색" />);

    expect(screen.getByRole('searchbox', { name: '글 검색' })).toBeInTheDocument();
  });

  it('aria-label을 주지 않아도 접근 가능한 이름이 있다', () => {
    render(<SearchInput />);

    expect(screen.getByRole('searchbox')).toHaveAccessibleName();
  });

  it('placeholder를 보여주고 입력값을 onChange로 전달한다', async () => {
    const onChange = vi.fn();
    render(
      <SearchInput aria-label="글 검색" placeholder="검색어를 입력하세요" onChange={onChange} />,
    );

    const box = screen.getByRole('searchbox', { name: '글 검색' });
    await userEvent.type(box, 'a');

    expect(box).toHaveAttribute('placeholder', '검색어를 입력하세요');
    expect(onChange).toHaveBeenCalled();
  });

  it('검색 아이콘은 장식이라 보조 기술에서 숨겨진다', () => {
    const { container } = render(<SearchInput aria-label="글 검색" />);

    const icon = container.querySelector('svg');
    expect(icon, '검색 아이콘 svg').not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('placeholder 색에 대비 토큰(input-placeholder)을 쓰고 hex를 쓰지 않는다', () => {
    render(<SearchInput aria-label="글 검색" />);

    const className = screen.getByRole('searchbox').className;
    expect(className).toMatch(/input-placeholder/);
    expect(className).not.toMatch(HEX_COLOR);
  });
});
