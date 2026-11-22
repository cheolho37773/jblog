import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageInfo } from './PageInfo';

const BREADCRUMB = [{ label: 'Home', href: '/' }, { label: 'Blog' }];

describe('PageInfo', () => {
  it('제목을 heading으로 보여준다', () => {
    render(<PageInfo title="Blog" breadcrumb={BREADCRUMB} />);

    expect(screen.getByRole('heading', { name: 'Blog' })).toBeInTheDocument();
  });

  it('breadcrumb는 이름이 "현재 위치"인 nav 안의 목록이다', () => {
    render(<PageInfo title="Blog" breadcrumb={BREADCRUMB} />);

    const nav = screen.getByRole('navigation', { name: '현재 위치' });
    expect(within(nav).getAllByRole('listitem')).toHaveLength(2);
  });

  it('앞 항목은 링크이고 마지막 항목은 링크가 아니라 aria-current="page"이다', () => {
    render(<PageInfo title="Blog" breadcrumb={BREADCRUMB} />);

    const nav = screen.getByRole('navigation', { name: '현재 위치' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(nav).queryByRole('link', { name: 'Blog' })).not.toBeInTheDocument();
    expect(within(nav).getByText('Blog')).toHaveAttribute('aria-current', 'page');
  });

  it('href가 없는 중간 항목도 링크로 만들지 않는다', () => {
    render(
      <PageInfo
        title="글"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Blog' }, { label: '글 제목' }]}
      />,
    );

    const nav = screen.getByRole('navigation', { name: '현재 위치' });
    expect(within(nav).queryByRole('link', { name: 'Blog' })).not.toBeInTheDocument();
    expect(within(nav).getByText('글 제목')).toHaveAttribute('aria-current', 'page');
  });
});
