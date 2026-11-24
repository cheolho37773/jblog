// 커버 이미지 픽스처(PNG)를 만드는 스크립트다. 외부 이미지는 쓰지 않고, 색 그라디언트를 직접 그린다 (M2-E, G1 결정 3과 같은 원칙).
// 실행: node --experimental-strip-types e2e/fixtures/make-assets.ts  (frontend/에서. Node 24는 플래그 없이도 된다)
// 결과 파일(assets/*.png)은 저장소에 커밋한다. 같은 입력이면 같은 바이트가 나오므로 다시 만들어도 diff가 없다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const WIDTH = 1200;
const HEIGHT = 630;
const OUTPUT_DIR = path.join(import.meta.dirname, 'assets');

type Rgb = [number, number, number];
interface CoverSpec {
  file: string;
  from: Rgb;
  to: Rgb;
}

// 파일 이름은 픽스처 서버의 coverImageUrl(`/uploads/fixtures/<file>`)과 맞춘다.
const COVERS: CoverSpec[] = [
  { file: 'cover-indigo.png', from: [75, 107, 251], to: [30, 41, 120] },
  { file: 'cover-emerald.png', from: [52, 211, 153], to: [6, 78, 59] },
  { file: 'cover-amber.png', from: [251, 191, 36], to: [120, 53, 15] },
  { file: 'cover-rose.png', from: [251, 113, 133], to: [136, 19, 55] },
  { file: 'cover-slate.png', from: [148, 163, 184], to: [15, 23, 42] },
  { file: 'cover-solid.png', from: [99, 102, 241], to: [99, 102, 241] },
];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, payload: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

// 대각선 방향 그라디언트. 각 행 맨 앞의 0은 PNG 필터 없음(None) 표시다.
function pixelRows({ from, to }: CoverSpec): Buffer {
  const rowBytes = 1 + WIDTH * 3;
  const raw = Buffer.alloc(rowBytes * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const t = (x / WIDTH + y / HEIGHT) / 2;
      const offset = y * rowBytes + 1 + x * 3;
      raw[offset] = mix(from[0], to[0], t);
      raw[offset + 1] = mix(from[1], to[1], t);
      raw[offset + 2] = mix(from[2], to[2], t);
    }
  }
  return raw;
}

function encodePng(spec: CoverSpec): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8비트, 트루컬러(RGB), 기본 압축·필터·비인터레이스
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const compressed = zlib.deflateSync(pixelRows(spec), { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
for (const spec of COVERS) {
  fs.writeFileSync(path.join(OUTPUT_DIR, spec.file), encodePng(spec));
}
