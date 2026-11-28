import path from 'node:path';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { parseDevAllowedOrigins } from './src/lib/dev-allowed-origins';
import { parseBuildEnv } from './src/lib/env.schema';

// standalone 출력이 pnpm 워크스페이스 의존성(저장소 루트 node_modules)까지 추적하도록
// 추적 기준을 frontend/가 아닌 저장소 루트로 둔다. 기본값(frontend/)이면 루트 밖 파일이 빠진다.
const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..');

// 설정이 로드될 때 검증해서, 환경변수가 잘못되면 `next build`가 바로 실패하게 한다.
// (server-only를 쓰는 env.ts는 설정 로드 환경에서 오류가 나므로 스키마 모듈을 쓴다.)
export default function createNextConfig(phase: string): NextConfig {
  const { server } = parseBuildEnv(process.env);

  // 빌드 전용 스위치(개요 §6, 앱 런타임 설정이 아니라 env.schema에 넣지 않는다).
  // 1이면 *.dev.tsx를 페이지로 인식해 /dev/components를 빌드한다. 운영 빌드에는 그 코드가 들어가지 않는다.
  const devPages = process.env.JBLOG_DEV_PAGES === '1';

  // Docker 이미지용 최소 서버(<distDir>/standalone/**/server.js)를 만든다 (프론트엔드 §2).
  const baseConfig: NextConfig = {
    // E2E가 운영 빌드와 개발 페이지 빌드를 동시에 돌리므로 산출물이 섞이지 않게 분리한다.
    distDir: devPages ? '.next-components' : '.next',
    // 기본 확장자를 유지하고 dev.tsx만 더한다.
    pageExtensions: devPages ? ['tsx', 'ts', 'jsx', 'js', 'dev.tsx'] : ['tsx', 'ts', 'jsx', 'js'],
    output: 'standalone',
    outputFileTracingRoot: REPOSITORY_ROOT,
  };

  // 프론트엔드 §4 경로 표: 로컬 개발에서만 Next가 /api/*와 /uploads/*를 백엔드로 넘긴다.
  // 운영은 Nginx가 맡는다(/api → Nest, /uploads → 정적 파일).
  if (phase !== PHASE_DEVELOPMENT_SERVER) return baseConfig;

  // 개발 서버는 localhost가 아닌 주소(휴대폰 등)의 /_next/* 요청을 막는다. 허용 호스트는 개발 서버에만 넣고
  // 빌드·운영 설정에는 넣지 않는다. 값이 없으면 키 자체를 넣지 않아 Next 기본(localhost만)을 따른다.
  const allowedDevOrigins = parseDevAllowedOrigins(process.env.JBLOG_DEV_ALLOWED_ORIGINS);

  return {
    ...baseConfig,
    ...(allowedDevOrigins.length > 0 && { allowedDevOrigins }),
    async rewrites() {
      return [
        { source: '/api/:path*', destination: `${server.API_INTERNAL_URL}/api/:path*` },
        { source: '/uploads/:path*', destination: `${server.API_INTERNAL_URL}/uploads/:path*` },
      ];
    },
  };
}
