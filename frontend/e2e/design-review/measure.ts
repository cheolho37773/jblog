// M1-05 규약 10: 원본 참고 이미지와 구현 캡처를 같은 방법(픽셀 분석)으로 재는 브라우저 안 함수.
// 새 의존성 없이 브라우저 canvas만 쓴다. 이 파일의 함수는 page.evaluate로 직렬화되므로 바깥 값을 참조하지 않는다.

export type Box = { x0: number; x1: number; y0: number; y1: number };
export type Rgb = [number, number, number];

export interface NavbarMeasure {
  width: number;
  height: number;
  background: Rgb;
  logo: Box | null;
  menu: Box[];
  menuTextColor: Rgb | null;
  menuInkMass: number | null; // Blog 글자의 (배경과의 색 차이) 합. 축소해도 보존되는 값이라 글자색 비교에 쓴다
  search: Box | null;
  searchBackground: Rgb | null;
  toggle: Box | null;
  toggleTrack: Rgb | null;
}

export interface FooterMeasure {
  width: number;
  height: number;
  background: Rgb;
  titles: Box[]; // About · Quick Link · Category 제목 (왼쪽부터)
  card: Box | null;
  cardBackground: Rgb | null;
  quickLinkItems: Box[]; // Quick Link 칸의 줄 상자
  categoryItems: Box[];
  divider: number | null; // 구분선 y
  contentBottom: number | null; // 가장 긴 칸(About·Quick Link·Category·카드)의 아래 끝 y
  copyright: Box | null; // 구분선 아래 줄의 잉크 범위
  copyrightTitle: Box | null; // 저작권 줄에서 왼쪽 끝 덩어리(로고)
  copyrightText: Box | null; // 저작권 줄에서 문구(로고 오른쪽 또는 아래)
}

export interface MeasureInput {
  refB64: string;
  implB64: string;
  implWidth: number; // 구현 캡처의 원래 CSS 폭(1920)
  targetWidth: number; // 참고 이미지 폭
  kind: 'navbar' | 'footer';
  theme: 'light' | 'dark';
}

export interface MeasureOutput {
  ref: NavbarMeasure | FooterMeasure;
  impl: NavbarMeasure | FooterMeasure;
  refCropB64: string;
  implReducedB64: string;
}

