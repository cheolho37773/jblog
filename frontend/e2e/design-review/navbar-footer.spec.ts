import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { pinTheme, waitForFonts, type Theme } from '../helpers/theme';
import {
  measureInBrowser,
  type Box,
  type FooterMeasure,
  type MeasureOutput,
  type NavbarMeasure,
  type Rgb,
} from './measure';

// M1-05 규약 10 / UI §11 "M1 한시 대체 비교" (A 기준): Navbar·Footer를 로컬 참고 스크린샷과 비교한다.
// 참고 이미지(docs/ui_design/references/)는 비공개라 없으면 건너뛴다. 그래서 CI에서는 돌지 않는다.
// 방법: 1920 캡처를 참고 이미지 폭으로 축소(브라우저 canvas) → 양쪽을 같은 픽셀 분석으로 요소 위치·크기를 재고 ±2px, 색은 채널별 ±3.
// 산출물(잘라낸 이미지·측정값)은 git 무시 경로 docs/ui_design/references/_compare/ 에만 저장한다.

const REFERENCES_DIR = path.resolve(process.cwd(), '../docs/ui_design/references');
const OUTPUT_DIR = path.join(REFERENCES_DIR, '_compare');
const POSITION_TOLERANCE = 2;
const COLOR_TOLERANCE = 3;
// 글자색 대리 지표의 허용 비율. 같은 글자라도 원본 PNG와 이 환경(macOS Chrome)의 글자 렌더링이 달라 5~10%는 흔들린다(UI §11 "폰트 렌더링 차이는 제외").
const INK_MASS_TOLERANCE = 0.15;
const FRAME = { width: 1920, height: 1000 };

const REFERENCE: Record<Theme, { file: string; width: number }> = {
  light: { file: 'blog-home-light.png', width: 1106 },
  dark: { file: 'blog-home-dark.png', width: 775 },
};

interface Row {
  area: string;
  item: string;
  ref: string;
  impl: string;
  diff: string;
  verdict: '통과' | '차이' | '원본 확인 불가' | '의도된 차이';
  note?: string;
}

/** 원본·구현에서 같은 방법으로 꺼낸 값 한 쌍 */
interface Pair {
  ref: number | undefined;
  impl: number | undefined;
  note?: string;
}

const hasReference = (theme: Theme) =>
  fs.existsSync(path.join(REFERENCES_DIR, REFERENCE[theme].file));
const round = (value: number) => Math.round(value * 10) / 10;
const rgb = (color: Rgb | null) => (color ? `rgb(${color.join(',')})` : '없음');

const centerY = (box: Box | null | undefined) => (box ? (box.y0 + box.y1) / 2 : undefined);
const width = (box: Box | null | undefined) => (box ? box.x1 - box.x0 : undefined);
const height = (box: Box | null | undefined) => (box ? box.y1 - box.y0 : undefined);
const left = (box: Box | null | undefined) => box?.x0;
const right = (box: Box | null | undefined) => box?.x1;
const top = (box: Box | null | undefined) => box?.y0;

/** 같은 항목을 원본·구현 양쪽에서 재는 함수 하나로 한 쌍을 만든다 */
function both<T>(ref: T, impl: T, pick: (measure: T) => number | undefined): Pair {
  return { ref: pick(ref), impl: pick(impl) };
}

function numberRow(area: string, item: string, pair: Pair): Row {
  const { ref, impl, note } = pair;
  if (ref === undefined || impl === undefined) {
    return {
      area,
      item,
      ref: String(ref ?? '없음'),
      impl: String(impl ?? '없음'),
      diff: '-',
      verdict: '차이',
      note: '한쪽에서 요소를 찾지 못함',
    };
  }
  const diff = impl - ref;
  const verdict = Math.abs(diff) <= POSITION_TOLERANCE ? '통과' : '차이';
  return {
    area,
    item,
    ref: String(round(ref)),
    impl: String(round(impl)),
    diff: String(round(diff)),
    verdict,
    note,
  };
}

function colorRow(area: string, item: string, colors: { ref: Rgb | null; impl: Rgb | null }): Row {
  const { ref, impl } = colors;
  if (!ref || !impl) {
    return {
      area,
      item,
      ref: rgb(ref),
      impl: rgb(impl),
      diff: '-',
      verdict: '차이',
      note: '한쪽에서 색을 얻지 못함',
    };
  }
  const diff = Math.max(...ref.map((channel, index) => Math.abs(channel - impl[index]!)));
  const verdict = diff <= COLOR_TOLERANCE ? '통과' : '차이';
  return { area, item, ref: rgb(ref), impl: rgb(impl), diff: String(diff), verdict };
}

