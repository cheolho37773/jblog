import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Input } from './Input';

// variant이 "서로 다르다"만으로는 임시 색(Tailwind 기본 팔레트)으로 돌아가는 회귀를 못 잡는다.
// 글자·배경 짝이 M1-08 토큰(대비가 검증된 값)을 쓰는지 직접 고정한다.

const COMPONENTS_DIR = path.resolve(import.meta.dirname, '..');
// Tailwind 기본 팔레트 색 유틸: white·black·red-500 등. 토큰 유틸(text-on-primary 등)과 겹치지 않는다.
const DEFAULT_PALETTE_COLOR =
  /\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via|divide|placeholder)-(?:white|black|(?:red|gray|zinc|slate|neutral|stone|blue|green|yellow|orange|pink|purple|indigo)-\d{2,3})\b/;

function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFilesUnder(full);
    return /\.tsx?$/.test(name) && !/\.(spec|test|unit\.test)\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('Atom 색 토큰 사용 (M1-08)', () => {
  it('Button primary는 primary-strong 배경 + on-primary 글자이다', () => {
    render(<Button variant="primary">버튼</Button>);
    const className = screen.getByRole('button').className;

    expect(className).toMatch(/bg-primary-strong/);
    expect(className).toMatch(/text-on-primary/);
  });

  it('Button icon은 icon-button-bg 배경 + on-primary 아이콘이다', () => {
    render(<Button variant="icon" aria-label="메뉴" />);
    const className = screen.getByRole('button').className;

    expect(className).toMatch(/bg-icon-button-bg/);
    expect(className).toMatch(/text-on-primary/);
  });

  it('Badge solid는 primary-strong + on-primary, soft 글자는 primary-text이다', () => {
    render(
      <>
        <Badge variant="solid">solid</Badge>
        <Badge variant="soft">soft</Badge>
      </>,
    );

    expect(screen.getByText('solid').className).toMatch(/bg-primary-strong/);
    expect(screen.getByText('solid').className).toMatch(/text-on-primary/);
    expect(screen.getByText('soft').className).toMatch(/text-primary-text/);
  });

  it('Input 오류는 danger 토큰(글자·테두리)을 쓴다', () => {
    render(<Input label="이메일" error="오류 문구" />);

    expect(screen.getByText('오류 문구').className).toMatch(/text-danger/);
    expect(screen.getByLabelText('이메일').className).toMatch(/border-danger/);
  });

  it('Avatar 이니셜은 primary-strong 배경 + on-primary 글자이다', () => {
    render(<Avatar alt="홍길동" />);
    const initial = screen.getByText('홍');
    const classNames = `${initial.className} ${initial.parentElement?.className ?? ''}`;

    expect(classNames).toMatch(/bg-primary-strong/);
    expect(classNames).toMatch(/text-on-primary/);
  });

  it('src/components의 소스에 Tailwind 기본 팔레트 색(white·black·red-500 등)이 없다', () => {
    const files = sourceFilesUnder(COMPONENTS_DIR);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          DEFAULT_PALETTE_COLOR.test(line)
            ? [`${path.relative(COMPONENTS_DIR, file)}:${index + 1} ${line.trim()}`]
            : [],
        ),
    );
    expect(offenders).toEqual([]);
  });
});
