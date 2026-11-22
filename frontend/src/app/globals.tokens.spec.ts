import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss, {
  type AtRule,
  type Container,
  type Declaration,
  type Node,
  type Rule,
} from 'postcss';
import { describe, expect, it } from 'vitest';

/**
 * 디자인 토큰 정적 검사 (M1-02 ①). `globals.css`를 postcss로 파싱해 값을 검사한다.
 * 기준: UI 기획서 §3.3~§3.6·§4.2·§8·§9, 프론트엔드 기획서 §5.1, 작업 지시서 M1-02 "토큰 이름" 표.
 *
 * (확정) 값은 정확히 비교하고, (추정) 값은 존재와 형식만 검사한다.
 * (추정) 값은 ③ 단계에서 참고 스크린샷 색 추출로 바뀔 수 있기 때문이다. 대비(AA)는 어떤 값이든 유지되어야 한다.
 */

const CSS_PATH = path.resolve(import.meta.dirname, 'globals.css');
const root = postcss.parse(readFileSync(CSS_PATH, 'utf8'));

// ---------------------------------------------------------------------------
// 기대값 (UI 기획서 표 순서 그대로)
// ---------------------------------------------------------------------------

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

interface ColorExpectation {
  /** 원시 변수 이름 (`--` 제외) */
  raw: string;
  /** Tailwind 테마 변수 이름 (`--` 제외) */
  tailwind: string;
  light: string;
  dark: string;
  /** (확정)이면 값을 정확히 비교하고, 아니면 형식만 본다 */
  lightFixed: boolean;
  darkFixed: boolean;
}

// UI §3.3. 순서: bg, bg-subtle, surface, surface-2, border, border-strong, text 4종, nav, input, footer, toggle
const COLOR_TOKENS: ColorExpectation[] = [
  {
    raw: 'bg',
    tailwind: 'color-bg',
    light: '#FFFFFF',
    dark: '#181A2A',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'bg-subtle',
    tailwind: 'color-bg-subtle',
    light: '#F6F6F7',
    dark: '#242535',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'surface',
    tailwind: 'color-surface',
    light: '#FFFFFF',
    dark: '#181A2A',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'surface-2',
    tailwind: 'color-surface-2',
    light: '#F6F6F7',
    dark: '#242535',
    lightFixed: false,
    darkFixed: true,
  },
  {
    raw: 'border',
    tailwind: 'color-border',
    light: '#E8E8EA',
    dark: '#242535',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'border-strong',
    tailwind: 'color-border-strong',
    light: '#DCDDDF',
    dark: '#3B3C4A',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'text-strong',
    tailwind: 'color-strong',
    light: '#181A2A',
    dark: '#FFFFFF',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'text-body',
    tailwind: 'color-body',
    light: '#3B3C4A',
    dark: '#BABABF',
    lightFixed: true,
    darkFixed: false,
  },
  {
    raw: 'text-muted',
    tailwind: 'color-muted',
    light: '#696A75',
    dark: '#97989F',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'text-subtle',
    tailwind: 'color-subtle',
    light: '#696A75',
    dark: '#97989F',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'nav-text',
    tailwind: 'color-nav-text',
    light: '#3B3C4A',
    dark: '#FFFFFF',
    lightFixed: true,
    darkFixed: false,
  },
  {
    raw: 'input-bg',
    tailwind: 'color-input-bg',
    light: '#F4F4F5',
    dark: '#242535',
    lightFixed: true,
    darkFixed: false,
  },
  {
    raw: 'input-placeholder',
    tailwind: 'color-input-placeholder',
    light: '#696A75',
    dark: '#97989F',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'footer-bg',
    tailwind: 'color-footer-bg',
    light: '#F6F6F7',
    dark: '#141624',
    lightFixed: false,
    darkFixed: true,
  },
  {
    raw: 'footer-link',
    tailwind: 'color-footer-link',
    light: '#3B3C4A',
    dark: '#BABABF',
    lightFixed: false,
    darkFixed: true,
  },
  {
    raw: 'toggle-track',
    tailwind: 'color-toggle-track',
    light: '#E8E8EA',
    dark: '#4B6BFB',
    lightFixed: true,
    darkFixed: false,
  },
  // M1-08 추가 토큰 (글자용 강조색·오류·아이콘 버튼·토글 노브)
  {
    raw: 'primary-strong',
    tailwind: 'color-primary-strong',
    light: '#4361EE',
    dark: '#4361EE',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'primary-text',
    tailwind: 'color-primary-text',
    light: '#4361EE',
    dark: '#7B93FF',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'on-primary',
    tailwind: 'color-on-primary',
    light: '#FFFFFF',
    dark: '#FFFFFF',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'danger',
    tailwind: 'color-danger',
    light: '#C81E1E',
    dark: '#F87171',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'icon-button-bg',
    tailwind: 'color-icon-button-bg',
    light: '#696A75',
    dark: '#696A75',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'toggle-knob',
    tailwind: 'color-toggle-knob',
    light: '#FFFFFF',
    dark: '#FFFFFF',
    lightFixed: true,
    darkFixed: true,
  },
  {
    raw: 'toggle-knob-icon',
    tailwind: 'color-toggle-knob-icon',
    light: '#181A2A',
    dark: '#181A2A',
    lightFixed: true,
    darkFixed: true,
  },
];