const fixed = (area: string, item: string, outcome: Pick<Row, 'verdict' | 'note'>): Row => ({
  area,
  item,
  ref: '-',
  impl: '-',
  diff: '-',
  ...outcome,
});
const unavailable = (area: string, item: string, note: string) =>
  fixed(area, item, { verdict: '원본 확인 불가', note });
const intended = (area: string, item: string, note: string) =>
  fixed(area, item, { verdict: '의도된 차이', note });

const gapsOf = (menu: Box[]) => menu.slice(1).map((box, index) => box.x0 - menu[index]!.x1);
const menuCenter = (menu: Box[]) =>
  menu.length ? (menu[0]!.x0 + menu[menu.length - 1]!.x1) / 2 : undefined;

const LIGHT_TOGGLE_NOTE =
  'Light는 노브(흰색)가 배경과 같아 트랙 오른쪽 일부만 잡힌다. 오른쪽 끝·높이만 유효';

function navbarMenuRows(ref: NavbarMeasure, impl: NavbarMeasure): Row[] {
  const area = 'Navbar';
  const refGaps = gapsOf(ref.menu);
  const implGaps = gapsOf(impl.menu);
  const gapRows = refGaps.map((gap, index) =>
    numberRow(area, `메뉴 ${index + 1}-${index + 2}번 글자 사이 간격`, {
      ref: gap,
      impl: implGaps[index],
    }),
  );
  return [
    numberRow(area, '메뉴 항목 수', {
      ref: ref.menu.length,
      impl: impl.menu.length,
      note: '기대 5',
    }),
    ...gapRows,
    numberRow(area, '메뉴 묶음 가운데 x', {
      ref: menuCenter(ref.menu),
      impl: menuCenter(impl.menu),
    }),
    numberRow(area, 'Home 항목 폭 (같은 단어)', both(ref.menu[0], impl.menu[0], width)),
    numberRow(area, '메뉴 세로 중심 y', both(ref.menu[0], impl.menu[0], centerY)),
  ];
}

function navbarBoxRows(ref: NavbarMeasure, impl: NavbarMeasure, theme: Theme): Row[] {
  const area = 'Navbar';
  const trackNote = theme === 'light' ? LIGHT_TOGGLE_NOTE : undefined;
  return [
    numberRow(area, '로고 왼쪽 x', both(ref.logo, impl.logo, left)),
    numberRow(area, '로고 세로 중심 y', both(ref.logo, impl.logo, centerY)),
    intended(area, '로고 폭·높이', '글자 로고(M1-10)'),
    numberRow(area, '검색창 x', both(ref.search, impl.search, left)),
    numberRow(area, '검색창 폭', both(ref.search, impl.search, width)),
    numberRow(area, '검색창 높이', both(ref.search, impl.search, height)),
    numberRow(area, '검색창 세로 중심 y', both(ref.search, impl.search, centerY)),
    numberRow(area, '토글 x', { ...both(ref.toggle, impl.toggle, left), note: trackNote }),
    numberRow(area, '토글 폭', { ...both(ref.toggle, impl.toggle, width), note: trackNote }),
    numberRow(area, '토글 높이', both(ref.toggle, impl.toggle, height)),
    numberRow(area, '토글 세로 중심 y', both(ref.toggle, impl.toggle, centerY)),
    numberRow(area, '토글 오른쪽 끝 x (컨테이너 오른쪽)', both(ref.toggle, impl.toggle, right)),
  ];
}

// 글자색: 가는 획이 축소로 배경과 섞여 가장 진한 픽셀은 원본 색이 아니다(같은 글자라도 하위 픽셀 위치에 따라 달라짐).
// 그래서 같은 단어(Blog)의 '배경과의 색 차이 합'을 비교한다. 이 값은 축소해도 보존되어 글자색 대비를 반영한다. 색값 자체는 확인 불가.
function menuTextColorRow(ref: NavbarMeasure, impl: NavbarMeasure): Row {
  const ratio =
    ref.menuInkMass && impl.menuInkMass ? impl.menuInkMass / ref.menuInkMass : undefined;
  const same = ratio !== undefined && Math.abs(ratio - 1) <= INK_MASS_TOLERANCE;
  return {
    area: 'Navbar',
    item: '메뉴 글자색 (Blog 글자의 색 차이 합 구현/원본)',
    ref: String(round(ref.menuInkMass ?? 0)),
    impl: String(round(impl.menuInkMass ?? 0)),
    diff: ratio === undefined ? '-' : String(round(ratio)),
    verdict: same ? '통과' : '차이',
    note: `비율 1±${INK_MASS_TOLERANCE} 이내면 같은 색으로 본다. 색값 자체(채널 ±3)는 축소로 섞여 원본 확인 불가`,
  };
}

