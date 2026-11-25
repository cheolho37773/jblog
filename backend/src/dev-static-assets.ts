import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';

// 시드 글의 커버 이미지(coverImageUrl = /uploads/seed/<파일>)가 개발 환경에서 보이게 하는 정적 서빙 (M2-03 규약 8).
// 운영에서는 Nginx가 /uploads를 맡으므로 이 라우트를 만들지 않는다(호출 측이 production을 걸러 낸다).
// 업로드 폴더 설정(UPLOAD_DIR)은 M3 미디어 작업에서 도입한다.
const SEED_UPLOAD_ROUTE = '/uploads/seed';
// src/(개발·테스트)와 dist/(빌드) 모두 backend/ 바로 아래라 같은 상대 경로로 닿는다.
const SEED_ASSETS_DIR = resolve(__dirname, '../prisma/seed-assets');

// 전역 prefix(/api)는 컨트롤러 라우트에만 붙으므로 정적 경로는 /api 밖에 놓인다.
// 폴더 밖 경로(..)와 없는 파일은 정적 미들웨어가 넘겨 일반 404로 끝난다.
export function serveSeedAssets(app: NestExpressApplication): void {
  app.useStaticAssets(SEED_ASSETS_DIR, {
    prefix: SEED_UPLOAD_ROUTE,
    // 폴더 목록·index.html·점 파일을 노출하지 않는다.
    index: false,
    dotfiles: 'ignore',
  });
}