// 양 테마 동일한 토큰: 원시 변수 없이 Tailwind 변수에 값을 둔다 (원시 변수를 거쳐도 해석되면 통과).
const SHARED_COLOR_TOKENS = [
  { tailwind: 'color-primary', value: '#4B6BFB' },
  { tailwind: 'color-primary-soft', value: 'rgba(75,107,251,0.05)' },
  { tailwind: 'color-overlay', value: 'rgba(20,22,36,0.4)' },
];

// UI §3.6 (확정). radius-full(100px)은 (추정)이라 형식만 본다.
const RADIUS_FIXED: Record<string, string> = {
  'radius-sm': '5px',
  'radius-md': '6px',
  'radius-lg': '12px',
};
const RADIUS_FULL = 'radius-full';
const SHADOWS: Record<string, string> = {
  'shadow-md': '0 12px 24px -6px rgba(24,26,42,0.12)',
  'shadow-toggle': '0 1px 1px rgba(0,0,0,0.12)',
};

// UI §3.4 (추정): 이름과 linear-gradient 형식만 본다.
const GRADIENTS = ['primary', 'orange', 'blue'];
const MIN_GRADIENT_STOPS = 2;

// UI §4.2
const BREAKPOINTS: Record<string, string> = {
  'breakpoint-tablet': '768px',
  'breakpoint-laptop': '1024px',
  'breakpoint-desktop': '1280px',
};
const CONTAINER_MAX_WIDTH = '1216px';
const CONTAINER_SIDE_PADDINGS = ['32px', '24px', '16px']; // laptop · tablet · mobile
const CONTAINER_UTILITY = 'container-site';

interface TypographyExpectation {
  name: string;
  size: number;
  lineHeight: number;
  weight: number;
  letterSpacing?: string;
}

// UI §3.5 표 순서. 길이는 px로 비교한다 (rem이면 16px 기준으로 환산).
const TYPOGRAPHY: TypographyExpectation[] = [
  { name: 'h1', size: 36, lineHeight: 40, weight: 600 },
  { name: 'h3-bold', size: 24, lineHeight: 28, weight: 700 },
  { name: 'h3', size: 24, lineHeight: 28, weight: 600 },
  { name: 'h4', size: 20, lineHeight: 24, weight: 600 },
  { name: 'b2', size: 20, lineHeight: 28, weight: 500 },
  { name: 'b3', size: 18, lineHeight: 26, weight: 400 },
  { name: 'b4', size: 16, lineHeight: 24, weight: 400 },
  { name: 'b4-medium', size: 16, lineHeight: 24, weight: 500 },
  { name: 'b5', size: 14, lineHeight: 20, weight: 400 },
  { name: 'b5-medium', size: 14, lineHeight: 20, weight: 500 },
  { name: 'article', size: 20, lineHeight: 32, weight: 400 },
  { name: 'quote', size: 24, lineHeight: 32, weight: 400 },
  { name: 'footer-logo', size: 20, lineHeight: 28, weight: 700 },
  { name: 'footer-title', size: 18, lineHeight: 28, weight: 600 },
  { name: 'footer-body', size: 16, lineHeight: 24, weight: 400 },
  { name: 'footer-label', size: 16, lineHeight: 24, weight: 600 },
  { name: 'display-hero', size: 56, lineHeight: 64, weight: 700 },
  { name: 'display-section', size: 32, lineHeight: 36, weight: 700 },
  { name: 'eyebrow', size: 20, lineHeight: 30, weight: 500, letterSpacing: '0.2em' },
  { name: 'intro', size: 18, lineHeight: 27, weight: 400 },
  { name: 'exp-title', size: 20, lineHeight: 28, weight: 600 },
  { name: 'exp-body', size: 14, lineHeight: 22, weight: 400 },
];