function navbarRows(ref: NavbarMeasure, impl: NavbarMeasure, theme: Theme): Row[] {
  const area = 'Navbar';
  return [
    ...navbarBoxRows(ref, impl, theme),
    ...navbarMenuRows(ref, impl),
    unavailable(
      area,
      'Navbar 높이·하단선',
      '원본에 하단선이 없어(UX상 추가, UI §5.1) 높이를 직접 잴 수 없다. 요소 세로 중심 비교로 대체',
    ),
    colorRow(area, '배경색', { ref: ref.background, impl: impl.background }),
    colorRow(area, '검색창 배경색', { ref: ref.searchBackground, impl: impl.searchBackground }),
    colorRow(area, '토글 트랙 색', { ref: ref.toggleTrack, impl: impl.toggleTrack }),
    menuTextColorRow(ref, impl),
    unavailable(
      area,
      '메뉴 글자색 채널값',
      '획이 가늘어 축소 시 배경과 섞인다 (위 색 차이 합으로 대체)',
    ),
  ];
}

const pitchOf = (items: Box[]) => {
  const count = items.length;
  if (count < 2) return undefined;
  return (items[count - 1]!.y0 - items[0]!.y0) / (count - 1);
};

const titleToFirstItem = (measure: FooterMeasure) => {
  const first = measure.quickLinkItems[0];
  const title = measure.titles[1];
  return first && title ? first.y0 - title.y1 : undefined;
};
const contentToDivider = (measure: FooterMeasure) =>
  measure.contentBottom !== null && measure.divider !== null
    ? measure.divider - measure.contentBottom
    : undefined;
const dividerToBottom = (measure: FooterMeasure) =>
  measure.divider !== null ? measure.height - measure.divider : undefined;

function footerColumnRows(ref: FooterMeasure, impl: FooterMeasure): Row[] {
  const area = 'Footer';
  const titleRows = ['About', 'Quick Link', 'Category'].map((name, index) =>
    numberRow(area, `${name} 칸 제목 시작 x`, both(ref.titles[index], impl.titles[index], left)),
  );
  return [
    ...titleRows,
    numberRow(area, '칸 제목 위쪽 y (Footer 위 기준)', both(ref.titles[0], impl.titles[0], top)),
    numberRow(area, '카드 x', both(ref.card, impl.card, left)),
    numberRow(area, '카드 폭', both(ref.card, impl.card, width)),
    numberRow(area, '카드 위쪽 y', both(ref.card, impl.card, top)),
    intended(area, '카드 높이·내용', 'Contact Me 카드(M1-10)는 내용이 달라 높이가 다르다'),
    numberRow(
      area,
      '칸 제목 아래 → 첫 항목 위 간격(Quick Link)',
      both(ref, impl, titleToFirstItem),
    ),
    numberRow(area, 'Quick Link 항목 수', {
      ref: ref.quickLinkItems.length,
      impl: impl.quickLinkItems.length,
      note: '기대 6(원본 Home·About·Blog·Archived·Author·Contact, 구현 Home·Blog·Projects·About·Contact·RSS)',
    }),
    numberRow(area, 'Quick Link 항목 간격(줄 위 → 다음 줄 위)', {
      ref: pitchOf(ref.quickLinkItems),
      impl: pitchOf(impl.quickLinkItems),
    }),
    numberRow(area, 'Category 항목 간격(줄 위 → 다음 줄 위)', {
      ref: pitchOf(ref.categoryItems),
      impl: pitchOf(impl.categoryItems),
      note: `원본 ${ref.categoryItems.length}줄 / 구현 ${impl.categoryItems.length}줄`,
    }),
  ];
}

