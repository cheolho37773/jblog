import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { parseEnv } from './src/lib/env.schema';

// 설정이 로드될 때 검증해서, 환경변수가 잘못되면 `next build`가 바로 실패하게 한다.
// (server-only를 쓰는 env.ts는 설정 로드 환경에서 오류가 나므로 스키마 모듈을 쓴다.)
export default function createNextConfig(phase: string): NextConfig {
  const { server } = parseEnv(process.env);

  // 프론트엔드 §4: 로컬 개발에서만 Next가 /api/*를 백엔드로 넘긴다. 운영은 Nginx가 맡는다.
  if (phase !== PHASE_DEVELOPMENT_SERVER) return {};

  return {
    async rewrites() {
      return [{ source: '/api/:path*', destination: `${server.API_INTERNAL_URL}/api/:path*` }];
    },
  };
}
