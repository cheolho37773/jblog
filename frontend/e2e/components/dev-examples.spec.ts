import { expect, test } from '@playwright/test';

// Codex M1-03 r1 #3: /dev/components는 각 Atom의 variant·크기·상태 예제를 data-example로 빠짐없이 보여준다.
// 필수 집합은 작업 지시서 "Codex r1 대응 기준 #3". Light 1회로 충분하다.

const PAGE_PATH = '/dev/components';
const BUTTON_VARIANTS = ['primary', 'outline', 'icon', 'pillSolid', 'pillOutline'];
const BUTTON_STATES = ['default', 'hover', 'focus', 'disabled'];
const AVATAR_SIZES = [28, 40, 80];

const REQUIRED_EXAMPLES: Record<string, string[]> = {
  'dev-button': BUTTON_VARIANTS.flatMap((variant) =>
    BUTTON_STATES.map((state) => `${variant}-${state}`),
  ),
  'dev-badge': ['solid-md', 'solid-lg', 'soft-md', 'soft-lg', 'link'],
  'dev-input': ['default', 'focus', 'error', 'disabled'],
  'dev-searchinput': ['default', 'focus', 'disabled'],
  'dev-avatar': AVATAR_SIZES.flatMap((size) => [`image-${size}`, `initials-${size}`]),
  'dev-icon': ['lucide', 'simple', 'labelled'],
};

test.use({ colorScheme: 'light' });

for (const [sectionId, examples] of Object.entries(REQUIRED_EXAMPLES)) {
  test(`${sectionId}에 필수 예제 ${examples.length}개가 모두 있다`, async ({ page }) => {
    await page.goto(PAGE_PATH);
    const section = page.getByTestId(sectionId);
    await expect(section).toBeVisible();

    const present = await section
      .locator('[data-example]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-example')));
    const missing = examples.filter((example) => !present.includes(example));
    expect(missing, `${sectionId}에 없는 예제`).toEqual([]);
  });
}

test('Avatar image-* 예제는 실제 <img>가 로드 완료되어 크기를 가진다', async ({ page }) => {
  await page.goto(PAGE_PATH);

  for (const size of AVATAR_SIZES) {
    const example = page.getByTestId('dev-avatar').locator(`[data-example="image-${size}"]`);
    await expect(example, `image-${size} 예제`).toBeVisible();
    await example.scrollIntoViewIfNeeded(); // lazy 이미지가 로드되도록 화면에 보이게 한다

    await expect
      .poll(
        () =>
          example.evaluate((element) => {
            const image =
              element instanceof HTMLImageElement ? element : element.querySelector('img');
            return image !== null && image.complete && image.naturalWidth > 0;
          }),
        { message: `image-${size}의 <img> 로드` },
      )
      .toBe(true);
  }
});
