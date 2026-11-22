import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Container } from './Container';
import { Section } from './Section';

describe('Container', () => {
  it('container-site 유틸을 가진 래퍼로 자식을 감싼다', () => {
    const { container } = render(<Container>본문</Container>);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toMatch(/container-site/);
    expect(wrapper).toHaveTextContent('본문');
  });

  it('as로 태그를 고를 수 있다', () => {
    const { container } = render(<Container as="section">본문</Container>);

    expect((container.firstElementChild as HTMLElement).tagName).toBe('SECTION');
  });

  it('className을 더해도 container-site를 잃지 않는다', () => {
    const { container } = render(<Container className="py-8">본문</Container>);

    const className = (container.firstElementChild as HTMLElement).className;
    expect(className).toMatch(/container-site/);
    expect(className).toMatch(/py-8/);
  });
});

describe('Section', () => {
  it('자식을 보여준다', () => {
    render(<Section>내용</Section>);

    expect(screen.getByText('내용')).toBeInTheDocument();
  });

  it('title이 있으면 heading으로 보여주고, 없으면 heading이 없다', () => {
    const { unmount } = render(<Section title="Latest Post">내용</Section>);
    expect(screen.getByRole('heading', { name: 'Latest Post' })).toBeInTheDocument();
    unmount();

    render(<Section>내용</Section>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
