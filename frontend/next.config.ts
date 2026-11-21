import path from 'node:path';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { parseEnv } from './src/lib/env.schema';

// standalone 출력이 pnpm 워크스페이스 의존성(저장소 루트 node_modules)까지 추적하도록
// 추적 기준을 frontend/가 아닌 저장소 루트로 둔다. 기본값(frontend/)이면 루트 밖 파일이 빠진다.
const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..');

// 설정이 로드될 때 검증해서, 환경변수가 잘못되면 `next build`가 바로 실패하게 한다.
// (server-only를 쓰는 env.ts는 설정 로드 환경에서 오류가 나므로 스키마 모듈을 쓴다.)
export default function createNextConfig(phase: string): NextConfig {
  const { server } = parseEnv(process.env);

  // Docker 이미지용 최소 서버(.next/standalone/**/server.js)를 만든다 (프론트엔드 §2).
  const baseConfig: NextConfig = {
    output: 'standalone',
    outputFileTracingRoot: REPOSITORY_ROOT,
  };

  // 프론트엔드 §4: 로컬 개발에서만 Next가 /api/*를 백엔드로 넘긴다. 운영은 Nginx가 맡는다.
  if (phase !== PHASE_DEVELOPMENT_SERVER) return baseConfig;

  return {
    ...baseConfig,
    async rewrites() {
      return [{ source: '/api/:path*', destination: `${server.API_INTERNAL_URL}/api/:path*` }];
    },
  };
}
