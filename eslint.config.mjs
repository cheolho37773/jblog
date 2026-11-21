import { baseConfig, defineIgnores } from '@jblog/eslint-config';

export default [
  // docs/**는 코드가 아니고, fixture는 규칙 위반을 일부러 담고 있다.
  defineIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**',
    '**/.turbo/**',
    'docs/**',
    'packages/eslint-config/test/fixtures/**',
  ]),
  ...baseConfig,
];