// UI §4.2 모바일(<768px) 축소. lineHeight가 없으면(display-section) 크기만 본다.
const MOBILE_TYPOGRAPHY: { name: string; size: number; lineHeight?: number }[] = [
  { name: 'h1', size: 28, lineHeight: 34 },
  { name: 'h3', size: 20, lineHeight: 26 },
  { name: 'display-hero', size: 36, lineHeight: 44 },
  { name: 'display-section', size: 24 },
  { name: 'article', size: 18, lineHeight: 30 },
];

// 프론트엔드 §5.1 폰트 변수. 한글 fallback은 Pretendard(UI §3.5).
const FONT_VARIABLES: Record<string, string[]> = {
  'font-sans': ['--font-work-sans', 'pretendard'],
  'font-serif': ['--font-source-serif'],
  'font-jakarta': ['--font-plus-jakarta', 'pretendard'],
  'font-display': ['--font-poppins', 'pretendard'],
  'font-mono': ['--font-jetbrains-mono'],
};

// UI §9 / M1-02 필수 검증: AA 4.5:1
const AA_TEXT_CONTRAST = 4.5;
const TEXT_ON_BACKGROUND_PAIRS = {
  texts: ['text-strong', 'text-body', 'text-muted', 'text-subtle', 'nav-text'],
  backgrounds: ['bg', 'surface', 'bg-subtle'],
};
const PAIRED_CONTRASTS: [text: string, background: string][] = [
  ['input-placeholder', 'input-bg'],
  ['footer-link', 'footer-bg'],
  // M1-08
  ['on-primary', 'primary-strong'],
  ['primary-text', 'bg'],
  ['primary-text', 'surface'],
  ['primary-text', 'bg-subtle'],
  ['primary-text', 'input-bg'],
  ['danger', 'bg'],
  ['danger', 'surface'],
  ['danger', 'input-bg'],
  ['toggle-knob-icon', 'toggle-knob'],
];
const WHITE = '#FFFFFF'; // Button icon의 아이콘 색 (UI §5.8)
const AA_NON_TEXT_CONTRAST = 3; // WCAG 1.4.11 비텍스트 (UI §9)

const TRANSITION_PROPERTIES = ['background-color', 'color', 'border-color'];
const TRANSITION_DURATION = '200ms';
const FOCUS_OUTLINE = '2px solid var(--color-primary)';
const FOCUS_OUTLINE_OFFSET = '2px';

// ---------------------------------------------------------------------------
// 파싱 도우미
// ---------------------------------------------------------------------------

function isAtRule(node: Node, name?: string): node is AtRule {
  return node.type === 'atrule' && (name === undefined || (node as AtRule).name === name);
}

function ancestorsOf(node: Node): Node[] {
  const chain: Node[] = [];
  let current = node.parent as Node | undefined;
  while (current) {
    chain.push(current);
    current = current.parent as Node | undefined;
  }
  return chain;
}

function allDeclarations(): Declaration[] {
  const found: Declaration[] = [];
  root.walkDecls((decl) => {
    found.push(decl);
  });
  return found;
}

function normalizeSelector(selector: string): string[] {
  return selector
    .replace(/"/g, "'")
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim());
}