// 이 함수는 page.evaluate로 통째로 직렬화되어 브라우저에서 실행된다. 바깥 함수를 참조할 수 없어 안에 모아 두었고,
// 그래서 함수 길이·복잡도 규칙은 이 파일에서만 끈다.
/* eslint-disable */
export async function measureInBrowser(input: MeasureInput): Promise<MeasureOutput> {
  const TEXT_INK = 30; // 글자로 보는 색 차이(채널 최대차)
  const FILL_INK = 4; // 배경과 다른 채워진 상자(검색창·토글·카드)로 보는 색 차이
  const LINE_INK = 3;

  const loadImage = (b64: string) =>
    new Promise<HTMLImageElement>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.src = `data:image/png;base64,${b64}`;
    });

  const canvasOf = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return { canvas, ctx };
  };

  const pngB64 = (canvas: HTMLCanvasElement) => canvas.toDataURL('image/png').split(',')[1]!;

  // ---- 픽셀 도구 ----
  type Img = { w: number; h: number; d: Uint8ClampedArray };
  const readImg = (ctx: CanvasRenderingContext2D, w: number, h: number): Img => ({
    w,
    h,
    d: ctx.getImageData(0, 0, w, h).data,
  });
  const at = (img: Img, x: number, y: number): Rgb => {
    const i =
      (Math.min(img.h - 1, Math.max(0, y)) * img.w + Math.min(img.w - 1, Math.max(0, x))) * 4;
    return [img.d[i]!, img.d[i + 1]!, img.d[i + 2]!];
  };
  const dist = (a: Rgb, b: Rgb) =>
    Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

  /** true인 위치를 모아, `minGap` 이상 비어 있으면 다른 덩어리로 나눈 [시작, 끝] 목록 */
  const groups = (flags: boolean[], minGap: number): [number, number][] => {
    const result: [number, number][] = [];
    let start = -1;
    let last = -1;
    flags.forEach((on, index) => {
      if (!on) return;
      if (start === -1) start = index;
      else if (index - last > minGap) {
        result.push([start, last]);
        start = index;
      }
      last = index;
    });
    if (start !== -1) result.push([start, last]);
    return result;
  };

  const inkBox = (
    img: Img,
    bg: Rgb,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    threshold: number,
  ): Box | null => {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (dist(at(img, x, y), bg) < threshold) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    return minX === Infinity ? null : { x0: minX, x1: maxX + 1, y0: minY, y1: maxY + 1 };
  };

  const colInk = (
    img: Img,
    bg: Rgb,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    threshold: number,
  ) => {
    const flags: boolean[] = [];
    for (let x = x0; x <= x1; x += 1) {
      let on = false;
      for (let y = y0; y <= y1 && !on; y += 1) on = dist(at(img, x, y), bg) >= threshold;
      flags.push(on);
    }
    return flags;
  };
  const rowInk = (
    img: Img,
    bg: Rgb,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    threshold: number,
  ) => {
    const flags: boolean[] = [];
    for (let y = y0; y <= y1; y += 1) {
      let on = false;
      for (let x = x0; x <= x1 && !on; x += 1) on = dist(at(img, x, y), bg) >= threshold;
      flags.push(on);
    }
    return flags;
  };

  /** 한 줄(가로)에서 배경과 다른 연속 구간들 */
  const fillRuns = (img: Img, bg: Rgb, y: number, x0: number, x1: number): [number, number][] =>
    groups(
      Array.from({ length: x1 - x0 + 1 }, (_, i) => dist(at(img, x0 + i, y), bg) >= FILL_INK),
      1,
    ).map(([a, b]) => [a + x0, b + x0 + 1]);

  /** 한 열(세로)에서 시작점 둘레의 채워진 구간 [위, 아래) */
  const fillSpan = (img: Img, bg: Rgb, x: number, yFrom: number): [number, number] => {
    let top = yFrom;
    while (top > 0 && dist(at(img, x, top - 1), bg) >= FILL_INK) top -= 1;
    let bottom = yFrom;
    while (bottom < img.h - 1 && dist(at(img, x, bottom + 1), bg) >= FILL_INK) bottom += 1;
    return [top, bottom + 1];
  };

  const extremeInk = (img: Img, bg: Rgb, box: Box): Rgb => {
    // 배경에서 가장 먼 픽셀 = 축소 후에도 가장 덜 섞인 글자색
    let best: Rgb = bg;
    let bestDist = -1;
    for (let y = box.y0; y < box.y1; y += 1) {
      for (let x = box.x0; x < box.x1; x += 1) {
        const color = at(img, x, y);
        const d = dist(color, bg);
        if (d > bestDist) {
          bestDist = d;
          best = color;
        }
      }
    }
    return best;
  };

  const inkMass = (img: Img, bg: Rgb, box: Box): number => {
    let sum = 0;
    for (let y = box.y0; y < box.y1; y += 1) {
      for (let x = box.x0; x < box.x1; x += 1) {
        const c = at(img, x, y);
        sum += (Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2])) / 3;
      }
    }
    return sum;
  };

  // ---- Navbar ----
  const measureNavbar = (img: Img, scale: number, theme: 'light' | 'dark'): NavbarMeasure => {
    const bg = at(img, 1, 1);
    const minGap = Math.max(4, Math.round(40 * scale * 0.5));
    const leftRegionEnd = Math.round(img.w * 0.62);
    const clusters = groups(colInk(img, bg, 0, leftRegionEnd, 0, img.h - 1, TEXT_INK), minGap).map(
      ([a, b]) => inkBox(img, bg, a, b, 0, img.h - 1, TEXT_INK)!,
    );
    const logo = clusters[0] ?? null;
    const menu = clusters.slice(1);
    const centers = menu.map((box) => (box.y0 + box.y1) / 2);
    const yCenter = centers.length
      ? Math.round(centers.reduce((a, b) => a + b, 0) / centers.length)
      : Math.round(img.h / 2);

    const probeY = yCenter - Math.round((6 * scale) / 0.576);
    const runs = fillRuns(img, bg, probeY, Math.round(img.w * 0.62), img.w - 1).filter(
      ([a, b]) => b - a >= 6,
    );
    const searchRun = runs[0];
    const toggleRun = runs[runs.length - 1];
    const boxOf = (run: [number, number] | undefined, x: number): Box | null => {
      if (!run) return null;
      const [top, bottom] = fillSpan(img, bg, x, probeY);
      return { x0: run[0], x1: run[1], y0: top, y1: bottom };
    };
    const search = boxOf(searchRun, searchRun ? searchRun[0] + 3 : 0);
    // 토글: 노브가 한쪽에 있으므로 노브 반대편 열에서 트랙의 위아래를 잰다
    const toggleX = toggleRun ? (theme === 'light' ? toggleRun[1] - 4 : toggleRun[0] + 4) : 0;
    const toggle = toggleRun && toggleRun !== searchRun ? boxOf(toggleRun, toggleX) : null;

    return {
      width: img.w,
      height: img.h,
      background: bg,
      logo,
      menu,
      // 두 번째 항목(Blog): 구현에서 첫 항목(Home)은 현재 메뉴라 강조색이다
      menuTextColor: menu[1] ? extremeInk(img, bg, menu[1]) : null,
      menuInkMass: menu[1] ? inkMass(img, bg, menu[1]) : null,
      search,
      searchBackground: search ? at(img, search.x0 + 3, probeY) : null,
      toggle,
      toggleTrack: toggle ? at(img, toggleX, probeY) : null,
    };
  };

  // ---- Footer ----
  const measureFooter = (img: Img, scale: number): FooterMeasure => {
    const bg = at(img, 2, Math.round(img.h * 0.5));
    const containerLeft = Math.round(352 * scale);
    const containerRight = Math.round((1920 - 352) * scale);
    const minGap = Math.max(5, Math.round(30 * scale));

    // 칸 제목: 맨 위의 글자 줄을 찾아 덩어리로 나눈다 (카드 안 글자는 더 아래 줄이다)
    const lineFlags = rowInk(img, bg, containerLeft, containerRight, 3, img.h - 1, TEXT_INK);
    const lines = groups(lineFlags, 1).map(([a, b]) => [a + 3, b + 3] as [number, number]);
    const firstLine = lines[0];
    const titleClusters = firstLine
      ? groups(
          colInk(img, bg, containerLeft - 2, containerRight, firstLine[0], firstLine[1], TEXT_INK),
          minGap,
        )
      : [];
    const titles = titleClusters.map(([a, b]) =>
      inkBox(
        img,
        bg,
        a + containerLeft - 2,
        b + containerLeft - 2,
        firstLine![0],
        firstLine![1],
        TEXT_INK,
      )!,
    );

    // 카드: 마지막 제목 오른쪽에서 배경과 다른 큰 상자
    const titleBottom = firstLine ? firstLine[1] : 0;
    const afterTitles = (titles[titles.length - 1]?.x1 ?? containerLeft) + 4;
    const cardProbeY = Math.round(titleBottom + (6 * scale) / 0.576);
    const cardRun = fillRuns(img, bg, cardProbeY, afterTitles, img.w - 1).filter(
      ([a, b]) => b - a >= img.w * 0.1,
    )[0];
    let card: Box | null = null;
    if (cardRun) {
      const [top, bottom] = fillSpan(img, bg, cardRun[0] + 4, cardProbeY);
      card = { x0: cardRun[0], x1: cardRun[1], y0: top, y1: bottom };
    }

    // 목록: 제목 아래, 해당 칸의 가로 범위 안 글자 줄
    const listItems = (titleIndex: number): Box[] => {
      const title = titles[titleIndex];
      if (!title) return [];
      const next = titles[titleIndex + 1];
      const x0 = title.x0;
      const x1 = next ? next.x0 - 3 : Math.min(containerRight, (card?.x0 ?? containerRight) - 3);
      const flags = rowInk(img, bg, x0, x1, title.y1 + 2, img.h - 1, TEXT_INK);
      return groups(flags, 1)
        .map(([a, b]) => ({ rowStart: a + title.y1 + 2, rowEnd: b + title.y1 + 2 }))
        .map((row) => inkBox(img, bg, x0, x1, row.rowStart, row.rowEnd, TEXT_INK)!)
        .filter(Boolean);
    };
    const quickLinkItems = listItems(1).filter((box) => box.y1 - box.y0 < (20 * scale) / 0.576 + 4);
    const categoryItems = listItems(2).filter((box) => box.y1 - box.y0 < (20 * scale) / 0.576 + 4);

    // 구분선: 목록 아래에서 컨테이너 폭 대부분이 배경과 조금 다른 줄
    const listBottom = Math.max(
      quickLinkItems.at(-1)?.y1 ?? 0,
      categoryItems.at(-1)?.y1 ?? 0,
      card?.y1 ?? 0,
    );
    let divider: number | null = null;
    for (let y = listBottom + 2; y < img.h - 2 && divider === null; y += 1) {
      let covered = 0;
      for (let x = containerLeft + 2; x < containerRight - 2; x += 1)
        if (dist(at(img, x, y), bg) >= LINE_INK) covered += 1;
      if (covered >= (containerRight - containerLeft - 4) * 0.85) divider = y;
    }

    // About 칸: 제목 아래 글자(소개·연락처)의 아래 끝
    const about = titles[0];
    const aboutRight = (titles[1]?.x0 ?? containerRight) - 3;
    const aboutInk = about
      ? inkBox(img, bg, about.x0, aboutRight, about.y1 + 2, (divider ?? img.h) - 1, TEXT_INK)
      : null;
    const contentBottom = Math.max(
      aboutInk?.y1 ?? 0,
      quickLinkItems.at(-1)?.y1 ?? 0,
      categoryItems.at(-1)?.y1 ?? 0,
      card?.y1 ?? 0,
    );
    let copyright: Box | null = null;
    let copyrightTitle: Box | null = null;
    let copyrightText: Box | null = null;
    if (divider !== null) {
      copyright = inkBox(
        img,
        bg,
        containerLeft - 2,
        containerRight + 2,
        divider + 3,
        img.h - 1,
        TEXT_INK,
      );
      if (copyright) {
        const parts = groups(
          colInk(img, bg, copyright.x0, copyright.x1, copyright.y0, copyright.y1 - 1, TEXT_INK),
          minGap,
        );
        const first = parts[0];
        if (first)
          copyrightTitle = inkBox(
            img,
            bg,
            first[0] + copyright.x0,
            first[1] + copyright.x0,
            copyright.y0,
            copyright.y1 - 1,
            TEXT_INK,
          );
      }
    }
    return {
      width: img.w,
      height: img.h,
      background: bg,
      titles,
      card,
      cardBackground: card ? at(img, card.x0 + 4, card.y0 + 4) : null,
      quickLinkItems,
      categoryItems,
      divider,
      contentBottom,
      copyright,
      copyrightTitle,
      copyrightText,
    };
  };

  // ---- 실행 ----
  const [refImage, implImage] = await Promise.all([
    loadImage(input.refB64),
    loadImage(input.implB64),
  ]);
  const scale = input.targetWidth / input.implWidth;

  // 참고 이미지: 필요한 영역만 잘라 낸다
  const refFull = canvasOf(refImage.naturalWidth, refImage.naturalHeight);
  refFull.ctx.drawImage(refImage, 0, 0);
  const refAll = readImg(refFull.ctx, refImage.naturalWidth, refImage.naturalHeight);

  let cropTop = 0;
  let cropHeight = Math.round(100 * scale);
  if (input.kind === 'footer') {
    const pageBg = at(refAll, 3, 3);
    // 페이지 배경과 달라진 뒤 계속 달라지는 첫 줄이 Footer 위쪽이다
    for (let y = Math.round(refAll.h * 0.5); y < refAll.h - 30; y += 1) {
      if (dist(at(refAll, 3, y), pageBg) < LINE_INK) continue;
      let stays = true;
      for (let k = 1; k <= 25; k += 1)
        if (dist(at(refAll, 3, y + k), pageBg) < LINE_INK) stays = false;
      if (stays) {
        cropTop = y;
        break;
      }
    }
    cropHeight = refAll.h - cropTop;
  }
  const refCrop = canvasOf(refAll.w, cropHeight);
  refCrop.ctx.drawImage(refImage, 0, cropTop, refAll.w, cropHeight, 0, 0, refAll.w, cropHeight);
  const refImg = readImg(refCrop.ctx, refAll.w, cropHeight);

  // 구현: 참고 이미지 폭에 맞춰 축소한다 (Navbar는 위쪽 100px만 쓴다)
  const implHeightCss = input.kind === 'navbar' ? 100 : implImage.naturalHeight;
  const reducedHeight = Math.round(implHeightCss * scale);
  const reduced = canvasOf(input.targetWidth, reducedHeight);
  reduced.ctx.drawImage(
    implImage,
    0,
    0,
    implImage.naturalWidth,
    implHeightCss,
    0,
    0,
    input.targetWidth,
    reducedHeight,
  );
  const implImg = readImg(reduced.ctx, input.targetWidth, reducedHeight);

  const measure = (img: Img) =>
    input.kind === 'navbar' ? measureNavbar(img, scale, input.theme) : measureFooter(img, scale);

  return {
    ref: measure(refImg),
    impl: measure(implImg),
    refCropB64: pngB64(refCrop.canvas),
    implReducedB64: pngB64(reduced.canvas),
  };
}
