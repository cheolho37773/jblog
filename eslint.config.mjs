import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import { baseConfig } from './scripts/eslint/base-config.mjs';
import { importBoundariesPlugin } from './scripts/eslint/import-boundaries.mjs';

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
      '**/coverage/**',
      '**/.turbo/**',
      'docs/**',
      'scripts/eslint/fixtures/**',
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
    plugins: { jblog: importBoundariesPlugin },
    rules: { 'jblog/import-boundaries': 'error' },
  },
];
