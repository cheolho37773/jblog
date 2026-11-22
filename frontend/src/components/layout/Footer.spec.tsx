import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer } from './Footer';

// 값이 없으면 그 칸을 숨기는 규칙(M1-04 Footer 규약, UI §5.9, M1-10)을 props 조합별로 확인한다.
// 연락처는 example.com 예시 값만 쓴다.
const ABOUT = '기술과 기록을 모아 두는 개인 블로그입니다.';
const EMAIL = 'hello@example.com';
const GITHUB_URL = 'https://github.com/example';
const MAX_CATEGORIES = 6;

const categories = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    name: `분류${index + 1}`,
    slug: `category-${index + 1}`,
  }));

const footer = () => screen.getByRole('contentinfo');
const heading = (name: string) => within(footer()).queryByRole('heading', { name });

describe('Footer (값 없음)', () => {
  it('contentinfo 영역으로 렌더된다', () => {
    render(<Footer />);

    expect(footer()).toBeInTheDocument();
  });

  it('Quick Link 6개(Home·Blog·Projects·About·Contact·RSS)를 정해진 주소로 보여준다', () => {
    render(<Footer />);

    const expected = [
      ['Home', '/'],
      ['Blog', '/blog'],
      ['Projects', '/projects'],
      ['About', '/about'],
      ['Contact', '/about#contact'],
      ['RSS', '/feed.xml'],
    ];
    for (const [name, href] of expected) {
      expect(within(footer()).getByRole('link', { name }), name).toHaveAttribute('href', href);
    }
  });

  it('Category 칸과 Contact Me 카드와 소개 문단을 숨긴다', () => {
    render(<Footer />);

    expect(heading('Category')).not.toBeInTheDocument();
    expect(heading('Contact Me')).not.toBeInTheDocument();
    expect(within(footer()).queryByText(ABOUT)).not.toBeInTheDocument();
    expect(within(footer()).queryByRole('link', { name: 'GitHub' })).not.toBeInTheDocument();
    expect(footer().querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('로고와 저작권 문구만 있고 정책 링크(Terms·Privacy·Cookie)는 없다', () => {
    render(<Footer />);

    expect(within(footer()).getByRole('link', { name: 'jblog 홈' })).toHaveAttribute('href', '/');
    expect(footer()).toHaveTextContent(`© ${new Date().getFullYear()} jblog. All rights reserved.`);
    for (const policy of [/terms/i, /privacy/i, /cookie/i]) {
      expect(within(footer()).queryByRole('link', { name: policy })).not.toBeInTheDocument();
    }
  });
});

describe('Footer (일부 값)', () => {
  it('about이 있으면 소개 문단을 보여준다', () => {
    render(<Footer about={ABOUT} />);

    expect(within(footer()).getByText(ABOUT)).toBeInTheDocument();
  });

  it('categories가 빈 배열이면 Category 칸을 숨긴다', () => {
    render(<Footer categories={[]} />);

    expect(heading('Category')).not.toBeInTheDocument();
  });

  it('categories가 있으면 /blog?category=<slug> 링크로 보여준다', () => {
    render(<Footer categories={categories(2)} />);

    expect(heading('Category')).toBeInTheDocument();
    expect(within(footer()).getByRole('link', { name: '분류1' })).toHaveAttribute(
      'href',
      '/blog?category=category-1',
    );
  });

  it(`Category는 상위 ${MAX_CATEGORIES}개까지만 보여준다`, () => {
    render(<Footer categories={categories(MAX_CATEGORIES + 2)} />);

    const links = within(footer()).getAllByRole('link', { name: /^분류\d+$/ });
    expect(links).toHaveLength(MAX_CATEGORIES);
    expect(
      within(footer()).queryByRole('link', { name: `분류${MAX_CATEGORIES + 1}` }),
    ).not.toBeInTheDocument();
  });

  it('contact가 빈 객체면 Contact Me 카드를 숨긴다', () => {
    render(<Footer contact={{}} />);

    expect(heading('Contact Me')).not.toBeInTheDocument();
  });
});

describe('Footer Contact Me 카드', () => {
  it('이메일만 있으면 mailto 링크만 보이고 GitHub 줄은 없다', () => {
    render(<Footer contact={{ email: EMAIL }} />);

    expect(heading('Contact Me')).toBeInTheDocument();
    expect(within(footer()).getByRole('link', { name: EMAIL })).toHaveAttribute(
      'href',
      `mailto:${EMAIL}`,
    );
    expect(within(footer()).queryByRole('link', { name: 'GitHub' })).not.toBeInTheDocument();
  });

  it('GitHub만 있으면 "GitHub" 이름의 외부 링크만 보이고 이메일 줄은 없다', () => {
    render(<Footer contact={{ githubUrl: GITHUB_URL }} />);

    const link = within(footer()).getByRole('link', { name: 'GitHub' });
    expect(link).toHaveAttribute('href', GITHUB_URL);
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
    expect(footer().querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('이메일 텍스트는 복사 방지 예외(.allow-select)이다', () => {
    render(<Footer contact={{ email: EMAIL, githubUrl: GITHUB_URL }} />);

    const email = within(footer()).getByText(EMAIL);
    expect(email.closest('.allow-select')).not.toBeNull();
  });
});
