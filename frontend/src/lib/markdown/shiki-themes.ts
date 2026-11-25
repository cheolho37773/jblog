import { bundledThemes, type ThemeRegistrationAny } from 'shiki';

// 코드 블록 테마 (프론트엔드 §5.3, UI §7.3). 블록 배경은 shiki 테마가 아니라 토큰 code-bg가 정한다(prose-jblog.css).
// 그래서 테마가 가정한 배경(흰색 등)이 아니라 "code-bg 위에서의 대비"로 글자색을 맞춰야 한다 (UI §9, AA 4.5:1).

// globals.css의 --code-bg 값과 같게 유지한다. 어긋나면 axe 대비 검사(E2E)가 잡는다.
// hex 문자열이 아닌 RGB 숫자로 둔 이유: 이 값은 대비 "계산용 사본"이고 화면 색의 출처는 토큰이다.
export const CODE_BACKGROUND_RGB = {
  light: [246, 246, 247],
  dark: [20, 22, 36],
} as const;

export const MINIMUM_CONTRAST = 4.5;
// 한 번에 색을 옮기는 비율. 작게 잡아 원래 색상(색조)을 최대한 유지한 채 필요한 만큼만 어둡게·밝게 한다.
const ADJUST_STEP = 0.03;
const HEX_COLOR = /^#([0-9a-f]{6})$/i;

type Rgb = readonly [number, number, number];

export function parseHex(value: string): Rgb | undefined {
  const match = HEX_COLOR.exec(value);
  if (!match?.[1]) return undefined;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

// WCAG 2.x 상대 휘도·대비
function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** 배경이 밝으면 검정 쪽으로, 어두우면 흰색 쪽으로 대비가 충분해질 때까지 조금씩 옮긴다. */
function withMinimumContrast(color: Rgb, background: Rgb): Rgb {
  const target = luminance(background) > 0.5 ? 0 : 255;
  let adjusted = color;
  while (contrast(adjusted, background) < MINIMUM_CONTRAST) {
    adjusted = adjusted.map(
      (channel) => channel + (target - channel) * ADJUST_STEP,
    ) as unknown as Rgb;
  }
  return adjusted;
}

function adjustColor(value: string | undefined, background: Rgb): string | undefined {
  const rgb = value ? parseHex(value) : undefined;
  if (!value || !rgb) return value;
  return contrast(rgb, background) >= MINIMUM_CONTRAST
    ? value
    : toHex(withMinimumContrast(rgb, background));
}

/**
 * 테마 글자색 중 code-bg 위에서 AA 미달인 것만 같은 색조로 어둡게·밝게 덮어쓴다 (규칙을 끄지 않고 색을 고친다).
 * 실측(M2-05): github-light의 주석·키워드·태그·변수 색이 미달이고, github-dark-dimmed는 모두 통과해 그대로다.
 */
function ensureReadableOn(theme: ThemeRegistrationAny, background: Rgb, name: string) {
  const tokenColors = (theme.tokenColors ?? theme.settings ?? []).map((rule) => ({
    ...rule,
    settings: { ...rule.settings, foreground: adjustColor(rule.settings?.foreground, background) },
  }));
  const colors = { ...theme.colors };
  const editorForeground = colors['editor.foreground'];
  if (editorForeground)
    colors['editor.foreground'] = adjustColor(editorForeground, background) ?? editorForeground;
  return { ...theme, name, colors, tokenColors, settings: undefined } as ThemeRegistrationAny;
}

export async function loadTheme(
  source: 'github-light' | 'github-dark-dimmed',
  tone: 'light' | 'dark',
) {
  const { default: theme } = await bundledThemes[source]();
  return ensureReadableOn(theme, CODE_BACKGROUND_RGB[tone], `jblog-${source}`);
}

export async function loadCodeThemes() {
  const [light, dark] = await Promise.all([
    loadTheme('github-light', 'light'),
    loadTheme('github-dark-dimmed', 'dark'),
  ]);
  return { light, dark };
}
