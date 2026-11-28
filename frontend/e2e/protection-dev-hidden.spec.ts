import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// M2-10: /dev/protection도 운영(prod) 빌드에 없어야 한다(기존 /dev/* 규칙). 페이지 마커는 data-testid 문자열이다.
const MARKER = 'protection-contact-email';

test('운영 빌드에서 /dev/protection은 404이다', async ({ request, page }) => {
  expect((await request.get('/dev/protection')).status()).toBe(404);
  expect((await page.goto('/dev/protection'))?.status()).toBe(404);
});

test(`운영 빌드 산출물에 dev 페이지 마커 ${MARKER}가 없다`, () => {
  const root = path.resolve('.next');
  const files = (fs.readdirSync(root, { recursive: true }) as string[])
    .filter((f) => f.startsWith('static') || f.startsWith('server'))
    .map((f) => path.join(root, f))
    .filter((f) => fs.statSync(f).isFile() && /\.(js|html|rsc|json|txt)$/.test(f));
  expect(files.length).toBeGreaterThan(0);
  expect(files.filter((f) => fs.readFileSync(f, 'utf8').includes(MARKER))).toEqual([]);
});