function footerBottomRows(ref: FooterMeasure, impl: FooterMeasure): Row[] {
  const area = 'Footer';
  return [
    // 구분선 y·Footer 전체 높이는 칸 내용 높이(원본 Newsletter ↔ Contact Me, 의도된 차이)에 따라 움직이므로 간격으로 비교한다
    unavailable(
      area,
      '가장 긴 칸 아래 → 구분선 간격 (기획 64)',
      `원본은 카드 상자(${contentToDivider(ref) ?? '?'})로 재지만 구현은 가장 긴 칸이 글자 칸이라 잉크 하단(줄 상자보다 약 3~4px 위, 축소 기준)으로만 잴 수 있어 측정이 어긋난다(구현 ${contentToDivider(impl) ?? '?'}). 64px 자체는 spec-values가 DOM으로 검증한다`,
    ),
    numberRow(area, '구분선 → Footer 아래 끝', {
      ref: dividerToBottom(ref),
      impl: dividerToBottom(impl),
      note: '저작권 줄(padding 32 + 줄 높이 + 아래 여백)',
    }),
    numberRow(area, '저작권 줄 왼쪽 묶음 높이 (로고 + 문구 세로 배치?)', {
      ref: height(ref.copyrightTitle),
      impl: height(impl.copyrightTitle),
      note: '원본은 로고 아래에 © 문구가 같은 묶음, 구현은 문구가 줄 오른쪽 끝',
    }),
    numberRow(area, '저작권 줄 로고 시작 x', both(ref.copyrightTitle, impl.copyrightTitle, left)),
    intended(area, '정책 링크(Terms·Privacy·Cookie)', '정책 링크 제거(M1-10)'),
    colorRow(area, 'Footer 배경색', { ref: ref.background, impl: impl.background }),
    colorRow(area, '카드 배경색', { ref: ref.cardBackground, impl: impl.cardBackground }),
  ];
}

const footerRows = (ref: FooterMeasure, impl: FooterMeasure): Row[] => [
  ...footerColumnRows(ref, impl),
  ...footerBottomRows(ref, impl),
];

async function measure(
  page: import('@playwright/test').Page,
  theme: Theme,
  kind: 'navbar' | 'footer',
): Promise<MeasureOutput> {
  const route = kind === 'navbar' ? '/' : '/dev/components';
  await pinTheme(page, theme);
  await page.setViewportSize(FRAME);
  await page.goto(route);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await waitForFonts(page);

  const target =
    kind === 'navbar'
      ? page.getByRole('banner')
      : page.getByTestId('dev-layout-footer').getByRole('contentinfo');
  await target.scrollIntoViewIfNeeded();
  const capture = await target.screenshot({ animations: 'disabled' });

  const reference = fs.readFileSync(path.join(REFERENCES_DIR, REFERENCE[theme].file));
  return page.evaluate(measureInBrowser, {
    refB64: reference.toString('base64'),
    implB64: capture.toString('base64'),
    implWidth: FRAME.width,
    targetWidth: REFERENCE[theme].width,
    kind,
    theme,
  });
}

function save(name: string, output: MeasureOutput, rows: Row[]) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${name}-ref-crop.png`),
    Buffer.from(output.refCropB64, 'base64'),
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${name}-impl-reduced.png`),
    Buffer.from(output.implReducedB64, 'base64'),
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${name}-rows.json`),
    JSON.stringify({ ref: output.ref, impl: output.impl, rows }, null, 2),
  );
}

function expectNoDifference(rows: Row[]) {
  for (const row of rows) {
    expect
      .soft(
        row.verdict,
        `${row.area} ${row.item}: 원본 ${row.ref} / 구현 ${row.impl} / 차이 ${row.diff} ${row.note ?? ''}`,
      )
      .not.toBe('차이');
  }
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`A 원본 대체 비교 1920 ${theme}`, () => {
    test.skip(!hasReference(theme), `참고 이미지(${REFERENCE[theme].file})가 없어 건너뛴다`);

    test(`Navbar 위치·크기 ±${POSITION_TOLERANCE}px, 색 ±${COLOR_TOLERANCE}`, async ({ page }) => {
      const output = await measure(page, theme, 'navbar');
      const rows = navbarRows(output.ref as NavbarMeasure, output.impl as NavbarMeasure, theme);
      save(`navbar-${theme}`, output, rows);
      expectNoDifference(rows);
    });

    test(`Footer(예시 값) 위치·크기 ±${POSITION_TOLERANCE}px, 색 ±${COLOR_TOLERANCE}`, async ({
      page,
    }) => {
      const output = await measure(page, theme, 'footer');
      const rows = footerRows(output.ref as FooterMeasure, output.impl as FooterMeasure);
      save(`footer-${theme}`, output, rows);
      expectNoDifference(rows);
    });
  });
}
