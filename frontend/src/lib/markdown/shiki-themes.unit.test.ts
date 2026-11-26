import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CODE_BACKGROUND_RGB,
  contrast,
  loadCodeThemes,
  MINIMUM_CONTRAST,
  parseHex,
} from './shiki-themes';

// 코드 블록 글자색 대비 보장(UI §9)과, 계산용 배경 사본이 globals.css 토큰과 같은지 확인한다.
const css = fs.readFileSync(path.resolve(import.meta.dirname, '../../app/globals.css'), 'utf8');

function codeBackgroundToken(selector: RegExp): [number, number, number] {
  const block = css.match(selector)?.[1] ?? '';
  const hex = /--code-bg:\s*(#[0-9a-f]{6})/i.exec(block)?.[1] ?? '';
  const rgb = parseHex(hex);
  if (!rgb) throw new Error(`globals.css에서 --code-bg를 찾지 못했다: ${selector}`);
  return [...rgb];
}

const TOKEN_BACKGROUND = {
  light: codeBackgroundToken(/:root,\s*\[data-theme='light'\]\s*\{([^}]*)\}/),
  dark: codeBackgroundToken(/\[data-theme='dark'\]\s*\{([^}]*)\}/),
};

describe('shiki 테마 색 덮어쓰기', () => {
  it('계산용 배경 사본이 globals.css의 --code-bg와 같다', () => {
    expect([...CODE_BACKGROUND_RGB.light]).toEqual(TOKEN_BACKGROUND.light);
    expect([...CODE_BACKGROUND_RGB.dark]).toEqual(TOKEN_BACKGROUND.dark);
  });

  it.each(['light', 'dark'] as const)(
    '%s 테마의 모든 토큰 글자색이 code-bg 위에서 AA(4.5:1) 이상이다',
    async (tone) => {
      const theme = (await loadCodeThemes())[tone];
      const foregrounds = (theme.tokenColors ?? [])
        .map((rule) => rule.settings?.foreground)
        .filter((color): color is string => typeof color === 'string');
      expect(foregrounds.length).toBeGreaterThan(5);
      for (const value of foregrounds) {
        const rgb = parseHex(value);
        if (!rgb) continue;
        expect(contrast(rgb, TOKEN_BACKGROUND[tone]), value).toBeGreaterThanOrEqual(
          MINIMUM_CONTRAST,
        );
      }
    },
  );
});
