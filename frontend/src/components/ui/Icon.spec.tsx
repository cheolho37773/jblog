import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';

// name: lucide 아이콘 이름 또는 simple-icons 슬러그. label이 있으면 의미 아이콘, 없으면 장식.
describe('Icon', () => {
  it('lucide 이름으로 svg를 렌더한다', () => {
    const { container } = render(<Icon name="search" />);

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('simple-icons 슬러그로 svg를 렌더한다', () => {
    const { container } = render(<Icon name="github" />);

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('label이 없으면 장식이라 aria-hidden이고 이미지 역할로 노출되지 않는다', () => {
    const { container } = render(<Icon name="search" />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('label이 있으면 그 이름을 가진 이미지로 보이고 숨겨지지 않는다', () => {
    const { container } = render(<Icon name="search" label="검색" />);

    expect(screen.getByRole('img', { name: '검색' })).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('색은 currentColor를 따른다 (lucide·simple-icons 모두)', () => {
    for (const name of ['search', 'github']) {
      const { container, unmount } = render(<Icon name={name} />);

      expect(container.innerHTML, name).toContain('currentColor');
      unmount();
    }
  });
});
