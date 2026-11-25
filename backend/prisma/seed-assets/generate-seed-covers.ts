// 시드 글 커버 PNG를 만든다(M2-03 규약 8). 외부 이미지 없이 대각선 그라디언트만 직접 그린다.
// 실행: backend/에서 `pnpm exec tsx prisma/seed-assets/generate-seed-covers.ts`
// 결과 파일은 커밋하므로 평소에는 다시 돌릴 필요가 없다. 색을 바꿀 때만 실행한다.
import { crc32, deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WIDTH = 1200;
const HEIGHT = 630;
const BYTES_PER_PIXEL = 3; // RGB, 알파 없음
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COLOR_TYPE_RGB = 2;
const BIT_DEPTH = 8;
const FILTER_NONE = 0;

type Rgb = readonly [number, number, number];

// 파일 이름은 seed-content.ts의 SEED_COVER_FILES와 같아야 한다.
const COVERS: ReadonlyArray<{ file: string; from: Rgb; to: Rgb }> = [
  { file: 'cover-indigo.png', from: [67, 56, 202], to: [168, 85, 247] },
  { file: 'cover-teal.png', from: [13, 148, 136], to: [56, 189, 248] },
  { file: 'cover-rose.png', from: [225, 29, 72], to: [251, 146, 60] },
  { file: 'cover-slate.png', from: [51, 65, 85], to: [148, 163, 184] },
];

function chunk(type: string, payload: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

function mix(from: number, to: number, ratio: number): number {
  return Math.round(from + (to - from) * ratio);
}

// 각 행 앞에 필터 종류 1바이트(0 = 필터 없음)를 붙인다.
function gradientPixels(from: Rgb, to: Rgb): Buffer {
  const rowLength = 1 + WIDTH * BYTES_PER_PIXEL;
  const pixels = Buffer.alloc(rowLength * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    const rowStart = y * rowLength;
    pixels[rowStart] = FILTER_NONE;
    for (let x = 0; x < WIDTH; x++) {
      const ratio = (x / (WIDTH - 1) + y / (HEIGHT - 1)) / 2; // 왼쪽 위 → 오른쪽 아래
      const offset = rowStart + 1 + x * BYTES_PER_PIXEL;
      pixels[offset] = mix(from[0], to[0], ratio);
      pixels[offset + 1] = mix(from[1], to[1], ratio);
      pixels[offset + 2] = mix(from[2], to[2], ratio);
    }
  }
  return pixels;
}

function encodePng(from: Rgb, to: Rgb): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = BIT_DEPTH;
  header[9] = COLOR_TYPE_RGB;
  // 압축·필터·인터레이스 방식은 0(표준)이다.
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(gradientPixels(from, to), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const cover of COVERS) {
  writeFileSync(resolve(__dirname, cover.file), encodePng(cover.from, cover.to));
}
