/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // scope에 WBS ID(M0-02, BE-03)를 쓰므로 소문자 강제를 끈다 (협업 §5.4).
    'scope-case': [0],
    // 본문·trailer(Co-Authored-By 등)는 길어질 수 있어 경고로만 둔다.
    'body-max-line-length': [1, 'always', 100],
    'footer-max-line-length': [1, 'always', 100],
  },
};
