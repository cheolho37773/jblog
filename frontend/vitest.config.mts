import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// frontend/.env*는 읽지 않는다: 테스트가 필요한 환경값은 테스트 코드에서 더미 값으로 넣는다.
// e2e 폴더(Playwright)는 포함하지 않는다.
export default defineConfig({
  // Vite는 기본으로 프로젝트 루트의 .env*를 읽는다. 개발자 PC의 frontend/.env.local이
  // 테스트에 섞이지 않도록 환경 파일 로드를 끈다(false: 지원 확인, vite index.d.ts).
  envDir: false,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}', 'test/**/*.spec.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
    // 테스트가 아직 없는 단계에서도 `pnpm test`가 실패하지 않게 한다.
    passWithNoTests: true,
    clearMocks: true,
  },
});
