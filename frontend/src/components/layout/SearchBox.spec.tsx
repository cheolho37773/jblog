import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchBox } from './SearchBox';

// 이동 함수(router.push)를 모킹해 어디로 보내는지만 확인한다.
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

const SEARCHBOX_NAME = '검색';

function searchbox() {
  return screen.getByRole('searchbox', { name: SEARCHBOX_NAME });
}

describe('SearchBox', () => {
  beforeEach(() => {
    router.push.mockClear();
  });

  it('role="search" 폼 안에 이름이 "검색"인 searchbox가 있다', () => {
    render(<SearchBox />);

    expect(screen.getByRole('search')).toContainElement(searchbox());
  });

  it('Enter를 누르면 /search?q=<검색어>로 이동한다', async () => {
    render(<SearchBox />);

    await userEvent.type(searchbox(), 'react{Enter}');

    expect(router.push).toHaveBeenCalledWith('/search?q=react');
  });

  it('앞뒤 공백은 제거하고 가운데 공백·특수문자·한글은 URL 인코딩한다', async () => {
    render(<SearchBox />);

    await userEvent.type(searchbox(), '  react hooks&한글  {Enter}');

    expect(router.push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('react hooks&한글')}`);
  });

  it('빈 값이면 이동하지 않는다', async () => {
    render(<SearchBox />);

    await userEvent.type(searchbox(), '{Enter}');

    expect(router.push).not.toHaveBeenCalled();
  });

  it('공백만 입력해도 이동하지 않는다', async () => {
    render(<SearchBox />);

    await userEvent.type(searchbox(), '   {Enter}');

    expect(router.push).not.toHaveBeenCalled();
  });
});