/** 최상위 규칙 중 선택자 목록에 `selector`가 들어 있는 것의 선언을 모은다. */
function topLevelDeclarations(selector: string): Map<string, string> {
  const result = new Map<string, string>();
  root.each((node) => {
    if (node.type !== 'rule') return;
    if (!normalizeSelector((node as Rule).selector).includes(selector)) return;
    node.walkDecls((decl) => {
      if (decl.parent === node) result.set(decl.prop, decl.value);
    });
  });
  return result;
}

/** `@theme inline` 안의 선언. 여러 블록이면 합친다. */
function themeDeclarations(): Map<string, string> {
  const result = new Map<string, string>();
  root.walkAtRules('theme', (atRule) => {
    atRule.walkDecls((decl) => {
      result.set(decl.prop, decl.value);
    });
  });
  return result;
}

const rootVars = topLevelDeclarations(':root');
const darkVars = topLevelDeclarations("[data-theme='dark']");
const themeVars = themeDeclarations();
const rawVars: Record<Theme, Map<string, string>> = { light: rootVars, dark: darkVars };

function squash(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** `rgb(24 26 42 / 0.12)`와 `rgba(24, 26, 42, 0.12)`를 같은 모양으로 만든다. */
function canonicalColors(value: string): string {
  const withCanonicalRgb = value.replace(
    /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/gi,
    (...match: string[]) => {
      const [, r, g, b, alpha] = match;
      return `rgba(${Number(r)},${Number(g)},${Number(b)},${alpha ? Number(alpha) : 1})`;
    },
  );
  return squash(withCanonicalRgb).replace(/\s*,\s*/g, ',');
}

function sameValue(actual: string | undefined, expected: string): boolean {
  return actual !== undefined && canonicalColors(actual) === canonicalColors(expected);
}

function toPx(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^(-?[\d.]+)(px|rem)$/.exec(value.trim());
  if (!match) return undefined;
  const REM_IN_PX = 16;
  return Number(match[1]) * (match[2] === 'rem' ? REM_IN_PX : 1);
}

const COLOR_FORMAT = /^(#[0-9a-f]{3,8}|rgba?\([^)]+\))$/i;

/** `var(--x)`를 최대 몇 단계까지 따라가 최종 값을 얻는다. */
const MAX_VAR_DEPTH = 5;
function resolveColor(value: string | undefined, theme: Theme): string | undefined {
  let current = value;
  for (let depth = 0; depth < MAX_VAR_DEPTH && current !== undefined; depth += 1) {
    const reference = /^var\(\s*--([\w-]+)\s*\)$/.exec(current.trim());
    if (!reference) return current;
    const name = reference[1] as string;
    current =
      rawVars[theme].get(`--${name}`) ?? rootVars.get(`--${name}`) ?? themeVars.get(`--${name}`);
  }
  return current;
}

// ---------------------------------------------------------------------------
// WCAG 상대 휘도 · 대비
// ---------------------------------------------------------------------------

function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`대비 계산은 hex(#RGB, #RRGGBB)만 지원한다: ${hex}`);
  const digits =
    (match[1] as string).length === 3
      ? (match[1] as string).replace(/./g, '$&$&')
      : (match[1] as string);
  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function channelLuminance(channel: number): number {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(channelLuminance) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

function resolvedHex(theme: Theme, rawName: string): string {
  const value = resolveColor(rawVars[theme].get(`--${rawName}`), theme);
  if (value === undefined) throw new Error(`${theme} --${rawName} 변수가 없다`);
  return value;
}

describe('대비 계산 도우미', () => {
  // 도우미가 틀리면 아래 AA 검사가 모두 무의미해지므로, 알려진 값으로 먼저 확인한다.
  it('흰색 대 검정은 21:1, 같은 색은 1:1이다', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('UI §9의 기획서 수치와 맞는다 (#696A75 on #FFFFFF ≈5.4, #97989F on #FFFFFF ≈2.9)', () => {
    expect(contrastRatio('#696A75', '#FFFFFF')).toBeGreaterThan(5.3);
    expect(contrastRatio('#97989F', '#FFFFFF')).toBeLessThan(3);
  });
});

// ---------------------------------------------------------------------------
// 색 토큰
// ---------------------------------------------------------------------------

describe('색 원시 변수 (UI §3.3)', () => {
  for (const theme of THEMES) {
    describe(theme === 'light' ? 'Light (:root)' : "Dark ([data-theme='dark'])", () => {
      for (const token of COLOR_TOKENS) {
        const expected = token[theme];
        const fixed = theme === 'light' ? token.lightFixed : token.darkFixed;

        if (fixed) {
          it(`--${token.raw}는 (확정) 값 ${expected}이다`, () => {
            expect(rawVars[theme].get(`--${token.raw}`)?.toLowerCase()).toBe(
              expected.toLowerCase(),
            );
          });
        } else {
          it(`--${token.raw}는 (추정) 값이라 존재하고 hex 또는 rgba 형식이다`, () => {
            const actual = rawVars[theme].get(`--${token.raw}`);
            expect(actual, `${theme} --${token.raw} 없음`).toBeDefined();
            expect(actual).toMatch(COLOR_FORMAT);
          });
        }
      }
    });
  }
});

describe('Tailwind 테마 변수 연결 (@theme inline)', () => {
  for (const token of COLOR_TOKENS) {
    it(`--${token.tailwind}가 var(--${token.raw})를 참조한다`, () => {
      expect(themeVars.get(`--${token.tailwind}`)?.replace(/\s+/g, '')).toBe(`var(--${token.raw})`);
    });
  }

  for (const shared of SHARED_COLOR_TOKENS) {
    it(`--${shared.tailwind}는 양 테마 동일하게 ${shared.value}이다`, () => {
      for (const theme of THEMES) {
        const resolved = resolveColor(themeVars.get(`--${shared.tailwind}`), theme);
        expect(
          sameValue(resolved, shared.value),
          `${theme} --${shared.tailwind} = ${resolved}`,
        ).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// radius · shadow · 그라디언트 · 브레이크포인트 · 컨테이너
// ---------------------------------------------------------------------------

describe('radius · shadow (UI §3.6)', () => {
  for (const [name, value] of Object.entries(RADIUS_FIXED)) {
    it(`--${name}는 ${value}이다`, () => {
      expect(themeVars.get(`--${name}`)).toBe(value);
    });
  }

  it(`--${RADIUS_FULL}는 (추정) 값이라 px 길이로 존재한다`, () => {
    expect(themeVars.get(`--${RADIUS_FULL}`)).toMatch(/^\d+px$/);
  });

  for (const [name, value] of Object.entries(SHADOWS)) {
    it(`--${name}는 ${value}이다`, () => {
      expect(sameValue(themeVars.get(`--${name}`), value)).toBe(true);
    });
  }
});

/** 이름이 `name`인 `@utility`(또는 `.name` 규칙)의 직렬화 텍스트. 없으면 undefined. */
function utilityText(name: string): string | undefined {
  let text: string | undefined;
  root.walk((node) => {
    const isUtility = isAtRule(node, 'utility') && node.params.trim() === name;
    const isClassRule =
      node.type === 'rule' && normalizeSelector((node as Rule).selector).includes(`.${name}`);
    if (isUtility || isClassRule) text = node.toString();
  });
  return text;
}

describe('그라디언트 (UI §3.4)', () => {
  for (const name of GRADIENTS) {
    it(`--gradient-${name}가 linear-gradient(색 정지점 ${MIN_GRADIENT_STOPS}개 이상)로 존재한다`, () => {
      const value = themeVars.get(`--gradient-${name}`) ?? rootVars.get(`--gradient-${name}`);
      expect(value, `--gradient-${name} 없음`).toBeDefined();
      expect(value).toMatch(/^linear-gradient\(/);
      const stops = (value as string).match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) ?? [];
      expect(stops.length).toBeGreaterThanOrEqual(MIN_GRADIENT_STOPS);
    });

    it(`text-gradient-${name} 유틸이 그라디언트를 글자에 입힌다 (background-clip: text, color: transparent)`, () => {
      const text = utilityText(`text-gradient-${name}`);
      expect(text, `text-gradient-${name} 유틸 없음`).toBeDefined();
      expect(text).toMatch(new RegExp(`background(-image)?:\\s*var\\(--gradient-${name}\\)`));
      expect(text).toMatch(/(-webkit-)?background-clip:\s*text/);
      expect(text).toMatch(/color:\s*transparent/);
    });
  }
});

describe('브레이크포인트 · 컨테이너 (UI §4.2)', () => {
  for (const [name, value] of Object.entries(BREAKPOINTS)) {
    it(`--${name}는 ${value}이다`, () => {
      expect(themeVars.get(`--${name}`)).toBe(value);
    });
  }

  it(`${CONTAINER_UTILITY} 유틸이 최대 폭 ${CONTAINER_MAX_WIDTH}와 반응형 좌우 여백 ${CONTAINER_SIDE_PADDINGS.join('·')}를 가진다`, () => {
    const text = utilityText(CONTAINER_UTILITY);
    expect(text, `${CONTAINER_UTILITY} 유틸 없음`).toBeDefined();
    expect(text).toContain(CONTAINER_MAX_WIDTH);
    for (const padding of CONTAINER_SIDE_PADDINGS) {
      expect(text, `좌우 여백 ${padding} 없음`).toContain(padding);
    }
  });
});

// ---------------------------------------------------------------------------
// 타이포 · 폰트
// ---------------------------------------------------------------------------

describe(`타이포 토큰 ${TYPOGRAPHY.length}종 (UI §3.5, 프론트엔드 §5.1)`, () => {
  it('기대 토큰이 22종이다 (표 자체 검증)', () => {
    expect(TYPOGRAPHY).toHaveLength(22);
  });

  for (const token of TYPOGRAPHY) {
    it(`text-${token.name}는 ${token.size}/${token.lineHeight} ${token.weight}${token.letterSpacing ? `, letter-spacing ${token.letterSpacing}` : ''}이다`, () => {
      const prefix = `--text-${token.name}`;
      expect(toPx(themeVars.get(prefix)), `${prefix} (글자 크기)`).toBe(token.size);
      expect(toPx(themeVars.get(`${prefix}--line-height`)), `${prefix}--line-height`).toBe(
        token.lineHeight,
      );
      expect(themeVars.get(`${prefix}--font-weight`), `${prefix}--font-weight`).toBe(
        String(token.weight),
      );
      if (token.letterSpacing) {
        expect(themeVars.get(`${prefix}--letter-spacing`), `${prefix}--letter-spacing`).toBe(
          token.letterSpacing,
        );
      }
    });
  }
});

describe('폰트 변수 5종 (프론트엔드 §5.1)', () => {
  for (const [name, parts] of Object.entries(FONT_VARIABLES)) {
    it(`--${name}가 ${parts.join(', ')}를 포함한다`, () => {
      const value = themeVars.get(`--${name}`);
      expect(value, `--${name} 없음`).toBeDefined();
      for (const part of parts) {
        expect(value?.toLowerCase()).toContain(part);
      }
    });
  }
});

describe('글 본문·인용문 서체 유틸 (UI §3.5, 프론트엔드 §5.1-a)', () => {
  const SERIF_UTILITIES = [
    { name: 'type-article', token: 'article' },
    { name: 'type-quote', token: 'quote' },
  ];

  for (const { name, token } of SERIF_UTILITIES) {
    it(`${name}는 serif 폰트와 --text-${token} 크기·줄 높이·굵기 변수를 참조한다`, () => {
      const text = utilityText(name);
      expect(text, `${name} 유틸 없음`).toBeDefined();
      expect(text).toMatch(/font-family:\s*var\(--font-serif\)/);
      expect(text).toMatch(new RegExp(`font-size:\\s*var\\(--text-${token}\\)`));
      expect(text).toMatch(new RegExp(`line-height:\\s*var\\(--text-${token}--line-height\\)`));
      expect(text).toMatch(new RegExp(`font-weight:\\s*var\\(--text-${token}--font-weight\\)`));
    });
  }

  it('type-article은 기울이지 않는다', () => {
    expect(utilityText('type-article')).not.toMatch(/font-style:\s*italic/);
  });

  it('type-quote는 italic이고, 이탤릭이 없는 한글을 가짜로 기울이지 않는다 (font-synthesis-style: none)', () => {
    const text = utilityText('type-quote');
    expect(text, 'type-quote 유틸 없음').toBeDefined();
    expect(text).toMatch(/font-style:\s*italic/);
    expect(text).toMatch(/font-synthesis-style:\s*none/);
  });
});

// ---------------------------------------------------------------------------
// 모바일 타이포 축소 (UI §4.2)
// ---------------------------------------------------------------------------

/** 모바일(<768px)을 가리키는 미디어 쿼리인지. `max-width: 767px`류와 `width < 768px`를 받는다. */
function isMobileMedia(atRule: AtRule): boolean {
  if (atRule.name !== 'media') return false;
  const params = atRule.params.replace(/\s+/g, ' ').toLowerCase();
  return (
    /max-width:\s*767(\.\d+)?px/.test(params) ||
    /width\s*<\s*768px/.test(params) ||
    /max-width:\s*calc\(\s*var\(--breakpoint-tablet\)\s*-/.test(params)
  );
}

interface MobileDeclaration {
  /** 감싸는 `@utility text-<name>`의 name. 최상위 미디어 쿼리면 undefined */
  utility: string | undefined;
  prop: string;
  value: string;
}

function mobileDeclarations(): MobileDeclaration[] {
  const found: MobileDeclaration[] = [];
  root.walkAtRules((atRule) => {
    if (!isMobileMedia(atRule)) return;
    const utilityAncestor = ancestorsOf(atRule).find((node): node is AtRule =>
      isAtRule(node, 'utility'),
    );
    const utility = utilityAncestor?.params.trim().replace(/^text-/, '');
    atRule.walkDecls((decl) => {
      found.push({ utility, prop: decl.prop, value: decl.value });
    });
  });
  return found;
}

describe('모바일(<768px) 타이포 축소 (UI §4.2)', () => {
  const mobile = mobileDeclarations();

  it('모바일 미디어 쿼리 규칙이 있다', () => {
    expect(mobile.length).toBeGreaterThan(0);
  });

  for (const token of MOBILE_TYPOGRAPHY) {
    const label =
      token.lineHeight === undefined ? `${token.size}` : `${token.size}/${token.lineHeight}`;
    it(`text-${token.name}는 모바일에서 ${label}로 줄어든다`, () => {
      const sizes = mobile
        .filter(
          (d) =>
            (d.utility === token.name && d.prop === 'font-size') ||
            d.prop === `--text-${token.name}`,
        )
        .map((d) => toPx(d.value));
      expect(sizes, `text-${token.name} 모바일 글자 크기`).toContain(token.size);

      if (token.lineHeight === undefined) return;
      const lineHeights = mobile
        .filter(
          (d) =>
            (d.utility === token.name && d.prop === 'line-height') ||
            d.prop === `--text-${token.name}--line-height`,
        )
        .map((d) => toPx(d.value));
      expect(lineHeights, `text-${token.name} 모바일 줄 높이`).toContain(token.lineHeight);
    });
  }
});

// ---------------------------------------------------------------------------
// 테마 규칙 (UI §8) · 접근성 (UI §9)
// ---------------------------------------------------------------------------

describe('테마 · 접근성 기본 스타일 (UI §8·§9)', () => {
  it('color-scheme: light dark를 선언한다', () => {
    const declared = allDeclarations().some(
      (d) => d.prop === 'color-scheme' && squash(d.value) === 'light dark',
    );
    expect(declared).toBe(true);
  });

  const transitionDeclarations = () =>
    allDeclarations().filter((d) => {
      if (d.prop !== 'transition' && d.prop !== 'transition-property') return false;
      return TRANSITION_PROPERTIES.every((property) => d.value.includes(property));
    });

  function insideMedia(node: Node, condition: string): boolean {
    return ancestorsOf(node).some(
      (ancestor) => isAtRule(ancestor, 'media') && ancestor.params.includes(condition),
    );
  }

  it(`배경·글자·테두리 색 전환이 ${TRANSITION_DURATION}로 지정되어 있다`, () => {
    const withDuration = transitionDeclarations().filter(
      (d) =>
        d.value.includes(TRANSITION_DURATION) ||
        (d.parent as Container | undefined)
          ?.toString()
          .includes(`transition-duration: ${TRANSITION_DURATION}`),
    );
    expect(
      withDuration.length,
      `${TRANSITION_PROPERTIES.join(', ')} ${TRANSITION_DURATION} 전환 없음`,
    ).toBeGreaterThan(0);
  });

  it('prefers-reduced-motion이면 전환이 없다 (no-preference에서만 전환하거나, reduce에서 전환을 끈다)', () => {
    const transitions = transitionDeclarations();
    expect(transitions.length, '색 전환 선언 없음').toBeGreaterThan(0);

    const onlyWhenMotionAllowed = transitions.every((d) =>
      insideMedia(d, 'prefers-reduced-motion: no-preference'),
    );
    if (onlyWhenMotionAllowed) return;

    const turnedOffInReduce = allDeclarations().some(
      (d) =>
        insideMedia(d, 'prefers-reduced-motion: reduce') &&
        (d.prop === 'transition' ||
          d.prop === 'transition-duration' ||
          d.prop === 'transition-property') &&
        /^(none|0s|0ms|0\.01ms)\b/.test(d.value.trim()),
    );
    expect(turnedOffInReduce, 'reduce 미디어 쿼리에서 전환을 끄지 않는다').toBe(true);
  });

  it(`포커스 링: :focus-visible에 outline ${FOCUS_OUTLINE}, offset ${FOCUS_OUTLINE_OFFSET}`, () => {
    let found = false;
    root.walkRules((rule) => {
      if (!rule.selector.includes(':focus-visible')) return;
      const outline = rule.nodes.find(
        (n): n is Declaration => n.type === 'decl' && n.prop === 'outline',
      );
      const offset = rule.nodes.find(
        (n): n is Declaration => n.type === 'decl' && n.prop === 'outline-offset',
      );
      if (
        outline &&
        squash(outline.value) === FOCUS_OUTLINE &&
        offset?.value.trim() === FOCUS_OUTLINE_OFFSET
      )
        found = true;
    });
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 대비 AA (UI §9). 실제 globals.css 값으로 계산한다 — (추정) 값이 바뀌어도 유지되어야 한다.
// ---------------------------------------------------------------------------

describe(`텍스트 대비 AA ${AA_TEXT_CONTRAST}:1 이상 (UI §9)`, () => {
  for (const theme of THEMES) {
    describe(theme === 'light' ? 'Light' : 'Dark', () => {
      for (const text of TEXT_ON_BACKGROUND_PAIRS.texts) {
        for (const background of TEXT_ON_BACKGROUND_PAIRS.backgrounds) {
          it(`--${text} on --${background}`, () => {
            const ratio = contrastRatio(resolvedHex(theme, text), resolvedHex(theme, background));
            expect(ratio).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
          });
        }
      }

      for (const [text, background] of PAIRED_CONTRASTS) {
        it(`--${text} on --${background}`, () => {
          const ratio = contrastRatio(resolvedHex(theme, text), resolvedHex(theme, background));
          expect(ratio).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
        });
      }
    });
  }
});

describe('M1-08 추가 대비', () => {
  for (const theme of THEMES) {
    it(`${theme}: 흰색 아이콘 on --icon-button-bg ${AA_TEXT_CONTRAST}:1 이상`, () => {
      expect(contrastRatio(WHITE, resolvedHex(theme, 'icon-button-bg'))).toBeGreaterThanOrEqual(
        AA_TEXT_CONTRAST,
      );
    });

    it(`${theme}: 비텍스트 --color-primary on --bg ${AA_NON_TEXT_CONTRAST}:1 이상 (장식·테두리·포커스 링)`, () => {
      const primary = resolveColor(themeVars.get('--color-primary'), theme) as string;
      expect(contrastRatio(primary, resolvedHex(theme, 'bg'))).toBeGreaterThanOrEqual(
        AA_NON_TEXT_CONTRAST,
      );
    });
  }
});
