import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import { baseConfig } from './scripts/eslint/base-config.mjs';
import { jblogPlugin } from './scripts/eslint/plugin.mjs';

// frontend·backend 코드에만 import 경계를 적용한다 (개요 D25·D26).
const APP_SOURCE_FILES = ['frontend/**/*.{js,mjs,cjs,ts,tsx}', 'backend/**/*.{js,mjs,cjs,ts,tsx}'];

// React·Next 규칙은 frontend에만 적용한다. 브라우저 코드와 Next 설정 파일을 함께 다루므로 files로 범위를 좁힌다.
const FRONTEND_FILES = ['frontend/**/*.{js,mjs,cjs,ts,tsx}'];

// 저장소 전체의 ESLint 설정은 이 파일 하나다. Next·Nest 플러그인은 M0-04·05에서
// frontend/**·backend/** 블록으로 이 배열에 추가한다 (앱 폴더에 별도 설정을 두지 않는다).
/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    // docs/**는 코드가 아니고, fixture는 규칙 위반을 일부러 담고 있다.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.next-components/**',
      '**/coverage/**',
      '**/.turbo/**',
      // Playwright 실행 산출물(.gitignore 대상). 시각 회귀 컨테이너가 호스트로 되돌려 놓는다 (M1-05).
      '**/playwright-report/**',
      '**/test-results/**',
      'docs/**',
      'scripts/eslint/fixtures/**',
      // Prisma 생성 클라이언트. 생성물이라 검사 대상이 아니다 (.gitignore 대상).
      'backend/src/generated/**',
      // openapi-typescript 생성물. 커밋하지만 생성 형식을 유지한다 (pnpm gen:api-types).
      'frontend/src/generated/**',
    ],
  },
  ...baseConfig,
  // Next 공식 권장(core-web-vitals)과 React Hooks 권장. 가독성 규칙(baseConfig)은 그대로 둔다.
  { ...nextPlugin.configs['core-web-vitals'], files: FRONTEND_FILES },
  { ...reactHooks.configs.flat.recommended, files: FRONTEND_FILES },
  {
    // frontend/ 가 앱 루트이므로 Next 플러그인이 app/·pages/ 위치를 올바로 찾게 한다.
    files: FRONTEND_FILES,
    settings: { next: { rootDir: 'frontend' } },
  },
  {
    files: APP_SOURCE_FILES,
    plugins: { jblog: jblogPlugin },
    rules: { 'jblog/import-boundaries': 'error' },
  },
  {
    // 색은 디자인 토큰으로만 쓴다 (프론트엔드 §5.1). 테스트는 토큰 값을 검증하므로 hex를 쓴다.
    files: ['frontend/src/**/*.{ts,tsx}'],
    ignores: ['frontend/src/**/*.{spec,test}.{ts,tsx}'],
    plugins: { jblog: jblogPlugin },
    rules: { 'jblog/no-hex-color': 'error' },
  },
];
