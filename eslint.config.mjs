import { baseConfig } from './scripts/eslint/base-config.mjs';

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
];
